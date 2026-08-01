"""
deal_scorer.py — Multi-signal deal scoring pipeline for the vinyl tracker.

METHODOLOGY
===========
This module replaces the naive single-average deal detection with a
multi-window, tiered scoring system inspired by CamelCamelCamel and Keepa.

PRICE BENCHMARKS (CamelCamelCamel approach)
--------------------------------------------
Four reference prices are computed per product from HistoricoPreco:

  avg_30d      — 30-day rolling average (primary signal).
                 Adaptive: if < 30 days of history exists, uses all available
                 data as the reference window to avoid spurious "deals" caused
                 by incomplete windows.

  avg_90d      — 90-day rolling average (confirmation signal).
                 Used to verify the current price is not just recovering from
                 a recent spike. Skipped when confidence < high_confidence
                 (fewer than 168 data points).

  low_30d      — Lowest price in the last 30 days (proximity anchor).
                 Key insight from Keepa: "below average" alone is insufficient
                 because it fires on any price after a spike. The price must
                 actually be near the recorded floor to qualify for Tier 3.

  low_all_time — Lowest price ever recorded (all-time reference anchor).
                 Stored for display and future trend analysis.

DEAL SCORING TIERS (Keepa approach) — pt-BR display labels
-----------------------------------------------------------
Scores are assigned 1–3 (stored as deal_score on Disco):

Each tier is a STRICT SUPERSET of the one below it, so a higher badge is
always harder to earn than a lower one:

  Score 1 (DEAL_TIER_GOOD)  — "Boa Oferta"
    Baseline deal: current price is ≥ DEAL_THRESHOLD_PCT below avg_30d
    and the absolute drop is ≥ MIN_ABSOLUTE_DROP.

  Score 2 (DEAL_TIER_GREAT) — "Ótima Oferta"
    Tier 1 AND below avg_90d, confirming the price is genuinely low vs. the
    longer trend, not a correction from a temporary spike.
    Requires moderate_confidence or better.

  Score 3 (DEAL_TIER_BEST)  — "Melhor Preço"
    Tier 2 AND current price at or below low_all_time — the lowest price we
    have ever recorded for this product. No proximity margin: it must match
    or beat the record outright.
    Requires high_confidence.

    The disco page prints "o menor preço registrado foi R$X, em <date>"
    directly under the badge, so any margin here would let the badge
    contradict the number beside it. Keep this exact.

    low_all_time is the low across OUR history, which begins 2026-04-14 —
    it is not an all-time-ever low. Display copy must say "menor preço desde
    que começamos a acompanhar", never "de todos os tempos".

DUAL-GATE THRESHOLD
--------------------
Both gates must pass before any score is assigned:
  a) Percentage drop ≥ DEAL_THRESHOLD_PCT  (default: 10% below avg_30d)
  b) Absolute drop   ≥ MIN_ABSOLUTE_DROP   (default: R$2.00)

Gate (b) prevents flagging nominal discounts on low-price items
("R$0,30 de desconto num produto de R$3" would fail the absolute gate).

ADAPTIVE CONFIDENCE TIERS
--------------------------
Designed to work with sparse early-operation data. As history accumulates,
products naturally graduate to higher tiers with no code changes needed:

Thresholds combine tracked days with event count (see _confidence_level), so a
product priced steadily for 45 days counts as well-covered even with few
distinct price events:

  < MIN_HISTORY_POINTS events, or < 1 day  → insufficient_data  not scored
  < 14 days   or < 10 events              → low_confidence      max Tier 1
  < 45 days   or < 30 events              → moderate_confidence max Tier 2
  45+ days   and 30+ events               → high_confidence     all tiers

COOLDOWN / DEDUPLICATION
-------------------------
Once flagged, a product is not re-flagged for DEAL_COOLDOWN_HOURS (default 6h).
This prevents the same product from appearing as a "new deal" every hour it
stays at a low price. Exception: if the price drops a further EARLY_REFLAG_DROP
(default 5%) below the last flagged price, an early re-flag is permitted
(a bigger deal supersedes the old notification).
"""
import logging
from datetime import datetime, timezone, timedelta

import psycopg2.extras

log = logging.getLogger(__name__)

# ── Configurable constants (all in one place) ─────────────────────────────────
DEAL_THRESHOLD_PCT    = 0.10   # 10% below average to qualify
MIN_ABSOLUTE_DROP     = 2.00   # minimum R$2 absolute price drop
DEAL_COOLDOWN_HOURS   = 6      # hours before re-flagging the same product
MIN_HISTORY_POINTS    = 3      # minimum recorded price events to attempt scoring
ROLLING_WINDOW_SHORT  = 30     # days for primary average (avg_30d)
ROLLING_WINDOW_LONG   = 90     # days for secondary average (avg_90d)
LOW_PROXIMITY_MARGIN  = 0.02   # within 2% of low_30d: overrides the re-flag cooldown
EARLY_REFLAG_DROP     = 0.05   # 5% further drop overrides cooldown

# Prices below this threshold are excluded from all benchmark calculations and
# deal scoring. Must be kept in sync with MIN_PRICE_BRL in main.py.
# Without this filter, old sub-threshold records in HistoricoPreco (from before
# the threshold was raised) cause phantom deals at prices like R$20.
MIN_DEAL_PRICE_BRL    = 30.0

# Clear an active deal if no qualifying price record has been written within
# this window. Catches products where Phase 0 is repeatedly CAPTCHA-blocked:
# the stale R$205 price persists in HistoricoPreco while Amazon's real price
# has moved to R$300, and the deal badge would otherwise hang indefinitely.
STALE_DEAL_HOURS      = 48

# Deal tier backend identifiers (stored as deal_score in DB)
DEAL_TIER_GOOD  = 1  # pt-BR: "Boa Oferta"
DEAL_TIER_GREAT = 2  # pt-BR: "Ótima Oferta"
DEAL_TIER_BEST  = 3  # pt-BR: "Melhor Preço"

# Confidence level backend identifiers (stored as confidence_level in DB)
CONFIDENCE_INSUFFICIENT = "insufficient_data"
CONFIDENCE_LOW          = "low_confidence"
CONFIDENCE_MODERATE     = "moderate_confidence"
CONFIDENCE_HIGH         = "high_confidence"

# pt-BR display labels — read by the frontend to render trust indicators
DEAL_TIER_LABELS = {
    DEAL_TIER_GOOD:  "Boa Oferta",
    DEAL_TIER_GREAT: "Ótima Oferta",
    DEAL_TIER_BEST:  "Melhor Preço",
}

CONFIDENCE_LABELS = {
    CONFIDENCE_INSUFFICIENT: "Dados insuficientes",
    CONFIDENCE_LOW:          "⚠️ Poucos dados disponíveis",
    CONFIDENCE_MODERATE:     "Confiança moderada",
    CONFIDENCE_HIGH:         "Alta confiança",
}


def _confidence_tier(total_points: int, history_days: int) -> str:
    """
    Map price history coverage to a confidence tier.

    Uses history_days (days since first recorded price) as the primary signal
    and total_points (number of recorded price events) as a secondary gate.
    This correctly handles stable-priced products: a vinyl that stayed at R$320
    for 45 days has solid coverage even if it only has a handful of data points.
    """
    if total_points < MIN_HISTORY_POINTS or history_days < 1:
        return CONFIDENCE_INSUFFICIENT   # brand new or no data
    if history_days < 14 or total_points < 10:
        return CONFIDENCE_LOW            # < 2 weeks tracked — max Tier 1
    if history_days < 45 or total_points < 30:
        return CONFIDENCE_MODERATE       # 2 weeks–45 days — Tier 1 or 3
    return CONFIDENCE_HIGH               # 45+ days with 30+ events — all tiers


def _compute_raw_score(
    current_price: float,
    avg_30d: float,
    avg_90d: float | None,
    low_all_time: float | None,
    confidence: str,
) -> int | None:
    """
    Compute a deal score without cooldown or state checks.

    Returns a DEAL_TIER_* constant (1–3) or None when no deal qualifies.

    Score escalation logic — each tier is a STRICT SUPERSET of the one below,
    so a higher badge is always harder to earn:
      DEAL_TIER_GOOD  (1): dual-gate threshold met vs avg_30d
      DEAL_TIER_GREAT (2): Tier 1 AND below avg_90d          [moderate+ confidence]
      DEAL_TIER_BEST  (3): Tier 2 AND at/below low_all_time  [high confidence]

    This replaces an earlier arrangement where Tier 3 short-circuited Tier 2 and
    was anchored on low_30d. Two things were wrong with it:

      1. Tier 3 needed only moderate confidence while Tier 2 needed high, so the
         "best" badge was EASIER to earn than the middle one. Measured live:
         "Melhor Preço" was on 567 of 709 badged records (79%) while "Ótima
         Oferta" was on 104, and 64 records held Tier 3 at a confidence level
         that could never reach Tier 2.

      2. Anchoring on low_30d meant the badge fired on a 30-day floor while the
         label (and the on-page FAQ line "o menor preço registrado foi R$X")
         speak about the recorded low. 27% of Tier 3 records sat more than 5%
         above their true recorded low, and 11% more than 20% above — the badge
         contradicted the price graph directly beneath it.

    Tier 3 now requires the price to match or beat low_all_time outright (no
    proximity margin), so the badge and the chart can never disagree.

    NOTE: low_all_time is the lowest price *we have recorded*, and the price
    history only starts 2026-04-14. Copy must therefore say "menor preço desde
    que começamos a acompanhar", never "de todos os tempos". The claim
    strengthens on its own as history accumulates, with no code change.
    """
    if confidence == CONFIDENCE_INSUFFICIENT:
        return None

    if avg_30d <= 0:
        return None

    # Dual-gate: both percentage AND absolute drop must qualify
    pct_drop = (avg_30d - current_price) / avg_30d
    abs_drop = avg_30d - current_price

    if pct_drop < DEAL_THRESHOLD_PCT or abs_drop < MIN_ABSOLUTE_DROP:
        return None

    score = DEAL_TIER_GOOD  # 1 — baseline qualifying tier

    # Escalate to Tier 2: confirmation via 90-day average. Moderate confidence
    # is enough — the 90-day comparison is the check that carries the meaning
    # here, and requiring high confidence is what forced the old inversion.
    if (
        confidence in (CONFIDENCE_MODERATE, CONFIDENCE_HIGH)
        and avg_90d is not None
        and current_price < avg_90d
    ):
        score = DEAL_TIER_GREAT  # 2

    # Escalate to Tier 3: at or below the lowest price ever recorded. Gated on
    # having reached Tier 2 first so the ladder stays monotonic.
    if (
        score == DEAL_TIER_GREAT
        and confidence == CONFIDENCE_HIGH
        and low_all_time is not None
        and low_all_time > 0
        and current_price <= low_all_time
    ):
        score = DEAL_TIER_BEST  # 3

    return score


# Scoring passes abandoned to a statement timeout in this process.
# A timeout must never pass silently: deal scores simply stop updating while the
# crawl still reports success, which is invisible until the site goes stale.
# main() reads this at the very end of the run and exits non-zero, so the
# workflow's failure step opens a GitHub issue — after all crawled data has been
# committed and published, so the visibility costs nothing.
TIMED_OUT_PASSES = 0


def score_deals(conn) -> dict:
    """
    Compute deal scores for all products with sufficient price history
    and persist the results to the Disco table.

    Algorithm:
      1. Single SQL query fetches rolling benchmarks for all products.
      2. Python applies scoring rules and cooldown logic per product.
      3. Two batch UPDATEs write results back to Disco:
           a. All products: deal_score + benchmark stats + confidence metadata.
           b. Newly-flagged products only: last_flagged_at + last_flagged_price.

    Returns a summary dict: {total, scored, flagged, cleared, skipped}
    """
    global TIMED_OUT_PASSES

    _EMPTY = {
        "total": 0, "scored": 0, "flagged": 0,
        "cleared": 0, "skipped": 0, "stale_cleared": 0, "orphans_cleared": 0,
    }

    # If a scoring pass already timed out this process, the benchmark query is too
    # slow for the current HistoricoPreco size and the table does not shrink within
    # a run — every later pass (Phase 3.5, in-loop refreshes) would just burn
    # another full statement_timeout to the same result. Skip them: the run is
    # already destined to be marked failed, and the reclaimed minutes go back to
    # the crawl instead of three dead 10-minute scans.
    if TIMED_OUT_PASSES > 0:
        log.warning(
            "score_deals: a prior pass timed out this run — skipping "
            "(deal scores stay stale until the benchmark query is faster)."
        )
        return _EMPTY

    now = datetime.now(timezone.utc)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Concurrency guard: if another score_deals call is already running
        # (e.g. main crawler and stale-only crawler overlapping), skip this
        # invocation rather than stacking two full HistoricoPreco scans.
        # pg_try_advisory_xact_lock is transaction-scoped — released automatically
        # at conn.commit() / conn.rollback(), compatible with PgBouncer transaction mode.
        cur.execute("SELECT pg_try_advisory_xact_lock(9876543210) AS got_lock")
        if not cur.fetchone()["got_lock"]:
            log.warning("score_deals: another instance running — skipping this call")
            conn.rollback()
            return _EMPTY

        # Cap the read at 10 minutes — enough for any realistic HistoricoPreco size.
        # The unlimited timeout (0) that was here before caused a 32-min runaway scan
        # when two crawler instances overlapped.  Write batch below keeps timeout=0
        # because batch UPDATEs are safe to let run to completion.
        cur.execute("SET LOCAL statement_timeout = '10min'")
        # Single query: compute all rolling benchmarks and fetch current deal state.
        # avg_30d is adaptive — falls back to all-time average when < 30 days of data.
        #
        # Both CTEs filter h."precoBrl" >= MIN_DEAL_PRICE_BRL so that old sub-threshold
        # records (inserted before the price floor was raised) never pollute benchmark
        # averages or appear as the "current price".  Products whose entire price history
        # is below the threshold are absent from the join and won't receive a deal score.
        try:
            cur.execute(
                """
            WITH stats AS (
                SELECT
                    h."discoId",
                    COUNT(*)                                           AS total_points,
                    -- GREATEST(1, ...) prevents history_days=0 when all recorded
                    -- prices share the same timestamp (e.g. batch import or same-run
                    -- multi-insert).  Any product with at least one price is treated
                    -- as having 1 day of history so it isn't silently excluded.
                    GREATEST(1,
                        CEIL(
                            EXTRACT(EPOCH FROM
                                (MAX(h."capturadoEm") - MIN(h."capturadoEm"))
                            ) / 86400.0
                        )
                    )::INTEGER                                         AS history_days,
                    MIN(h."precoBrl")::float                           AS low_all_time,
                    AVG(h."precoBrl")::float                           AS avg_all_time,
                    AVG(
                        CASE WHEN h."capturadoEm" >= NOW() - INTERVAL '30 days'
                             THEN h."precoBrl" END
                    )::float                                           AS avg_30d_strict,
                    MIN(
                        CASE WHEN h."capturadoEm" >= NOW() - INTERVAL '30 days'
                             THEN h."precoBrl" END
                    )::float                                           AS low_30d,
                    AVG(
                        CASE WHEN h."capturadoEm" >= NOW() - INTERVAL '90 days'
                             THEN h."precoBrl" END
                    )::float                                           AS avg_90d
                FROM "HistoricoPreco" h
                WHERE h."precoBrl" >= %s
                GROUP BY h."discoId"
            )
            SELECT
                d.id,
                d.asin,
                d.deal_score,
                d.last_flagged_at,
                d.last_flagged_price::float    AS last_flagged_price,
                l.current_price,
                l.latest_captured_at,
                s.total_points::integer        AS total_points,
                s.history_days,
                s.low_all_time,
                s.low_30d,
                s.avg_90d,
                -- Adaptive avg_30d: prefer the 30-day strict window; fall back to
                -- all-time average when avg_30d_strict is NULL.  This handles two
                -- cases cleanly:
                --   a) history_days < 30 → avg_30d_strict may be non-NULL (prices
                --      were recorded recently but not yet 30 days ago); COALESCE
                --      returns it directly, which is the correct reference price.
                --   b) history_days >= 30 but no prices in the last 30 days (stale
                --      product, e.g. unavailable for a month) → avg_30d_strict is
                --      NULL; fall back to avg_all_time so scoring still runs rather
                --      than converting NULL → 0.0 and silently skipping the product.
                COALESCE(s.avg_30d_strict, s.avg_all_time) AS avg_30d
            FROM "Disco" d
            INNER JOIN stats s ON s."discoId" = d.id
            -- LATERAL replaces the old `latest` CTE: fetches the most-recent
            -- qualifying price per Disco row using the FK index on "discoId"
            -- instead of a second full sequential scan of HistoricoPreco.
            JOIN LATERAL (
                SELECT
                    "precoBrl"::float AS current_price,
                    "capturadoEm"     AS latest_captured_at
                FROM "HistoricoPreco"
                WHERE "discoId" = d.id
                  AND "precoBrl" >= %s
                ORDER BY "capturadoEm" DESC
                LIMIT 1
            ) l ON TRUE
                """,
                (MIN_DEAL_PRICE_BRL, MIN_DEAL_PRICE_BRL),
            )
            products = cur.fetchall()
        except psycopg2.errors.QueryCanceled:
            # The benchmark aggregate exceeded its timeout.  Deal scoring is
            # best-effort and re-runs later in this crawl and on the next one, so
            # a slow read must not abort the run — everything crawled up to here
            # is already committed.  The run is still marked failed at the end
            # (see TIMED_OUT_PASSES) so this surfaces instead of rotting quietly.
            TIMED_OUT_PASSES += 1
            log.error(
                "score_deals: benchmark query exceeded the statement timeout — "
                "skipping this scoring pass. Deal scores are now STALE; the crawl "
                "continues and the run will be marked failed at the end."
            )
            conn.rollback()
            return _EMPTY

    log.info("score_deals: evaluating %d products", len(products))

    all_updates  = []   # (deal_score, avg_30d, avg_90d, low_30d, low_all_time,
    #                       confidence_level, history_days, disco_id)
    flag_updates = []   # (last_flagged_at, last_flagged_price, disco_id)
    #                      — only for products transitioning NULL → non-NULL

    total = scored = flagged = cleared = skipped = 0
    stale_clear_updates = []  # (last_flagged_at, disco_id) — stale deal clears
    orphan_count = 0

    for p in products:
        total += 1
        disco_id           = str(p["id"])
        current_price      = float(p["current_price"])
        avg_30d            = float(p["avg_30d"]) if p["avg_30d"] is not None else 0.0
        avg_90d            = float(p["avg_90d"]) if p["avg_90d"] is not None else None
        low_30d            = float(p["low_30d"]) if p["low_30d"] is not None else None
        low_all_time       = float(p["low_all_time"]) if p["low_all_time"] is not None else None
        total_points       = int(p["total_points"])
        history_days       = int(p["history_days"]) if p["history_days"] is not None else 0
        current_db_score   = p["deal_score"]         # existing value in Disco (None or int)
        last_flagged_at    = p["last_flagged_at"]    # datetime or None
        last_flagged_price = (
            float(p["last_flagged_price"]) if p["last_flagged_price"] is not None else None
        )

        confidence = _confidence_tier(total_points, history_days)
        raw_score  = _compute_raw_score(current_price, avg_30d, avg_90d, low_all_time, confidence)

        # Apply cooldown only when transitioning NULL → non-NULL (new deal detection).
        # If a product is already flagged (deal_score != NULL), we update its score
        # without cooldown — the deal is ongoing, not a new event.
        effective_score = raw_score
        if raw_score is not None and current_db_score is None:
            if last_flagged_at is not None:
                cooldown_expires = last_flagged_at + timedelta(hours=DEAL_COOLDOWN_HOURS)
                if now < cooldown_expires:
                    # Within cooldown — allow early re-flag on further significant drop
                    # OR when price is at the 30-day floor (Phase 0 deal_cleared after
                    # a parse failure can wipe a valid floor-level deal; re-flag immediately).
                    allow_early = False
                    if last_flagged_price is not None and last_flagged_price > 0:
                        further_drop = (last_flagged_price - current_price) / last_flagged_price
                        allow_early = further_drop >= EARLY_REFLAG_DROP
                    if not allow_early and low_30d is not None and low_30d > 0:
                        allow_early = current_price <= low_30d * (1.0 + LOW_PROXIMITY_MARGIN)
                    if not allow_early:
                        effective_score = None
                        skipped += 1
                        log.debug(
                            "Cooldown active for %s (expires %s) — skipping re-flag",
                            p["asin"], cooldown_expires.isoformat(),
                        )

        # Staleness check: clear an active deal badge if the most recent qualifying
        # price record is older than STALE_DEAL_HOURS. Catches CAPTCHA-blocked products
        # where the crawler can't write a fresh price (e.g. Phase 0 repeatedly blocked).
        latest_captured_at = p.get("latest_captured_at")
        if latest_captured_at is not None and getattr(latest_captured_at, "tzinfo", None) is None:
            latest_captured_at = latest_captured_at.replace(tzinfo=timezone.utc)
        if (
            current_db_score is not None
            and latest_captured_at is not None
            and (now - latest_captured_at).total_seconds() > STALE_DEAL_HOURS * 3600
        ):
            stale_hours = (now - latest_captured_at).total_seconds() / 3600
            log.warning(
                "Stale deal cleared: %s — price unconfirmed for %.0fh (threshold %dh)",
                p["asin"], stale_hours, STALE_DEAL_HOURS,
            )
            effective_score = None
            stale_clear_updates.append((now, disco_id))

        new_score = effective_score

        # Track state transitions for logging and flag_updates
        if new_score is not None and current_db_score is None:
            # Transition: no deal → deal (newly flagged)
            flag_updates.append((now, current_price, disco_id))
            flagged += 1
            log.debug(
                "New deal flagged: %s  score=%d  confidence=%s  price=%.2f  avg_30d=%.2f",
                p["asin"], new_score, confidence, current_price, avg_30d,
            )
        elif new_score is None and current_db_score is not None:
            # Transition: deal → no deal (deal cleared)
            cleared += 1
        elif new_score is not None:
            # Steady state: deal score maintained or updated
            scored += 1

        all_updates.append((
            new_score,
            avg_30d if avg_30d > 0 else None,
            avg_90d,
            low_30d,
            low_all_time,
            confidence,
            history_days,
            disco_id,
        ))

    # Batch write 1: update benchmark stats + deal_score for all products
    with conn.cursor() as cur:
        cur.execute("SET LOCAL statement_timeout = 0")
        psycopg2.extras.execute_batch(
            cur,
            """
            UPDATE "Disco"
            SET
                deal_score       = %s,
                avg_30d          = %s,
                avg_90d          = %s,
                low_30d          = %s,
                low_all_time     = %s,
                confidence_level = %s,
                history_days     = %s
            WHERE id = %s
            """,
            all_updates,
            page_size=500,
        )

        # Batch write 2: stamp last_flagged_at on newly flagged products only
        if flag_updates:
            psycopg2.extras.execute_batch(
                cur,
                """
                UPDATE "Disco"
                SET last_flagged_at    = %s,
                    last_flagged_price = %s
                WHERE id = %s
                """,
                flag_updates,
                page_size=500,
            )

        # Batch write 3: stamp last_flagged_at on stale-cleared products so the
        # 6h cooldown prevents them from being immediately re-flagged on the next run.
        if stale_clear_updates:
            psycopg2.extras.execute_batch(
                cur,
                """
                UPDATE "Disco"
                SET last_flagged_at = %s
                WHERE id = %s
                """,
                stale_clear_updates,
                page_size=500,
            )

        # Orphan cleanup: products whose entire price history is sub-threshold are
        # absent from the main INNER JOIN so Batch write 1 never touches them.
        # Clear their deal badge explicitly so phantom deals can't linger.
        cur.execute(
            """
            UPDATE "Disco" d
            SET deal_score      = NULL,
                last_flagged_at = NOW()
            WHERE deal_score IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "HistoricoPreco" hp
                WHERE hp."discoId" = d.id
                  AND hp."precoBrl" >= %s
              )
            """,
            (MIN_DEAL_PRICE_BRL,),
        )
        orphan_count = cur.rowcount
        if orphan_count:
            log.warning(
                "Orphan deal cleanup: cleared %d products with no qualifying price history",
                orphan_count,
            )

    conn.commit()

    summary = {
        "total":           total,
        "scored":          scored,
        "flagged":         flagged,
        "cleared":         cleared,
        "skipped":         skipped,
        "stale_cleared":   len(stale_clear_updates),
        "orphans_cleared": orphan_count,
    }
    log.info(
        "score_deals done — total=%d | newly_flagged=%d | maintained=%d"
        " | cleared=%d (stale=%d) | orphans=%d | cooldown_skipped=%d",
        total, flagged, scored, cleared, len(stale_clear_updates), orphan_count, skipped,
    )
    return summary

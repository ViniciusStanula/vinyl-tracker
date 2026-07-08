"""
crawl_tiering.py — Popularity-weighted crawl-frequency scheduling.

Assigns each Amazon-vinyl Disco record a priority tier (S/A/B/C/F) derived from
Last.fm reach, so the background scheduled crawler refreshes popular records more
often and obscure ones less often. The tier drives a per-record freshness interval
consumed by database.fetch_stale_records.

Design decisions (see the Phase 1 audit + amendment):

  - Score source is COALESCE(album lastfm_listeners, artist MAX lastfm_listeners).
    Album value first; a NULL/0-album record by a known artist inherits the
    artist's peak reach. This lifts usable coverage from 63% to ~81% and halves
    the no-signal (F) bucket.

  - Intervals are derived from OBSERVED 30-day price volatility, not round guesses.
    Even the most popular band changes price only ~every 2.4 days on average, so
    sub-8h cadences oversample and blow the Creators API day cap (CREATORS_TPD).
    They are also sized so the projected NET daily API count (gross minus what the
    free category sweep already absorbs) stays under CREATORS_TPD with the budget
    guard inactive under normal load. See projection_report().

  - S (fastest) is reserved for money-committed demand: records with a confirmed
    price alert, plus the top ~1% by score. Popularity moves the bulk between A/B/C.

  - The score/tier is materialised weekly (Last.fm reach moves slowly). The
    freshness interval itself is computed in-query from the stored tier, so the
    free category sweep bumping last_crawled_at out of band never leaves a stale
    next_crawl_at behind.

Rule Zero is untouched: active deals bypass the tier floor entirely and are
re-validated every run by Phase 0. This module only reorders the Phase 3 backlog.
"""
from __future__ import annotations

import logging

from database import _cursor

log = logging.getLogger(__name__)

# ── Tiers ────────────────────────────────────────────────────────────────
TIER_S, TIER_A, TIER_B, TIER_C, TIER_F = 0, 1, 2, 3, 4
TIER_NAMES = {0: "S", 1: "A", 2: "B", 3: "C", 4: "F"}

# Per-tier freshness interval in HOURS. Single source of truth: the selection
# query builds its SQL CASE from this map (tier_interval_case_sql), and the
# projection report reads it too. Change cadence here only.
TIER_INTERVAL_HOURS = {
    TIER_S: 8,    # alerts + top ~1% by score
    TIER_A: 24,   # high reach   (>= p90 listeners)
    TIER_B: 36,   # mid reach    (>= median listeners)
    TIER_C: 48,   # low reach    (has listeners, below median)
    TIER_F: 72,   # no usable signal / unidentified artist
}
# Records not yet scored (crawl_tier IS NULL) fall back to the old ~12h baseline.
_UNSCORED_INTERVAL_HOURS = 12

# Popularity thresholds — measured percentiles of lastfm_listeners > 0 on the
# live catalog (2026-07-08): median 17,097, p90 531k.
_A_FLOOR = 531_000   # >= this → A
_B_FLOOR = 17_097    # >= this → B ; (0, this) → C ; 0 → F


def ensure_tier_columns(conn) -> None:
    """
    Idempotently add the tiering columns + index. Kept separate from
    ensure_schema_extras so its fast-path column count stays undisturbed.

    Disco.crawl_tier           SMALLINT     0=S .. 4=F (NULL = not yet scored)
    Disco.popularity_score     REAL         log10(effective_listeners + 1)
    Disco.popularity_scored_at TIMESTAMPTZ  last rescore time (weekly cadence)
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'Disco'
              AND column_name IN ('crawl_tier', 'popularity_score', 'popularity_scored_at')
            """
        )
        if cur.fetchone()[0] == 3:
            log.debug("ensure_tier_columns: columns already present, skipping DDL.")
            return
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute(
            """
            ALTER TABLE "Disco"
                ADD COLUMN IF NOT EXISTS crawl_tier           SMALLINT,
                ADD COLUMN IF NOT EXISTS popularity_score     REAL,
                ADD COLUMN IF NOT EXISTS popularity_scored_at TIMESTAMPTZ
            """
        )
        # Selection query filters WHERE disponivel/marketplace and orders by
        # (deal-priority, crawl_tier, last_crawled_at). This partial index serves
        # the tier-ordered backlog scan.
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_disco_tier_lastcrawl
                ON "Disco" (crawl_tier, last_crawled_at ASC NULLS FIRST)
                WHERE disponivel = TRUE AND marketplace = 'amazon'
            """
        )
    conn.commit()
    log.info("ensure_tier_columns: tiering schema applied.")


def tier_interval_case_sql(col: str = "crawl_tier") -> str:
    """
    Build the SQL CASE expression mapping a tier column to its INTERVAL, so the
    intervals live only in TIER_INTERVAL_HOURS. Used by fetch_stale_records.

    Returns e.g.:  CASE crawl_tier WHEN 0 THEN INTERVAL '8 hours' ... ELSE INTERVAL '12 hours' END
    """
    whens = " ".join(
        f"WHEN {tier} THEN INTERVAL '{hours} hours'"
        for tier, hours in sorted(TIER_INTERVAL_HOURS.items())
    )
    return f"CASE {col} {whens} ELSE INTERVAL '{_UNSCORED_INTERVAL_HOURS} hours' END"


# ── Scoring / tier assignment (weekly rescore) ───────────────────────────
def rescore_catalog(conn, dry_run: bool = False) -> dict:
    """
    Recompute popularity_score + crawl_tier for every Amazon-vinyl record.

    Step 1: threshold assignment from effective listeners
            (album value, else artist MAX, else 0 → F; unidentified artist → F).
    Step 2: promote to S the top ~1% by score.
    Step 3: promote to S every record with a confirmed price alert.

    dry_run=True computes and returns the resulting tier histogram without writing.
    Returns {"S": n, "A": n, ...}.
    """
    if dry_run:
        return _tier_histogram_preview(conn)

    with _cursor(conn) as cur:
        # Step 1 — threshold tiers from effective listeners.
        cur.execute(
            f"""
            WITH am AS (
                SELECT artista, MAX(lastfm_listeners) AS amax
                FROM "Disco"
                WHERE marketplace = 'amazon' AND (format IS NULL OR format = 'vinyl')
                GROUP BY artista
            ), scored AS (
                SELECT d.id,
                    CASE WHEN d.artista ~* 'artista n[ãa]o identificad' THEN 0
                         ELSE COALESCE(NULLIF(d.lastfm_listeners, 0), am.amax, 0)
                    END AS eff
                FROM "Disco" d
                LEFT JOIN am ON am.artista = d.artista
                WHERE d.marketplace = 'amazon' AND (d.format IS NULL OR d.format = 'vinyl')
            )
            UPDATE "Disco" d SET
                popularity_score = log(10, GREATEST(s.eff, 0) + 1),
                popularity_scored_at = NOW(),
                crawl_tier = CASE
                    WHEN s.eff = 0          THEN {TIER_F}
                    WHEN s.eff < {_B_FLOOR} THEN {TIER_C}
                    WHEN s.eff < {_A_FLOOR} THEN {TIER_B}
                    ELSE                         {TIER_A}
                END
            FROM scored s
            WHERE d.id = s.id
            """
        )
        step1 = cur.rowcount

        # Step 2 — promote top ~1% by score to S.
        cur.execute(
            f"""
            WITH ranked AS (
                SELECT id, ntile(100) OVER (ORDER BY popularity_score DESC) AS pct
                FROM "Disco"
                WHERE marketplace = 'amazon' AND (format IS NULL OR format = 'vinyl')
                  AND popularity_score > 0
            )
            UPDATE "Disco" d SET crawl_tier = {TIER_S}
            FROM ranked r
            WHERE d.id = r.id AND r.pct = 1
            """
        )
        step2 = cur.rowcount

        # Step 3 — promote confirmed price-alert records to S (money-committed demand).
        cur.execute(
            f"""
            UPDATE "Disco" d SET crawl_tier = {TIER_S}
            WHERE d.marketplace = 'amazon'
              AND d.id::text IN (
                  SELECT filters->>'record_id'
                  FROM alert_subscriptions
                  WHERE status = 'confirmed' AND filters ? 'record_id'
              )
            """
        )
        step3 = cur.rowcount
    conn.commit()
    log.info(
        "rescore_catalog: scored %d records, S-promoted %d (top 1%%) + %d (alerts).",
        step1, step2, step3,
    )
    return _tier_histogram(conn)


def _tier_histogram(conn) -> dict:
    with _cursor(conn) as cur:
        cur.execute(
            """
            SELECT crawl_tier, COUNT(*) FROM "Disco"
            WHERE marketplace = 'amazon' AND (format IS NULL OR format = 'vinyl')
            GROUP BY crawl_tier ORDER BY crawl_tier
            """
        )
        rows = cur.fetchall()
    return {TIER_NAMES.get(t, f"tier{t}" if t is not None else "unscored"): n for t, n in rows}


def _tier_histogram_preview(conn) -> dict:
    """Same tiering as rescore_catalog but computed read-only (no write)."""
    with _cursor(conn) as cur:
        cur.execute(
            f"""
            WITH am AS (
                SELECT artista, MAX(lastfm_listeners) AS amax
                FROM "Disco"
                WHERE marketplace = 'amazon' AND (format IS NULL OR format = 'vinyl')
                GROUP BY artista
            ), scored AS (
                SELECT d.id,
                    CASE WHEN d.artista ~* 'artista n[ãa]o identificad' THEN 0
                         ELSE COALESCE(NULLIF(d.lastfm_listeners, 0), am.amax, 0)
                    END AS eff
                FROM "Disco" d
                LEFT JOIN am ON am.artista = d.artista
                WHERE d.marketplace = 'amazon' AND (d.format IS NULL OR d.format = 'vinyl')
            ), tiered AS (
                SELECT id,
                    CASE
                        WHEN eff = 0          THEN {TIER_F}
                        WHEN eff < {_B_FLOOR} THEN {TIER_C}
                        WHEN eff < {_A_FLOOR} THEN {TIER_B}
                        ELSE                       {TIER_A}
                    END AS tier
                FROM scored
            )
            SELECT tier, COUNT(*) FROM tiered GROUP BY tier ORDER BY tier
            """
        )
        rows = cur.fetchall()
    return {TIER_NAMES.get(t, str(t)): n for t, n in rows}


# ── Dry-run NET budget projection (step 6 gate) ──────────────────────────
def projection_report(conn, tpd: int = 8640) -> dict:
    """
    Project the daily Creators-API load under the tier schedule against the day cap
    (CREATORS_TPD). Read-only; requires crawl_tier to be populated first.

    Signal model (corrected — grounded in the real scheduling column, not price rows):
      - The API budget is spent ONLY by Phase 0 (deals) + Phase 3 (this backlog).
        The free category sweep does NOT touch the budget; it only bumps
        last_crawled_at. HistoricoPreco insert counts are mostly the free sweep and
        are NOT API calls — the api_budget_ledger is the only true API counter.
      - A record costs an API call in a run only when it is DUE: last_crawled_at is
        NULL or older than its tier interval. The free sweep keeps the whole
        available catalog fresh within ~48h, so tiers with interval >= 24h are
        largely pre-covered and rarely fire; the demand concentrates in S/A.
      - due_now  = records currently past their tier interval (instantaneous backlog).
        est_api_per_day = due_now * (24 / interval_h): the residual refills roughly
        once per interval as records age past the free sweep.

    Deal reserve is read from the api_budget_ledger (actual getItems spent), and the
    tier backlog REPLACES today's FIFO Phase-3 spend rather than adding to it, so the
    projected total stays at today's operating point. Deal-day guard: deals are
    ordered before all tiers (Rule Zero); tiers drain S<A<B<C<F, so the lowest tiers
    starve first if the cap is ever approached.
    """
    interval_case = tier_interval_case_sql()
    per_tier: dict[int, dict] = {}
    with _cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT crawl_tier,
                   count(*) AS n,
                   count(*) FILTER (
                       WHERE last_crawled_at IS NULL
                          OR last_crawled_at < NOW() - ({interval_case})
                   ) AS due_now
            FROM "Disco"
            WHERE marketplace = 'amazon' AND (format IS NULL OR format = 'vinyl')
              AND disponivel = TRUE AND crawl_tier IS NOT NULL
            GROUP BY crawl_tier ORDER BY crawl_tier
            """
        )
        for tier, n, due_now in cur.fetchall():
            tier, n, due_now = int(tier), int(n), int(due_now)
            hours = TIER_INTERVAL_HOURS.get(tier, _UNSCORED_INTERVAL_HOURS)
            est = round(due_now * (24.0 / hours))
            per_tier[tier] = {
                "name": TIER_NAMES.get(tier, str(tier)),
                "interval_h": hours, "n": n, "due_now": due_now,
                "est_api_per_day": est,
            }

        # Deal reserve: actual API getItems spent on the most recent COMPLETE ledger day.
        cur.execute(
            """
            SELECT used FROM api_budget_ledger
            WHERE day < (NOW() AT TIME ZONE 'UTC')::date
            ORDER BY day DESC LIMIT 1
            """
        )
        row = cur.fetchone()
        ledger_recent = int(row[0]) if row else 0
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE deal_score IS NOT NULL AND marketplace = 'amazon'"""
        )
        deals = int(cur.fetchone()[0])

    backlog_est = sum(t["est_api_per_day"] for t in per_tier.values())

    log.info("=" * 78)
    log.info("TIER SCHEDULE — daily API projection vs CREATORS_TPD = %d", tpd)
    log.info("=" * 78)
    log.info("%-5s %8s %10s %9s %14s", "tier", "int(h)", "records", "due_now", "est_API/day")
    for tier in sorted(per_tier):
        t = per_tier[tier]
        log.info("%-5s %8d %10d %9d %14d",
                 t["name"], t["interval_h"], t["n"], t["due_now"], t["est_api_per_day"])
    log.info("-" * 78)
    log.info("Phase-3 tier backlog est API/day     : %6d  (replaces today's FIFO backlog)", backlog_est)
    log.info("Recent full-day ledger (actual total): %6d  (deals + FIFO backlog, %d active deals)",
             ledger_recent, deals)
    # Total operating point: tiering redistributes the backlog within the same regime;
    # the backlog estimate should sit at or below the current ledger level.
    projected_total = max(ledger_recent, backlog_est)
    headroom = tpd - projected_total
    log.info("Projected TOTAL API/day (<= today)   : %6d", projected_total)
    log.info("Day cap (CREATORS_TPD)               : %6d", tpd)
    log.info("Headroom under cap                   : %6d", headroom)
    gate_passes = projected_total <= tpd
    log.info("GATE (guard inactive under normal load): %s",
             "PASS" if gate_passes else "FAIL — relax intervals")
    # Deal-day stress: how far deals can spike before low tiers starve.
    cf = per_tier.get(TIER_C, {}).get("est_api_per_day", 0) + per_tier.get(TIER_F, {}).get("est_api_per_day", 0)
    protected = backlog_est - cf  # S+A+B
    log.info(
        "High-deal-day: S+A+B need %d/day; C/F need %d/day. C/F starve only once deal "
        "spend exceeds %d/day (%.1fx recent). Deals unchanged by tiering (Phase 0).",
        protected, cf, tpd - protected - cf, (tpd - protected - cf) / max(ledger_recent, 1),
    )
    log.info("=" * 78)

    return {
        "per_tier": {per_tier[t]["name"]: per_tier[t] for t in per_tier},
        "backlog_est": backlog_est,
        "ledger_recent": ledger_recent,
        "projected_total": projected_total,
        "tpd": tpd, "headroom": headroom, "gate_passes": gate_passes,
    }


def main():
    import argparse
    import os

    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    from database import get_connection

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    p = argparse.ArgumentParser(description="Popularity-weighted crawl tiering")
    p.add_argument("--rescore", action="store_true",
                   help="Recompute popularity_score + crawl_tier for the catalog (writes).")
    p.add_argument("--dry-run", action="store_true",
                   help="With --rescore: preview tier histogram without writing.")
    p.add_argument("--project", action="store_true",
                   help="Print the NET daily-API budget projection (read-only; needs tiers set).")
    p.add_argument("--tpd", type=int, default=int(os.environ.get("CREATORS_TPD", "8640") or "8640"),
                   help="Day cap to check the projection against (default: CREATORS_TPD env or 8640).")
    args = p.parse_args()

    conn = get_connection()
    ensure_tier_columns(conn)

    if args.rescore:
        hist = rescore_catalog(conn, dry_run=args.dry_run)
        log.info("Tier histogram%s: %s", " (dry-run)" if args.dry_run else "", hist)
    if args.project:
        projection_report(conn, tpd=args.tpd)
    if not args.rescore and not args.project:
        log.info("Nothing to do. Use --rescore and/or --project.")
    conn.close()


if __name__ == "__main__":
    main()


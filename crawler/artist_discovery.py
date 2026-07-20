"""
artist_discovery.py — Own-catalog artist → Amazon Brazil vinyl discovery.

Third discovery path, alongside lastfm_discovery.py and soundtrack_discovery.py.

The gap it closes: lastfm_discovery walks Last.fm's chart top 3000, so an artist
we already stock is only ever re-searched if they happen to chart. Measured
against prod, 86% of our confirmed-vinyl artists (11,448 of 13,302) sit outside
that chart and are therefore never searched again after the record that first
brought them in. ACxDC is the archetype: a powerviolence band nowhere near the
chart, one record in Disco, seven vinyl ASINs live on Amazon.

So this path inverts the direction. Instead of asking a chart who is popular, it
asks our own catalog who we already sell, and re-searches them. An artist in
Disco is proof Amazon Brazil presses them — the strongest discovery signal we
have, and the one we were throwing away.

Reuses lastfm_discovery's search + parse + queue machinery wholesale (same as
soundtrack_discovery does). Found ASINs land in `discovered_vinyls` for main.py
Phase 2.8 to validate and ingest.

Usage:
    python artist_discovery.py                  # run the due artists
    python artist_discovery.py --dry-run        # search and log, no DB writes
    python artist_discovery.py --limit 50       # cap artists this run
    python artist_discovery.py --artist ACxDC   # force one artist, ignore rotation

Schedule: once per day, offset from the other two discovery paths (18:00 vs
12:00 vs 00:00 UTC) and in the same concurrency group — two live Amazon sessions
compound CAPTCHA. ScrapeLock guards it at runtime too.
"""
import os
import time
import random
import logging
import argparse
import urllib.parse
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from bs4 import BeautifulSoup

from database import get_connection
from domain import UNKNOWN_ARTIST, is_fake_artist
from scrape_lock import ScrapeLock
from lastfm_discovery import (
    make_session,
    warm_up,
    upsert_discovered,
    _parse_page,
    _BOT_RE,
    AMAZON_BASE,
    MAX_SEARCH_PAGES,
    DELAY_PAGE_MIN,
    DELAY_PAGE_MAX,
    SOFTBLOCK_ROTATE_STREAK,
    SOFTBLOCK_ABORT_STREAK,
    SOFTBLOCK_BACKOFF_MIN,
    SOFTBLOCK_BACKOFF_MAX,
)

# ─────────────────────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────────────────────

SOURCE = "db_artist_search"

# Compilation bucket, not an artist. Searching it returns unrelated records from
# every genre — the one name in the catalog guaranteed to be off-purpose.
_EXCLUDED_ARTISTS = frozenset({"Various Artists"})

# Sized against the run budget, not picked round. An artist costs ~20-30s
# (3 search pages plus inter-page and inter-artist delays), so 250 fills roughly
# 105 minutes — the soft timeout — with room for slow pages and CAPTCHA retries.
ARTISTS_PER_RUN = int(os.environ.get("ARTIST_DISCOVERY_PER_RUN", "250"))

DELAY_ARTIST_MIN = 8.0   # between artists
DELAY_ARTIST_MAX = 15.0

# Stop before the GHA job timeout so results still get written.
SOFT_TIMEOUT_SECONDS = int(os.environ.get("SOFT_TIMEOUT_SECONDS", str(105 * 60)))

# ── Artist rotation ──────────────────────────────────────────────────────
# Freshness interval per tier, in HOURS. Mirrors soundtrack_discovery's scheme:
# tiers come from RECENT yield, not lifetime hits, and `recent_hits` is halved
# each run (see record_artist_result) so old wins fade over ~5 runs.
#
# The intervals are anchored to the natural full-pass time, which the pool size
# and ARTISTS_PER_RUN fix at ~53 days (13.4k artists / 250 per daily run). COLD
# sits at 45 days — deliberately UNDER that — because a tier interval longer
# than the cycle would mean artists come up for their turn and aren't due yet,
# and the run would search fewer than its budget for no gain.
#
# HOT/WARM buy queue-jumping for artists actively yielding new pressings.
# DORMANT is the lever that makes the whole thing scale: an artist we have
# fully harvested drops to a quarterly check, shrinking the working pool, which
# speeds the cycle up for everyone still producing. It is a floor, never
# "never" — a band with no new pressing today may get a reissue next year, and
# nothing else would rediscover it.
TIER_HOT, TIER_WARM, TIER_COLD, TIER_DORMANT = "hot", "warm", "cold", "dormant"
ARTIST_TIER_INTERVAL_HOURS = {
    TIER_HOT:     336,   # recent_hits >= 2  → fortnightly
    TIER_WARM:    720,   # recent_hits 1     → monthly
    TIER_COLD:    1080,  # no recent hits    → every 45 days
    TIER_DORMANT: 2160,  # 3+ straight misses → quarterly floor
}
# Lower than soundtrack's floor of 3: a franchise seed fans out into 6 queries
# and can plausibly find 3 new OSTs, but a single artist yielding 2 new vinyl
# ASINs in one run is already an active catalog worth revisiting.
_HOT_FLOOR = 2
_MISS_STREAK_DORMANT = 3

# ─────────────────────────────────────────────────────────────────────────────
#  Logging
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("discovery.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  Database helpers
# ─────────────────────────────────────────────────────────────────────────────

@contextmanager
def _cursor(conn):
    with conn.cursor() as cur:
        cur.execute("SET LOCAL statement_timeout = 0")
        yield cur


def ensure_artist_tables(conn) -> None:
    """Idempotently create artist_discovery_state."""
    with _cursor(conn) as cur:
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS artist_discovery_state (
                artist_name      TEXT        PRIMARY KEY,
                tier             TEXT        NOT NULL DEFAULT 'cold',
                recent_hits      INTEGER     NOT NULL DEFAULT 0,
                total_hits       INTEGER     NOT NULL DEFAULT 0,
                miss_streak      INTEGER     NOT NULL DEFAULT 0,
                last_searched_at TIMESTAMPTZ,
                last_hit_at      TIMESTAMPTZ,
                updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS artist_discovery_state_due_idx
                ON artist_discovery_state (last_searched_at NULLS FIRST)
        """)
    conn.commit()
    log.debug("Artist discovery tables ensured.")


def fetch_catalog_artists(conn) -> list[str]:
    """
    Every artist we hold a CONFIRMED vinyl record for.

    format='vinyl' rather than the whole Disco table on purpose: an unverified
    or CD-only row is not evidence Amazon presses that artist on vinyl, and the
    junk bylines the scraper occasionally picks up ("Cerâmica", 153 rows) are
    almost all non-vinyl formats, so this one predicate drops them for free.
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            SELECT DISTINCT artista
            FROM "Disco"
            WHERE format = 'vinyl'
              AND artista IS NOT NULL
              AND artista <> %s
              AND artista <> ALL(%s)
            """,
            (UNKNOWN_ARTIST, list(_EXCLUDED_ARTISTS)),
        )
        rows = [r[0] for r in cur.fetchall()]

    # is_fake_artist catches the byline-parse debris that survives the format
    # filter — date strings ("5 nov. 2025"), price fragments, "Músicas MP3".
    artists = [a for a in rows if a and a.strip() and not is_fake_artist(a)]
    log.info(
        "Catalog artists with confirmed vinyl: %d (%d rejected as junk bylines).",
        len(artists), len(rows) - len(artists),
    )
    return artists


def sync_artist_state(conn, artists: list[str]) -> int:
    """
    Registers artists that entered the catalog since the last run. A new artist
    lands with last_searched_at NULL, which sorts first in select_due_artists —
    a band we just started stocking is searched promptly, not in 45 days.

    Artists that leave the catalog keep their row; harmless, and it survives a
    record being temporarily delisted. select_due_artists intersects against the
    live catalog anyway, so a stale row is never searched.
    """
    if not artists:
        return 0
    with _cursor(conn) as cur:
        cur.execute("SELECT count(*) FROM artist_discovery_state")
        before = cur.fetchone()[0]
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO artist_discovery_state (artist_name)
            VALUES (%s)
            ON CONFLICT (artist_name) DO NOTHING
            """,
            [(a,) for a in artists],
            page_size=500,
        )
        cur.execute("SELECT count(*) FROM artist_discovery_state")
        after = cur.fetchone()[0]
    conn.commit()
    added = after - before
    if added:
        log.info("Registered %d new artist(s) into the rotation.", added)
    return added


def _tier_interval_case_sql() -> str:
    """Builds the tier → interval CASE from ARTIST_TIER_INTERVAL_HOURS."""
    whens = " ".join(
        f"WHEN '{tier}' THEN {hours}"
        for tier, hours in ARTIST_TIER_INTERVAL_HOURS.items()
    )
    return f"CASE tier {whens} ELSE {ARTIST_TIER_INTERVAL_HOURS[TIER_COLD]} END"


def select_due_artists(conn, artists: list[str], limit: int) -> list[str]:
    """
    Picks the artists whose tier interval has elapsed, oldest first.
    NULLS FIRST puts never-searched artists at the head of the queue.
    """
    if not artists:
        return []
    with _cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT artist_name FROM artist_discovery_state
            WHERE artist_name = ANY(%s)
              AND (
                    last_searched_at IS NULL
                 OR last_searched_at < NOW() - (({_tier_interval_case_sql()}) * INTERVAL '1 hour')
              )
            ORDER BY last_searched_at ASC NULLS FIRST
            LIMIT %s
            """,
            (artists, limit),
        )
        return [row[0] for row in cur.fetchall()]


def _next_tier(recent_hits: int, miss_streak: int) -> str:
    if recent_hits >= _HOT_FLOOR:
        return TIER_HOT
    if recent_hits >= 1:
        return TIER_WARM
    if miss_streak >= _MISS_STREAK_DORMANT:
        return TIER_DORMANT
    return TIER_COLD


def record_artist_result(conn, artist: str, new_hits: int) -> str:
    """
    Updates one artist's rotation state after a search and returns the new tier.

    new_hits counts ASINs genuinely new to us, not search results — otherwise a
    fully-harvested artist whose whole catalog we already own would return 20
    results every run and stay HOT forever.
    """
    with _cursor(conn) as cur:
        cur.execute(
            "SELECT recent_hits, miss_streak FROM artist_discovery_state WHERE artist_name = %s",
            (artist,),
        )
        row = cur.fetchone()
        recent_hits, miss_streak = (row[0], row[1]) if row else (0, 0)

        recent_hits = recent_hits // 2 + new_hits
        miss_streak = 0 if new_hits else miss_streak + 1
        tier        = _next_tier(recent_hits, miss_streak)

        cur.execute(
            """
            UPDATE artist_discovery_state SET
                tier             = %s,
                recent_hits      = %s,
                total_hits       = total_hits + %s,
                miss_streak      = %s,
                last_searched_at = NOW(),
                last_hit_at      = CASE WHEN %s > 0 THEN NOW() ELSE last_hit_at END,
                updated_at       = NOW()
            WHERE artist_name = %s
            """,
            (tier, recent_hits, new_hits, miss_streak, new_hits, artist),
        )
    conn.commit()
    return tier

# ─────────────────────────────────────────────────────────────────────────────
#  Amazon search
# ─────────────────────────────────────────────────────────────────────────────

_CARD_SELECTOR = 'div[data-component-type="s-search-result"][data-asin]'


def search_artist_pages(session, artist: str) -> tuple[list[dict], bool, bool]:
    """
    Searches Amazon Brazil for one artist's vinyl. Mirrors
    lastfm_discovery.search_artist — same paging, same CAPTCHA handling, same
    no-retry policy — but reports one extra bit: whether the results page
    rendered ANY product cards.

    Returns (results, blocked, inconclusive).

    Why the extra bit. Amazon intermittently answers a scraper with HTTP 200, no
    CAPTCHA marker, and a page carrying zero search-result cards — a soft block.
    search_artist reports that as ([], False), identical to "this artist has no
    vinyl". lastfm_discovery can live with the ambiguity because it keeps no
    per-artist state; this path cannot. A miss here increments miss_streak, and
    three of them exile an artist to DORMANT for 90 days. Observed live on
    ACxDC: one search returned 7 ASINs, the next returned 0 cards seconds later.

    Distinguishing the two is possible because of where this path's artists come
    from: every one of them already has a confirmed vinyl record in Disco, so
    their name provably matches something on Amazon. A page with cards but no
    vinyl is a real miss (they press CDs, we found nothing new). A page with no
    cards at all is Amazon declining to answer, and must not touch tier state.
    """
    found: dict[str, dict] = {}
    encoded = urllib.parse.quote(artist)
    saw_cards = False

    for page in range(1, MAX_SEARCH_PAGES + 1):
        url = f"{AMAZON_BASE}/s?k={encoded}&i=popular"
        if page > 1:
            url += f"&page={page}"

        try:
            resp = session.get(url, timeout=25)
        except Exception as exc:
            log.warning("[search] %r page %d: request error — %s", artist, page, exc)
            return list(found.values()), True, not saw_cards

        if resp.status_code != 200:
            log.warning("[search] %r page %d: HTTP %d — skipping artist",
                        artist, page, resp.status_code)
            return list(found.values()), True, not saw_cards

        if _BOT_RE.search(resp.text):
            log.warning("[search] %r page %d: CAPTCHA — skipping artist", artist, page)
            return list(found.values()), True, not saw_cards

        soup = BeautifulSoup(resp.content, "lxml")
        cards = len(soup.select(_CARD_SELECTOR))
        if cards:
            saw_cards = True
        elif page == 1:
            # Page 1 with no cards at all: soft block, not an empty catalog.
            log.warning("[search] %r page 1: HTTP 200 but zero product cards — "
                        "soft block, leaving rotation state untouched.", artist)
            return [], False, True

        page_results = _parse_page(soup)
        for r in page_results:
            found.setdefault(r["asin"], r)

        log.debug("[search] %r page %d: %d card(s), %d vinyl result(s)",
                  artist, page, cards, len(page_results))

        # No cards on a later page means the result set ended, not a block.
        if not cards:
            break
        if page < MAX_SEARCH_PAGES:
            time.sleep(random.uniform(DELAY_PAGE_MIN, DELAY_PAGE_MAX))

    return list(found.values()), False, False

# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Discover vinyl ASINs by re-searching our own catalog's artists on Amazon Brazil."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Search and log results without writing to the database.")
    parser.add_argument("--limit", type=int, default=ARTISTS_PER_RUN, metavar="N",
                        help=f"Max artists to search this run (default: {ARTISTS_PER_RUN}).")
    parser.add_argument("--artist", type=str, default=None, metavar="NAME",
                        help="Search only this artist (substring match), ignoring rotation.")
    args = parser.parse_args()

    conn = get_connection()
    ensure_artist_tables(conn)

    artists = fetch_catalog_artists(conn)
    if not artists:
        log.error("No catalog artists found — aborting.")
        conn.close()
        raise SystemExit(1)

    sync_artist_state(conn, artists)

    # ── Pick this run's artists ──────────────────────────────────────────────
    if args.artist:
        needle = args.artist.lower()
        due = [a for a in artists if needle in a.lower()]
        if not due:
            log.error("No catalog artist matches %r — aborting.", args.artist)
            conn.close()
            raise SystemExit(1)
        log.info("Forced artist selection (%d): %s", len(due), ", ".join(due[:20]))
    else:
        due = select_due_artists(conn, artists, args.limit)
        if not due:
            log.info("No artists due this run — every artist is within its tier interval.")
            conn.close()
            return
        log.info("Artists due this run: %d/%d.", len(due), len(artists))

    # Guard: never co-scrape the storefront with the main crawl or the other
    # discovery runs. Two live Amazon sessions compound CAPTCHA and rate limits.
    _scrape_lock = ScrapeLock(label="artist-discovery")
    _scrape_lock.__enter__()
    if not _scrape_lock.acquired:
        log.warning("Artist discovery skipped — another run holds the storefront lock. "
                    "Exiting without advancing state; the next cron run retries.")
        _scrape_lock.__exit__()
        conn.close()
        return

    session = make_session()
    warm_up(session)

    # ── Search ───────────────────────────────────────────────────────────────
    # Two separate ledgers, because a search can be good enough to queue from
    # but not good enough to draw conclusions from.
    all_rows: list[dict] = []                        # everything found → queue
    scored: list[tuple[str, list[dict]]] = []        # trustworthy → tier state
    # Disjoint: an artist is blocked (CAPTCHA/HTTP), soft-blocked (200 with no
    # cards), or scored — never counted under two headings.
    blocked_names: list[str] = []
    softblocked_names: list[str] = []
    soft_timeout_hit = False
    softblock_streak = 0     # consecutive turn-aways (block or soft block)
    aborted_blocked  = False

    run_start = time.monotonic()

    for idx, artist in enumerate(due, 1):
        elapsed = time.monotonic() - run_start
        if elapsed >= SOFT_TIMEOUT_SECONDS:
            log.warning(
                "Soft timeout reached (%.0fs) at artist [%d/%d] — saving progress and exiting.",
                elapsed, idx - 1, len(due),
            )
            soft_timeout_hit = True
            break

        log.info("[%d/%d] %r", idx, len(due), artist)

        results, blocked, inconclusive = search_artist_pages(session, artist)

        for r in results:
            r["artist_name"] = artist
            r["source"]      = SOURCE

        log.info("  → %d vinyl ASIN(s)%s", len(results),
                 " (partial — blocked)" if blocked else "")

        # Anything Amazon did hand over is worth queueing, even from a truncated
        # search. But a truncated search is not evidence about what it did NOT
        # return, so it must not advance the tier: withheld artists keep their
        # old last_searched_at and come back around on the next run.
        all_rows.extend(results)
        if blocked:
            blocked_names.append(artist)
        elif inconclusive:
            softblocked_names.append(artist)
        else:
            scored.append((artist, results))

        # ── Circuit breaker ────────────────────────────────────────────────────
        # A run of turn-aways (CAPTCHA/HTTP block or empty-card soft block) means
        # Amazon is refusing this session or IP. Rotate + back off to recover a
        # session-level throttle; abort if a fresh session keeps getting turned
        # away — continuing only wastes requests and deepens the block.
        if blocked or inconclusive:
            softblock_streak += 1
            if softblock_streak >= SOFTBLOCK_ABORT_STREAK:
                log.warning(
                    "[circuit-breaker] %d consecutive turn-aways — aborting run at "
                    "artist [%d/%d]; the IP looks flagged.",
                    softblock_streak, idx, len(due),
                )
                aborted_blocked = True
                break
            if softblock_streak % SOFTBLOCK_ROTATE_STREAK == 0:
                backoff = random.uniform(SOFTBLOCK_BACKOFF_MIN, SOFTBLOCK_BACKOFF_MAX)
                log.warning(
                    "[circuit-breaker] %d consecutive turn-aways — rotating session "
                    "and backing off %.0fs.", softblock_streak, backoff,
                )
                time.sleep(backoff)
                session = make_session()
                warm_up(session)
        else:
            softblock_streak = 0

        if idx < len(due):
            time.sleep(random.uniform(DELAY_ARTIST_MIN, DELAY_ARTIST_MAX))

    # Storefront work done — release before the DB writes below.
    _scrape_lock.__exit__()

    # ── Dedupe across artists (a split release shows up under both) ──────────
    seen: set[str] = set()
    unique: list[dict] = []
    for r in all_rows:
        if r["asin"] not in seen:
            seen.add(r["asin"])
            unique.append(r)

    log.info("Unique vinyl ASINs found: %d", len(unique))

    # ── Write ────────────────────────────────────────────────────────────────
    newly_inserted = 0
    already_known  = 0

    if args.dry_run:
        log.info("[dry-run] Would queue %d ASIN(s) — skipping DB write.", len(unique))
        for artist, rows in scored:
            if rows:
                log.info("  %s → %s", artist, ", ".join(r["asin"] for r in rows))
    else:
        # Read what we already knew BEFORE upserting — afterwards every ASIN is
        # known, and the tier would read every artist as a miss.
        known_before: set[str] = set()
        asins = [r["asin"] for r in unique]
        if asins:
            with _cursor(conn) as cur:
                cur.execute('SELECT asin FROM "Disco" WHERE asin = ANY(%s)', (asins,))
                known_before = {row[0] for row in cur.fetchall()}
                cur.execute(
                    "SELECT asin FROM discovered_vinyls WHERE asin = ANY(%s)",
                    (asins,),
                )
                known_before |= {row[0] for row in cur.fetchall()}

        newly_inserted, already_known = upsert_discovered(conn, unique)

        fresh_asins = {r["asin"] for r in unique if r["asin"] not in known_before}
        tier_counts: dict[str, int] = {}
        for artist, rows in scored:
            new_hits = sum(1 for r in rows if r["asin"] in fresh_asins)
            tier = record_artist_result(conn, artist, new_hits)
            tier_counts[tier] = tier_counts.get(tier, 0) + 1
            if new_hits:
                log.info("  %s: %d new ASIN(s) → tier %s", artist, new_hits, tier)
        log.info("Tiers after run — %s",
                 "  ".join(f"{t}={n}" for t, n in sorted(tier_counts.items())) or "none")

    # ── Summary ──────────────────────────────────────────────────────────────
    if aborted_blocked:
        run_label = "Partial run (blocked — circuit breaker)"
    elif soft_timeout_hit:
        run_label = "Partial run (soft timeout)"
    else:
        run_label = "Run complete"
    log.info(
        "%s — artists_searched=%d  artists_scored=%d  artists_blocked=%d  "
        "artists_soft_blocked=%d  vinyl_asins_found=%d  newly_queued=%d  already_known=%d",
        run_label,
        len(scored) + len(blocked_names) + len(softblocked_names),
        len(scored),
        len(blocked_names),
        len(softblocked_names),
        len(unique),
        newly_inserted,
        already_known,
    )
    if blocked_names:
        log.info("Blocked, rotation state untouched (%d): %s", len(blocked_names),
                 ", ".join(blocked_names[:30]))
    if softblocked_names:
        # A high count here means Amazon is throttling this run, not that the
        # catalog is exhausted — these artists kept their state and will retry.
        log.info("Soft-blocked (200, no cards), rotation state untouched (%d): %s",
                 len(softblocked_names), ", ".join(softblocked_names[:30]))

    conn.close()


if __name__ == "__main__":
    main()

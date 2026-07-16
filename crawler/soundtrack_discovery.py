"""
soundtrack_discovery.py — Curated soundtrack → Amazon Brazil vinyl discovery.

Second discovery path alongside lastfm_discovery.py. Where that one walks the
Last.fm artist chart, this one runs curated searches for movie / anime / game
soundtracks, which the chart never surfaces: an OST is filed under its composer
or a franchise name, not under an artist with listeners.

Seeds live in soundtrack_seeds.json and come in two kinds:

  titles — a franchise carrying its own category (game/anime/movie). Every ASIN
    the seed finds inherits that category, subject to a title cross-check.
  labels — boutique OST pressers (Mondo, Waxwork, Data Discs…). High-yield and
    low-noise: they press almost nothing but soundtracks, so searching the label
    name finds pressings no title seed would think to ask for. They imply no
    category — they press film, game and anime scores mixed — so their ASINs are
    classified by matching the product title against the title-seed vocabulary.

Reuses lastfm_discovery's search + parse + queue machinery wholesale. Found
ASINs land in `discovered_vinyls` for main.py Phase 2.8 to validate and ingest;
the category is recorded in `soundtrack_candidates` and applied to
Disco.lastfm_tags on a later run, once Phase 2.8 has actually created the row.

Usage:
    python soundtrack_discovery.py               # run the due seeds
    python soundtrack_discovery.py --dry-run     # search and log, no DB writes
    python soundtrack_discovery.py --limit 5     # cap seeds this run
    python soundtrack_discovery.py --seed Zelda  # force one seed, ignore rotation

Schedule: once per day, offset from discovery.yml (00:00 vs 12:00 UTC) and in
the same concurrency group — two live Amazon sessions compound CAPTCHA.
"""
import os
import re
import json
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
from scrape_lock import ScrapeLock
from lastfm_discovery import (
    _parse_page,
    make_session,
    warm_up,
    upsert_discovered,
    _BOT_RE,
    AMAZON_BASE,
)

# ─────────────────────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────────────────────

SEEDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "soundtrack_seeds.json")

CATEGORIES = ("game", "anime", "movie")
SOUNDTRACK_TAG = "soundtrack"

# Positive evidence that a product IS a soundtrack, independent of which seed
# found it. Amazon's search is fuzzy — a seed's results include records that
# merely look like the query — so matching the seed name proves nothing on its
# own. Deliberately narrow: an unproven record is queued untagged, which costs
# nothing, while a wrong tag pollutes a genre page.
_OST_EVIDENCE_RE = re.compile(
    r"\bsoundtrack[s]?\b|\bo\.s\.t\.?\b|\bost\b|\bscore\b"
    r"|\btrilha[s]?\s+sonora[s]?\b|\bbanda\s+sonora\b"
    r"|\boriginal\s+motion\s+picture\b|\bmotion\s+picture\b"
    r"|\bmusic\s+from\b|\bmúsica[s]?\s+d[eo]\s+filme\b"
    r"|\bgame\s+music\b|\bvideo\s?game\s+music\b|\bvgm\b"
    r"|\btheme[s]?\s+(?:song|from)\b|\bopening\s+theme\b|\bending\s+theme\b",
    re.IGNORECASE,
)

# Query templates. Marketplace is Brazilian but OST titles are usually English,
# so both languages are covered. {q} is the seed name, already URL-encoded.
TITLE_QUERY_TEMPLATES = [
    "{q} vinyl",
    "{q} soundtrack vinyl",
    "{q} OST vinyl",
    "{q} original soundtrack LP",
    "{q} vinil",
    "{q} trilha sonora vinil",
]
LABEL_QUERY_TEMPLATES = [
    "{q} vinyl",
    "{q} vinil",
]

# Two pages, not lastfm_discovery's three: a seed fans out into 6 queries, so
# breadth comes from the variants. Page 3 of "{title} OST vinyl" is noise.
MAX_SEARCH_PAGES = 2

# Sized against the seed count, not picked round. A title seed costs ~90s
# (6 queries x 2 pages, plus delays); a label ~35s. 30 seeds is ~45min of the
# 105min soft timeout, leaving room for slow pages and CAPTCHA retries.
#
# The floor that matters: TIER_DORMANT is 28 days, so the whole seed list must
# be reachable within 28 runs or the coldest seeds never come up at all. At 30/run
# the ~336 seeds take ~12 days for a full pass — 2.4x headroom over the dormant
# floor, which is what lets hot seeds jump the queue without starving the rest.
# Raise this if the seed list grows past ~800.
SEEDS_PER_RUN    = int(os.environ.get("SOUNDTRACK_SEEDS_PER_RUN", "30"))

DELAY_PAGE_MIN   = 3.0   # between search pages
DELAY_PAGE_MAX   = 5.0
DELAY_QUERY_MIN  = 4.0   # between query variants of one seed
DELAY_QUERY_MAX  = 7.0
DELAY_SEED_MIN   = 8.0   # between seeds
DELAY_SEED_MAX   = 15.0

SOFT_TIMEOUT_SECONDS = int(os.environ.get("SOFT_TIMEOUT_SECONDS", str(105 * 60)))

# Stale candidates that never made it into Disco (Phase 2.8 dropped them as
# unknown-format, or they were never ingested) are pruned rather than retried
# forever.
CANDIDATE_TTL_DAYS = 30

# ── Seed rotation ────────────────────────────────────────────────────────
# Freshness interval per tier, in HOURS. Mirrors crawl_tiering.TIER_INTERVAL_HOURS:
# single source of truth, the selection SQL builds its CASE from this map.
#
# Tiers come from RECENT yield, not lifetime hits — a franchise that delivered 20
# ASINs two years ago and nothing since should cool off, and a cumulative counter
# would keep it hot forever. `recent_hits` is halved every run (see
# _decay_recent_hits), so old wins fade out over ~5 runs.
#
# DORMANT is a floor, never "never": a franchise with no pressing today may get
# one next year, and nothing else would ever rediscover it.
TIER_HOT, TIER_WARM, TIER_COLD, TIER_DORMANT = "hot", "warm", "cold", "dormant"
SEED_TIER_INTERVAL_HOURS = {
    TIER_HOT:     72,    # recent_hits >= 3  → every 3 days
    TIER_WARM:    168,   # recent_hits 1-2   → weekly
    TIER_COLD:    336,   # no recent hits    → fortnightly
    TIER_DORMANT: 672,   # 3+ straight misses → monthly floor
}
_HOT_FLOOR  = 3
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
#  Seeds
# ─────────────────────────────────────────────────────────────────────────────

class Seed:
    """One search seed. kind is "title" (carries a category) or "label"."""

    def __init__(self, name: str, kind: str, category: str | None = None,
                 aliases: list[str] | None = None, ambiguous: bool = False):
        self.name      = name
        self.kind      = kind
        self.category  = category
        self.aliases   = aliases or []
        # Name is an ordinary word or a common title ("Doom", "Journey",
        # "Psycho"). The seed is still searched; it just never joins the
        # classifier vocabulary, where it would mislabel unrelated records.
        self.ambiguous = ambiguous

    @property
    def key(self) -> str:
        """Stable primary key for soundtrack_seed_state. Renaming a seed in the
        JSON resets its rotation state, which is the correct behaviour."""
        return f"{self.kind}:{self.name}"

    @property
    def templates(self) -> list[str]:
        return TITLE_QUERY_TEMPLATES if self.kind == "title" else LABEL_QUERY_TEMPLATES

    def queries(self) -> list[str]:
        return [t.format(q=self.name) for t in self.templates]


def load_seeds(path: str = SEEDS_PATH) -> list[Seed]:
    """Reads and validates soundtrack_seeds.json. Raises on a malformed file —
    a typo'd category must fail the run, not silently mis-tag a catalog."""
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)

    seeds: list[Seed] = []
    seen: set[str] = set()

    for entry in raw.get("titles", []):
        name = (entry.get("name") or "").strip()
        cat  = (entry.get("category") or "").strip().lower()
        if not name:
            raise ValueError("soundtrack_seeds.json: a titles[] entry has no name.")
        if cat not in CATEGORIES:
            raise ValueError(
                f"soundtrack_seeds.json: title {name!r} has category {cat!r}; "
                f"expected one of {CATEGORIES}."
            )
        seeds.append(Seed(name, "title", cat, entry.get("aliases") or [],
                          bool(entry.get("ambiguous", False))))

    for entry in raw.get("labels", []):
        name = (entry.get("name") or "").strip()
        if not name:
            raise ValueError("soundtrack_seeds.json: a labels[] entry has no name.")
        seeds.append(Seed(name, "label"))

    for s in seeds:
        if s.key in seen:
            raise ValueError(f"soundtrack_seeds.json: duplicate seed {s.key!r}.")
        seen.add(s.key)

    log.info(
        "Loaded %d seed(s): %d title(s), %d label(s).",
        len(seeds),
        sum(1 for s in seeds if s.kind == "title"),
        sum(1 for s in seeds if s.kind == "label"),
    )
    return seeds

# ─────────────────────────────────────────────────────────────────────────────
#  Classification
# ─────────────────────────────────────────────────────────────────────────────

def build_title_classifier(seeds: list[Seed]) -> list[tuple[re.Pattern, str, str]]:
    """
    Compiles the title seeds into a franchise-name → category matcher, reusing
    the seed list as the classifier vocabulary instead of a second keyword table.

    Seeds flagged `ambiguous` are excluded: a name that is also an ordinary word
    ("Doom", "Journey", "Psycho") would fire on unrelated records — Nirvana's
    "Bleach" is not an anime OST. They lose nothing by sitting out, because a
    real OST found by those seeds still proves itself through _OST_EVIDENCE_RE.

    Returns [(pattern, category, seed_name)], word-boundary anchored.
    """
    out: list[tuple[re.Pattern, str, str]] = []
    for s in seeds:
        if s.kind != "title" or not s.category or s.ambiguous:
            continue
        for name in [s.name] + s.aliases:
            pat = re.compile(r"\b" + re.escape(name) + r"\b", re.IGNORECASE)
            out.append((pat, s.category, s.name))
    return out


def categories_in_title(title: str,
                        classifier: list[tuple[re.Pattern, str, str]]) -> set[str]:
    """Every franchise category whose name/alias appears in the product title."""
    return {cat for pat, cat, _name in classifier if pat.search(title)}


def classify(title: str, seed: Seed,
             classifier: list[tuple[re.Pattern, str, str]]) -> tuple[list[str] | None, str | None]:
    """
    Decides which genre tags one discovered product should carry.

    Returns (tags_or_None, conflict_reason_or_None):
      ["soundtrack", category] — proven soundtrack, proven kind
      ["soundtrack"]           — proven soundtrack, kind unproven (soundtrack-only)
      None                     — no soundtrack evidence: queue the ASIN, tag nothing

    Amazon's search is fuzzy, so a seed's results are NOT all that seed's
    soundtrack: "Mondo vinyl" returns "Souvenirs D'un Autre Monde" (Alcest, black
    metal). Matching the seed name is not evidence the product is an OST, so a
    result must prove it on its own — by naming a known franchise, or by saying
    it is a soundtrack. Anything unproven is still queued (a new vinyl is worth
    having) but goes in untagged rather than guessed; enrich_style_tags.py's LLM
    pass is the backstop for a genuine OST that names neither.

    title seeds — the seed's category applies once the product is proven a
      soundtrack, unless the title names a DIFFERENT franchise, which means the
      seed is mislabelled or the search drifted. Contradiction is reported, not
      resolved.
    label seeds — nothing to inherit (they press film, game and anime mixed), so
      the title must name exactly one franchise or the ASIN stays soundtrack-only.
    """
    found = categories_in_title(title, classifier)
    is_ost = bool(_OST_EVIDENCE_RE.search(title))

    if seed.kind == "title":
        if found and seed.category not in found:
            return None, (
                f"seed category {seed.category!r} contradicted by title evidence "
                f"{sorted(found)!r}"
            )
        if seed.category in found:
            return [SOUNDTRACK_TAG, seed.category], None   # franchise named outright
        if is_ost:
            # No franchise in the title, but the product says it is a soundtrack
            # and this seed only searched for one: "Original Soundtrack [LP]".
            return [SOUNDTRACK_TAG, seed.category], None
        return None, None

    # Label seed.
    if len(found) > 1:
        return None, f"label title matches multiple categories {sorted(found)!r}"
    if len(found) == 1:
        return [SOUNDTRACK_TAG, found.pop()], None
    if is_ost:
        return [SOUNDTRACK_TAG], None
    return None, None

# ─────────────────────────────────────────────────────────────────────────────
#  Database helpers
# ─────────────────────────────────────────────────────────────────────────────

@contextmanager
def _cursor(conn):
    with conn.cursor() as cur:
        cur.execute("SET LOCAL statement_timeout = 0")
        yield cur


def ensure_soundtrack_tables(conn) -> None:
    """Idempotently create soundtrack_seed_state and soundtrack_candidates."""
    with _cursor(conn) as cur:
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS soundtrack_seed_state (
                seed_key         TEXT        PRIMARY KEY,
                kind             TEXT        NOT NULL,
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
            CREATE TABLE IF NOT EXISTS soundtrack_candidates (
                asin          TEXT        PRIMARY KEY,
                seed_key      TEXT        NOT NULL,
                category      TEXT,
                titulo        TEXT,
                status        TEXT        NOT NULL DEFAULT 'pending',
                discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                tagged_at     TIMESTAMPTZ
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS soundtrack_candidates_status_idx
                ON soundtrack_candidates (status)
        """)
    conn.commit()
    log.debug("Soundtrack tables ensured.")


def sync_seed_state(conn, seeds: list[Seed]) -> None:
    """
    Registers seeds added to the JSON since the last run. A new seed lands with
    last_searched_at NULL, which sorts first in select_due_seeds — cold start is
    a prompt first search, not a wait.

    Seeds deleted from the JSON keep their row; harmless, and it survives a
    temporary removal.
    """
    with _cursor(conn) as cur:
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO soundtrack_seed_state (seed_key, kind)
            VALUES (%s, %s)
            ON CONFLICT (seed_key) DO NOTHING
            """,
            [(s.key, s.kind) for s in seeds],
            page_size=200,
        )
    conn.commit()


def _tier_interval_case_sql() -> str:
    """Builds the tier → interval CASE from SEED_TIER_INTERVAL_HOURS."""
    whens = " ".join(
        f"WHEN '{tier}' THEN {hours}"
        for tier, hours in SEED_TIER_INTERVAL_HOURS.items()
    )
    return f"CASE tier {whens} ELSE {SEED_TIER_INTERVAL_HOURS[TIER_COLD]} END"


def select_due_seeds(conn, seeds: list[Seed], limit: int) -> list[Seed]:
    """
    Picks the seeds whose tier interval has elapsed, oldest first.
    NULLS FIRST puts never-searched seeds at the head of the queue.
    """
    by_key = {s.key: s for s in seeds}
    with _cursor(conn) as cur:
        cur.execute(
            f"""
            SELECT seed_key FROM soundtrack_seed_state
            WHERE seed_key = ANY(%s)
              AND (
                    last_searched_at IS NULL
                 OR last_searched_at < NOW() - (({_tier_interval_case_sql()}) * INTERVAL '1 hour')
              )
            ORDER BY last_searched_at ASC NULLS FIRST
            LIMIT %s
            """,
            (list(by_key.keys()), limit),
        )
        keys = [row[0] for row in cur.fetchall()]
    return [by_key[k] for k in keys if k in by_key]


def _next_tier(recent_hits: int, miss_streak: int) -> str:
    if recent_hits >= _HOT_FLOOR:
        return TIER_HOT
    if recent_hits >= 1:
        return TIER_WARM
    if miss_streak >= _MISS_STREAK_DORMANT:
        return TIER_DORMANT
    return TIER_COLD


def record_seed_result(conn, seed: Seed, new_hits: int) -> str:
    """
    Updates one seed's rotation state after a search and returns its new tier.

    recent_hits decays by half each run before this run's hits are added, so a
    seed's tier tracks what it is finding lately rather than what it once found.
    new_hits counts ASINs genuinely new to us — not search results, which would
    keep a fully-harvested franchise hot forever.
    """
    with _cursor(conn) as cur:
        cur.execute(
            "SELECT recent_hits, miss_streak FROM soundtrack_seed_state WHERE seed_key = %s",
            (seed.key,),
        )
        row = cur.fetchone()
        recent_hits, miss_streak = (row[0], row[1]) if row else (0, 0)

        decayed     = recent_hits // 2
        recent_hits = decayed + new_hits
        miss_streak = 0 if new_hits else miss_streak + 1
        tier        = _next_tier(recent_hits, miss_streak)

        cur.execute(
            """
            UPDATE soundtrack_seed_state SET
                tier             = %s,
                recent_hits      = %s,
                total_hits       = total_hits + %s,
                miss_streak      = %s,
                last_searched_at = NOW(),
                last_hit_at      = CASE WHEN %s > 0 THEN NOW() ELSE last_hit_at END,
                updated_at       = NOW()
            WHERE seed_key = %s
            """,
            (tier, recent_hits, new_hits, miss_streak, new_hits, seed.key),
        )
    conn.commit()
    return tier


def record_candidates(conn, rows: list[dict]) -> None:
    """
    Stores the category decided for each discovered ASIN, to be applied once
    main.py Phase 2.8 has created the Disco row.

    ON CONFLICT DO NOTHING: the first seed to find an ASIN owns its category.
    Later seeds finding the same ASIN don't get to relabel it.
    """
    if not rows:
        return
    with _cursor(conn) as cur:
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO soundtrack_candidates (asin, seed_key, category, titulo)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (asin) DO NOTHING
            """,
            [(r["asin"], r["seed_key"], r["category"], r.get("titulo")) for r in rows],
            page_size=500,
        )
    conn.commit()


def _merge_tags(existing: str | None, additions: list[str]) -> str:
    """
    Unions new tags into a Disco.lastfm_tags CSV, preserving what enrichment
    already wrote. Case-insensitive dedupe, original order kept.
    """
    current = [t.strip() for t in (existing or "").split(",") if t.strip()]
    lowered = {t.lower() for t in current}
    for tag in additions:
        if tag.lower() not in lowered:
            current.append(tag)
            lowered.add(tag.lower())
    return ", ".join(current)


def apply_pending_tags(conn) -> tuple[int, int]:
    """
    Tags candidate ASINs that have since been ingested as vinyl.

    Runs at the START of each run rather than as a separate scheduled job: the
    crawler ingests the queue on its own cadence, so tagging is always catching
    up with the previous run's finds. Self-healing — a candidate missed today is
    retried tomorrow.

    Non-vinyl rows are marked and never tagged: a Funko that reached Disco by
    some other path must not carry a genre. Returns (tagged, marked_non_vinyl).
    """
    with _cursor(conn) as cur:
        cur.execute("""
            SELECT c.asin, c.category, d.lastfm_tags, d.format
            FROM soundtrack_candidates c
            JOIN "Disco" d ON d.asin = c.asin
            WHERE c.status = 'pending'
        """)
        rows = cur.fetchall()

        updates: list[tuple[str, str]] = []
        tagged_asins: list[str] = []
        non_vinyl_asins: list[str] = []

        for asin, category, existing, fmt in rows:
            if fmt is not None and fmt != "vinyl":
                non_vinyl_asins.append(asin)
                continue
            additions = [SOUNDTRACK_TAG] + ([category] if category else [])
            merged = _merge_tags(existing, additions)
            if merged != (existing or ""):
                updates.append((merged, asin))
            tagged_asins.append(asin)

        if updates:
            psycopg2.extras.execute_batch(
                cur,
                'UPDATE "Disco" SET lastfm_tags = %s WHERE asin = %s',
                updates,
                page_size=500,
            )
        if tagged_asins:
            cur.execute(
                """UPDATE soundtrack_candidates
                   SET status = 'tagged', tagged_at = NOW()
                   WHERE asin = ANY(%s)""",
                (tagged_asins,),
            )
        if non_vinyl_asins:
            cur.execute(
                """UPDATE soundtrack_candidates
                   SET status = 'non_vinyl', tagged_at = NOW()
                   WHERE asin = ANY(%s)""",
                (non_vinyl_asins,),
            )

        # Candidates that never became a Disco row (dropped as unknown-format,
        # or never ingested) would otherwise stay pending forever.
        cur.execute(
            """DELETE FROM soundtrack_candidates
               WHERE status = 'pending'
                 AND discovered_at < NOW() - (%s * INTERVAL '1 day')""",
            (CANDIDATE_TTL_DAYS,),
        )
        expired = cur.rowcount

    conn.commit()
    if expired:
        log.info("Pruned %d candidate(s) older than %d days.", expired, CANDIDATE_TTL_DAYS)
    return len(tagged_asins), len(non_vinyl_asins)

# ─────────────────────────────────────────────────────────────────────────────
#  Amazon search
# ─────────────────────────────────────────────────────────────────────────────

def search_query(session, query: str) -> tuple[list[dict], bool]:
    """
    Runs one search query against Amazon Brazil, up to MAX_SEARCH_PAGES.
    Returns (results, blocked). Mirrors lastfm_discovery.search_artist —
    same paging, same CAPTCHA handling, same no-retry policy.
    """
    found: dict[str, dict] = {}
    encoded = urllib.parse.quote(query)

    for page in range(1, MAX_SEARCH_PAGES + 1):
        url = f"{AMAZON_BASE}/s?k={encoded}&i=popular"
        if page > 1:
            url += f"&page={page}"

        try:
            resp = session.get(url, timeout=25)
        except Exception as exc:
            log.warning("[search] %r page %d: request error — %s", query, page, exc)
            return list(found.values()), True

        if resp.status_code != 200:
            log.warning("[search] %r page %d: HTTP %d — skipping query",
                        query, page, resp.status_code)
            return list(found.values()), True

        if _BOT_RE.search(resp.text):
            log.warning("[search] %r page %d: CAPTCHA — skipping query", query, page)
            return list(found.values()), True

        soup = BeautifulSoup(resp.content, "lxml")
        page_results = _parse_page(soup)

        for r in page_results:
            found.setdefault(r["asin"], r)

        log.debug("[search] %r page %d: %d vinyl result(s)", query, page, len(page_results))

        if not page_results:
            break
        if page < MAX_SEARCH_PAGES:
            time.sleep(random.uniform(DELAY_PAGE_MIN, DELAY_PAGE_MAX))

    return list(found.values()), False


def search_seed(session, seed: Seed) -> tuple[list[dict], bool]:
    """Runs every query variant for one seed, deduped by ASIN."""
    found: dict[str, dict] = {}
    blocked_any = False

    queries = seed.queries()
    for i, query in enumerate(queries, 1):
        results, blocked = search_query(session, query)
        blocked_any = blocked_any or blocked
        for r in results:
            found.setdefault(r["asin"], r)
        log.debug("  [%d/%d] %r → %d result(s)", i, len(queries), query, len(results))
        if i < len(queries):
            time.sleep(random.uniform(DELAY_QUERY_MIN, DELAY_QUERY_MAX))

    return list(found.values()), blocked_any

# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Discover soundtrack vinyl ASINs via curated Amazon Brazil searches."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Search and log results without writing to the database.")
    parser.add_argument("--limit", type=int, default=SEEDS_PER_RUN, metavar="N",
                        help=f"Max seeds to search this run (default: {SEEDS_PER_RUN}).")
    parser.add_argument("--seed", type=str, default=None, metavar="NAME",
                        help="Search only this seed (substring match), ignoring rotation.")
    args = parser.parse_args()

    seeds = load_seeds()
    classifier = build_title_classifier(seeds)

    conn = get_connection()
    ensure_soundtrack_tables(conn)
    sync_seed_state(conn, seeds)

    # Apply the previous run's finds now that the crawler has had time to ingest.
    tagged, marked_non_vinyl = apply_pending_tags(conn)
    if tagged or marked_non_vinyl:
        log.info(
            "Applied pending tags: %d tagged, %d skipped as non-vinyl.",
            tagged, marked_non_vinyl,
        )

    # ── Pick this run's seeds ────────────────────────────────────────────────
    if args.seed:
        needle = args.seed.lower()
        due = [s for s in seeds if needle in s.name.lower()]
        if not due:
            log.error("No seed matches %r — aborting.", args.seed)
            conn.close()
            raise SystemExit(1)
        log.info("Forced seed selection (%d): %s", len(due), ", ".join(s.name for s in due))
    else:
        due = select_due_seeds(conn, seeds, args.limit)
        if not due:
            log.info("No seeds due this run — every seed is within its tier interval.")
            conn.close()
            return
        log.info("Seeds due this run (%d/%d): %s",
                 len(due), len(seeds), ", ".join(s.name for s in due))

    # Guard: never co-scrape the storefront with the main crawl or the Last.fm
    # discovery run. Two live Amazon sessions compound CAPTCHA and rate limits.
    _scrape_lock = ScrapeLock(label="soundtrack-discovery")
    _scrape_lock.__enter__()
    if not _scrape_lock.acquired:
        log.warning("Soundtrack discovery skipped — another run holds the storefront "
                    "lock. Exiting without advancing state; the next cron run retries.")
        _scrape_lock.__exit__()
        conn.close()
        return

    session = make_session()
    warm_up(session)

    # ── Search ───────────────────────────────────────────────────────────────
    per_seed_rows: list[tuple[Seed, list[dict]]] = []
    conflicts: list[str] = []
    soundtrack_only: list[str] = []
    untagged: list[str] = []
    seeds_blocked = 0
    soft_timeout_hit = False

    run_start = time.monotonic()

    for idx, seed in enumerate(due, 1):
        elapsed = time.monotonic() - run_start
        if elapsed >= SOFT_TIMEOUT_SECONDS:
            log.warning(
                "Soft timeout reached (%.0fs) at seed [%d/%d] — saving progress and exiting.",
                elapsed, idx - 1, len(due),
            )
            soft_timeout_hit = True
            break

        log.info("[%d/%d] %s %r", idx, len(due), seed.kind, seed.name)

        results, blocked = search_seed(session, seed)
        if blocked:
            seeds_blocked += 1

        for r in results:
            title = r.get("titulo") or ""
            tags, conflict = classify(title, seed, classifier)
            # tags is None → no soundtrack evidence: queue it, tag nothing.
            r["tags"]     = tags
            r["category"] = tags[1] if tags and len(tags) > 1 else None
            r["seed_key"] = seed.key
            r["artist_name"] = seed.name
            r["source"] = f"soundtrack_{seed.kind}_search"

            if conflict:
                msg = f"{r['asin']} [{seed.name}] {title[:60]!r}: {conflict}"
                conflicts.append(msg)
                log.warning("  [conflict] %s", msg)
            elif tags is None:
                msg = f"{r['asin']} [{seed.name}] {title[:60]!r}"
                untagged.append(msg)
                log.info("  [no-ost-evidence] %s", msg)
            elif len(tags) == 1:
                msg = f"{r['asin']} [{seed.name}] {title[:60]!r}"
                soundtrack_only.append(msg)
                log.info("  [soundtrack-only] %s", msg)

        log.info("  → %d vinyl ASIN(s)%s", len(results), " (partial — blocked)" if blocked else "")
        per_seed_rows.append((seed, results))

        if idx < len(due):
            time.sleep(random.uniform(DELAY_SEED_MIN, DELAY_SEED_MAX))

    # Storefront work done — release before DB writes.
    _scrape_lock.__exit__()

    # ── Dedupe across seeds ──────────────────────────────────────────────────
    seen: set[str] = set()
    unique: list[dict] = []
    for _seed, rows in per_seed_rows:
        for r in rows:
            if r["asin"] not in seen:
                seen.add(r["asin"])
                unique.append(r)

    log.info("Unique vinyl ASINs found: %d", len(unique))

    # ── Write ────────────────────────────────────────────────────────────────
    newly_inserted = 0
    already_known  = 0
    per_category: dict[str, int] = {}

    def _bucket(row: dict) -> str:
        if row["tags"] is None:
            return "untagged (no OST evidence)"
        return row["category"] or "soundtrack-only"

    if args.dry_run:
        log.info("[dry-run] Would queue %d ASIN(s) — skipping DB write.", len(unique))
        for r in unique:
            per_category[_bucket(r)] = per_category.get(_bucket(r), 0) + 1
    else:
        newly_inserted, already_known = upsert_discovered(conn, unique)

        # Only genuinely new ASINs count as candidates and as seed yield —
        # upsert_discovered drops what Disco already has.
        known_before: set[str] = set()
        with _cursor(conn) as cur:
            asins = [r["asin"] for r in unique]
            if asins:
                cur.execute(
                    "SELECT asin FROM soundtrack_candidates WHERE asin = ANY(%s)",
                    (asins,),
                )
                known_before = {row[0] for row in cur.fetchall()}
                cur.execute('SELECT asin FROM "Disco" WHERE asin = ANY(%s)', (asins,))
                known_before |= {row[0] for row in cur.fetchall()}

        fresh = [r for r in unique if r["asin"] not in known_before]
        # Only ASINs proven to be soundtracks become candidates; the rest are
        # queued for the catalog but carry no genre claim.
        record_candidates(conn, [r for r in fresh if r["tags"]])

        for r in fresh:
            per_category[_bucket(r)] = per_category.get(_bucket(r), 0) + 1

        fresh_asins = {r["asin"] for r in fresh}
        for seed, rows in per_seed_rows:
            new_hits = sum(1 for r in rows if r["asin"] in fresh_asins)
            tier = record_seed_result(conn, seed, new_hits)
            log.debug("  %s: %d new hit(s) → tier %s", seed.name, new_hits, tier)

    # ── Summary ──────────────────────────────────────────────────────────────
    run_label = "Partial run (soft timeout)" if soft_timeout_hit else "Run complete"
    cat_summary = "  ".join(
        f"{cat}={n}" for cat, n in sorted(per_category.items())
    ) or "none"
    log.info(
        "%s — seeds_searched=%d  seeds_blocked=%d  vinyl_asins_found=%d  "
        "newly_queued=%d  duplicates_skipped=%d  candidates_non_vinyl=%d  "
        "conflicts=%d",
        run_label,
        len(per_seed_rows),
        seeds_blocked,
        len(unique),
        newly_inserted,
        already_known,
        marked_non_vinyl,
        len(conflicts),
    )
    log.info("New ASINs per category — %s", cat_summary)
    log.info(
        "Tagged into Disco this run: %d (from earlier runs' finds).", tagged
    )
    if soundtrack_only:
        log.info(
            "Soundtrack-only (no category proven) — %d:\n  %s",
            len(soundtrack_only), "\n  ".join(soundtrack_only[:40]),
        )
    if untagged:
        log.info(
            "Queued untagged (fuzzy search hit, no OST evidence) — %d:\n  %s",
            len(untagged), "\n  ".join(untagged[:40]),
        )
    if conflicts:
        log.warning(
            "Classification conflicts — %d:\n  %s",
            len(conflicts), "\n  ".join(conflicts[:40]),
        )

    conn.close()


if __name__ == "__main__":
    main()

"""
lastfm_discovery.py — Daily Last.fm → Amazon Brazil vinyl discovery.

Rotates through Last.fm's top artists in configurable batches, searches
Amazon Brazil for their vinyl records, and queues discovered ASINs in
Supabase for the main crawler to process.

Usage:
    python lastfm_discovery.py            # run current batch
    python lastfm_discovery.py --dry-run  # parse and log, no DB writes
    python lastfm_discovery.py --batch 3  # override batch index

Schedule: once per day.  State (batch_index) lives in Supabase so it
survives across ephemeral CI runners.

Dependencies: same as main.py (curl_cffi preferred, requests fallback).
"""
import os
import re
import json
import time
import random
import logging
import argparse
import urllib.parse
import urllib.request
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup

from database import get_connection

# ─────────────────────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────────────────────

LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")
LASTFM_BASE    = "https://ws.audioscrobbler.com/2.0/"
LASTFM_DELAY   = 0.25   # seconds between Last.fm page requests (≤5 req/s limit)

AMAZON_BASE    = "https://www.amazon.com.br"

# Batch schedule: (start_rank, end_rank) — 1-indexed Last.fm chart positions.
# After the last batch wraps back to index 0.
BATCHES: list[tuple[int, int]] = [
    (1,    200),   # 0 — chart elite
    (201,  400),   # 1
    (401,  700),   # 2 — wider block for mid-tier
    (701,  1000),  # 3
    (1001, 1200),  # 4
    (1201, 1400),  # 5
    (1401, 1600),  # 6
    (1601, 1900),  # 7
    (1901, 2200),  # 8
    (2201, 2400),  # 9
    (2401, 2600),  # 10
    (2601, 2900),  # 11
    (2901, 3000),  # 12
]

MAX_SEARCH_PAGES = 3
DELAY_PAGE_MIN   = 3.0   # seconds between Amazon search pages
DELAY_PAGE_MAX   = 5.0
DELAY_ARTIST_MIN = 8.0   # seconds between artists
DELAY_ARTIST_MAX = 15.0

MIN_PRICE_BRL = 30.0

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
#  Compiled regexes
# ─────────────────────────────────────────────────────────────────────────────

_ASIN_RE        = re.compile(r"/dp/([A-Z0-9]{10})", re.IGNORECASE)
_PRICE_CLEAN_RE = re.compile(r"R\$\s*|\xa0|\s")
_PRICE_NUM_RE   = re.compile(r"\d+\.?\d*")
_BOT_RE         = re.compile(
    r"Robot Check|Verificação de robô|Digite os caracteres"
    r"|just need to make sure you.re not a robot|validateCaptcha"
    r"|Prove you.re not a robot|Access Denied",
    re.IGNORECASE,
)
_VINIL_RE   = re.compile(r"disco\s+de\s+vinil", re.IGNORECASE)
_NO_BUY_RE  = re.compile(r"nenhuma\s+op.+?de\s+compra\s+em\s+destaque", re.IGNORECASE)
_OUTRO_RE   = re.compile(r"outro\s+formato|other\s+format", re.IGNORECASE)

# ─────────────────────────────────────────────────────────────────────────────
#  HTTP session
# ─────────────────────────────────────────────────────────────────────────────

_BROWSER_IDS = [
    "chrome136", "chrome133a", "chrome131", "chrome124",
    "edge101", "firefox144", "firefox135",
]

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]

_ACCEPT_LANGS = [
    "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "pt-BR,pt;q=0.9,en;q=0.8",
    "pt-BR,pt;q=0.8,en-US;q=0.7,en;q=0.6",
]


def make_session():
    """curl_cffi session preferred; falls back to requests."""
    try:
        from curl_cffi import requests as cffi
        s = cffi.Session(impersonate=random.choice(_BROWSER_IDS))
        s.headers.update({
            "Accept-Language": random.choice(_ACCEPT_LANGS),
            "Referer": "https://www.amazon.com.br/",
        })
        return s
    except ImportError:
        import requests as rlib
        s = rlib.Session()
        s.headers.update({
            "User-Agent":      random.choice(_USER_AGENTS),
            "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": random.choice(_ACCEPT_LANGS),
            "DNT":             "1",
            "Connection":      "keep-alive",
            "Referer":         "https://www.amazon.com.br/",
        })
        return s


def warm_up(session) -> None:
    """Visit homepage to prime session cookies before crawling search results."""
    try:
        session.get("https://www.amazon.com.br/", timeout=15)
        time.sleep(random.uniform(1.0, 2.0))
        session.get("https://www.amazon.com.br/CD-e-Vinil/b/?node=7791937011", timeout=15)
        time.sleep(random.uniform(0.8, 1.5))
    except Exception:
        pass

# ─────────────────────────────────────────────────────────────────────────────
#  Database helpers
# ─────────────────────────────────────────────────────────────────────────────

@contextmanager
def _cursor(conn):
    with conn.cursor() as cur:
        cur.execute("SET LOCAL statement_timeout = 0")
        yield cur


def ensure_discovery_tables(conn) -> None:
    """Idempotently create discovered_vinyls and discovery_run_state."""
    with _cursor(conn) as cur:
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS discovered_vinyls (
                asin          TEXT          PRIMARY KEY,
                titulo        TEXT,
                artist_name   TEXT,
                price_brl     DECIMAL(10,2),
                source        TEXT          NOT NULL DEFAULT 'lastfm_artist_search',
                discovered_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS discovery_run_state (
                id          INTEGER     PRIMARY KEY DEFAULT 1,
                batch_index INTEGER     NOT NULL DEFAULT 0,
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        # Seed the state row on first run; do nothing if it already exists.
        cur.execute("""
            INSERT INTO discovery_run_state (id, batch_index, updated_at)
            VALUES (1, 0, NOW())
            ON CONFLICT (id) DO NOTHING
        """)
    conn.commit()
    log.debug("Discovery tables ensured.")


def get_batch_index(conn) -> int:
    with _cursor(conn) as cur:
        cur.execute("SELECT batch_index FROM discovery_run_state WHERE id = 1")
        row = cur.fetchone()
        return row[0] if row else 0


def advance_batch_index(conn, current: int) -> int:
    nxt = (current + 1) % len(BATCHES)
    with _cursor(conn) as cur:
        cur.execute(
            "UPDATE discovery_run_state SET batch_index = %s, updated_at = NOW() WHERE id = 1",
            (nxt,),
        )
    conn.commit()
    return nxt


def upsert_discovered(conn, rows: list[dict]) -> tuple[int, int]:
    """
    Insert rows into discovered_vinyls, skipping ASINs already tracked in Disco.
    Returns (newly_inserted, already_known).
    already_known = already in Disco + already in discovered_vinyls.
    """
    if not rows:
        return 0, 0

    asins = [r["asin"] for r in rows]

    with _cursor(conn) as cur:
        # Skip ASINs the main crawler already tracks fully.
        cur.execute('SELECT asin FROM "Disco" WHERE asin = ANY(%s)', (asins,))
        in_disco: set[str] = {row[0] for row in cur.fetchall()}

        to_insert = [r for r in rows if r["asin"] not in in_disco]
        if not to_insert:
            conn.commit()
            return 0, len(in_disco)

        insert_asins = [r["asin"] for r in to_insert]

        # Count how many are already queued so we can report skipped accurately.
        cur.execute(
            "SELECT asin FROM discovered_vinyls WHERE asin = ANY(%s)",
            (insert_asins,),
        )
        pre_existing: set[str] = {row[0] for row in cur.fetchall()}

        data = [
            (
                r["asin"],
                r.get("titulo") or None,
                r.get("artist_name") or None,
                r.get("price_brl") or None,
                r.get("source", "lastfm_artist_search"),
            )
            for r in to_insert
        ]
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO discovered_vinyls
                (asin, titulo, artist_name, price_brl, source, discovered_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (asin) DO NOTHING
            """,
            data,
            page_size=500,
        )

    conn.commit()
    newly_inserted = len(to_insert) - len(pre_existing)
    already_known  = len(in_disco) + len(pre_existing)
    return newly_inserted, already_known

# ─────────────────────────────────────────────────────────────────────────────
#  Last.fm
# ─────────────────────────────────────────────────────────────────────────────

def fetch_lastfm_artists(api_key: str, start_rank: int, end_rank: int) -> list[str]:
    """
    Fetch artist names from chart.getTopArtists for ranks start_rank..end_rank
    (1-indexed, inclusive).  Returns names in chart order.
    """
    # Last.fm uses limit=50 pages; compute which API pages overlap the range.
    page_start = (start_rank - 1) // 50 + 1
    page_end   = (end_rank   - 1) // 50 + 1

    raw: list[str] = []
    for page in range(page_start, page_end + 1):
        params = urllib.parse.urlencode({
            "method": "chart.getTopArtists",
            "api_key": api_key,
            "page":    page,
            "limit":   50,
            "format":  "json",
        })
        try:
            with urllib.request.urlopen(f"{LASTFM_BASE}?{params}", timeout=15) as resp:
                data = json.loads(resp.read())
        except Exception as exc:
            log.warning("Last.fm page %d fetch failed: %s", page, exc)
            if page < page_end:
                time.sleep(LASTFM_DELAY)
            continue

        if "error" in data:
            log.warning("Last.fm API error (page %d): %s", page, data.get("message"))
            continue

        page_artists = data.get("artists", {}).get("artist", [])
        raw.extend(a.get("name", "").strip() for a in page_artists)
        log.debug("Last.fm page %d: %d artists", page, len(page_artists))

        if page < page_end:
            time.sleep(LASTFM_DELAY)

    # Slice raw list to exactly [start_rank-1 : end_rank] relative to page_start.
    global_offset = (page_start - 1) * 50        # absolute index of raw[0]
    lo = (start_rank - 1) - global_offset
    hi = (end_rank)       - global_offset
    return [a for a in raw[lo:hi] if a]

# ─────────────────────────────────────────────────────────────────────────────
#  Price parsing
# ─────────────────────────────────────────────────────────────────────────────

def _parse_price(text: str) -> float | None:
    if not text:
        return None
    cleaned = _PRICE_CLEAN_RE.sub("", text).replace(".", "").replace(",", ".")
    m = _PRICE_NUM_RE.search(cleaned)
    if not m:
        return None
    try:
        v = float(m.group())
        return v if v >= MIN_PRICE_BRL else None
    except ValueError:
        return None

# ─────────────────────────────────────────────────────────────────────────────
#  Amazon search parsing
# ─────────────────────────────────────────────────────────────────────────────

def _parse_page(soup) -> list[dict]:
    """
    Extract vinyl records from one Amazon search results page.
    Returns list of {asin, titulo, price_brl}.
    """
    results: list[dict] = []

    for card in soup.select('div[data-component-type="s-search-result"][data-asin]'):
        card_asin = card.get("data-asin", "").strip().upper()
        if not card_asin or len(card_asin) != 10:
            continue

        # Cards with no active listing are uninteresting.
        if _NO_BUY_RE.search(card.get_text(" ", strip=True)):
            continue

        vinyl_asin: str | None = None

        # ── Case 1: card's own format is vinyl ────────────────────────────────
        # The format label "Disco de Vinil" appears as an <a class="a-text-bold">
        # inside div[data-cy="price-recipe"].
        price_recipe = card.select_one('div[data-cy="price-recipe"]')
        if price_recipe:
            for link in price_recipe.select("a.a-text-bold"):
                if _VINIL_RE.search(link.get_text(strip=True)):
                    vinyl_asin = card_asin
                    break

        # ── Case 2: "Outro formato: Disco de Vinil" — CD card with vinyl link ─
        # The vinyl ASIN is embedded in the href, not in data-asin.
        if vinyl_asin is None:
            for link in card.select("a[href]"):
                if not _VINIL_RE.search(link.get_text(strip=True)):
                    continue
                parent_text = (link.parent.get_text(" ", strip=True)
                               if link.parent else "")
                if _OUTRO_RE.search(parent_text):
                    m = _ASIN_RE.search(link.get("href", ""))
                    if m:
                        vinyl_asin = m.group(1).upper()
                        break

        if vinyl_asin is None:
            continue

        # ── Title ─────────────────────────────────────────────────────────────
        title = ""
        h2 = card.select_one("h2[aria-label]")
        if h2:
            title = h2.get("aria-label", "").strip()
        if not title:
            h2 = card.select_one("h2")
            if h2:
                title = h2.get_text(" ", strip=True)

        # ── Price ─────────────────────────────────────────────────────────────
        price: float | None = None
        for el in card.select(".a-price .a-offscreen"):
            price = _parse_price(el.get_text(strip=True))
            if price:
                break

        results.append({"asin": vinyl_asin, "titulo": title, "price_brl": price})

    return results


def search_artist(session, artist_name: str) -> tuple[list[dict], bool]:
    """
    Search Amazon Brazil for an artist's vinyl records (up to MAX_SEARCH_PAGES).

    Returns (results, captcha_blocked).
    On CAPTCHA or HTTP error: logs the artist, returns ([], True) — no retry.
    """
    found: dict[str, dict] = {}
    encoded = urllib.parse.quote(artist_name)

    for page in range(1, MAX_SEARCH_PAGES + 1):
        if page == 1:
            url = f"{AMAZON_BASE}/s?k={encoded}&i=popular"
        else:
            url = f"{AMAZON_BASE}/s?k={encoded}&i=popular&page={page}"

        try:
            resp = session.get(url, timeout=25)
        except Exception as exc:
            log.warning("[search] %r page %d: request error — %s", artist_name, page, exc)
            return list(found.values()), True

        if resp.status_code != 200:
            log.warning(
                "[search] %r page %d: HTTP %d — skipping artist",
                artist_name, page, resp.status_code,
            )
            return list(found.values()), True

        if _BOT_RE.search(resp.text):
            log.warning("[search] %r page %d: CAPTCHA — skipping artist", artist_name, page)
            return list(found.values()), True

        soup = BeautifulSoup(resp.content, "lxml")
        page_results = _parse_page(soup)

        for r in page_results:
            if r["asin"] not in found:
                found[r["asin"]] = r

        log.debug("[search] %r page %d: %d vinyl result(s)", artist_name, page, len(page_results))

        # No results on this page → end of search results, stop paging.
        if not page_results:
            break

        if page < MAX_SEARCH_PAGES:
            time.sleep(random.uniform(DELAY_PAGE_MIN, DELAY_PAGE_MAX))

    return list(found.values()), False

# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Discover vinyl ASINs via Last.fm top artists → Amazon Brazil search."
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and log results without writing to the database.")
    parser.add_argument("--batch", type=int, default=None,
                        help="Override batch index (0-based). Ignores stored state.")
    args = parser.parse_args()

    if not LASTFM_API_KEY:
        log.error("LASTFM_API_KEY not set — aborting.")
        raise SystemExit(1)

    conn = get_connection()
    ensure_discovery_tables(conn)

    batch_index = args.batch if args.batch is not None else get_batch_index(conn)
    batch_index = batch_index % len(BATCHES)
    start_rank, end_rank = BATCHES[batch_index]
    n_artists = end_rank - start_rank + 1

    log.info(
        "Discovery run: batch %d/%d — Last.fm ranks %d–%d (%d artists).",
        batch_index, len(BATCHES) - 1, start_rank, end_rank, n_artists,
    )

    # ── Fetch artists from Last.fm ────────────────────────────────────────────
    log.info("Fetching Last.fm chart ranks %d–%d…", start_rank, end_rank)
    artists = fetch_lastfm_artists(LASTFM_API_KEY, start_rank, end_rank)

    if not artists:
        log.error("No artists returned from Last.fm — aborting without advancing state.")
        conn.close()
        raise SystemExit(1)

    log.info("Got %d artists from Last.fm.", len(artists))

    # ── Warm up a fresh session ───────────────────────────────────────────────
    session = make_session()
    warm_up(session)

    # ── Search each artist on Amazon ──────────────────────────────────────────
    all_vinyls: list[dict] = []
    artists_with_results = 0
    artists_no_results   = 0
    artists_blocked      = 0
    blocked_names: list[str] = []

    for idx, artist in enumerate(artists, 1):
        log.info("[%d/%d] %r", idx, len(artists), artist)

        vinyls, blocked = search_artist(session, artist)

        # Track block separately — keep any partial results from completed pages.
        if blocked:
            artists_blocked += 1
            blocked_names.append(artist)

        if vinyls:
            artists_with_results += 1
            log.info("  → %d vinyl ASIN(s)%s", len(vinyls), " (partial — blocked)" if blocked else "")
            for v in vinyls:
                v["artist_name"] = artist
                v["source"]      = "lastfm_artist_search"
            all_vinyls.extend(vinyls)
        elif not blocked:
            artists_no_results += 1
            log.debug("  → no vinyl found")

        if idx < len(artists):
            time.sleep(random.uniform(DELAY_ARTIST_MIN, DELAY_ARTIST_MAX))

    # ── Deduplicate across artists (same ASIN may appear for multiple) ────────
    seen: set[str] = set()
    unique_vinyls: list[dict] = []
    for v in all_vinyls:
        if v["asin"] not in seen:
            seen.add(v["asin"])
            unique_vinyls.append(v)

    log.info("Unique vinyl ASINs found: %d", len(unique_vinyls))

    # ── Write to DB ───────────────────────────────────────────────────────────
    newly_inserted = 0
    already_known  = 0

    if args.dry_run:
        log.info("[dry-run] Would upsert %d rows — skipping DB write.", len(unique_vinyls))
    else:
        newly_inserted, already_known = upsert_discovered(conn, unique_vinyls)
        next_index = advance_batch_index(conn, batch_index)
        nxt_start, nxt_end = BATCHES[next_index]
        log.info(
            "Advanced batch_index %d → %d (next run: ranks %d–%d).",
            batch_index, next_index, nxt_start, nxt_end,
        )

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info(
        "Run complete — "
        "artists_processed=%d  artists_no_vinyl=%d  artists_blocked=%d  "
        "vinyl_asins_found=%d  newly_inserted=%d  already_known=%d",
        artists_with_results + artists_no_results,
        artists_no_results,
        artists_blocked,
        len(unique_vinyls),
        newly_inserted,
        already_known,
    )
    if blocked_names:
        log.info("Blocked artists (%d): %s", len(blocked_names),
                 ", ".join(blocked_names[:30]))

    conn.close()


if __name__ == "__main__":
    main()

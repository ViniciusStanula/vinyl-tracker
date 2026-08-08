"""mb_backfill_secondary_types.py — fill mb_secondary_types for already-matched rows.

mb_enrich stores secondary types going forward, but ~27k rows were matched
before the column existed. Their MBID is already known, so this needs a direct
release-group lookup rather than a search — one request per row, no matching
risk.

Why it is worth 8 hours of polite crawling: "Soundtrack" is an official
MusicBrainz secondary type. Everything else the catalog uses to decide whether a
record is a soundtrack is inference — the title saying "OST", a Discogs style, a
Last.fm crowd tag — and each of those has been wrong in both directions. This is
the one field that answers the question outright.

Priority order is deliberate: rows already carrying soundtrack/anime/game come
first, because those are the ones whose tags are under review.

Usage:
    python mb_backfill_secondary_types.py --limit 200        # dry run
    python mb_backfill_secondary_types.py --limit 200 --apply
    python mb_backfill_secondary_types.py --apply            # until done
"""
import os
import sys
import json
import time
import logging
import argparse
import urllib.request
import urllib.error

from dotenv import load_dotenv
load_dotenv()

from database import get_connection
import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(),
              logging.FileHandler("logs/mb_secondary_backfill.log", encoding="utf-8")],
)
log = logging.getLogger(__name__)

MB_BASE = "https://musicbrainz.org/ws/2/"
USER_AGENT = os.environ.get(
    "MB_USER_AGENT", "VinylTracker/1.0 ( vinicius.stanula@gmail.com )")

# MB asks for <= 1 req/s. 1.1 matches mb_enrich.
DELAY = 1.1

SELECT_SQL = """
    SELECT id, asin, mb_mbid, titulo
    FROM "Disco"
    WHERE mb_mbid IS NOT NULL AND mb_mbid <> ''
      AND mb_secondary_types IS NULL
      AND (format IS NULL OR format = 'vinyl')
    ORDER BY
      -- rows whose genre tags are under review first
      (lastfm_tags ILIKE '%%soundtrack%%'
       OR lastfm_tags ILIKE '%%anime%%'
       OR lastfm_tags ILIKE '%%game%%') DESC,
      lastfm_listeners DESC NULLS LAST
    LIMIT %s
"""


def fetch_secondary_types(mbid: str) -> str | None:
    """Returns the comma-joined secondary types, "" when the group has none,
    or None when the lookup failed (so the row is retried on a later run)."""
    req = urllib.request.Request(
        f"{MB_BASE}release-group/{mbid}?fmt=json",
        headers={"User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return ""          # MBID merged away; don't keep asking
        log.warning("  %s: HTTP %s", mbid, exc.code)
        return None
    except Exception as exc:
        log.warning("  %s: %s", mbid, exc)
        return None
    return ", ".join(data.get("secondary-types") or [])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max rows (0 = all)")
    ap.add_argument("--apply", action="store_true", help="write to the database")
    args = ap.parse_args()

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(SELECT_SQL, (args.limit or 10 ** 9,))
        rows = cur.fetchall()
    log.info("Rows to look up: %d%s", len(rows), "" if args.apply else "  (dry run)")

    updates, done, failed, hits = [], 0, 0, 0
    for i, (rid, asin, mbid, titulo) in enumerate(rows, 1):
        st = fetch_secondary_types(mbid)
        if st is None:
            failed += 1
        else:
            # "" is a real answer (a plain studio album) and must be stored, or
            # the row is re-fetched forever.
            updates.append({"id": rid, "st": st})
            if "Soundtrack" in st:
                hits += 1
                log.info("  [soundtrack] %s  %s", asin, (titulo or "")[:60])
        done += 1

        if args.apply and len(updates) >= 100:
            # Sorted by id so this job locks rows in the same order deal_scorer
            # does. Unsorted, the two deadlocked and Postgres killed whichever
            # it liked — three crawl runs died that way, and the crawler is the
            # one that must never lose, since it carries the price refresh.
            updates.sort(key=lambda u: u["id"])
            with conn.cursor() as cur:
                psycopg2.extras.execute_batch(
                    cur, 'UPDATE "Disco" SET mb_secondary_types = %(st)s WHERE id = %(id)s',
                    updates, page_size=100)
            conn.commit()
            updates.clear()
            log.info("... %d/%d done, %d soundtracks found, %d failed",
                     done, len(rows), hits, failed)
        time.sleep(DELAY)

    if args.apply and updates:
        updates.sort(key=lambda u: u["id"])
        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(
                cur, 'UPDATE "Disco" SET mb_secondary_types = %(st)s WHERE id = %(id)s',
                updates, page_size=100)
        conn.commit()

    log.info("Done — looked up %d, soundtracks %d, failed %d.", done, hits, failed)


if __name__ == "__main__":
    main()

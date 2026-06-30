"""
mb_rating.py — Second-pass MusicBrainz enrichment: fetch the community rating
for records already matched to a release-group (mb_mbid set) by mb_enrich.py.

One MB call per record: release-group lookup with inc=ratings → value (0-5)
and votes-count, stored in mb_rating / mb_rating_votes. The frontend only
surfaces ratings with >=10 votes (low-vote ratings are noise).

IMPORTANT: MusicBrainz allows ~1 request/sec PER IP. Do NOT run this at the
same time as mb_enrich.py or mb_tracklist.py — together they exceed the limit.
Run the MB passes sequentially.

Usage:
    python mb_rating.py
    python mb_rating.py --max-chunks 1     # smoke / top-N records only

Requires DATABASE_URL in environment (or .env file).
"""
import os
import sys
import json
import time
import argparse
import logging
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import (
    get_connection,
    fetch_albums_needing_rating,
    bulk_update_rating,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

MB_BASE = "https://musicbrainz.org/ws/2/"
USER_AGENT = os.environ.get(
    "MB_USER_AGENT", "VinylTracker/1.0 ( vinicius.stanula@gmail.com )"
)


def fetch_rating(mbid: str) -> tuple[float, int] | None:
    """Returns (value 0-5, votes) for the release-group, or None on error."""
    url = f"{MB_BASE}release-group/{mbid}?inc=ratings&fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("rating fetch failed for %s: %s", mbid, exc)
        return None
    r = data.get("rating") or {}
    return (r.get("value"), r.get("votes-count") or 0)


def parse_args():
    p = argparse.ArgumentParser(description="Backfill MusicBrainz community ratings for matched release-groups")
    p.add_argument("--chunk",      type=int,   default=200, metavar="N")
    p.add_argument("--delay",      type=float, default=1.1, metavar="S",
                   help="Seconds between MB requests — keep >= 1.1 (default: 1.1)")
    p.add_argument("--max-chunks", type=int,   default=0,   metavar="N",
                   help="Stop after N chunks (0 = run until done)")
    return p.parse_args()


def main():
    args = parse_args()
    conn = get_connection()

    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE mb_mbid IS NOT NULL AND mb_mbid <> ''
                 AND mb_rating IS NULL AND disponivel = TRUE"""
        )
        start = cur.fetchone()[0]
    log.info("Starting rating backfill: %d matched rows need a rating.", start)

    total = rated = chunks = 0
    t_start = time.monotonic()

    while True:
        rows = fetch_albums_needing_rating(conn, limit=args.chunk)
        if not rows:
            log.info("No more rows — rating backfill complete.")
            break

        updates = []
        for r in rows:
            res = fetch_rating(r["mbid"])
            value = res[0] if res else None
            votes = res[1] if res else 0
            # -1 sentinel marks "fetched, no rating" so the row is not re-queried.
            updates.append({
                "id":     r["id"],
                "rating": value if value is not None else -1,
                "votes":  votes,
            })
            if value:
                rated += 1
            time.sleep(args.delay)

        total += bulk_update_rating(conn, updates)
        chunks += 1
        elapsed = time.monotonic() - t_start
        rate = total / elapsed if elapsed else 0
        eta_h = (max(start - total, 0) / rate / 3600) if rate else 0
        log.info("Chunk %d — %d/%d done, %d rated (%.0f%%), ETA %.1fh.",
                 chunks, total, start, rated, 100 * rated / total if total else 0, eta_h)

        if args.max_chunks and chunks >= args.max_chunks:
            log.info("Reached --max-chunks=%d — stopping.", args.max_chunks)
            break

    conn.close()
    log.info("Done. %d rows processed, %d rated, in %.0fs.",
             total, rated, time.monotonic() - t_start)


if __name__ == "__main__":
    main()

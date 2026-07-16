"""
backfill_listeners.py — One-time drainer for the Last.fm album-enrichment backlog.

The crawl's Phase 5 enriches only `limit=200` albums per run (and stops at the
crawl deadline), so the ~50k rows with lastfm_listeners IS NULL never drain.
This script calls enrich_album_infos in chunks until no NULL rows remain,
committing after each chunk so a long run is crash-safe and resumable.

Last.fm's API is free; the only constraint is the ~5 req/s rate limit, handled
by the inter-row delay inside enrich_album_infos.

Usage:
    python backfill_listeners.py
    python backfill_listeners.py --chunk 200 --delay 0.4
    python backfill_listeners.py --max-chunks 5      # smoke test, ~1000 rows

Requires LASTFM_API_KEY and DATABASE_URL in environment (or .env file).
"""
import os
import sys
import time
import argparse
import logging

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import get_connection
from lastfm import enrich_album_infos

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def parse_args():
    p = argparse.ArgumentParser(description="Drain the Last.fm listener-enrichment backlog")
    p.add_argument("--chunk",      type=int,   default=200,  metavar="N",
                   help="Albums processed per enrich_album_infos call (default: 200)")
    p.add_argument("--delay",      type=float, default=0.4,  metavar="S",
                   help="Seconds between Last.fm requests (default: 0.4)")
    p.add_argument("--max-chunks", type=int,   default=0,    metavar="N",
                   help="Stop after N chunks (0 = run until drained; use for smoke tests)")
    return p.parse_args()


def main():
    args = parse_args()

    if not os.environ.get("LASTFM_API_KEY"):
        log.error("LASTFM_API_KEY is not set. Aborting.")
        sys.exit(1)

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE lastfm_listeners IS NULL AND disponivel = TRUE
                 AND (format IS NULL OR format = 'vinyl')
                 AND artista !~* 'artista n[ãa]o identificad'"""
        )
        start_null = cur.fetchone()[0]
    log.info("Starting drain: %d identified-artist rows with NULL listeners.", start_null)

    total = 0
    chunks = 0
    t_start = time.monotonic()

    while True:
        updated = enrich_album_infos(
            conn,
            api_key=os.environ["LASTFM_API_KEY"],
            delay=args.delay,
            deadline=None,
            limit=args.chunk,
            exclude_unidentified=True,
        )
        if updated == 0:
            log.info("No more NULL rows — drain complete.")
            break

        total += updated
        chunks += 1
        elapsed = time.monotonic() - t_start
        rate = total / elapsed if elapsed else 0
        remaining = max(start_null - total, 0)
        eta_h = (remaining / rate / 3600) if rate else 0
        log.info("Chunk %d done — %d/%d processed (%.1f rows/s, ETA %.1fh).",
                 chunks, total, start_null, rate, eta_h)

        if args.max_chunks and chunks >= args.max_chunks:
            log.info("Reached --max-chunks=%d — stopping.", args.max_chunks)
            break

    conn.close()
    log.info("Done. %d rows enriched across %d chunks in %.0fs.",
             total, chunks, time.monotonic() - t_start)


if __name__ == "__main__":
    main()

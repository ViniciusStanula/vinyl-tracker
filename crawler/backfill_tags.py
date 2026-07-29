"""
backfill_tags.py — Tags every Disco row with lastfm_tags IS NULL, per RECORD.

Runs on a schedule (.github/workflows/tag_enrichment.yml, every 6h) so this
is the entry point for tagging brand-new listings, not just a one-time
backfill despite the filename.

Was per-ARTIST (Last.fm artist.getTopTags, one call per artist, written via
UPDATE ... WHERE artista = %s) until 2026-07-29: that stamped the SAME 3
tags onto every album by an artist, capping 21,373 records at an identical
artist-wide value (Pantera's "Reinventing the Steel", "Cowboys From Hell",
"History of Hostility" all showed the same genre string). Fixed to call
album.getTopTags per record instead. See crawler/rematch_album_tags.py for
the one-off backfill that corrected the already-clobbered rows; this file
is what keeps NEW rows from developing the same problem going forward.

Safe to interrupt and re-run: only rows with lastfm_tags IS NULL are
selected, and a row is written (even to '') as soon as it's processed, so a
partial run just leaves the remainder NULL for next time.

Usage:
    python backfill_tags.py
    python backfill_tags.py --dry-run        # print what would be fetched, no writes
    python backfill_tags.py --delay 0.3      # slower rate (default: 0.25)
    python backfill_tags.py --limit 500      # cap this run (workflow uses this)

Requires:
    LASTFM_API_KEY and DATABASE_URL in environment (or .env file).
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

from database import get_connection, ensure_schema_extras, fetch_untagged_discos, bulk_update_tags_by_slug
from lastfm import fetch_album_tags, clean_album_title
from genre_filter import filter_genres

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def parse_args():
    p = argparse.ArgumentParser(description="Tag every Disco row missing lastfm_tags, per record")
    p.add_argument("--dry-run",  action="store_true", help="Fetch tags but do not write to DB")
    p.add_argument("--delay",    type=float, default=0.25, metavar="S",
                   help="Seconds between Last.fm requests (default: 0.25)")
    p.add_argument("--limit",    type=int, default=None, metavar="N",
                   help="Cap the number of rows processed this run")
    p.add_argument("--verbose",  action="store_true")
    return p.parse_args()


def main():
    args = parse_args()
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    api_key = os.environ.get("LASTFM_API_KEY", "")
    if not api_key:
        log.error("LASTFM_API_KEY is not set. Aborting.")
        sys.exit(1)

    log.info("Connecting to database...")
    conn = get_connection()
    ensure_schema_extras(conn)   # adds lastfm_tags column if it doesn't exist yet

    rows = fetch_untagged_discos(conn, limit=args.limit)
    total = len(rows)
    log.info("Records to tag: %d%s", total, "  (dry-run — no writes)" if args.dry_run else "")

    if total == 0:
        log.info("Nothing to do. All records already have tags.")
        conn.close()
        return

    t_start = time.monotonic()
    done = 0

    for i, (slug, artista, titulo) in enumerate(rows, 1):
        clean = clean_album_title(titulo, artista)
        # Pull more raw candidates than kept -- filter_genres below removes
        # junk Last.fm ranks high (years, the artist's own name as a
        # self-tag), so truncating before filtering can throw away a real
        # genre tag ranked behind five junk ones.
        raw_tags = fetch_album_tags(artista, clean, api_key, max_tags=15)
        tags = filter_genres(raw_tags)[:5] if raw_tags is not None else []
        tag_str = ", ".join(tags)

        if args.verbose or i % 50 == 0:
            log.info("[%d/%d] %r / %r → %s", i, total, artista, clean, repr(tag_str) if tag_str else "(none)")

        if not args.dry_run:
            bulk_update_tags_by_slug(conn, {slug: tag_str})
            done += 1

        if i < total:
            time.sleep(args.delay)

    conn.close()
    elapsed = time.monotonic() - t_start
    log.info(
        "Done. %d/%d records %s in %.0fs.",
        done if not args.dry_run else total,
        total,
        "tagged" if not args.dry_run else "inspected (dry-run)",
        elapsed,
    )


if __name__ == "__main__":
    main()

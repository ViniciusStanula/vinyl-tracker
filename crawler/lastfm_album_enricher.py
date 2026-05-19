"""
lastfm_album_enricher.py — Standalone script to enrich Disco records with
Last.fm album.getInfo data (listeners, playcount, English wiki summary).

Run standalone:  python lastfm_album_enricher.py
Also called from main.py as Phase 5.

Processes albums where lastfm_listeners IS NULL, prioritising those with
the most price history (price_count DESC) so popular records get enriched first.
"""
import os
import logging

from database import get_connection
from lastfm import enrich_album_infos, backfill_album_images

log = logging.getLogger(__name__)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--backfill-images",
        action="store_true",
        help="Fetch lastfm_img_url for albums that already have listener data but no image.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Max albums to process per run (default 500).",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    _api_key = os.environ.get("LASTFM_API_KEY")
    if not _api_key:
        print("LASTFM_API_KEY not set — nothing to do.")
    else:
        _conn = get_connection()
        try:
            if args.backfill_images:
                _updated = backfill_album_images(_conn, api_key=_api_key, limit=args.limit)
                print(f"Image backfill: processed {_updated} albums.")
            else:
                _updated = enrich_album_infos(_conn, api_key=_api_key, limit=args.limit)
                print(f"Enriched {_updated} albums with Last.fm data.")
        finally:
            _conn.close()

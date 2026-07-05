"""One-off local drainer for the Last.fm album-enrichment backlog.

Runs enrich_album_infos in 500-row chunks (each chunk commits) until the
queue of available, known-artist vinyl with lastfm_listeners IS NULL is empty.
Resilient to interruption — already-processed rows are not NULL anymore.

Usage: python drain_enrichment.py
"""
import os
import time
import logging

from dotenv import load_dotenv

load_dotenv()

from database import get_connection
from lastfm import enrich_album_infos

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("drain")

CHUNK = 500
DELAY = 0.3  # Last.fm free API ~5 req/s; 0.3s stays well under with fallback calls

def main() -> None:
    api_key = os.environ["LASTFM_API_KEY"]
    total = 0
    chunk_no = 0
    while True:
        chunk_no += 1
        conn = get_connection()
        try:
            n = enrich_album_infos(
                conn,
                api_key=api_key,
                delay=DELAY,
                deadline=None,
                limit=CHUNK,
                exclude_unidentified=True,
            )
        finally:
            conn.close()
        total += n
        log.info("=== chunk %d done: processed %d (running total %d) ===", chunk_no, n, total)
        if n < CHUNK:
            break
        time.sleep(1)
    log.info("DRAIN COMPLETE — %d rows processed across %d chunks.", total, chunk_no)


if __name__ == "__main__":
    main()

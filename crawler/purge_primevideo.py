"""
purge_primevideo.py — One-shot cleanup: find ASINs that redirect to primevideo.com
and mark them unavailable in the Disco table.

Usage:
    python purge_primevideo.py [--dry-run] [--limit N]

Reads DATABASE_URL from .env or environment.
Makes HEAD requests to amazon.com.br; follows redirects; checks final domain.
Respects a 1 s delay between requests to avoid rate-limiting.
"""
import os
import sys
import time
import logging
import argparse

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(__file__))
from preflight import load_dotenv_if_present
from database import get_connection

DELAY = 1.0  # seconds between requests
AMAZON_BASE = "https://www.amazon.com.br/dp/"
PRIME_VIDEO_HOST = "primevideo.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def is_prime_video(asin: str, session) -> bool:
    url = f"{AMAZON_BASE}{asin}"
    try:
        resp = session.get(url, timeout=15, headers=HEADERS, allow_redirects=True)
        final = getattr(resp, "url", "") or str(resp.url)
        return PRIME_VIDEO_HOST in final
    except Exception as exc:
        log.warning("ASIN %s — request error: %s", asin, exc)
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print matches without updating DB")
    parser.add_argument("--limit", type=int, default=0, help="Max ASINs to check (0 = all)")
    args = parser.parse_args()

    load_dotenv_if_present()

    try:
        import requests as req_lib
        session = req_lib.Session()
    except ImportError:
        try:
            from curl_cffi import requests as cffi_requests
            session = cffi_requests.Session(impersonate="chrome124")
        except ImportError:
            log.error("Install requests or curl_cffi: pip install requests")
            sys.exit(1)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            query = 'SELECT id, asin FROM "Disco" WHERE disponivel = TRUE'
            if args.limit:
                query += f" LIMIT {args.limit}"
            cur.execute(query)
            rows = cur.fetchall()

        log.info("Checking %d ASINs for Prime Video redirects...", len(rows))
        prime_ids = []

        for idx, (disco_id, asin) in enumerate(rows, 1):
            hit = is_prime_video(asin, session)
            if hit:
                log.info("[%d/%d] ASIN %s → PRIME VIDEO", idx, len(rows), asin)
                prime_ids.append(disco_id)
            else:
                log.debug("[%d/%d] ASIN %s — ok", idx, len(rows), asin)
            time.sleep(DELAY)

        log.info("Found %d Prime Video ASINs.", len(prime_ids))

        if prime_ids and not args.dry_run:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "Disco" SET disponivel = FALSE WHERE id = ANY(%s)',
                    (prime_ids,),
                )
            conn.commit()
            log.info("Marked %d records unavailable.", len(prime_ids))
        elif prime_ids and args.dry_run:
            log.info("Dry-run — no DB changes.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

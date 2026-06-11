#!/usr/bin/env python3
"""
format_sweep.py — classify the physical format of existing catalog rows
(CD-contamination incident, 2026-06-11).

Fetches the Amazon product page for every Disco row whose format is still
NULL and stores detect_format()'s verdict:

  - "vinyl"  → confirmed, stays on the site
  - "cd"     → confirmed non-vinyl, excluded from all site surfaces and
               added to the do-not-recrawl list (via the existing filters)
  - unknown  → format stays NULL (kept visible); logged for manual review

Resumable: rows are processed in visibility order (live, most-priced first)
and each verdict is committed immediately, so the sweep can run in bounded
chunks (--limit) across multiple scheduled runs until no NULL rows remain.

Usage:
    DATABASE_URL=... python format_sweep.py --limit 1500
"""
import argparse
import logging
import random
import sys
import time

from bs4 import BeautifulSoup

from database import get_connection
from domain import detect_format

log = logging.getLogger("format_sweep")

BASE_URL = "https://www.amazon.com.br"

_BOT_SIGNAL = (
    "Robot Check", "validateCaptcha", "Digite os caracteres",
    "Enter the characters you see", "automated access to Amazon",
)


def make_session():
    """curl_cffi session preferred; falls back to requests."""
    try:
        from curl_cffi import requests as cffi
        s = cffi.Session(impersonate="chrome")
        s.headers.update({"Referer": BASE_URL + "/"})
        return s
    except ImportError:
        import requests as rlib
        s = rlib.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
            "Referer": BASE_URL + "/",
        })
        return s


def fetch_format(session, asin: str) -> str | None:
    """Fetch the product page and classify. None = fetch failed (retry later)."""
    try:
        resp = session.get(f"{BASE_URL}/dp/{asin}", timeout=25)
    except Exception as exc:
        log.warning("%s: fetch error: %s", asin, exc)
        return None
    if resp.status_code == 404:
        # Listing gone — cannot verify; treat as unknown (stays NULL).
        return "unknown"
    if resp.status_code != 200:
        log.warning("%s: HTTP %s", asin, resp.status_code)
        return None
    html = resp.text
    if any(sig in html for sig in _BOT_SIGNAL):
        log.warning("%s: bot challenge — aborting this run.", asin)
        raise RuntimeError("bot challenge")
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("#productTitle")
    title = title_el.get_text(strip=True) if title_el else ""
    return detect_format(title, soup)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=1500,
                        help="max product pages to verify this run")
    parser.add_argument("--delay", type=float, default=3.0,
                        help="base delay between page fetches (seconds)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s  %(levelname)-7s %(message)s")

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT asin FROM "Disco"
            WHERE format IS NULL
            ORDER BY disponivel DESC, price_count DESC, "updatedAt" DESC
            LIMIT %s
            """,
            (args.limit,),
        )
        asins = [row[0] for row in cur.fetchall()]

    if not asins:
        log.info("Nothing to sweep — every row already has a format. Done.")
        return

    log.info("Sweeping %d ASIN(s)...", len(asins))
    session = make_session()
    counts = {"vinyl": 0, "cd": 0, "unknown": 0, "failed": 0}

    for i, asin in enumerate(asins, 1):
        try:
            fmt = fetch_format(session, asin)
        except RuntimeError:
            break  # bot challenge — stop politely, resume next run
        if fmt is None:
            counts["failed"] += 1
        elif fmt == "unknown":
            counts["unknown"] += 1
            log.info("%s: unknown — left NULL for manual review.", asin)
        else:
            counts[fmt] += 1
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "Disco" SET format = %s WHERE asin = %s AND format IS NULL',
                    (fmt, asin),
                )
            conn.commit()
            if fmt != "vinyl":
                log.warning("%s: classified %s — excluded from site.", asin, fmt)
        if i % 100 == 0:
            log.info("progress %d/%d  %s", i, len(asins), counts)
        time.sleep(args.delay + random.uniform(0.5, 1.5))

    log.info("Sweep run finished: %s", counts)
    conn.close()
    # Non-vinyl findings are expected during cleanup — exit 0 either way;
    # the post-crawl monitor (not the sweep) is the alarm for NEW insertions.
    sys.exit(0)


if __name__ == "__main__":
    main()

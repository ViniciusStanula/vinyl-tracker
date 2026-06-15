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
_VINYL_URL_PATH = (
    "/s?i=popular&srs=19549018011"
    "&rh=n%3A19549018011"
    "&s=popularity-rank"
    "&fs=true"
    "&ref=lp_19549018011_sar"
)

_BOT_SIGNAL = (
    "Robot Check", "validateCaptcha", "Digite os caracteres",
    "Enter the characters you see", "automated access to Amazon",
)

_BROWSER_IDENTITIES = [
    "chrome136", "chrome133a", "chrome131", "chrome124", "chrome120",
    "edge101", "firefox144", "firefox135", "firefox133",
]

_ACCEPT_LANGUAGES = [
    "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "pt-BR,pt;q=0.9,en;q=0.6",
    "pt-BR,pt;q=0.8,en-US;q=0.5",
]


def make_session():
    """curl_cffi session preferred; falls back to requests."""
    try:
        from curl_cffi import requests as cffi
        s = cffi.Session(impersonate=random.choice(_BROWSER_IDENTITIES))
        s.headers.update({
            "Accept-Language": random.choice(_ACCEPT_LANGUAGES),
            "Referer": BASE_URL + "/",
        })
        return s
    except ImportError:
        import requests as rlib
        s = rlib.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": random.choice(_ACCEPT_LANGUAGES),
            "DNT": "1",
            "Connection": "keep-alive",
            "Referer": BASE_URL + "/",
        })
        return s


def warm_up(session) -> None:
    """Three-step warm-up: homepage → vinyl category → vinyl search results."""
    try:
        session.get(BASE_URL + "/", timeout=15)
        time.sleep(random.uniform(0.8, 1.8))
        session.get(BASE_URL + "/CD-e-Vinil/b/?node=7791937011", timeout=15)
        time.sleep(random.uniform(0.5, 1.2))
        session.get(BASE_URL + _VINYL_URL_PATH, timeout=15)
        time.sleep(random.uniform(0.5, 1.0))
    except Exception:
        pass


def _quick_warmup(session) -> None:
    """Mid-run re-warm after session rotation: homepage + category only."""
    try:
        session.get(BASE_URL + "/", timeout=12)
        time.sleep(random.uniform(0.5, 1.2))
        session.get(BASE_URL + "/CD-e-Vinil/b/?node=7791937011", timeout=12)
        time.sleep(random.uniform(0.3, 0.8))
    except Exception:
        pass


def fetch_format(session, asin: str) -> str | None:
    """
    Fetch the product page and classify.

    Returns:
      "vinyl" / "cd" / "other" — confident verdict, write to DB
      "unknown"                 — page loaded but no format signal (genuine ambiguity)
      None                      — fetch/HTTP error or degraded page (retry later)
    """
    try:
        resp = session.get(f"{BASE_URL}/dp/{asin}", timeout=25)
    except Exception as exc:
        log.warning("%s: fetch error: %s", asin, exc)
        return None
    if resp.status_code == 404:
        return "unknown"   # listing gone; stays NULL
    if resp.status_code != 200:
        log.warning("%s: HTTP %s", asin, resp.status_code)
        return None
    html = resp.text
    if any(sig in html for sig in _BOT_SIGNAL):
        log.warning("%s: bot challenge — aborting this run.", asin)
        raise RuntimeError("bot challenge")
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("#productTitle")
    if title_el is None:
        # No #productTitle → Amazon served a degraded/minimal page under bot
        # pressure. Treat as a fetch failure (None) so it doesn't count toward
        # the unknown-ratio ABORT threshold; the record will retry next run.
        log.debug("%s: degraded page (no #productTitle) — skipping.", asin)
        return None
    title = title_el.get_text(strip=True)
    return detect_format(title, soup, asin=asin)


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
    warm_up(session)
    counts = {"vinyl": 0, "cd": 0, "other": 0, "unknown": 0, "failed": 0}
    _fetches_this_session = 0
    _rotate_after = int(random.uniform(30, 50))
    _aborted = False

    # Early-abort threshold: if Amazon is serving degraded pages (bot pressure),
    # detect_format returns "unknown" for everything. Abort before doing mass damage.
    _UNKNOWN_ABORT_AFTER = 20   # check window
    _UNKNOWN_ABORT_RATIO = 0.80 # abort if >80% unknown in first window

    for i, asin in enumerate(asins, 1):
        # Rotate session periodically so we don't burn a single cookie fingerprint.
        if _fetches_this_session >= _rotate_after:
            log.info("Rotating session after %d fetches.", _fetches_this_session)
            session = make_session()
            warm_up(session)
            _fetches_this_session = 0
            _rotate_after = int(random.uniform(30, 50))

        try:
            fmt = fetch_format(session, asin)
            _fetches_this_session += 1
        except RuntimeError:
            break  # bot challenge — stop politely, resume next run

        if fmt is None:
            counts["failed"] += 1
        elif fmt == "unknown":
            # Cannot determine format — Amazon may have served a degraded page
            # (no detail sections) under bot pressure. These records already
            # passed the main crawler's vinyl allowlist gate at insertion time,
            # so "unknown" here most likely means bad HTML, not a real non-vinyl.
            # Leave format=NULL and retry on the next sweep run instead of
            # wrongly writing "cd" and destroying catalog entries.
            counts["unknown"] += 1
            log.warning("%s: unknown format — skipping (format stays NULL, retry later).", asin)
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

        # Early-abort: if after the first window the unknown rate is suspiciously
        # high, Amazon is serving degraded pages — stop before more damage.
        if i == _UNKNOWN_ABORT_AFTER:
            classified = counts["vinyl"] + counts["cd"] + counts["other"]
            unknown_ratio = counts["unknown"] / i
            if unknown_ratio > _UNKNOWN_ABORT_RATIO:
                log.error(
                    "ABORT — %.0f%% unknown in first %d records (vinyl=%d cd=%d unknown=%d). "
                    "Amazon is likely serving degraded pages. Resume after a cooldown.",
                    unknown_ratio * 100, i, counts["vinyl"], counts["cd"], counts["unknown"],
                )
                _aborted = True
                break

        if i % 100 == 0:
            log.info("progress %d/%d  %s", i, len(asins), counts)
        time.sleep(args.delay + random.uniform(0.5, 1.5))

    log.info("Sweep run finished: %s", counts)
    conn.close()
    # Exit 1 on ABORT so the workflow's "if: success()" re-trigger step does
    # not fire — prevents an infinite ABORT loop when Amazon is blocking us.
    # The 3-hour cron acts as a cooldown restart. Non-ABORT exits use 0.
    sys.exit(1 if _aborted else 0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
diagnose_html.py — Fetch real Amazon BR pages and report which HTML
selectors carry format signals, plus what detect_format() returns.

Usage:
    python diagnose_html.py [ASIN ...]
    python diagnose_html.py  # uses built-in sample list
"""
import random
import sys
import time

from bs4 import BeautifulSoup

from domain import detect_format, _FORMAT_VINYL_RE, _FORMAT_NONVINYL_RE, _FORMAT_LABEL_RE

BASE_URL = "https://www.amazon.com.br"

_BROWSER_IDENTITIES = [
    "chrome136", "chrome133a", "chrome131", "chrome124",
    "edge101", "firefox144", "firefox135",
]
_ACCEPT_LANGUAGES = [
    "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "pt-BR,pt;q=0.9,en;q=0.6",
]

SAMPLE_ASINS = [
    # Title has no vinyl/CD keyword — hardest to classify
    "B0D63LQKPM",   # Fly Like An Eagle tribute
    "B0BPPS6FJT",   # RITCHIE VALENS - THE HITS
    "B09ZY1GFFQ",   # A Collection
    "B002RD4V08",   # Fall Be Kind
    "B0B7SF7S49",   # HEALING
    # Title clearly signals vinyl
    "B0DLLBQFHG",   # Tical [Silver 2 LP]
    "B0D79TZKRY",   # A Perfect Contradiction [VINYL]
    # Title clearly signals CD
    "B0DF9R9DWP",   # Hail to the King [2 CDs]
]

_BOT_SIGNALS = (
    "Robot Check", "validateCaptcha", "Digite os caracteres",
    "Enter the characters you see", "automated access to Amazon",
)

DETAIL_SELECTORS = [
    "#productSubtitle",
    "#detailBullets_feature_div",
    "#productDetails_detailBullets_sections1",
    "#productDetails_techSpec_section_1",
    "#prodDetails",
]


def make_session():
    try:
        from curl_cffi import requests as cffi
        s = cffi.Session(impersonate=random.choice(_BROWSER_IDENTITIES))
    except ImportError:
        import requests as rlib
        s = rlib.Session()
    s.headers.update({
        "Accept-Language": random.choice(_ACCEPT_LANGUAGES),
        "Referer": BASE_URL + "/",
    })
    return s


def warm_up(session):
    try:
        session.get(BASE_URL + "/", timeout=15)
        time.sleep(random.uniform(1.0, 2.0))
        session.get(BASE_URL + "/CD-e-Vinil/b/?node=7791937011", timeout=15)
        time.sleep(random.uniform(0.8, 1.5))
    except Exception:
        pass


def analyse(asin: str, session) -> None:
    url = f"{BASE_URL}/dp/{asin}"
    try:
        resp = session.get(url, timeout=25)
    except Exception as exc:
        print(f"  FETCH ERROR: {exc}")
        return

    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}")
        return

    html = resp.text
    if any(sig in html for sig in _BOT_SIGNALS):
        print("  BOT CHALLENGE — aborting")
        raise RuntimeError("bot")

    soup = BeautifulSoup(html, "lxml")

    title_el = soup.select_one("#productTitle")
    title = title_el.get_text(strip=True) if title_el else "(no #productTitle)"
    print(f"  Title  : {title[:100]}")

    verdict = detect_format(title, soup, asin=asin)
    print(f"  Verdict: {verdict}")

    # ── Swatches ────────────────────────────────────────────────
    swatches = soup.select("#tmmSwatches .swatchElement")
    if swatches:
        print(f"  Swatches ({len(swatches)}):")
        for sw in swatches:
            selected = "SELECTED" if "selected" in (sw.get("class") or []) else "       "
            text = sw.get_text(" ", strip=True)[:80]
            link_el = sw.select_one("a[href]")
            href = link_el["href"][:60] if link_el else "(no link)"
            print(f"    [{selected}] {text!r}  →  {href}")
    else:
        print("  Swatches: none (#tmmSwatches absent)")

    # ── Detail sections ─────────────────────────────────────────
    found_any = False
    for sel in DETAIL_SELECTORS:
        area = soup.select_one(sel)
        if area is None:
            continue
        text = area.get_text(" ", strip=True)
        # Look for format label
        m = _FORMAT_LABEL_RE.search(text)
        label_hit = None
        if m:
            segment = text[m.end():m.end() + 80]
            label_hit = segment.strip()
        vinyl_anywhere = bool(_FORMAT_VINYL_RE.search(text))
        cd_anywhere    = bool(_FORMAT_NONVINYL_RE.search(text))
        if m or vinyl_anywhere or cd_anywhere:
            found_any = True
            print(f"  {sel}:")
            if label_hit:
                print(f"    format label → {label_hit!r}")
            if vinyl_anywhere:
                # Find actual match context
                import re
                for match in re.finditer(r".{0,20}(vinil|vinyl|\blp\b).{0,20}", text, re.IGNORECASE):
                    print(f"    vinyl keyword: ...{match.group().strip()}...")
                    break
            if cd_anywhere and not m:
                print(f"    cd/non-vinyl keyword present (no label prefix)")
    if not found_any:
        print("  Detail sections: no format signal found in any selector")

    # ── Breadcrumbs ─────────────────────────────────────────────
    bc = soup.select_one("#wayfinding-breadcrumbs_feature_div")
    if bc:
        print(f"  Breadcrumb: {bc.get_text(' ', strip=True)[:120]}")

    print()


def main():
    asins = sys.argv[1:] if len(sys.argv) > 1 else SAMPLE_ASINS
    session = make_session()
    print("Warming up session...")
    warm_up(session)
    print(f"Analysing {len(asins)} ASINs...\n")

    for asin in asins:
        print(f"── {asin} ────────────────────────────────────────────────────")
        try:
            analyse(asin, session)
        except RuntimeError:
            print("Stopping (bot challenge).")
            break
        delay = 4.0 + random.uniform(1.0, 3.0)
        print(f"  (sleeping {delay:.1f}s)")
        print()
        time.sleep(delay)


if __name__ == "__main__":
    main()

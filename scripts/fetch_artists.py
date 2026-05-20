#!/usr/bin/env python3
"""
fetch_artists.py — scrapes kworb.net daily charts for 20 countries,
ranks top-10 artists by summed daily streams, enriches with Spotify oEmbed,
writes frontend/data/top_artists.json (read by the Next.js page at build time).

Usage:
    python scripts/fetch_artists.py
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

# ── paths ────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
JSON_OUT = ROOT / "frontend" / "data" / "top_artists.json"

# ── config ───────────────────────────────────────────────────────────────────

COUNTRIES: dict[str, str] = {
    "US": "United States",
    "GB": "United Kingdom",
    "BR": "Brazil",
    "DE": "Germany",
    "FR": "France",
    "JP": "Japan",
    "MX": "Mexico",
    "CA": "Canada",
    "AU": "Australia",
    "ES": "Spain",
    "IT": "Italy",
    "NL": "Netherlands",
    "SE": "Sweden",
    "AR": "Argentina",
    "IN": "India",
    "KR": "South Korea",
    "ID": "Indonesia",
    "TR": "Turkey",
    "PL": "Poland",
    "PH": "Philippines",
}

KWORB_COUNTRY_URL = "https://kworb.net/spotify/country/{code}_daily.html"
KWORB_LISTENERS_URL = "https://kworb.net/spotify/listeners.html"
OEMBED_URL = "https://open.spotify.com/oembed?url=https://open.spotify.com/artist/{id}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

COUNTRY_DELAY = 1.5
OEMBED_DELAY = 0.5

# ── HTTP ─────────────────────────────────────────────────────────────────────


@retry(
    retry=retry_if_exception_type((requests.ConnectionError, requests.Timeout)),
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
def get(url: str) -> requests.Response:
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp


# ── scraping ─────────────────────────────────────────────────────────────────


def parse_int(s: str) -> int:
    cleaned = s.replace(",", "").replace(".", "").strip()
    return int(cleaned) if cleaned.isdigit() else 0


def scrape_country(code: str) -> list[dict]:
    """Returns [{artist_name, artist_id, daily_streams}, ...]."""
    url = KWORB_COUNTRY_URL.format(code=code.lower())
    resp = get(url)
    soup = BeautifulSoup(resp.content, "lxml")
    table = soup.find("table")
    if not table:
        print(f"  [WARN] no table found for {code}", file=sys.stderr)
        return []

    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:]
    records: list[dict] = []

    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 7:
            continue

        # col[2]: first <a> with href containing "../artist/" is the artist link
        artist_link = next(
            (a for a in cols[2].find_all("a", href=True) if "../artist/" in a["href"]),
            None,
        )
        if not artist_link:
            continue

        m = re.search(r"/artist/([^/]+)\.html", artist_link["href"])
        if not m:
            continue

        records.append(
            {
                "artist_name": artist_link.get_text(strip=True),
                "artist_id": m.group(1),
                "daily_streams": parse_int(cols[6].get_text(strip=True)),
            }
        )

    return records


def top_artists(records: list[dict], n: int = 10) -> list[dict]:
    """Group by artist ID, sum streams, return top-n sorted descending."""
    agg: dict[str, dict] = {}
    for r in records:
        aid = r["artist_id"]
        if aid not in agg:
            agg[aid] = {"name": r["artist_name"], "id": aid, "streams": 0}
        agg[aid]["streams"] += r["daily_streams"]
    return sorted(agg.values(), key=lambda x: x["streams"], reverse=True)[:n]


def scrape_global_listeners() -> dict[str, int]:
    """Returns {lowercase_artist_name: monthly_listeners}."""
    resp = get(KWORB_LISTENERS_URL)
    soup = BeautifulSoup(resp.content, "lxml")
    table = soup.find("table")
    if not table:
        return {}

    tbody = table.find("tbody")
    rows = tbody.find_all("tr") if tbody else table.find_all("tr")[1:]
    result: dict[str, int] = {}

    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 2:
            continue
        a_tag = cols[0].find("a")
        name = a_tag.get_text(strip=True) if a_tag else cols[0].get_text(strip=True)
        # listeners value: first column after name that looks like a number
        for col in cols[1:]:
            text = col.get_text(strip=True)
            if text and (text[0].isdigit() or text.startswith("-")):
                val = parse_int(text)
                if val > 0:
                    result[name.lower()] = val
                break

    return result


def fetch_oembed(spotify_id: str) -> dict[str, str]:
    try:
        data = get(OEMBED_URL.format(id=spotify_id)).json()
        return {
            "image_url": data.get("thumbnail_url", ""),
            "name": data.get("title", ""),
        }
    except Exception:
        return {"image_url": "", "name": ""}


# ── pipeline ─────────────────────────────────────────────────────────────────


def build_data() -> dict:
    print("Fetching global listeners…", flush=True)
    listeners_map = scrape_global_listeners()
    print(f"  {len(listeners_map)} artists in listeners map", flush=True)
    time.sleep(COUNTRY_DELAY)

    country_tops: dict[str, tuple[str, list[dict]]] = {}

    for code, country_name in COUNTRIES.items():
        print(f"Scraping {code} ({country_name})…", flush=True)
        try:
            records = scrape_country(code)
            country_tops[code] = (country_name, top_artists(records))
        except Exception as exc:
            print(f"  [ERROR] {code}: {exc}", file=sys.stderr)
            country_tops[code] = (country_name, [])
        time.sleep(COUNTRY_DELAY)

    # collect unique artist IDs across all top-10s
    unique_ids: set[str] = {
        a["id"]
        for _, (_, artists) in country_tops.items()
        for a in artists
    }

    print(f"\nEnriching {len(unique_ids)} unique artists via oEmbed…", flush=True)
    oembed_cache: dict[str, dict[str, str]] = {}
    for aid in unique_ids:
        print(f"  oEmbed {aid}", flush=True)
        oembed_cache[aid] = fetch_oembed(aid)
        time.sleep(OEMBED_DELAY)

    now = datetime.now(timezone.utc).isoformat()
    output: dict = {"last_updated": now, "countries": {}}

    for code, (country_name, artists) in country_tops.items():
        enriched = []
        for rank, a in enumerate(artists, start=1):
            oe = oembed_cache.get(a["id"], {"image_url": "", "name": ""})
            name = oe["name"] or a["name"]
            enriched.append(
                {
                    "rank": rank,
                    "name": name,
                    "chart_streams": a["streams"],
                    "monthly_listeners": listeners_map.get(name.lower(), 0),
                    "spotify_url": f"https://open.spotify.com/artist/{a['id']}",
                    "image_url": oe["image_url"],
                    "spotify_id": a["id"],
                }
            )
        output["countries"][code] = {
            "country_name": country_name,
            "artists": enriched,
        }

    return output


# ── entry point ───────────────────────────────────────────────────────────────


def main() -> None:
    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)

    print("=== fetch_artists.py ===", flush=True)
    data = build_data()

    print(f"\nWriting {JSON_OUT} …", flush=True)
    JSON_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Done.", flush=True)


if __name__ == "__main__":
    main()

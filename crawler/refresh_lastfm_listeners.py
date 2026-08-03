"""
refresh_lastfm_listeners.py — re-ask Last.fm for records whose listener count
looks like a bad match.

Why
---
lastfm_listeners is written once and never revisited: enrich_album_infos only
selects rows where it IS NULL. So a record enriched before the title cleaning
improved keeps whatever the bad query returned, forever. Death "Leprosy" sits
at 3 listeners; the album has 135,429. Nick Cave "Push the Sky Away" at 3
against 248,442. Lil Jon "Crunk Juice" at 1 against 231,339.

Scope
-----
Only the low band. Measured on a random sample of records above 50 listeners:
median drift 0%, none badly wrong — Shinedown 375,809 -> 376,136, Lee Morgan
111,953 -> 112,190. Counts do not meaningfully decay at this timescale, so
refreshing the whole catalogue would spend 31,000 calls to fix nothing. Bad
matches land low, and that is where this looks.

Never lowers a stored value
---------------------------
A refetch can fail to match an album that matched before — sampling returned
"no match" for Lorde despite a stored 2.8M. Resetting to NULL and re-enriching
would have destroyed that. This only writes when the new number is HIGHER, so a
miss costs one wasted call and nothing else.

    python refresh_lastfm_listeners.py --limit 50      # dry run
    python refresh_lastfm_listeners.py --apply
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import ResilientConn
from lastfm import clean_album_title

log = logging.getLogger(__name__)

API = "https://ws.audioscrobbler.com/2.0/"
# Last.fm asks for no more than 5 requests/second averaged over 5 minutes. One
# per second is well inside that and keeps this polite next to the other jobs.
DELAY = 1.0

# Above this, sampling showed values are already correct. The band below it is
# where a bad title match lands.
SUSPICIOUS_MAX = 50


def album_listeners(artist: str, album: str, key: str) -> tuple[int, int] | None:
    """(listeners, playcount) or None when Last.fm has no match."""
    url = API + "?" + urllib.parse.urlencode({
        "method": "album.getinfo",
        "api_key": key,
        "artist": artist,
        "album": album,
        "format": "json",
    })
    for attempt in (1, 2, 3):
        try:
            with urllib.request.urlopen(url, timeout=25) as r:
                data = json.loads(r.read())
            break
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            log.warning("Last.fm HTTP %s for %s / %s", exc.code, artist, album)
            time.sleep(DELAY * attempt)
        except Exception as exc:
            log.warning("Last.fm error for %s / %s: %s", artist, album, exc)
            time.sleep(DELAY * attempt)
    else:
        return None

    info = data.get("album")
    if not isinstance(info, dict):
        return None
    try:
        return int(info.get("listeners", 0)), int(info.get("playcount", 0))
    except (TypeError, ValueError):
        return None


def main() -> None:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        print("LASTFM_API_KEY not set — nothing to do.")
        return

    conn = ResilientConn()
    with conn.cursor() as cur:
        cur.execute(
            f"""SELECT slug, artista, titulo, lastfm_listeners
                FROM "Disco"
                WHERE disponivel = TRUE
                  AND (format IS NULL OR format = 'vinyl')
                  AND lastfm_listeners IS NOT NULL
                  AND lastfm_listeners <= {SUSPICIOUS_MAX}
                ORDER BY price_count DESC NULLS LAST
                {'LIMIT %s' if args.limit else ''}""",
            (args.limit,) if args.limit else (),
        )
        rows = cur.fetchall()

    print(f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'}\n")

    raised = unchanged = missing = 0
    for slug, artista, titulo, stored in rows:
        album = clean_album_title(titulo, artista) or titulo
        got = album_listeners(artista, album, key)
        time.sleep(DELAY)

        if got is None:
            missing += 1
            continue
        listeners, playcount = got
        # Only ever upward. A refetch that finds nothing, or finds a smaller
        # duplicate entry, must not overwrite a good stored number.
        if listeners <= (stored or 0):
            unchanged += 1
            continue

        raised += 1
        if args.apply:
            conn.write(
                """UPDATE "Disco"
                   SET lastfm_listeners = %s, lastfm_playcount = %s
                   WHERE slug = %s""",
                (listeners, playcount, slug),
            )
        else:
            print(f"  {artista[:20]:22s}{titulo[:30]:32s} {stored:>4} -> {listeners:,}")

    print(f"\ncorrected      : {raised}")
    print(f"already right  : {unchanged}")
    print(f"no Last.fm match: {missing}")
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()

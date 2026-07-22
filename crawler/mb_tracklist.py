"""
mb_tracklist.py — Second-pass MusicBrainz enrichment: fetch the tracklist for
records already matched to a release-group (mb_mbid set) by mb_enrich.py.

One MB call per record: fetch one release of the release-group with its
recordings, store the ordered track titles as a JSON array in mb_tracklist.

IMPORTANT: MusicBrainz allows ~1 request/sec PER IP. Do NOT run this at the
same time as mb_enrich.py — together they would exceed the limit. Run this
after mb_enrich has matched the release-groups you care about.

Usage:
    python mb_tracklist.py
    python mb_tracklist.py --max-chunks 1     # smoke / top-N records only

Requires DATABASE_URL in environment (or .env file).
"""
import os
import sys
import json
import time
import argparse
import logging
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import (
    get_connection,
    fetch_albums_needing_tracklist,
    bulk_update_tracklist,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

MB_BASE = "https://musicbrainz.org/ws/2/"
USER_AGENT = os.environ.get(
    "MB_USER_AGENT", "VinylTracker/1.0 ( vinicius.stanula@gmail.com )"
)


def fetch_tracklist(mbid: str) -> list[dict] | None:
    """
    Returns ordered tracks for the fullest release of the release-group, each as
    {"title": str, "length": int|None} where length is milliseconds.
    Returns None on error, [] when no release/tracks exist.

    A release-group can hold promo singles/samplers alongside the full album,
    and MusicBrainz returns its releases in no particular order — grabbing the
    first one (limit=1) left albums with a bogus 1-2 track tracklist. We fetch
    up to 25 releases and keep the one with the most tracks.
    """
    url = (f"{MB_BASE}release?release-group={urllib_quote(mbid)}"
           f"&inc=recordings&limit=25&fmt=json")
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        log.debug("tracklist fetch failed for %s: %s", mbid, exc)
        return None

    releases = data.get("releases") or []
    if not releases:
        return []

    best: list[dict] = []
    for rel in releases:
        tracks = [
            {"title": tr["title"], "length": tr.get("length")}
            for m in rel.get("media", []) for tr in m.get("tracks", [])
            if tr.get("title")
        ]
        if len(tracks) > len(best):
            best = tracks
    return best


def urllib_quote(s: str) -> str:
    import urllib.parse
    return urllib.parse.quote(s, safe="")


def parse_args():
    p = argparse.ArgumentParser(description="Backfill MusicBrainz tracklists for matched release-groups")
    p.add_argument("--chunk",      type=int,   default=200, metavar="N")
    p.add_argument("--delay",      type=float, default=1.1, metavar="S",
                   help="Seconds between MB requests — keep >= 1.1 (default: 1.1)")
    p.add_argument("--max-chunks", type=int,   default=0,   metavar="N",
                   help="Stop after N chunks (0 = run until done)")
    return p.parse_args()


def main():
    args = parse_args()
    conn = get_connection()

    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE mb_mbid IS NOT NULL AND mb_mbid <> ''
                 AND mb_tracklist IS NULL AND disponivel = TRUE"""
        )
        start = cur.fetchone()[0]
    log.info("Starting tracklist backfill: %d matched rows need a tracklist.", start)

    total = got = chunks = 0
    t_start = time.monotonic()

    while True:
        rows = fetch_albums_needing_tracklist(conn, limit=args.chunk)
        if not rows:
            log.info("No more rows — tracklist backfill complete.")
            break

        updates = []
        for r in rows:
            tracks = fetch_tracklist(r["mbid"])
            updates.append({"id": r["id"], "tracklist": json.dumps(tracks or [])})
            if tracks:
                got += 1
            time.sleep(args.delay)

        total += bulk_update_tracklist(conn, updates)
        chunks += 1
        elapsed = time.monotonic() - t_start
        rate = total / elapsed if elapsed else 0
        eta_h = (max(start - total, 0) / rate / 3600) if rate else 0
        log.info("Chunk %d — %d/%d done, %d with tracks (%.0f%%), ETA %.1fh.",
                 chunks, total, start, got, 100 * got / total if total else 0, eta_h)

        if args.max_chunks and chunks >= args.max_chunks:
            log.info("Reached --max-chunks=%d — stopping.", args.max_chunks)
            break

    conn.close()
    log.info("Done. %d rows processed, %d with tracklists, in %.0fs.",
             total, got, time.monotonic() - t_start)


if __name__ == "__main__":
    main()

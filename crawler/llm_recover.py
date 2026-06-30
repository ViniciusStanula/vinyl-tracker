"""
llm_recover.py — Last.fm listener recovery for records the drain FAILED on
because their artista/titulo was corrupted (e.g. artista "Disco de Vinil" or a
scrambled name). Uses the local Ollama LLM to re-parse the raw title into a
clean {artist, album}, stores it in lookup_artist/lookup_album, and re-queries
Last.fm with the clean name.

Targets: lastfm_listeners = 0 (drain tried + missed), vinyl, identified,
available, not yet LLM-attempted (lookup_artist IS NULL).

The stored lookup_artist/lookup_album can later let the MusicBrainz pass
recover genres/tracklist/rating for the same records.

LOCAL ONLY: requires Ollama running (cannot run in GitHub Actions). Ollama is
the bottleneck (~3 s/record), so Last.fm load stays low — safe to run beside
the drain. Last.fm is free; MusicBrainz is not touched here.

Usage:
    python llm_recover.py
    python llm_recover.py --max-chunks 1     # smoke / top-N

Requires DATABASE_URL and LASTFM_API_KEY (or .env file).
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

from database import (
    get_connection,
    fetch_records_needing_llm_recovery,
    bulk_update_llm_recovery,
)
from lastfm import fetch_album_info, _album_search_fallback
from llm_parse import llm_parse_title

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def parse_args():
    p = argparse.ArgumentParser(description="LLM-assisted Last.fm listener recovery for drain failures")
    p.add_argument("--chunk",      type=int,   default=100, metavar="N",
                   help="Records fetched + committed per chunk (default: 100)")
    p.add_argument("--delay",      type=float, default=0.2, metavar="S",
                   help="Seconds between Last.fm requests (default: 0.2)")
    p.add_argument("--max-chunks", type=int,   default=0,   metavar="N",
                   help="Stop after N chunks (0 = run until done)")
    return p.parse_args()


def main():
    args = parse_args()
    api_key = os.environ.get("LASTFM_API_KEY")
    if not api_key:
        log.error("LASTFM_API_KEY is not set. Aborting.")
        sys.exit(1)

    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE lastfm_listeners = 0 AND lookup_artist IS NULL
                 AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                 AND artista !~* 'artista n[ãa]o identificad'"""
        )
        start = cur.fetchone()[0]
    log.info("Starting LLM recovery: %d failed vinyl records to re-parse.", start)

    total = parsed = recovered = chunks = 0
    t_start = time.monotonic()

    while True:
        rows = fetch_records_needing_llm_recovery(conn, limit=args.chunk)
        if not rows:
            log.info("No more rows — LLM recovery complete.")
            break

        updates = []
        for r in rows:
            p = llm_parse_title(r["titulo"])
            if not p:
                # Parse failed/non-music — mark attempted ('') so it isn't retried.
                updates.append({"id": r["id"], "lookup_artist": "", "lookup_album": "",
                                "listeners": 0, "playcount": 0})
                continue
            parsed += 1
            info = (fetch_album_info(p["artist"], p["album"], api_key)
                    or _album_search_fallback(p["artist"], p["album"], api_key))
            listeners = info["listeners"] if info else 0
            playcount = info["playcount"] if info else 0
            if listeners > 0:
                recovered += 1
                log.info("  recovered %d listeners: %s / %s", listeners, p["artist"], p["album"])
            updates.append({
                "id": r["id"],
                "lookup_artist": p["artist"],
                "lookup_album":  p["album"],
                "listeners": listeners,
                "playcount": playcount,
            })
            time.sleep(args.delay)

        total += bulk_update_llm_recovery(conn, updates)
        chunks += 1
        elapsed = time.monotonic() - t_start
        rate = total / elapsed if elapsed else 0
        eta_h = (max(start - total, 0) / rate / 3600) if rate else 0
        log.info("Chunk %d — %d/%d processed, %d parsed, %d recovered (%.0f%% of parsed), ETA %.1fh.",
                 chunks, total, start, parsed, recovered,
                 100 * recovered / parsed if parsed else 0, eta_h)

        if args.max_chunks and chunks >= args.max_chunks:
            log.info("Reached --max-chunks=%d — stopping.", args.max_chunks)
            break

    conn.close()
    log.info("Done. %d processed, %d parsed, %d recovered listeners, in %.0fs.",
             total, parsed, recovered, time.monotonic() - t_start)


if __name__ == "__main__":
    main()

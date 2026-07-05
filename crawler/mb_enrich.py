"""
mb_enrich.py — MusicBrainz release-group enrichment for the vinyl catalog.

For each identified, available Disco row not yet searched (mb_mbid IS NULL),
queries MusicBrainz release-group search by artist + cleaned album title and
stores the canonical MBID, first-release-date, primary-type, and genres.

These feed disco-page SEO content (release year, album-vs-single filtering,
supplementary genres alongside lastfm_tags).

Constraints / etiquette:
  - MusicBrainz allows ~1 request/sec and REQUIRES a descriptive User-Agent.
    Default delay is 1.1 s; do not lower it.
  - No API key needed. No barcode in our data, so matching is by name only;
    a search score >= MB_SCORE_THRESHOLD is required to accept a match.

Usage:
    python mb_enrich.py
    python mb_enrich.py --chunk 200 --delay 1.1
    python mb_enrich.py --max-chunks 1      # smoke test, ~200 rows

Requires DATABASE_URL in environment (or .env file).
"""
import os
import sys
import json
import re
import time
import argparse
import logging
import urllib.parse
import urllib.request

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import (
    get_connection,
    ensure_mb_columns,
    fetch_albums_needing_mb,
    bulk_update_mb,
)
from lastfm import clean_album_title, NON_GENRE_TAGS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

MB_BASE = "https://musicbrainz.org/ws/2/"
# MusicBrainz asks that the User-Agent identify the app and a contact address.
USER_AGENT = os.environ.get(
    "MB_USER_AGENT", "VinylTracker/1.0 ( vinicius.stanula@gmail.com )"
)
# Minimum search score (0-100) to accept a release-group as the match.
MB_SCORE_THRESHOLD = 90


def _mb_get(path: str) -> dict | None:
    req = urllib.request.Request(MB_BASE + path, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as exc:
        log.debug("MB request failed (%s): %s", path, exc)
        return None


def _tokens(s: str) -> set[str]:
    """Lowercase alphanumeric token set, for title-overlap validation."""
    return set(re.sub(r"[^\w\s]", " ", s.lower()).split())


# Lucene special chars that break a MusicBrainz query if left unescaped.
_LUCENE_SPECIALS = re.compile(r'[+\-&|!(){}\[\]^"~*?:\\/]')


def _mb_search_groups(artist: str, album: str, quoted: bool) -> list[dict]:
    """One release-group search. quoted=exact phrase (precise);
    quoted=False=token AND (tolerant of leftover edition/colour junk)."""
    if quoted:
        rg = f'"{album}"'
    else:
        rg = "(" + _LUCENE_SPECIALS.sub(" ", album).strip() + ")"
    query = urllib.parse.urlencode({
        "query": f'artist:"{artist}" AND releasegroup:{rg}',
        "fmt":   "json",
        "limit": "6",
    })
    data = _mb_get("release-group/?" + query)
    return (data.get("release-groups") or []) if data else []


def search_release_group(artist: str, album: str) -> dict | None:
    """
    Returns {mbid, first_release_date, primary_type, genres} for the best
    release-group match, or None if nothing clears MB_SCORE_THRESHOLD.
    """
    groups = [g for g in _mb_search_groups(artist, album, quoted=True)
              if int(g.get("score", 0)) >= MB_SCORE_THRESHOLD]
    if not groups:
        # Fallback: unquoted token AND. The exact-phrase query returns ZERO when
        # the Amazon title still carries edition/colour junk ("Pearl Jam: Ten",
        # "24K Magic Gold", "Back To Black (Half-Speed Master)"). Unquoted lets
        # MB relevance-rank past the junk. Guard against false positives: the
        # matched title's tokens must be a subset of the (junk-carrying) query.
        qtok = _tokens(album)
        groups = [
            g for g in _mb_search_groups(artist, album, quoted=False)
            if int(g.get("score", 0)) >= MB_SCORE_THRESHOLD
            and g.get("title")
            and _tokens(g["title"]) <= qtok
        ]
    if not groups:
        return None

    # Prefer the album over same-titled singles/EPs — a title like "Off the
    # Wall" returns both a Single and the Album at score 100, and limit=1 would
    # grab whichever MB lists first. Rank: Album > EP > other; then higher
    # score; then earliest release (original over reissue/compilation).
    _TYPE_RANK = {"Album": 0, "EP": 1}
    groups.sort(key=lambda g: (
        _TYPE_RANK.get(g.get("primary-type"), 2),
        -int(g.get("score", 0)),
        g.get("first-release-date") or "9999",
    ))
    rg = groups[0]

    def _genre_names(items):
        return [
            x["name"] for x in items
            if x.get("name") and x["name"].lower() not in NON_GENRE_TAGS
        ][:3]

    genres = _genre_names(rg.get("genres", []))
    if not genres:  # release-group genres are sparse; fall back to folksonomy tags
        genres = _genre_names(rg.get("tags", []))

    return {
        "mbid":               rg.get("id", ""),
        "first_release_date": rg.get("first-release-date") or None,
        "primary_type":       rg.get("primary-type") or None,
        "genres":             ", ".join(genres),
    }


def parse_args():
    p = argparse.ArgumentParser(description="Enrich the catalog with MusicBrainz release-group data")
    p.add_argument("--chunk",      type=int,   default=200, metavar="N",
                   help="Rows fetched + committed per chunk (default: 200)")
    p.add_argument("--delay",      type=float, default=1.1, metavar="S",
                   help="Seconds between MB requests — keep >= 1.1 (default: 1.1)")
    p.add_argument("--max-chunks", type=int,   default=0,   metavar="N",
                   help="Stop after N chunks (0 = run until done; use for smoke tests)")
    return p.parse_args()


def main():
    args = parse_args()
    conn = get_connection()
    ensure_mb_columns(conn)

    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE mb_mbid IS NULL AND disponivel = TRUE
                 AND artista !~* 'artista n[ãa]o identificad'"""
        )
        start = cur.fetchone()[0]
    log.info("Starting MB enrichment: %d identified-artist rows to search.", start)

    total = matched = chunks = 0
    t_start = time.monotonic()

    while True:
        rows = fetch_albums_needing_mb(conn, limit=args.chunk)
        if not rows:
            log.info("No more rows — MB enrichment complete.")
            break

        updates = []
        for r in rows:
            album = clean_album_title(r["titulo"], r["artista"])
            hit = search_release_group(r["artista"], album)
            updates.append({
                "id":                 r["id"],
                "mbid":               hit["mbid"] if hit else "",   # "" = searched, no match
                "first_release_date": hit["first_release_date"] if hit else None,
                "primary_type":       hit["primary_type"] if hit else None,
                "genres":             hit["genres"] if hit else None,
            })
            if hit:
                matched += 1
            time.sleep(args.delay)

        total += bulk_update_mb(conn, updates)
        chunks += 1
        elapsed = time.monotonic() - t_start
        rate = total / elapsed if elapsed else 0
        eta_h = (max(start - total, 0) / rate / 3600) if rate else 0
        log.info("Chunk %d — %d/%d searched, %d matched (%.0f%%), ETA %.1fh.",
                 chunks, total, start, matched, 100 * matched / total if total else 0, eta_h)

        if args.max_chunks and chunks >= args.max_chunks:
            log.info("Reached --max-chunks=%d — stopping.", args.max_chunks)
            break

    conn.close()
    log.info("Done. %d rows searched, %d matched, in %.0fs.",
             total, matched, time.monotonic() - t_start)


if __name__ == "__main__":
    main()

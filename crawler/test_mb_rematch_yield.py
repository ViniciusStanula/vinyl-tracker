"""
test_mb_rematch_yield.py — READ-ONLY. Estimate how many previously-failed
MusicBrainz searches would succeed under the CURRENT matcher.

mb_mbid semantics: NULL = never searched, '' = searched and failed. mb_enrich
only picks up NULL, so the 6,079 '' rows are frozen at whatever the matcher
returned on the day they ran -- before the score-threshold change, the
both-paths title guard, and today's clean_album_title fix (which was silently
destroying titles such as "Disco De Vinil Novo - Metallica - ...And Justice
For All").

This samples those rows at random and re-runs the real matcher to measure the
yield BEFORE anything is reset. Writes nothing.

Usage:
    python test_mb_rematch_yield.py --limit 30
"""
import argparse
import io
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry
from lastfm import clean_album_title
from mb_enrich import search_release_group


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--delay", type=float, default=1.1)
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    # Random sample, not price_count-ordered: popular records match more often,
    # which would inflate the estimate for the catalogue as a whole.
    cur.execute(
        """
        SELECT slug, artista, titulo FROM "Disco"
        WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
          AND mb_mbid = ''
          AND artista NOT ILIKE '%%o identificado%%'
        ORDER BY random()
        LIMIT %s
        """,
        (args.limit,),
    )
    rows = cur.fetchall()
    conn.close()
    print(f"sampling {len(rows)} previously-FAILED records (read-only)\n")

    hit = 0
    for artista, titulo in [(a, t) for _s, a, t in rows]:
        album = clean_album_title(titulo, artista)
        try:
            res = search_release_group(artista, album)
        except Exception as exc:
            res = None
            print(f"  ERR  {artista[:20]:20s} | {album[:40]:40s} {exc}")
        time.sleep(args.delay)
        if res:
            hit += 1
            print(f"  MATCH  {artista[:20]:20s} | {album[:38]:38s} -> {res.get('title','')[:34]}")
        else:
            print(f"  still no  {artista[:20]:20s} | {album[:38]}")

    pct = 100 * hit / len(rows) if rows else 0
    print(f"\nwould now match: {hit}/{len(rows)}  ({pct:.0f}%)")
    print(f"extrapolated over 5,919 retryable rows: ~{int(5919 * pct / 100):,} records")
    print("\nREAD-ONLY — nothing written.")


if __name__ == "__main__":
    main()

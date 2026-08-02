"""
fix_placeholder_artists.py — replace placeholder artist values with the real
artist, using Discogs as the source.

Some rows carry a placeholder instead of an artist. Amazon's byline is the
origin: a soundtrack listing often bylines "Soundtrack", and one seller's rows
came through bylined with the seller's own name.

    Soundtrack           33 records
    Músicas MP3           7      <- a seller name, not a musician
    Original Soundtrack   3
    OST                   2

These are not cosmetic. A row with no real artist cannot be matched on
MusicBrainz (search needs an artist), so it also has no tracklist, no release
date, no genres — the placeholder blocks four other enrichments at once.

Discogs returns a structured artists array on every barcode match, so the real
name is available: a row filed under "Soundtrack" resolves to Danny Elfman.

WHY THIS IS REPORT-FIRST
------------------------
Changing artista is not a field update. It moves the record to a different
/artista/ page, and every placeholder currently HAS a live page:

    /artista/soundtrack          33 records
    /artista/musicas-mp3          7
    /artista/original-soundtrack  3
    /artista/ost                  2

After the fix those pages are empty and need 301s, exactly like the 2026-07-30
artist merges. So the default is a report you review, and --apply also prints
the slugs that need redirects.

EXACT MATCHING ONLY
-------------------
"Motion City Soundtrack" is a real band with 4 records in the catalogue, and
"Twilight Soundtrack" / "Batman Forever Soundtrack" are title fragments, not
placeholders. A rule matching "contains soundtrack" would destroy all of them.
Only the exact values in PLACEHOLDERS are touched.

    python fix_placeholder_artists.py            # report
    python fix_placeholder_artists.py --apply
"""
from __future__ import annotations

import argparse
import io
import sys
from collections import Counter

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry
from discogs_enrich import Discogs, verify_match, _norm, _tokens

# Exact values only. See the docstring — substring matching is not safe here.
PLACEHOLDERS = ("Soundtrack", "Músicas MP3", "Musicas MP3", "Original Soundtrack", "OST", "O.S.T.")


def real_artist(rel: dict) -> str | None:
    """The credited artist from a Discogs release, if it is a usable one."""
    names = [a.get("name", "").strip() for a in (rel.get("artists") or [])]
    names = [n for n in names if n and n.lower() not in ("various", "unknown artist")]
    if not names:
        return None
    # Discogs disambiguates duplicate names with a trailing "(2)".
    return names[0].rsplit(" (", 1)[0].strip()


def main() -> None:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    conn = connect_with_retry()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(
            f"""SELECT slug, artista, titulo, ean
                FROM "Disco"
                WHERE artista = ANY(%s)
                  AND ean ~ '^[0-9]{{13}}$'
                  AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                ORDER BY price_count DESC NULLS LAST
                {'LIMIT %s' if args.limit else ''}""",
            (list(PLACEHOLDERS), args.limit) if args.limit else (list(PLACEHOLDERS),),
        )
        rows = cur.fetchall()

    print(f"placeholder-artist records with a barcode: {len(rows)}  "
          f"(mode: {'APPLY' if args.apply else 'REPORT'})\n")
    if not rows:
        return

    dg = Discogs()
    fixed = unresolved = 0
    emptied: Counter = Counter()

    for slug, artista, titulo, ean in rows:
        results = dg.by_barcode(ean)
        # Artist verification is meaningless here — ours is a placeholder — so
        # the title has to carry the match on its own.
        verified = [
            r for r in results
            if _tokens(titulo) & set(_norm(r.get("title") or "").split())
        ]
        if not verified:
            unresolved += 1
            print(f"  ?  {artista:20s} | {titulo[:40]:42s} -> no confident match")
            continue

        rel = dg.release(verified[0]["id"]) or {}
        name = real_artist(rel)
        if not name:
            unresolved += 1
            print(f"  ?  {artista:20s} | {titulo[:40]:42s} -> Discogs credits 'Various'")
            continue

        fixed += 1
        emptied[artista] += 1
        print(f"  ✓  {artista:20s} | {titulo[:38]:40s} -> {name}")
        if args.apply:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "Disco" SET artista = %s WHERE slug = %s AND artista = %s',
                    (name, slug, artista),
                )

    print(f"\nresolved to a real artist : {fixed}")
    print(f"left unchanged            : {unresolved}")

    if emptied:
        print("\nArtist pages losing records — these need 301s in next.config.ts:")
        with conn.cursor() as cur:
            for placeholder, n in emptied.items():
                cur.execute(
                    'SELECT count(*) FROM "Disco" WHERE artista = %s AND disponivel = TRUE',
                    (placeholder,),
                )
                left = cur.fetchone()[0]
                state = "EMPTY" if left == 0 else f"{left} left"
                print(f"   {placeholder!r:24s} -{n} records  ({state})")

    if not args.apply:
        print("\nREPORT ONLY — nothing written.")


if __name__ == "__main__":
    main()

"""
fix_unknown_artists_from_discogs.py — name the records Amazon left unattributed.

805 live records carry the literal placeholder "Artista não identificado".
Discogs, having resolved the pressing by barcode, names a real act on 509 of
them: The Grateful Dead for a 1981 Madison Square Garden recording, The White
Stripes for "Elephant (200 Gram Vinyl)".

Why only this subset
--------------------
An audit of all 24,472 records holding both names found 80% identical. Of the
disagreements, most must NOT be adopted:

  * "&" against "And"                King Gizzard & The Lizard Wizard
  * Discogs adding collaborators     Ella Fitzgerald -> Ella Fitzgerald, Joe Pass
  * "Various" on compilations        would replace Nick Drake with Various

Those are cosmetic or actively worse, and rewriting them would churn
/artista/<slug> URLs that already work. The placeholder rows are different:
there is no real artist page to break, because the current name is not an
artist.

Slugs
-----
Disco.slug never changes — the record URL is stable. The artist page URL is
derived from the name, so these records move from /artista/artista-nao-
identificado onto a real artist's page, which is the point.

    python fix_unknown_artists_from_discogs.py            # dry run
    python fix_unknown_artists_from_discogs.py --apply
"""
from __future__ import annotations

import argparse
import io
import sys

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import ResilientConn

# Discogs credits compilations to "Various", which is no more informative than
# the placeholder it would replace.
GENERIC = {"various", "various artists", "unknown artist", "no artist"}


def main() -> None:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = ResilientConn()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT slug, titulo, discogs_artist
               FROM "Disco"
               WHERE artista ~* 'artista n[ãa]o identificad'
                 AND COALESCE(discogs_artist, '') <> ''
               ORDER BY price_count DESC NULLS LAST"""
        )
        rows = cur.fetchall()

    fixed = skipped = 0
    for slug, titulo, dg_artist in rows:
        name = (dg_artist or "").strip()
        if not name or name.lower() in GENERIC:
            skipped += 1
            continue
        # A credit listing several acts belongs on a compilation, not on one
        # artist page. Keep the placeholder rather than invent a joint artist.
        if name.count(",") >= 2:
            skipped += 1
            continue

        fixed += 1
        if args.apply:
            conn.write('UPDATE "Disco" SET artista = %s WHERE slug = %s', (name, slug))
        elif fixed <= 20:
            print(f"  {titulo[:44]:46s} -> {name[:30]}")

    print(f"\nwould rename : {fixed}" if not args.apply else f"\nrenamed : {fixed}")
    print(f"left alone   : {skipped}  (Various, or several acts credited)")
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()

"""
backfill_master_ids.py — recover the master id for title-resolved records.

Records matched by artist+title rather than barcode have no release id, so the
page credited Discogs as plain text with nowhere to point: 2,911 records, 2,892
of which carry a master year — the master was fetched and its id discarded.

Re-runs the same search those records were resolved by and takes the master
every verified pressing agrees on, which is exactly what album_level_fields
did. Two calls per record, and only the id is written: nothing else is touched,
so a wrong match here cannot corrupt data that is already correct.

    python backfill_master_ids.py --limit 10     # dry run
    python backfill_master_ids.py --apply
"""
from __future__ import annotations

import argparse
import io
import logging
import sys

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import ResilientConn
from discogs_enrich import (
    Discogs,
    DiscogsUnavailable,
    master_consensus,
    verify_match,
)
from lastfm import clean_album_title


def main() -> None:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    conn = ResilientConn()
    with conn.cursor() as cur:
        cur.execute(
            f"""SELECT slug, artista, titulo FROM "Disco"
                WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                  AND discogs_release_id IS NULL
                  AND discogs_master_id IS NULL
                  AND discogs_master_year IS NOT NULL
                  AND artista !~* 'artista n[ãa]o identificad'
                ORDER BY price_count DESC NULLS LAST
                {'LIMIT %s' if args.limit else ''}""",
            (args.limit,) if args.limit else (),
        )
        rows = cur.fetchall()

    dg = Discogs()
    print(f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'}\n")

    found = missed = 0
    for slug, artista, titulo in rows:
        query = clean_album_title(titulo, artista) or titulo
        try:
            results = dg.by_artist_title(artista, query)
        except DiscogsUnavailable:
            continue
        mid = master_consensus([r for r in results if verify_match(artista, titulo, r)])
        if not mid:
            missed += 1
            continue
        found += 1
        if args.apply:
            conn.write('UPDATE "Disco" SET discogs_master_id = %s WHERE slug = %s',
                       (mid, slug))
        elif found <= 12:
            print(f"  {artista[:22]:24s}{titulo[:30]:32s} -> master/{mid}")

    print(f"\nmaster id found : {found}")
    print(f"no consensus    : {missed}")
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()

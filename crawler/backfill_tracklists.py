"""
backfill_tracklists.py — re-apply the narrowed layout gate to records that lost
their tracklist to the old one.

The gate compared the whole Discogs format list, so "Limited Edition" and
"Reissue" counted as structural differences. Jack White "No Name" returns four
pressings that are all Vinyl/LP/Album and differ only by those words, and its
13-track A/B tracklist was dropped for it.

6,218 resolved records have no tracklist; 2,537 of them lost it this way. This
re-runs the barcode search, applies _layout_key, and stores the tracklist when
the siblings share a physical layout.

Only writes a tracklist where there is none — nothing already stored is
touched, and catno/country stay as they are.

    python backfill_tracklists.py --limit 10     # dry run
    python backfill_tracklists.py --apply
"""
from __future__ import annotations

import argparse
import io
import json
import logging
import re
import sys

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import ResilientConn
from discogs_enrich import Discogs, DiscogsUnavailable, _layout_key, verify_match


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
            f"""SELECT slug, artista, titulo, ean, discogs_release_id
                FROM "Disco"
                WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
                  AND discogs_release_id IS NOT NULL
                  AND discogs_tracklist IS NULL
                  AND ean ~ '^[0-9]{{13}}$'
                ORDER BY price_count DESC NULLS LAST
                {'LIMIT %s' if args.limit else ''}""",
            (args.limit,) if args.limit else (),
        )
        rows = cur.fetchall()

    dg = Discogs()
    print(f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'}\n")

    stored = still_mixed = empty = 0
    for slug, artista, titulo, ean, release_id in rows:
        try:
            results = dg.by_barcode(ean)
            sibs = [r for r in results if verify_match(artista, titulo, r, from_barcode=True)]
            if len(sibs) > 1 and len({_layout_key(r) for r in sibs}) > 1:
                still_mixed += 1
                continue
            rel = dg.release(release_id) or {}
        except DiscogsUnavailable:
            continue

        tracks = [
            {"position": t.get("position"), "title": t.get("title"),
             "duration": t.get("duration")}
            for t in (rel.get("tracklist") or [])
            if t.get("title") and (t.get("type_") or "track") == "track"
        ]
        if not tracks:
            empty += 1
            continue

        stored += 1
        if args.apply:
            conn.write(
                """UPDATE "Disco" SET discogs_tracklist = %s
                   WHERE slug = %s AND discogs_tracklist IS NULL""",
                (json.dumps(tracks, ensure_ascii=False), slug),
            )
        elif stored <= 12:
            sides = sorted({re.match(r"^([A-Z])", str(t.get("position") or "")).group(1)
                            for t in tracks
                            if re.match(r"^([A-Z])", str(t.get("position") or ""))})
            print(f"  {artista[:20]:22s}{titulo[:28]:30s} {len(tracks):3d} tracks, sides {sides}")

    print(f"\ntracklist stored : {stored}")
    print(f"layouts differ   : {still_mixed}  (gate correctly still fires)")
    print(f"release has none : {empty}")
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()

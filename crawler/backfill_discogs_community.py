"""
backfill_discogs_community.py — fill the fields added after the main run began.

The enrichment gained community ratings and then discogs_artist partway
through, so records resolved before each addition have a release id and none of
the newer columns. One re-fetch of /releases/<id> carries all of them:

    discogs_rating, discogs_rating_votes   community rating and vote count
    discogs_have, discogs_want             collectors who own / want it
    discogs_artist                         who Discogs credits on this pressing

Ordered by price_count so the records people actually visit are corrected in
the first hour and the obscure tail drains overnight.

Resumable. A row leaves the candidate set once discogs_artist is set, and a
release that genuinely carries no artist gets '' rather than NULL — the same
"asked, nothing there" sentinel mb_mbid uses — so it is never re-asked forever.

    python backfill_discogs_community.py --limit 20      # dry run
    python backfill_discogs_community.py --apply
"""
from __future__ import annotations

import argparse
import io
import logging
import re
import sys

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import ResilientConn
from discogs_enrich import Discogs, DiscogsUnavailable

log = logging.getLogger(__name__)


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
            f"""SELECT slug, discogs_release_id, artista
                FROM "Disco"
                WHERE discogs_release_id IS NOT NULL
                  AND discogs_artist IS NULL
                ORDER BY price_count DESC NULLS LAST
                {'LIMIT %s' if args.limit else ''}""",
            (args.limit,) if args.limit else (),
        )
        rows = cur.fetchall()

    dg = Discogs()
    print(f"candidates: {len(rows)} | mode: {'APPLY' if args.apply else 'DRY RUN'} "
          f"| ~{len(rows) * dg.delay / 3600:.1f}h at {dg.delay}s/call\n")

    done = rated = renamed = unavailable = 0
    for i, (slug, release_id, artista) in enumerate(rows, 1):
        try:
            rel = dg.release(release_id) or {}
        except DiscogsUnavailable:
            # Leave the row alone so the next run picks it up.
            unavailable += 1
            continue
        if not rel:
            continue

        community = rel.get("community") or {}
        crating = community.get("rating") or {}
        votes = crating.get("count") or 0
        avg = crating.get("average")
        if not votes or not avg:
            avg = votes = None
        have = community.get("have")
        want = community.get("want")

        dg_artist = ", ".join(
            re.sub(r"\s*\(\d+\)$", "", (a.get("name") or "").strip())
            for a in (rel.get("artists") or [])
            if a.get("name")
        )
        # '' marks "asked, nothing there" so this row leaves the candidate set.
        if not dg_artist:
            dg_artist = ""

        done += 1
        if votes:
            rated += 1
        if dg_artist and dg_artist.strip().lower() != (artista or "").strip().lower():
            renamed += 1

        if args.apply:
            conn.write(
                """UPDATE "Disco"
                   SET discogs_rating       = COALESCE(%s, discogs_rating),
                       discogs_rating_votes = COALESCE(%s, discogs_rating_votes),
                       discogs_have         = COALESCE(%s, discogs_have),
                       discogs_want         = COALESCE(%s, discogs_want),
                       discogs_artist       = %s
                   WHERE slug = %s""",
                (avg, votes, have, want, dg_artist, slug),
            )
        elif i <= 15:
            flag = "  <- differs" if dg_artist.strip().lower() != (artista or "").strip().lower() else ""
            print(f"  {artista[:24]:26s} -> {dg_artist[:24]:26s} "
                  f"rating={avg or '-'} have={have or '-'}{flag}")

        if args.apply and i % 250 == 0:
            print(f"  ...{i}/{len(rows)} | with a rating: {rated} | artist differs: {renamed}")

    print(f"\nprocessed          : {done}")
    print(f"  with a rating    : {rated}")
    print(f"  artist differs   : {renamed}   <- candidates for the name audit")
    print(f"API unavailable    : {unavailable}")
    if not args.apply:
        print("\nDRY RUN — nothing written.")


if __name__ == "__main__":
    main()

"""Album-level Discogs collection counts for the /guias/melhores-discos pages.

Discogs publishes `have`/`want` per RELEASE. A master carries no community
block at all — /masters/<id> has no such key — so the per-pressing number is
all the obvious API path gives you, and it is not the album's standing: our
catalogue links a 2,010-owner repress of Megadeth's "Countdown to Extinction"
while the album's master shows 53,530 owners on discogs.com.

The aggregate the website displays is reproducible: /masters/<id>/versions
returns every pressing with `stats.community.in_collection` / `in_wantlist`,
and summing them lands within a handful of the site's figure (53,525 / 33,835
against 53,530 / 33,843 — live drift, not error).

Cost is ceil(versions / 100) calls per album, so this is run for the albums that
appear on a guide page, not across the whole catalogue.

    python discogs_master_stats.py                # dry run
    python discogs_master_stats.py --apply
"""
from __future__ import annotations

import argparse
import io
import sys
import time
from urllib.parse import quote_plus

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from database import get_connection
from discogs_enrich import Discogs

# Mirrors BEST_OF_ARTISTS in frontend/lib/guias/best-of-artist-data.ts.
GUIDE_ARTISTS = [
    "%Metallica%", "%Iron Maiden%", "%Megadeth%", "%Nirvana%", "%Alice in Chains%",
    "%Linkin Park%", "%Radiohead%",
]

PAGE_DELAY = 1.1  # authed Discogs allows ~60 req/min


COLUMNS = ("discogs_master_have", "discogs_master_want", "discogs_master_stats_at")


def ensure_columns(conn) -> None:
    # Check before altering. The ALTER is a no-op once the columns exist, but it
    # still takes a lock, and with the dev server holding connections that hit
    # the statement timeout instead of returning instantly.
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM information_schema.columns
               WHERE table_name = 'Disco' AND column_name = ANY(%s)""",
            (list(COLUMNS),),
        )
        if cur.fetchone()[0] == len(COLUMNS):
            return
    with conn.cursor() as cur:
        cur.execute(
            """ALTER TABLE "Disco"
                 ADD COLUMN IF NOT EXISTS discogs_master_have INTEGER,
                 ADD COLUMN IF NOT EXISTS discogs_master_want INTEGER,
                 -- Stamped even when the sum yields nothing, so a second run
                 -- does not re-spend a few hundred calls on the same albums.
                 ADD COLUMN IF NOT EXISTS discogs_master_stats_at TIMESTAMPTZ"""
        )
    conn.commit()


def master_totals(dg: Discogs, master_id: int) -> tuple[int, int, int]:
    """(have, want, versions counted) summed over every pressing of a master."""
    have = want = counted = 0
    page = 1
    while True:
        data = dg._get(f"/masters/{master_id}/versions?per_page=100&page={page}")
        if not data:
            break
        for v in data.get("versions") or []:
            community = (v.get("stats") or {}).get("community") or {}
            if community.get("in_collection") is not None:
                have += community["in_collection"]
                want += community.get("in_wantlist") or 0
                counted += 1
        pages = (data.get("pagination") or {}).get("pages") or 1
        if page >= pages:
            break
        page += 1
        time.sleep(PAGE_DELAY)
    return have, want, counted


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="stop after N albums")
    args = ap.parse_args()

    conn = get_connection()
    # Always, including a dry run: the worklist query filters on these columns,
    # and adding three nullable columns writes no data.
    ensure_columns(conn)
    cur = conn.cursor()

    # One representative row per album: the pressing we know a Discogs release
    # for, preferring the most-owned one, since any pressing resolves to the
    # same master.
    cur.execute(
        """
        SELECT mb_mbid,
               (array_agg(titulo             ORDER BY (discogs_release_id IS NULL), discogs_have DESC NULLS LAST))[1],
               (array_agg(artista            ORDER BY (discogs_release_id IS NULL), discogs_have DESC NULLS LAST))[1],
               (array_agg(discogs_release_id ORDER BY (discogs_release_id IS NULL), discogs_have DESC NULLS LAST))[1],
               (array_agg(discogs_master_id  ORDER BY discogs_master_id DESC NULLS LAST))[1],
               MAX(discogs_have),
               -- Clean album name for the master search fallback. mb_title is
               -- free of the marketplace noise that titulo carries.
               (array_agg(mb_title ORDER BY (mb_title IS NULL)))[1]
        FROM "Disco"
        WHERE artista ILIKE ANY(%s)
          AND disponivel AND (format IS NULL OR format = 'vinyl')
          AND mb_mbid IS NOT NULL AND mb_primary_type = 'Album'
          AND discogs_master_have IS NULL
        GROUP BY mb_mbid
        -- Prefer a row that HAS a release id over the most-owned one: picking
        -- purely by discogs_have selected a row whose release id was NULL and
        -- silently skipped the album, losing Nevermind and Rust in Peace even
        -- though other listings of both carried an id. Albums with no matched
        -- pressing at all are no longer excluded here — they fall through to
        -- the master search below.
        HAVING count(discogs_release_id) > 0 OR (array_agg(mb_title))[1] IS NOT NULL
        """,
        (GUIDE_ARTISTS,),
    )
    albums = cur.fetchall()
    if args.limit:
        albums = albums[: args.limit]
    print(f"{len(albums)} guide albums with a Discogs release and no master totals yet\n")

    dg = Discogs()
    if not dg.authed:
        print("no Discogs credentials; aborting", file=sys.stderr)
        return 1

    done = failed = 0
    for mbid, titulo, artista, release_id, master_id, pressing_have, search_title in albums:
        from_search = False
        if not master_id and release_id:
            rel = dg._get(f"/releases/{release_id}")
            time.sleep(PAGE_DELAY)
            master_id = (rel or {}).get("master_id") or None
        if not master_id:
            # No matched pressing at all, or one that belongs to no master.
            # Search the master index directly on the MusicBrainz title, which
            # is already cleaned of marketplace noise. Radiohead's "Kid A",
            # "Amnesiac", "The King of Limbs" and "A Moon Shaped Pool" all
            # reach the guide this way and would otherwise show nothing.
            found = dg._get(
                "/database/search?type=master&artist=%s&release_title=%s&per_page=5"
                % (quote_plus(artista or ""), quote_plus(search_title or titulo))
            ) if (search_title or titulo) else None
            time.sleep(PAGE_DELAY)
            for hit in (found or {}).get("results") or []:
                if hit.get("id"):
                    master_id = hit["id"]
                    from_search = True
                    print(f"  search  {artista} - {(search_title or titulo)[:36]} -> master {master_id} ({hit.get('title')})")
                    break
        if not master_id:
            print(f"  SKIP  {artista} - {titulo[:44]}  (release has no master)")
            failed += 1
            continue

        have, want, counted = master_totals(dg, master_id)
        if not counted:
            print(f"  SKIP  {artista} - {titulo[:44]}  (master {master_id} returned no version stats)")
            failed += 1
            continue
        # A search hit is a guess, unlike a master reached from a pressing we
        # already verified. Blindly taking the first result attached a 2-version
        # master (37 owners) to a "Live Grunge Ultimate Collection" bootleg
        # whose MB match claims it is Alice in Chains' self-titled album. Any
        # real album by an artist big enough for a guide page has been pressed
        # many times, so a thin master here means the search missed.
        if from_search and counted < 5:
            print(f"  SKIP  {artista} - {titulo[:44]}  (search hit has only {counted} versions)")
            failed += 1
            continue

        print(
            "  %-5s %-42s master=%-8s versions=%-4d have=%-7d want=%-7d  (pressing had %s)"
            % ("APPLY" if args.apply else "DRY", titulo[:42], master_id, counted, have, want, pressing_have)
        )
        if args.apply:
            cur.execute(
                """UPDATE "Disco"
                      SET discogs_master_id      = COALESCE(discogs_master_id, %s),
                          discogs_master_have    = %s,
                          discogs_master_want    = %s,
                          discogs_master_stats_at = NOW()
                    WHERE mb_mbid = %s""",
                (master_id, have, want, mbid),
            )
            conn.commit()
        done += 1
        time.sleep(PAGE_DELAY)

    print(f"\n{done} albums resolved, {failed} skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""
rematch_flagged_tracklists.py — re-search MusicBrainz for the records flagged by
flag_bad_tracklists.py, using the fixed matcher (mb_enrich.py, title-guard on
both search paths, threshold 70).

flag_bad_tracklists.py cleared mb_tracklist but deliberately kept mb_mbid "so a
later re-match pass can revisit these rows" -- but that left the WRONG mbid in
place, and the scheduled crawler's mb_tracklist.py re-fetches any row where
mb_mbid IS NOT NULL AND mb_tracklist IS NULL, using whatever mbid is stored.
Confirmed live: 338 of the 376 flagged rows already had their tracklist
silently restored to the SAME wrong release-group (Wings verified: mb_mbid
still 5c03bba6-..., "Wings 1971-73", 214 tracks -- unchanged).

This clears mb_mbid/mb_title/mb_first_release_date/mb_primary_type/mb_genres
on the flagged rows (so mb_enrich treats them as unsearched) and re-searches
+ re-fetches immediately, rather than waiting for the next scheduled run.

Usage:
    python rematch_flagged_tracklists.py --dry-run
    python rematch_flagged_tracklists.py --apply
"""
import argparse
import io
import json
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry
from mb_enrich import search_release_group
from mb_tracklist import fetch_tracklist
from lastfm import clean_album_title


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--backup", default="rematch_flagged_backup.json")
    ap.add_argument("--delay", type=float, default=1.1)
    args = ap.parse_args()

    with open("mb_tracklist_backup.json", encoding="utf-8") as f:
        flagged = json.load(f)
    slugs = [r["slug"] for r in flagged["rows"]]
    print(f"flagged rows to re-match: {len(slugs)}")

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(
        """SELECT slug, artista, titulo, mb_mbid, mb_title
           FROM "Disco" WHERE slug = ANY(%s)""",
        (slugs,),
    )
    rows = cur.fetchall()

    if not args.apply:
        cur.execute(
            """SELECT count(*) FROM "Disco"
               WHERE slug = ANY(%s) AND mb_tracklist IS NOT NULL""",
            (slugs,),
        )
        restored = cur.fetchone()[0]
        print(f"already silently re-restored to the old (wrong) tracklist: {restored}")
        print("\nDRY RUN — nothing written. Re-run with --apply to re-search + re-fetch.")
        conn.close()
        return

    backup = [
        {"slug": s, "mb_mbid": mbid, "mb_title": title}
        for s, _a, _t, mbid, title in rows
    ]
    with open(args.backup, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False, indent=2)
    print(f"backup of pre-rematch mbid/title written to {args.backup}")

    rematched = unmatched = tracklisted = 0
    for i, (slug, artista, titulo, _old_mbid, _old_title) in enumerate(rows, 1):
        album = clean_album_title(titulo, artista)
        hit = search_release_group(artista, album)
        time.sleep(args.delay)

        if hit:
            cur.execute(
                """UPDATE "Disco"
                   SET mb_mbid = %s, mb_title = %s, mb_first_release_date = %s,
                       mb_primary_type = %s, mb_genres = %s, mb_tracklist = NULL
                   WHERE slug = %s""",
                (hit["mbid"], hit["title"], hit["first_release_date"],
                 hit["primary_type"], hit["genres"], slug),
            )
            rematched += 1

            tracks = fetch_tracklist(hit["mbid"])
            time.sleep(args.delay)
            if tracks:
                cur.execute(
                    """UPDATE "Disco" SET mb_tracklist = %s WHERE slug = %s""",
                    (json.dumps(tracks, ensure_ascii=False), slug),
                )
                tracklisted += 1
        else:
            # No confident match under the fixed matcher either -- clear
            # everything rather than leave the wrong mbid in place.
            cur.execute(
                """UPDATE "Disco"
                   SET mb_mbid = '', mb_title = NULL, mb_first_release_date = NULL,
                       mb_primary_type = NULL, mb_genres = NULL, mb_tracklist = NULL
                   WHERE slug = %s""",
                (slug,),
            )
            unmatched += 1

        if i % 25 == 0:
            conn.commit()
            print(f"  {i}/{len(rows)} | rematched {rematched} | unmatched {unmatched} | tracklisted {tracklisted}")

    conn.commit()
    conn.close()
    print(f"\ndone: {rematched} re-matched ({tracklisted} with a fresh tracklist), "
          f"{unmatched} had no confident match and were cleared")


if __name__ == "__main__":
    main()

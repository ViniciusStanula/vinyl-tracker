"""
flag_bad_tracklists.py — clear tracklists that plainly belong to another release.

mb_tracklist is fetched from whatever release-group mb_enrich matched, so a bad
match yields a confidently wrong tracklist. Confirmed example: the product
"WINGS [180g LP]" (one LP) was matched to a release-group whose only release is
"Wings 1971-73", an 18-disc box set — 214 tracks on a single-LP product page.

Two signals need no API calls and are hard to argue with:

  BOX     tracklist has >30 tracks while the product title claims no box set,
          deluxe, anthology or multi-LP edition.
  STUB    tracklist has 1-2 tracks while the product is not a single or EP —
          mb_enrich matched a promo single instead of the album.

Both clear mb_tracklist to NULL rather than guessing a replacement: a missing
tracklist degrades gracefully on the page, a wrong one misinforms. mb_mbid is
left in place so a later re-match pass can revisit these rows.

Usage:
    python flag_bad_tracklists.py            # dry run
    python flag_bad_tracklists.py --apply
"""
import argparse
import io
import json
import sys
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry

# Title markers that legitimately justify a very long tracklist. The year-range
# alternative matters: retrospectives are titled "1983-2023" / "1992 - 2001"
# and really are box sets, so flagging them would delete correct data.
BOXSET_MARKERS = r"(box ?set|boxset|deluxe|anthology|complete|collection|discograf|" \
                 r"[2-9] ?[- ]?lp|1[0-9] ?[- ]?lp|[2-9] ?cd|super ?deluxe|" \
                 r"years|greatest hits|best of|essential|compilation|live|" \
                 r"int[ée]grale|1[89][0-9]{2} ?[-–] ?[12][0-9]{3})"
# A 1-2 track release is normal for a single. "b/w" (backed with) is the giveaway
# on 7" pressings, and Amazon titles rarely say "single" outright.
SINGLE_MARKERS = r"(single|7\"|10\"|12\"|\bep\b|maxi|b/w|b-w|remix)"

# STUB needs two extra guards or it deletes correct data. Plenty of albums are
# genuinely one or two tracks — Jethro Tull's "Thick As A Brick" is a single
# piece split over two sides, likewise Pharoah Sanders' "Black Unity" and Paul
# Simon's "Seven Psalms". What separates those from a bad match is total
# running time: a real album runs 20+ minutes even in two tracks, whereas a
# promo single matched onto an album product is a few minutes. So require MB to
# call it an Album AND the total duration to be implausibly short.
STUB_MAX_MS = 15 * 60 * 1000

SQL = f"""
WITH t AS (
  SELECT slug, artista, titulo, mb_mbid, mb_primary_type,
         jsonb_array_length(mb_tracklist::jsonb) AS n,
         (SELECT sum((e->>'length')::bigint)
            FROM jsonb_array_elements(mb_tracklist::jsonb) e
           WHERE e->>'length' ~ '^[0-9]+$') AS total_ms
  FROM "Disco"
  WHERE mb_tracklist IS NOT NULL
)
SELECT slug, artista, titulo, mb_mbid, n,
       CASE
         WHEN n > 30 AND titulo !~* '{BOXSET_MARKERS}' THEN 'BOX'
         WHEN n BETWEEN 1 AND 2
              AND titulo !~* '{SINGLE_MARKERS}'
              AND mb_primary_type = 'Album'
              AND total_ms IS NOT NULL
              AND total_ms < {STUB_MAX_MS} THEN 'STUB'
       END AS reason
FROM t
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--backup", default="mb_tracklist_backup.json")
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(SQL)
    rows = [r for r in cur.fetchall() if r[5]]

    box = [r for r in rows if r[5] == "BOX"]
    stub = [r for r in rows if r[5] == "STUB"]
    print(f"flagged total : {len(rows)}")
    print(f"  BOX  (>30 tracks, no box-set marker in title): {len(box)}")
    print(f"  STUB (1-2 tracks, not a single/EP)           : {len(stub)}")

    print("\nworst BOX offenders:")
    for slug, art, tit, _mbid, n, _ in sorted(box, key=lambda r: -r[4])[:12]:
        print(f"  {n:4d} tracks | {str(art)[:22]:22s} | {str(tit)[:46]}")
    print("\nsample STUB:")
    for slug, art, tit, _mbid, n, _ in stub[:8]:
        print(f"  {n:4d} tracks | {str(art)[:22]:22s} | {str(tit)[:46]}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        conn.close()
        return

    cur.execute(
        """SELECT slug, mb_tracklist FROM "Disco" WHERE slug = ANY(%s)""",
        ([r[0] for r in rows],),
    )
    backup = [{"slug": s, "mb_tracklist": t} for s, t in cur.fetchall()]
    with open(args.backup, "w", encoding="utf-8") as f:
        json.dump(
            {"taken_at": datetime.now(timezone.utc).isoformat(),
             "reasons": {r[0]: r[5] for r in rows},
             "rows": backup},
            f, ensure_ascii=False, indent=2,
        )
    print(f"\nbackup written to {args.backup} ({len(backup)} rows)")

    cur.execute(
        """UPDATE "Disco" SET mb_tracklist = NULL WHERE slug = ANY(%s)""",
        ([r[0] for r in rows],),
    )
    conn.commit()
    print(f"cleared mb_tracklist on {cur.rowcount} rows (mb_mbid kept for re-matching)")
    conn.close()


if __name__ == "__main__":
    main()

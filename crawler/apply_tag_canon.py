"""
apply_tag_canon.py — rewrite Disco.lastfm_tags into its canonical form.

Applies crawler/tag_canon.py across the catalog: folds spelling variants, drops
tags curated as non-genres, and drops the long tail that
frontend/lib/db/estilo.ts already refuses to list.

Counts are taken over the same scope the frontend uses to decide visibility
(available vinyl), so the threshold here means the same thing it means there.
Rows outside that scope are still rewritten, using those counts — otherwise a
record's tags would change the day it went out of stock.

Every change is written to tag_canon_changes.csv BEFORE any UPDATE, with the
reason per tag, so the cleanup is explainable and reversible.

Idempotent: a second run over canonicalised data finds nothing to do.

Usage:
    python apply_tag_canon.py            # dry run + changes CSV
    python apply_tag_canon.py --apply
    python apply_tag_canon.py --limit 50 # inspect a sample first
"""
import io
import os
import csv
import sys
import argparse
from collections import Counter

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection
from tag_canon import Canonicaliser, MIN_USES

CHANGES_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "tag_canon_changes.csv")

# The corpus the frontend counts over when deciding what to list.
VISIBILITY_SCOPE = "disponivel = TRUE AND (format IS NULL OR format = 'vinyl')"


def catalog_counts(cur) -> dict[str, int]:
    cur.execute(f"""
        WITH tags AS (
          SELECT TRIM(unnest(string_to_array(lastfm_tags, ','))) AS tag
          FROM "Disco"
          WHERE {VISIBILITY_SCOPE}
            AND lastfm_tags IS NOT NULL AND lastfm_tags <> ''
        )
        SELECT tag, COUNT(*) FROM tags WHERE tag <> '' GROUP BY tag
    """)
    return {tag: n for tag, n in cur.fetchall()}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=None,
                    help="only process this many rows (inspection)")
    args = ap.parse_args()

    conn = get_connection()
    cur = conn.cursor()

    counts = catalog_counts(cur)
    canon = Canonicaliser(counts)
    print(f"vocabulary            : {len(counts)} distinct tag(s)")
    print(f"variant spellings     : {len(canon.variant_map)}")
    print(f"threshold             : < {MIN_USES} uses dropped\n")

    sql = ('SELECT asin, lastfm_tags FROM "Disco" '
           "WHERE lastfm_tags IS NOT NULL AND lastfm_tags <> ''")
    if args.limit:
        sql += f" LIMIT {int(args.limit)}"
    cur.execute(sql)
    rows = cur.fetchall()

    updates: list[tuple[str, str]] = []
    reasons = Counter()
    emptied = 0
    change_log: list[tuple[str, str, str, str, str]] = []

    for asin, tags in rows:
        new, changes = canon.apply(tags)
        if new == tags:
            continue
        updates.append((new, asin))
        if not new:
            emptied += 1
        for tag, reason in changes.items():
            reasons[reason.split(" ")[0]] += 1
            change_log.append((asin, tags, new, tag, reason))

    print(f"rows examined         : {len(rows)}")
    print(f"rows changing         : {len(updates)}")
    print(f"rows left with no tags: {emptied}")
    print("\ntag changes by reason:")
    for reason, n in reasons.most_common():
        print(f"  {n:7d}  {reason}")

    with io.open(CHANGES_CSV, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["asin", "old_tags", "new_tags", "tag", "reason"])
        w.writerows(change_log)
    print(f"\nchange log -> {CHANGES_CSV}")

    if not args.apply:
        print("\nDRY RUN — no database writes. Re-run with --apply.")
        conn.close()
        return

    import psycopg2.extras
    psycopg2.extras.execute_batch(
        cur,
        'UPDATE "Disco" SET lastfm_tags = %s, "updatedAt" = NOW() WHERE asin = %s',
        updates,
        page_size=500,
    )
    conn.commit()
    conn.close()
    print(f"\nAPPLIED — {len(updates)} row(s) rewritten.")


if __name__ == "__main__":
    main()

"""
clean_mb_genres.py — strip non-genre junk from Disco.mb_genres.

mb_enrich used to fall back to MusicBrainz folksonomy tags with only a small
blocklist, so the column accumulated site names, chart metadata and rating codes
("offizielle charts", "plattentests.de", "ph_2_stars", "1-4 wochen", bare years,
one raw MBID). genre_filter.filter_genres is the allowlist that mb_enrich now
applies at write time; this rewrites the rows already stored.

Writes a JSON backup of every changed row before touching the DB.

Usage:
    python clean_mb_genres.py --dry-run     # report only (default)
    python clean_mb_genres.py --apply
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
from genre_filter import filter_genres


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--backup", default="mb_genres_backup.json")
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(
        """SELECT slug, mb_genres FROM "Disco"
           WHERE mb_genres IS NOT NULL AND mb_genres <> ''"""
    )
    rows = cur.fetchall()
    print(f"rows with mb_genres: {len(rows)}")

    changes = []
    for slug, raw in rows:
        before = [t.strip() for t in raw.split(",") if t.strip()]
        after = filter_genres(before)
        if after != before:
            changes.append({"slug": slug, "before": raw, "after": ", ".join(after)})

    emptied = sum(1 for c in changes if not c["after"])
    print(f"rows changed : {len(changes)}")
    print(f"  ...of which end up empty: {emptied}")
    print(f"rows untouched: {len(rows) - len(changes)}")

    from collections import Counter
    dropped = Counter()
    for c in changes:
        b = {t.strip() for t in c["before"].split(",") if t.strip()}
        a = {t.strip() for t in c["after"].split(",") if t.strip()}
        dropped.update(b - a)
    print("\ntop values removed:")
    for tag, n in dropped.most_common(20):
        print(f"  {n:5d}  {tag[:55]}")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        conn.close()
        return

    with open(args.backup, "w", encoding="utf-8") as f:
        json.dump(
            {"taken_at": datetime.now(timezone.utc).isoformat(), "rows": changes},
            f, ensure_ascii=False, indent=2,
        )
    print(f"\nbackup written to {args.backup} ({len(changes)} rows)")

    for c in changes:
        cur.execute(
            'UPDATE "Disco" SET mb_genres = %s WHERE slug = %s',
            (c["after"] or None, c["slug"]),
        )
    conn.commit()
    conn.close()
    print(f"applied: {len(changes)} rows updated")


if __name__ == "__main__":
    main()

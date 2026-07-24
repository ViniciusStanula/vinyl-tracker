"""
audit_clobbered_tags.py — separate genuinely-empty tags from erased ones.

21,877 Disco rows hold lastfm_tags = ''. Most are honest: '' is how the Last.fm
pass records "artist fetched, no genre tags found" so it is not re-fetched. But
until the guard added to bulk_update_tags, the artist-level write also erased
per-ASIN tags, so some unknown share of those rows are damage.

Guessing which is which from the current table is impossible — both states look
identical. This uses evidence instead: enrich_style_tags.py and
augment_style_tags write one JSONL line per row they touch, recording the tags
written. Any ASIN that was written a non-empty tag set and now reads '' or NULL
was erased afterwards.

That is a lower bound, not the full count. It only sees rows the LLM passes
touched and only as far back as the retained logs. Rows whose tags came from
somewhere else, or predate the logs, cannot be recovered this way and are left
alone rather than guessed at.

Recovery re-queues rather than rewrites: the row is set to '' (if NULL) so
enrich_style_tags.py's fill mode picks it up and re-derives tags from the
current title and artist. Replaying an old log line would restore tags that may
have been computed from a since-corrected artist -- exactly the contamination
found in the "Yesterday"/"Only Yesterday" rows.

Usage:
    python audit_clobbered_tags.py            # report only
    python audit_clobbered_tags.py --apply    # re-queue the recoverable rows
"""
import os
import sys
import glob
import json
from collections import defaultdict

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
LOG_GLOBS = ("enrich_style_tags_*.jsonl", "augment_style_tags_*.jsonl")


def written_tags_from_logs():
    """
    ASIN -> most recent non-empty tag list actually written (dry_run false).

    Files are processed in filename order, which is timestamp order, so a later
    run's line overwrites an earlier one.
    """
    written = {}
    files = []
    for pattern in LOG_GLOBS:
        files.extend(glob.glob(os.path.join(LOG_DIR, pattern)))

    scanned = 0
    for path in sorted(files):
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                scanned += 1
                if rec.get("dry_run"):
                    continue
                tags = rec.get("tags")
                if not tags:                      # null or [] — nothing written
                    continue
                asin = rec.get("asin")
                if asin:
                    written[asin] = tags
    return written, len(files), scanned


def main() -> None:
    apply = "--apply" in sys.argv

    written, n_files, n_lines = written_tags_from_logs()
    print(f"logs scanned      : {n_files} file(s), {n_lines} line(s)")
    print(f"real tag writes   : {len(written)} ASIN(s)")

    if not written:
        print("No non-dry-run tag writes in the retained logs — nothing to check.")
        return

    conn = get_connection()
    cur = conn.cursor()

    asins = list(written)
    cur.execute("""
        SELECT asin, lastfm_tags, titulo, artista
        FROM "Disco" WHERE asin = ANY(%s)
    """, (asins,))
    rows = cur.fetchall()

    present = {r[0] for r in rows}
    erased = [(a, t, ar) for a, tags, t, ar in rows
              if tags is None or tags.strip() == ""]

    print(f"still in catalog  : {len(present)}")
    print(f"gone since        : {len(asins) - len(present)}")
    print(f"ERASED (written non-empty, now blank): {len(erased)}")

    if erased:
        print("\nsample:")
        for asin, titulo, artista in erased[:20]:
            was = ", ".join(written[asin])[:40]
            print(f"  {asin}  {(titulo or '')[:44]:44s}  was={was!r}")
        if len(erased) > 20:
            print(f"  … and {len(erased) - 20} more")

    # How concentrated is the damage per artist? Artist-level clobbering should
    # show up as whole artists going blank at once.
    by_artist = defaultdict(int)
    for _asin, _t, artista in erased:
        by_artist[artista] += 1
    if by_artist:
        top = sorted(by_artist.items(), key=lambda kv: -kv[1])[:10]
        print("\nmost affected artists:")
        for artista, n in top:
            print(f"  {n:4d}  {artista}")

    if not apply:
        print("\nREPORT ONLY — re-run with --apply to re-queue these for enrichment.")
        conn.close()
        return

    # Re-queue: '' is the state enrich_style_tags.py fill mode drains. Rows that
    # are already '' need no write; only NULL ones do.
    to_queue = [a for a, _t, _ar in erased]
    cur.execute("""UPDATE "Disco" SET lastfm_tags = '', "updatedAt" = NOW()
                   WHERE asin = ANY(%s) AND lastfm_tags IS NULL""", (to_queue,))
    changed = cur.rowcount
    conn.commit()
    conn.close()
    print(f"\nRe-queued {changed} NULL row(s) as ''. "
          f"{len(to_queue) - changed} were already '' and already in the queue.")
    print("enrich_style_tags.py will re-derive tags on its next run.")


if __name__ == "__main__":
    main()

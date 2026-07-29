"""
rematch_album_tags.py — replace artist-level-capped Disco.lastfm_tags with
real per-album Last.fm tags (album.getTopTags instead of artist.getTopTags).

Root cause: backfill_tags.py only ever called artist.getTopTags once per
artist and stamped the same top-3 tags onto every album that artist has.
21,373 of ~30k rows are stuck at exactly 3 tags for this reason (see
style_tag_enrichment_audit memory) -- e.g. every Pantera album shows the
identical "thrash metal, groove metal, heavy metal" regardless of which
specific record it is.

Targets rows where lastfm_tags has exactly 3 tags AND that exact string is
shared with at least one other record by the same artist (the direct
fingerprint of the artist-level stamp -- a genuinely correct 3-tag
per-album result wouldn't coincidentally match another album word-for-word).

Usage:
    python rematch_album_tags.py --limit 100                # dry run, no writes
    python rematch_album_tags.py --limit 100 --apply         # write results
    python rematch_album_tags.py --apply                     # full run (all suspects)
"""
import argparse
import io
import json
import os
import sys
import time
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry
from database import bulk_update_tags_by_slug
from lastfm import fetch_album_tags
from genre_filter import filter_genres

SUSPECT_SQL = """
WITH capped AS (
  SELECT slug, artista, titulo, lastfm_tags
  FROM "Disco"
  WHERE lastfm_tags IS NOT NULL
    AND array_length(string_to_array(lastfm_tags, ', '), 1) = 3
    AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
),
dupe_fingerprint AS (
  SELECT lastfm_tags, artista, COUNT(*) AS n
  FROM capped
  GROUP BY lastfm_tags, artista
  HAVING COUNT(*) > 1
)
SELECT c.slug, c.artista, c.titulo, c.lastfm_tags
FROM capped c
JOIN dupe_fingerprint d ON d.lastfm_tags = c.lastfm_tags AND d.artista = c.artista
ORDER BY c.artista, c.titulo
"""


def clean_title_for_lastfm(titulo: str, artista: str) -> str:
    # Reuse the same Amazon-junk stripper the enrichment pipelines already
    # trust, so the album name sent to Last.fm matches what mb_enrich/wiki
    # fetch already send -- avoids inventing a second cleaning rule.
    from lastfm import clean_album_title
    return clean_album_title(titulo, artista)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="cap the suspect pool (0 = all)")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--delay", type=float, default=0.25)
    ap.add_argument("--backup", default="lastfm_tags_rematch_backup.json")
    args = ap.parse_args()

    api_key = os.environ.get("LASTFM_API_KEY", "")
    if not api_key:
        print("LASTFM_API_KEY not set. Aborting.")
        sys.exit(1)

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(SUSPECT_SQL)
    suspects = cur.fetchall()
    if args.limit:
        suspects = suspects[: args.limit]
    print(f"suspect rows (artist-level-capped, duplicate fingerprint): {len(suspects)}")

    backup = []
    got_tags = got_empty = got_none = 0
    changed = unchanged = 0

    for i, (slug, artista, titulo, old_tags) in enumerate(suspects, 1):
        clean = clean_title_for_lastfm(titulo, artista)
        # Pull more raw candidates than we intend to keep (15, not 5) -- the
        # genre_filter pass below removes junk that Last.fm ranks high
        # (years, self-tags like "2pac" on a 2Pac album), so truncating to 5
        # BEFORE filtering can throw away a real genre tag ranked 6th behind
        # five junk ones. Filter first, then keep the top 5 of what's left.
        raw_tags = fetch_album_tags(artista, clean, api_key, max_tags=15)
        time.sleep(args.delay)

        # Same allowlist genre_filter.py built for MusicBrainz's genre field --
        # album-level Last.fm tagging turns out to carry its OWN junk class
        # (years "2020"/"2020s", the artist's own name as a self-tag "2pac",
        # generic "albums"/"cover") that the older NON_GENRE_TAGS blocklist in
        # lastfm.py never had to filter for artist-level tags. Confirmed on a
        # 40-row test batch: filter_genres cleanly strips all of it while
        # keeping legitimate genre words (including multi-word ones like
        # "melodic black metal").
        new_tags = filter_genres(raw_tags)[:5] if raw_tags is not None else None

        if new_tags is None:
            got_none += 1
            print(f"  NO-RESULT  {artista[:22]:22s} | {clean[:35]:35s} (kept old: {old_tags})")
            continue

        if not new_tags:
            # Last.fm has no per-album tags for this specific release. Keep
            # the old artist-level value rather than clear it -- per user
            # decision, never worse than before an empty per-album result
            # is not a case where "no data beats wrong data" applies, since
            # the site still needs SOMETHING to show for this record.
            got_empty += 1
            unchanged += 1
            print(f"  {artista[:22]:22s} | {clean[:35]:35s} | old: {old_tags[:35]:35s} -> new: (none, kept old)")
            continue

        new_str = ", ".join(new_tags)
        got_tags += 1
        changed += 1
        print(f"  {artista[:22]:22s} | {clean[:35]:35s} | old: {old_tags[:35]:35s} -> new: {new_str}")

        backup.append({"slug": slug, "old_tags": old_tags, "new_tags": new_str})

        if args.apply:
            # The live crawler writes to Disco concurrently -- confirmed
            # deadlocks against it earlier this session (audit_mb_titles.py).
            # Retry once with a fresh cursor rather than crash mid-run.
            for attempt in range(3):
                try:
                    bulk_update_tags_by_slug(conn, {slug: new_str})
                    break
                except Exception as exc:
                    conn.rollback()
                    if "deadlock" not in str(exc).lower() or attempt == 2:
                        raise
                    time.sleep(2 * (attempt + 1))
                    cur = conn.cursor()

        if i % 25 == 0:
            print(f"  ...{i}/{len(suspects)} | got_tags={got_tags} got_empty={got_empty} no_result={got_none}")

    if backup:
        with open(args.backup, "w", encoding="utf-8") as f:
            json.dump(
                {"taken_at": datetime.now(timezone.utc).isoformat(), "rows": backup},
                f, ensure_ascii=False, indent=2,
            )
        print(f"\nbackup written to {args.backup}")

    print(f"\ndone: {len(suspects)} processed | got real tags: {got_tags} | "
          f"got empty (no genre tags on Last.fm): {got_empty} | no API result: {got_none} | "
          f"changed vs old: {changed} | unchanged: {unchanged}")
    if not args.apply:
        print("DRY RUN -- nothing written. Add --apply to write.")
    conn.close()


if __name__ == "__main__":
    main()

"""
audit_mb_titles.py — retroactively audit every existing MusicBrainz match using
the SAME title guard now baked into mb_enrich.search_release_group.

Every previous mb_enrich run before the PR #286/#292 fixes matched using either
no title guard at all, or a guard with the disambiguator bug (see
wikipedia_bio_fetch.py's identical class of bug, fixed in #292). Those matches
were never re-verified. Now that mb_title is backfilled for ~25.6k rows
(backfill_mb_title.py), this is pure string comparison — zero MusicBrainz API
calls needed to FIND the bad ones. API calls only happen for rows this flags,
when re-matching them.

Usage:
    python audit_mb_titles.py                    # report only
    python audit_mb_titles.py --rematch --apply   # also re-search + re-fetch flagged rows
"""
import argparse
import io
import json
import sys
import time
from datetime import datetime, timezone

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

import re
import unicodedata

from db_retry import connect_with_retry
from mb_enrich import search_release_group, title_matches_release
from mb_tracklist import fetch_tracklist
from lastfm import clean_album_title

# title_matches_release (mb_enrich.py) is deliberately strict token-subset
# matching, tuned for LIVE search results -- freshly fetched MB candidates
# rarely differ from the query only cosmetically. Retroactively comparing
# already-STORED mb_title against titulo is a different problem: real,
# correct matches routinely differ only in accents ("Seance"/"Séance"),
# smart quotes/dashes, a leading "The", or "&" vs "and". Reusing the strict
# comparator here flagged 1492/22992 (6.5%) rows, and manual inspection
# showed the overwhelming majority were exactly this kind of cosmetic-only
# difference, not real mismatches. _norm_loose absorbs those before the
# subset test so the audit only flags rows that are actually suspicious.
_LEADING_ARTICLE = re.compile(r"^(the|a|an) ")


def _norm_loose(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("&", " and ")
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = _LEADING_ARTICLE.sub("", s)
    return s


def _loose_tokens(s: str) -> set[str]:
    return set(_norm_loose(s).split())


def title_matches_loosely(mb_title: str, album_clean: str, artist: str) -> bool:
    if not mb_title:
        return False
    qtok = _loose_tokens(album_clean)
    atok = _loose_tokens(artist)
    mbtok = _loose_tokens(mb_title) - atok
    return mbtok <= qtok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rematch", action="store_true", help="re-search flagged rows")
    ap.add_argument("--apply", action="store_true", help="write re-match results (default: dry run)")
    ap.add_argument("--delay", type=float, default=1.1)
    ap.add_argument("--backup", default="mb_title_audit_backup.json")
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(
        """SELECT slug, artista, titulo, mb_title, mb_mbid
           FROM "Disco"
           WHERE mb_title IS NOT NULL AND mb_mbid IS NOT NULL AND mb_mbid <> ''
             AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')"""
    )
    rows = cur.fetchall()
    print(f"rows with mb_title to audit: {len(rows)}")

    # Loose-match failures split further by token overlap: sharing ZERO words
    # with the product title (after discounting the artist) means mb_title is
    # very likely describing a different release entirely (e.g. "V" matched
    # to "Nocturnal (Disclosure V.I.P.)" -- zero overlap). Sharing most words
    # but adding a subtitle/qualifier ("Live", "Soundtrack", ": The Classic
    # Characters...") is very likely still the CORRECT release, just with a
    # fuller title than the stripped-down Amazon listing -- rewriting mb_mbid
    # for those would be pure churn, not a fix.
    high_conf, low_conf = [], []
    for slug, artista, titulo, mb_title, mb_mbid in rows:
        album_clean = clean_album_title(titulo, artista)
        if title_matches_loosely(mb_title, album_clean, artista):
            continue
        qtok = _loose_tokens(album_clean)
        mbtok = _loose_tokens(mb_title) - _loose_tokens(artista)
        overlap = qtok & mbtok
        row = (slug, artista, titulo, album_clean, mb_title, mb_mbid)
        if not overlap:
            high_conf.append(row)
        else:
            low_conf.append(row)

    print(f"flagged total: {len(high_conf) + len(low_conf)} "
          f"({100*(len(high_conf)+len(low_conf))/len(rows):.1f}%)")
    print(f"  HIGH confidence (zero word overlap -- likely a real wrong match): {len(high_conf)}")
    print(f"  LOW  confidence (shares words, likely just a fuller title): {len(low_conf)}")
    flagged = high_conf

    print("\nHIGH-confidence sample:")
    for slug, artista, titulo, album_clean, mb_title, _mbid in high_conf[:40]:
        print(f"  {str(artista)[:20]:20s} | {album_clean[:30]:30s} -> mb_title: {mb_title[:40]}")
    print("\nLOW-confidence sample (NOT auto-flagged):")
    for slug, artista, titulo, album_clean, mb_title, _mbid in low_conf[:15]:
        print(f"  {str(artista)[:20]:20s} | {album_clean[:30]:30s} -> mb_title: {mb_title[:40]}")

    if not args.rematch:
        with open(args.backup.replace(".json", "_flagged.json"), "w", encoding="utf-8") as f:
            json.dump(
                [{"slug": s, "artista": a, "titulo": t, "mb_title": m, "mb_mbid": mb}
                 for s, a, t, _c, m, mb in flagged],
                f, ensure_ascii=False, indent=2,
            )
        print(f"\nflagged list written to {args.backup.replace('.json', '_flagged.json')}")
        print("Re-run with --rematch (and --apply to write) to re-search these.")
        conn.close()
        return

    backup = [
        {"slug": s, "mb_mbid": mb, "mb_title": m}
        for s, a, t, c, m, mb in flagged
    ]
    if args.apply:
        with open(args.backup, "w", encoding="utf-8") as f:
            json.dump(
                {"taken_at": datetime.now(timezone.utc).isoformat(), "rows": backup},
                f, ensure_ascii=False, indent=2,
            )
        print(f"backup of pre-rematch mbid/title written to {args.backup}")

    def _write_with_retry(sql, params, attempts=5):
        # The live crawler writes to Disco concurrently, so this can deadlock
        # (confirmed: crashed the first run at row 25/123 mid-batch-commit,
        # losing the remaining 98 rows' work since the DeadlockDetected
        # exception was never caught). Retry with a fresh cursor instead.
        nonlocal cur
        for attempt in range(attempts):
            try:
                cur.execute(sql, params)
                return
            except Exception as exc:
                conn.rollback()
                if "deadlock" not in str(exc).lower() or attempt == attempts - 1:
                    raise
                time.sleep(2 * (attempt + 1))
                cur = conn.cursor()

    rematched = unmatched = tracklisted = 0
    for i, (slug, artista, titulo, album_clean, _old_title, _old_mbid) in enumerate(flagged, 1):
        hit = search_release_group(artista, album_clean)
        time.sleep(args.delay)

        if hit:
            rematched += 1
            if args.apply:
                _write_with_retry(
                    """UPDATE "Disco"
                       SET mb_mbid = %s, mb_title = %s, mb_first_release_date = %s,
                           mb_primary_type = %s, mb_genres = %s, mb_tracklist = NULL
                       WHERE slug = %s""",
                    (hit["mbid"], hit["title"], hit["first_release_date"],
                     hit["primary_type"], hit["genres"], slug),
                )
                tracks = fetch_tracklist(hit["mbid"])
                time.sleep(args.delay)
                if tracks:
                    _write_with_retry(
                        """UPDATE "Disco" SET mb_tracklist = %s WHERE slug = %s""",
                        (json.dumps(tracks, ensure_ascii=False), slug),
                    )
                    tracklisted += 1
        else:
            unmatched += 1
            if args.apply:
                _write_with_retry(
                    """UPDATE "Disco"
                       SET mb_mbid = '', mb_title = NULL, mb_first_release_date = NULL,
                           mb_primary_type = NULL, mb_genres = NULL, mb_tracklist = NULL
                       WHERE slug = %s""",
                    (slug,),
                )

        # Commit every row, not every 25 -- a crash mid-batch previously lost
        # up to 24 rows of already-completed API work along with it.
        if args.apply:
            conn.commit()
        if i % 25 == 0:
            print(f"  {i}/{len(flagged)} | rematched {rematched} | unmatched {unmatched} | tracklisted {tracklisted}")

    if args.apply:
        conn.commit()
        print(f"\ndone: {rematched} re-matched ({tracklisted} with a fresh tracklist), "
              f"{unmatched} had no confident match and were cleared")
    else:
        print(f"\nDRY RUN (rematch, no apply): would re-match {len(flagged)} rows. "
              f"Add --apply to write.")
    conn.close()


if __name__ == "__main__":
    main()

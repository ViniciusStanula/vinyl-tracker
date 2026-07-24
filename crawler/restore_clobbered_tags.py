"""
restore_clobbered_tags.py — repair tags erased by the artist-level tag write.

bulk_update_tags matched on artista alone, so an artist selected because ONE of
its rows was NULL had every row rewritten — and when Last.fm returned no tags,
rewritten to ''. That erased soundtrack discovery's per-ASIN tags: candidates
sat marked 'tagged' while their Disco row carried nothing.

The write is now guarded (database.bulk_update_tags, WHERE lastfm_tags IS NULL).
This repairs what it already destroyed.

Two repairs:

  1. Soundtrack candidates marked 'tagged' whose Disco.lastfm_tags is empty are
     reset to 'pending' and re-applied through apply_pending_tags(), the same
     path that wrote them originally. Reusing it keeps the merge/non-vinyl rules
     in one place.

  2. Rows whose tags were inferred from a mis-stamped artist are reset to '',
     which is the queue enrich_style_tags.py drains. Their tags described the
     wrong record — "Yesterday", a Danny Boyle film, was tagged `anime` because
     it had been filed under the Ghibli seed "Only Yesterday". Blanking is
     better than hand-editing: the LLM pass re-derives them from the corrected
     artist and the title.

Safe to re-run. Once it reports 0 for both it can be deleted.

Usage:
    python restore_clobbered_tags.py            # dry run
    python restore_clobbered_tags.py --apply
"""
import re
import sys

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection
from domain import UNKNOWN_ARTIST
from soundtrack_discovery import apply_pending_tags, load_seeds


def find_cleared_candidates(cur):
    """Candidates marked tagged whose Disco row lost its tags."""
    cur.execute("""
        SELECT sc.asin, sc.category, d.titulo
        FROM soundtrack_candidates sc
        JOIN "Disco" d ON d.asin = sc.asin
        WHERE sc.status = 'tagged'
          AND (d.lastfm_tags IS NULL OR d.lastfm_tags = '')
          AND (d.format IS NULL OR d.format = 'vinyl')
        ORDER BY sc.asin
    """)
    return cur.fetchall()


def find_artist_contaminated(cur, seeds):
    """
    Rows reset to UNKNOWN_ARTIST by the seed-leak cleanup that still carry tags
    inferred from the wrong artist.
    """
    names = sorted({s.name for s in seeds if s.kind == "title"})
    cur.execute("""
        SELECT asin, titulo, lastfm_tags
        FROM "Disco"
        WHERE source LIKE 'soundtrack%%'
          AND artista = %s
          AND lastfm_tags IS NOT NULL AND lastfm_tags <> ''
    """, (UNKNOWN_ARTIST,))
    rows = cur.fetchall()
    # Only those whose tags name a franchise category the title does not support.
    out = []
    for asin, titulo, tags in rows:
        low = (tags or "").lower()
        if ("anime" in low or "game" in low) and not any(
            re.search(r"\b" + re.escape(n) + r"\b", titulo or "", re.IGNORECASE)
            for n in names
        ):
            out.append((asin, titulo, tags))
    return out


def main() -> None:
    apply = "--apply" in sys.argv
    seeds = load_seeds()

    conn = get_connection()
    cur = conn.cursor()

    cleared = find_cleared_candidates(cur)
    contaminated = find_artist_contaminated(cur, seeds)

    print(f"soundtrack rows with erased tags : {len(cleared)}")
    for asin, cat, titulo in cleared[:15]:
        print(f"    {asin}  category={cat or '(none)'}  {titulo[:52]}")
    if len(cleared) > 15:
        print(f"    … and {len(cleared) - 15} more")

    print(f"\nrows with tags from a wrong artist: {len(contaminated)}")
    for asin, titulo, tags in contaminated:
        print(f"    {asin}  {titulo[:45]:45s}  tags={tags!r}")

    if not apply:
        print("\nDRY RUN — no database writes. Re-run with --apply.")
        return

    if cleared:
        cur.execute("""
            UPDATE soundtrack_candidates SET status = 'pending', tagged_at = NULL
            WHERE asin = ANY(%s)
        """, ([r[0] for r in cleared],))
        conn.commit()
        tagged, non_vinyl = apply_pending_tags(conn)
        print(f"\nre-applied: {tagged} tagged, {non_vinyl} skipped as non-vinyl")

    if contaminated:
        cur.execute("""UPDATE "Disco" SET lastfm_tags = '', "updatedAt" = NOW()
                       WHERE asin = ANY(%s)""", ([r[0] for r in contaminated],))
        conn.commit()
        print(f"blanked {len(contaminated)} row(s) for LLM re-enrichment")

    conn.close()


if __name__ == "__main__":
    main()

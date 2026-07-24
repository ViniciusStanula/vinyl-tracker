"""
fix_soundtrack_categories.py — one-off cleanup for the fabricated-category bug.

Until 2026-07-24, soundtrack_discovery.classify() inherited the searching seed's
category for any result that merely said "soundtrack". Amazon's search is fuzzy,
so unrelated soundtracks were filed under the seed's franchise: "Halloween Kills"
and "You've Got Mail" as game records under the Hades seed, "Almost Famous" under
Journey, "Dirty Dancing" as anime under Akira.

The classifier is fixed. This drains what the old logic already wrote.

Every candidate is re-run through the CURRENT classify(). Where the category no
longer holds it is cleared, both in soundtrack_candidates (so apply_pending_tags
cannot re-apply it) and in the live Disco.lastfm_tags CSV. The `soundtrack` tag
itself is kept — it was almost always right; only the game/anime/movie kind was
fabricated.

Also resets artists mis-stamped with a seed name, the residual leak from #268:
that fix gated the artist stamp on tags being truthy, and the old branch made
tags truthy without proving the franchise.

Safe to re-run: it recomputes from the current classifier each time and only
writes rows that still disagree. Once it reports 0 changes it can be deleted.

Usage:
    python fix_soundtrack_categories.py            # dry run, writes the plan CSV
    python fix_soundtrack_categories.py --apply    # apply
"""
import re
import sys
import csv
import io
import os

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection
from domain import UNKNOWN_ARTIST
from soundtrack_discovery import load_seeds, build_title_classifier, classify

PLAN_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "soundtrack_category_cleanup.csv")


def build_plan(cur, seeds, classifier):
    """Rows whose stored category the current classifier no longer supports."""
    cur.execute("""
        SELECT sc.asin, sc.seed_key, sc.category, sc.status,
               COALESCE(d.titulo, sc.titulo) AS titulo, d.lastfm_tags
        FROM soundtrack_candidates sc
        LEFT JOIN "Disco" d ON d.asin = sc.asin
    """)
    by_key = {s.key: s for s in seeds}
    plan = []

    for asin, seed_key, old_cat, status, titulo, tags in cur.fetchall():
        seed = by_key.get(seed_key)
        if seed is None or not titulo or not old_cat:
            continue

        new_tags_list, _conflict = classify(titulo, seed, classifier)
        new_cat = (new_tags_list[1]
                   if new_tags_list and len(new_tags_list) > 1 else None)
        if new_cat == old_cat:
            continue

        # Drop only the disproven category; everything else the enrichment
        # passes wrote stays untouched.
        new_tags = None
        if status == "tagged" and tags:
            new_tags = ", ".join(
                t.strip() for t in tags.split(",")
                if t.strip() and t.strip().lower() != old_cat.lower()
            )

        plan.append({
            "asin": asin, "seed_key": seed_key, "status": status,
            "old_category": old_cat, "new_category": new_cat,
            "titulo": titulo, "old_tags": tags, "new_tags": new_tags,
        })
    return plan


def find_artist_leaks(cur, seeds):
    """Rows stamped with a seed name the title never mentions."""
    names = sorted({s.name for s in seeds if s.kind == "title"})
    cur.execute("""SELECT asin, artista, titulo FROM "Disco"
                   WHERE source LIKE 'soundtrack%%' AND artista = ANY(%s)""",
                (names,))
    return [
        (asin, artista, titulo)
        for asin, artista, titulo in cur.fetchall()
        if not re.search(r"\b" + re.escape(artista) + r"\b", titulo or "",
                         re.IGNORECASE)
    ]


def main() -> None:
    apply = "--apply" in sys.argv

    seeds = load_seeds()
    classifier = build_title_classifier(seeds)

    conn = get_connection()
    cur = conn.cursor()

    plan = build_plan(cur, seeds, classifier)
    leaks = find_artist_leaks(cur, seeds)

    live = sum(1 for p in plan if p["status"] == "tagged")
    print(f"category changes : {len(plan)}  ({live} live, {len(plan) - live} pending)")
    print(f"artist leaks     : {len(leaks)}")

    # Written before any UPDATE — this file is the rollback record.
    with io.open(PLAN_CSV, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(plan[0].keys())) if plan else None
        if w:
            w.writeheader()
            w.writerows(plan)
    print("plan/rollback written to", PLAN_CSV)

    for asin, artista, titulo in leaks:
        print(f"  artist: {asin}  {artista!r} -> {UNKNOWN_ARTIST!r}  ({titulo[:55]})")

    if not apply:
        print("\nDRY RUN — no database writes. Re-run with --apply.")
        return

    for p in plan:
        if p["status"] == "tagged" and p["new_tags"] is not None \
                and p["new_tags"] != (p["old_tags"] or ""):
            cur.execute('UPDATE "Disco" SET lastfm_tags = %s WHERE asin = %s',
                        (p["new_tags"], p["asin"]))
        cur.execute("UPDATE soundtrack_candidates SET category = %s WHERE asin = %s",
                    (p["new_category"], p["asin"]))

    for asin, _artista, _titulo in leaks:
        cur.execute('UPDATE "Disco" SET artista = %s WHERE asin = %s',
                    (UNKNOWN_ARTIST, asin))

    conn.commit()
    conn.close()
    print(f"\nAPPLIED — {len(plan)} categories, {len(leaks)} artists.")


if __name__ == "__main__":
    main()

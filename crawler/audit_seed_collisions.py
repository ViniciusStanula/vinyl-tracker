"""
audit_seed_collisions.py — find seed names that are also ordinary album titles.

soundtrack_seeds.json doubles as the classifier vocabulary: any title containing
a seed's name inherits that seed's category. That is safe for "Neon Genesis
Evangelion" and dangerous for "Fallout", which is a common English word — it
labelled The Ruts' 1978 punk album "Fulham Fallout" a game record, and Gong's
"Angel's Egg" an anime.

The `ambiguous` flag exists for exactly this and is applied by hand, so it only
covers names somebody already thought of. This measures the risk against the
real catalog instead of guessing.

Method: for each non-ambiguous title seed, count Disco rows whose title contains
the seed name but which show no sign of being that franchise's soundtrack —
no OST wording, and an established music identity (a MusicBrainz match or
Last.fm listeners). A franchise name that keeps landing on established albums by
unrelated artists is a collision, not a discovery.

Reports only. Flagging a seed is a judgement call about a franchise, so the
output is a ranked shortlist to review, not an edit.

Usage:
    python audit_seed_collisions.py
    python audit_seed_collisions.py --min-hits 3
"""
import re
import sys
import argparse

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from database import get_connection
from soundtrack_discovery import load_seeds, _OST_EVIDENCE_RE


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-hits", type=int, default=2,
                    help="report seeds with at least this many collisions")
    ap.add_argument("--sample", type=int, default=3,
                    help="example titles to print per seed")
    args = ap.parse_args()

    seeds = [s for s in load_seeds() if s.kind == "title" and not s.ambiguous]
    print(f"checking {len(seeds)} non-ambiguous title seed(s)\n")

    conn = get_connection()
    cur = conn.cursor()

    # Established music only: a MusicBrainz release-group match or real Last.fm
    # listeners means the record has an identity independent of any franchise.
    cur.execute("""
        SELECT titulo, artista, mb_mbid, lastfm_listeners
        FROM "Disco"
        WHERE format = 'vinyl'
          AND titulo IS NOT NULL
          AND (mb_mbid IS NOT NULL OR COALESCE(lastfm_listeners, 0) > 1000)
    """)
    catalog = cur.fetchall()
    conn.close()
    print(f"catalog rows considered: {len(catalog)}\n")

    findings = []
    for seed in seeds:
        pat = re.compile(r"\b" + re.escape(seed.name) + r"\b", re.IGNORECASE)
        # A seed's aliases are usually its composer ("Star Wars" -> John
        # Williams, "Minecraft" -> C418). A record BY that composer naming the
        # franchise is the seed working, not colliding.
        own = {n.lower() for n in [seed.name] + seed.aliases}
        hits = [
            (titulo, artista)
            for titulo, artista, _mbid, _listeners in catalog
            if pat.search(titulo)
            and not _OST_EVIDENCE_RE.search(titulo)
            and (artista or "").lower() not in own
        ]
        if len(hits) >= args.min_hits:
            findings.append((len(hits), seed, hits))

    findings.sort(key=lambda f: -f[0])

    if not findings:
        print("No collisions above the threshold.")
        return

    print(f"{len(findings)} seed(s) colliding with established records:\n")
    for n, seed, hits in findings:
        print(f"  {n:3d}  {seed.name!r} ({seed.category})")
        for titulo, artista in hits[:args.sample]:
            print(f"          {artista[:26]:26s}  {titulo[:56]}")
        if len(hits) > args.sample:
            print(f"          … and {len(hits) - args.sample} more")
        print()

    print("Review these. To suppress one, add \"ambiguous\": true to its entry in")
    print("soundtrack_seeds.json — it stays searchable and can still claim its own")
    print("name on a proven soundtrack, but stops labelling unrelated records.")


if __name__ == "__main__":
    main()

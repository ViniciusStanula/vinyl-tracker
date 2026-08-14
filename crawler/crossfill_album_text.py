"""crossfill_album_text.py — share album-level prose between listings of the
same album.

The catalog carries the same album under several ASINs (different sellers,
different pressings). Enrichment runs per row, so one listing ends up with a
Portuguese "Sobre" text or a translated Last.fm wiki while its twins show
nothing, even though the text describes the WORK and is equally true of every
pressing of it.

Only work-level prose moves:

    sobre_pt, sobre_pt_source_url, sobre_generated_at
    lastfm_wiki_pt, lastfm_wiki_en

Pressing-level fields (colour, weight, catalogue number, label, country,
format, barcode, prices) are deliberately NOT copied. Those are the fields that
tell two listings of one album apart, and 1,337 of the twin groups here already
differ on colour alone -- copying them would erase the only thing distinguishing
the rows.

Grouping is by MusicBrainz release-group id, which is the abstract album rather
than a pressing. mb_mbid matching has been wrong before (see the artist-mismatch
audits), so a group is only used when every row in it also agrees on the artist
name -- a wrong match that also happens to sit under the same artist can copy a
bio between two of that artist's own albums, which is a far smaller error than
copying one across artists.

    python crossfill_album_text.py            # dry run
    python crossfill_album_text.py --apply
"""
import argparse
import io
import re
import sys
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry

CHUNK_SIZE = 500
_MBID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

SELECT_SQL = """
    SELECT id, slug, artista, mb_mbid,
           sobre_pt, sobre_pt_source_url, sobre_generated_at,
           lastfm_wiki_pt, lastfm_wiki_en
    FROM "Disco"
    WHERE (format IS NULL OR format = 'vinyl')
      AND mb_mbid IS NOT NULL AND mb_mbid <> ''
"""

SOBRE_SQL = """UPDATE "Disco"
               SET sobre_pt = %s, sobre_pt_source_url = %s, sobre_generated_at = %s
               WHERE id = %s"""
WIKI_SQL = """UPDATE "Disco" SET lastfm_wiki_pt = %s, lastfm_wiki_en = %s WHERE id = %s"""


def _norm_artist(a):
    return re.sub(r"[^a-z0-9]+", "", (a or "").lower())


def _blank(v):
    return v is None or not str(v).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(SELECT_SQL)
    rows = cur.fetchall()

    groups = defaultdict(list)
    for r in rows:
        if _MBID_RE.match(r[3] or ""):
            groups[r[3]].append(r)

    sobre_updates, wiki_updates, samples = [], [], []
    skipped_mixed_artist = 0

    for mbid, members in groups.items():
        if len(members) < 2:
            continue
        if len({_norm_artist(m[2]) for m in members}) > 1:
            skipped_mixed_artist += 1
            continue

        # Donor: the longest text in the group. Length is a stand-in for how
        # much the enrichment actually found -- a two-line stub and a full
        # article can both be present, and the fuller one is the better answer
        # for every row here. Ties break on slug so reruns are deterministic.
        sobre_donors = sorted(
            (m for m in members if not _blank(m[4])),
            key=lambda m: (-len(m[4]), m[1]),
        )
        if sobre_donors:
            d = sobre_donors[0]
            for m in members:
                if _blank(m[4]):
                    sobre_updates.append((d[4], d[5], d[6], m[0]))
                    if len(samples) < 12:
                        samples.append(("sobre_pt", m[1], d[1], d[4][:70]))

        wiki_donors = sorted(
            (m for m in members if not _blank(m[7])),
            key=lambda m: (-len(m[7]), m[1]),
        )
        if wiki_donors:
            d = wiki_donors[0]
            for m in members:
                if _blank(m[7]):
                    # The English source travels with its translation only when
                    # the row has no English text of its own -- an existing
                    # lastfm_wiki_en belongs to this row's own Last.fm match.
                    wiki_updates.append((d[7], m[8] if not _blank(m[8]) else d[8], m[0]))
                    if len(samples) < 12:
                        samples.append(("lastfm_wiki_pt", m[1], d[1], d[7][:70]))

    print(f"groups: {len(groups)}  multi-row: {sum(1 for g in groups.values() if len(g) > 1)}")
    print(f"skipped (artists disagree): {skipped_mixed_artist}")
    print(f"sobre_pt fills:      {len(sobre_updates)}")
    print(f"lastfm_wiki_pt fills:{len(wiki_updates)}")

    if not args.apply:
        print("\nsamples:")
        for field, to_slug, from_slug, text in samples:
            print(f"  {field:15s} {to_slug[:38]:40s} <- {from_slug[:34]:36s} {text}...")
        print(f"\n(dry run -- re-run with --apply)")
        return

    for sql, ups in ((SOBRE_SQL, sobre_updates), (WIKI_SQL, wiki_updates)):
        ups.sort(key=lambda u: u[-1])
        for start in range(0, len(ups), CHUNK_SIZE):
            with conn.cursor() as c2:
                c2.executemany(sql, ups[start:start + CHUNK_SIZE])
            conn.commit()
    print(f"wrote {len(sobre_updates)} sobre_pt and {len(wiki_updates)} lastfm_wiki_pt")


if __name__ == "__main__":
    main()

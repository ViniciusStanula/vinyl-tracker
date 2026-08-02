"""Progress + correctness spot-check for the Discogs enrichment run.

The number to watch is the wrong-match signal: records whose stored Discogs
title shares no identifying word with our artist or title. That is the only
symptom a bad match leaves behind, because the matcher verifies against the
SEARCH result and never re-checks what it actually fetched.

    python check_discogs_progress.py
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry

# The same tokenizer the matcher uses, rather than a second one written here.
# The local copy stripped non-ASCII instead of folding it, so "Música De Las
# Américas" became "M sica De Las Am ricas" and read as a mismatch against our
# unaccented "Musica De Las Americas" — a correct match reported as a wrong one.
from discogs_enrich import _is_latin_comparable, _tokens

conn = connect_with_retry()
cur = conn.cursor()

cur.execute(
    """SELECT count(*) FILTER (WHERE discogs_checked_at IS NOT NULL),
              count(*) FILTER (WHERE discogs_release_id IS NOT NULL),
              count(*) FILTER (WHERE discogs_catno IS NOT NULL),
              count(*) FILTER (WHERE discogs_tracklist IS NOT NULL),
              count(*) FILTER (WHERE discogs_label IS NOT NULL),
              count(*) FILTER (WHERE discogs_master_year IS NOT NULL)
       FROM "Disco" """
)
checked, resolved, catno, tracklist, label, year = cur.fetchone()
print(f"checked={checked} resolved={resolved} catno={catno} "
      f"tracklist={tracklist} label={label} year={year}")

cur.execute(
    """SELECT slug, artista, titulo, discogs_title FROM "Disco"
       WHERE discogs_title IS NOT NULL AND discogs_title <> ''"""
)
rows = cur.fetchall()

suspect = []
for slug, artista, titulo, dg_title in rows:
    # A Japanese or Cyrillic title cannot be compared against our romanised one
    # and is not evidence of anything.
    if not _is_latin_comparable(dg_title):
        continue
    ours = _tokens(artista) | _tokens(titulo)
    theirs = _tokens(dg_title)
    if ours and theirs and not (ours & theirs):
        suspect.append((slug, artista, titulo, dg_title))

pct = 100 * len(suspect) / max(len(rows), 1)
print(f"titles stored={len(rows)}  zero-overlap (wrong-match signal)="
      f"{len(suspect)}  ({pct:.1f}%)")
print("  a few percent is normal — alternate titles and our own bad artist "
      "column both land here. A climbing number is the thing to worry about.")
for slug, a, t, d in suspect[:12]:
    print(f"   {a[:18]:20s}| {t[:32]:34s} -> {d[:30]:32s} /disco/{slug}")

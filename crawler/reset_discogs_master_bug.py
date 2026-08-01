"""One-off: clear Discogs data written before the master-vs-release id fix.

A barcode search returns master rows mixed in with release rows, both carrying
a plain "id", and the two id spaces overlap. The enrichment took the first
verified hit — often a master — and fetched /releases/<master id>, which is an
unrelated record. The Beatles "Live At The Hollywood Bowl" (0602557054996)
returned master 1103767, and release 1103767 is a Dutch novelty album whose
tracklist, styles, year and title were stored against the Beatles row.

verify_match reads the search result's title, which is correct on the master
too, so no per-row check can tell a good row from a bad one after the fact.
Every resolved row is therefore suspect and gets cleared; the corrected run
(discogs_enrich.py now passes type=release) redoes them at ~1,300 API calls,
about 20 minutes of a run that takes 8-17 hours anyway.

Nothing here is irreplaceable: every column is derived data the crawler
regenerates. Run once, then relaunch discogs_enrich.py --apply.
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry

COLUMNS = (
    "discogs_release_id",
    "discogs_catno",
    "discogs_country",
    "discogs_styles",
    "discogs_tracklist",
    "discogs_title",
    "discogs_master_year",
    "discogs_master_checked_at",
    "discogs_checked_at",
)

conn = connect_with_retry()
cur = conn.cursor()

cur.execute(
    """SELECT count(*) FILTER (WHERE discogs_checked_at IS NOT NULL),
              count(*) FILTER (WHERE discogs_release_id IS NOT NULL)
       FROM "Disco" """
)
checked, resolved = cur.fetchone()
print(f"before: checked={checked} resolved={resolved}")

cur.execute(
    f"""UPDATE "Disco"
        SET {", ".join(f"{c} = NULL" for c in COLUMNS)}
        WHERE discogs_checked_at IS NOT NULL OR discogs_release_id IS NOT NULL"""
)
print(f"rows cleared: {cur.rowcount}")
conn.commit()

cur.execute(
    """SELECT count(*) FILTER (WHERE discogs_checked_at IS NOT NULL),
              count(*) FILTER (WHERE discogs_release_id IS NOT NULL),
              count(*) FILTER (WHERE discogs_styles IS NOT NULL),
              count(*) FILTER (WHERE discogs_tracklist IS NOT NULL)
       FROM "Disco" """
)
print("after (checked/resolved/styles/tracklist):", cur.fetchone())

"""Read-only: coverage of every field the disco page and its schema depend on.

Scoped to LISTABLE records (available vinyl with >=5 price points) — the ones
actually reachable on the site. Enriching rows nobody can see is wasted effort.
"""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry

LISTABLE = "disponivel = TRUE AND (format IS NULL OR format = 'vinyl') AND price_count >= 5"

CHECKS = [
    ("artist known",        "artista IS NOT NULL AND lower(artista) <> 'artista não identificado'"),
    ("cover image",         '"imgUrl" IS NOT NULL'),
    ("MB matched (mbid)",   "mb_mbid IS NOT NULL AND mb_mbid <> ''"),
    ("tracklist",           "mb_tracklist IS NOT NULL AND mb_tracklist <> ''"),
    ("release date/decade", "mb_first_release_date ~ '^[0-9]{4}'"),
    ("primary type",        "mb_primary_type IS NOT NULL"),
    ("genres (MB)",         "mb_genres IS NOT NULL AND mb_genres <> ''"),
    ("style tags (lastfm)", "lastfm_tags IS NOT NULL AND lastfm_tags <> ''"),
    ("record label",        "mb_label IS NOT NULL"),
    ("barcode / gtin13",    "ean ~ '^[0-9]{13}$'"),
    ("PT bio (sobre_pt)",   "sobre_pt IS NOT NULL AND sobre_pt <> ''"),
    ("lastfm listeners",    "lastfm_listeners > 0"),
]

conn = connect_with_retry()
cur = conn.cursor()
cur.execute(f'SELECT count(*) FROM "Disco" WHERE {LISTABLE}')
total = cur.fetchone()[0]
print(f"listable records: {total}\n")
print(f"{'field':24s} {'have':>7s} {'missing':>8s}   coverage")
print("-" * 58)
for label, cond in CHECKS:
    cur.execute(f'SELECT count(*) FROM "Disco" WHERE {LISTABLE} AND ({cond})')
    have = cur.fetchone()[0]
    bar = "#" * int(round(20 * have / total))
    print(f"{label:24s} {have:7d} {total-have:8d}   {100*have/total:5.1f}% {bar}")

# Artist country drives /pais and the "Origem" row; it lives on ArtistMeta.
cur.execute(
    f'''SELECT count(*) FROM "Disco" d
        LEFT JOIN "ArtistMeta" am ON am.artista = d.artista
        WHERE {LISTABLE.replace("disponivel", "d.disponivel").replace("format", "d.format").replace("price_count", "d.price_count")}
          AND am.country IS NOT NULL'''
)
have = cur.fetchone()[0]
print(f"{'artist country':24s} {have:7d} {total-have:8d}   {100*have/total:5.1f}%")

print("\n--- how many records are missing NOTHING? ---")
all_conds = " AND ".join(f"({c})" for _, c in CHECKS)
cur.execute(f'SELECT count(*) FROM "Disco" WHERE {LISTABLE} AND {all_conds}')
print("fully enriched on every field above:", cur.fetchone()[0])

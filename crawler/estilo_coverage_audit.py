"""Would Discogs styles fill the gaps on /estilo, and what would they create?

Two questions the style work needs answered before any frontend change:

  1. How many records have no browsable style today, and how many of those
     would gain one from discogs_styles or discogs_genres?
  2. Which Discogs vocabulary does NOT map to a slug we already serve? Those
     either need mapping onto an existing page or dropping — creating a page
     per new tag is how index bloat starts, and REDIRECTED_ESTILO_SLUGS
     already exists precisely to keep thin tags out.

Writes nothing.
"""
import io
import re
import sys
import unicodedata
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present

load_dotenv_if_present()

from db_retry import connect_with_retry


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


conn = connect_with_retry()
cur = conn.cursor()

LIVE = "disponivel = TRUE AND (format IS NULL OR format = 'vinyl')"

cur.execute(f"""SELECT
  count(*)                                                                  AS live,
  count(*) FILTER (WHERE lastfm_tags IS NULL OR lastfm_tags = '')            AS no_tag,
  count(*) FILTER (WHERE (lastfm_tags IS NULL OR lastfm_tags = '')
                     AND COALESCE(discogs_styles, '') <> '')                 AS gain_style,
  count(*) FILTER (WHERE (lastfm_tags IS NULL OR lastfm_tags = '')
                     AND COALESCE(discogs_styles, '') = ''
                     AND COALESCE(discogs_genres, '') <> '')                 AS gain_genre_only
  FROM "Disco" WHERE {LIVE}""")
live, no_tag, gain_style, gain_genre = cur.fetchone()
print(f"live vinyl records          : {live}")
print(f"  with no browsable style   : {no_tag} ({100*no_tag/max(live,1):.0f}%)")
print(f"  ...gain one from styles   : {gain_style}")
print(f"  ...only from genres       : {gain_genre}")
print(f"  ...still nothing          : {no_tag - gain_style - gain_genre}")

# Which slugs does /estilo actually serve? Same derivation the page uses.
cur.execute("""SELECT DISTINCT btrim(unnest(string_to_array(lastfm_tags, ', ')))
               FROM "Disco" WHERE lastfm_tags IS NOT NULL AND lastfm_tags <> ''""")
served = {slugify(r[0]) for r in cur.fetchall() if r[0]}

cur.execute("""SELECT btrim(unnest(string_to_array(discogs_styles, ', '))) s, count(*)
               FROM "Disco" WHERE COALESCE(discogs_styles,'') <> ''
               GROUP BY 1 ORDER BY 2 DESC""")
rows = cur.fetchall()
mapped = [(s, n) for s, n in rows if slugify(s) in served]
new = [(s, n) for s, n in rows if slugify(s) not in served]
print(f"\ndiscogs styles seen         : {len(rows)} distinct")
print(f"  already a served slug     : {len(mapped)}  ({sum(n for _, n in mapped)} rows)")
print(f"  NOT served — would be new : {len(new)}  ({sum(n for _, n in new)} rows)")
print("\n  new vocabulary by volume (map or drop, do not create a page each):")
for s, n in new[:30]:
    print(f"    {n:5d}  {s:30s} -> {slugify(s)}")

cur.execute("""SELECT btrim(unnest(string_to_array(discogs_genres, ', '))) g, count(*)
               FROM "Disco" WHERE COALESCE(discogs_genres,'') <> ''
               GROUP BY 1 ORDER BY 2 DESC""")
print("\ngenres (small closed vocabulary — good fallback for untagged records):")
for g, n in cur.fetchall():
    mark = "served" if slugify(g) in served else "NEW"
    print(f"    {n:5d}  {g:26s} {mark}")

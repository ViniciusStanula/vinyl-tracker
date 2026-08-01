"""Progress + correctness spot-check for the Discogs enrichment run."""
import io,sys,re
sys.stdout=io.TextIOWrapper(sys.stdout.buffer,encoding="utf-8")
from preflight import load_dotenv_if_present; load_dotenv_if_present()
from db_retry import connect_with_retry
c=connect_with_retry().cursor()
c.execute("""SELECT count(*) FILTER (WHERE discogs_checked_at IS NOT NULL),
                    count(*) FILTER (WHERE discogs_release_id IS NOT NULL),
                    count(*) FILTER (WHERE discogs_catno IS NOT NULL),
                    count(*) FILTER (WHERE discogs_tracklist IS NOT NULL)
             FROM "Disco" """)
ck,res,cat,tl=c.fetchone()
print(f"checked={ck} resolved={res} catno={cat} tracklist={tl}")

c.execute("""SELECT artista,titulo,discogs_title FROM "Disco"
             WHERE discogs_title IS NOT NULL AND discogs_title <> ''""")
def toks(s):
    s=re.sub(r"[^a-z0-9 ]"," ",(s or "").lower())
    return {w for w in s.split() if len(w)>2 and w not in
            {"the","and","for","los","las","dos","des","der","die","das","disco","vinil","vinyl"}}
rows=c.fetchall()
bad=[r for r in rows if (toks(r[0])|toks(r[1])) and toks(r[2])
     and not ((toks(r[0])|toks(r[1])) & toks(r[2]))]
print(f"titles stored={len(rows)}  zero-overlap (wrong-match signal)={len(bad)}")
for a,t,d in bad[:8]: print(f"   {a[:20]:22s}| {t[:34]:36s} -> {d[:34]}")

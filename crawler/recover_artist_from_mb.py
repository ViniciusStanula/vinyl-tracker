"""
recover_artist_from_mb.py — resolve 'Artista não identificado' by searching
MusicBrainz for the album title alone.

recover_artist_from_title.py only accepts an artist already present in the
catalogue, which left 999 records unresolved. MusicBrainz knows artists we
don't, so it can close much of that gap -- but searching by title WITHOUT an
artist is far weaker evidence than the artist+title search mb_enrich does, so
this file is deliberately paranoid:

  * Generic titles are skipped outright. "Greatest Hits" / "Live" / "Christmas"
    match thousands of unrelated release-groups; no score threshold saves you.
  * The MB title must equal ours after normalisation -- not merely overlap.
    (mb_enrich can use subset matching because the artist already constrains it.)
  * A clear winner is required: the best candidate must beat every candidate
    crediting a DIFFERENT artist by MIN_SCORE_GAP. If two artists tie on the
    same title, we genuinely cannot tell which record this is -> skip.

Anything uncertain is reported, never written.

IMPORTANT: MusicBrainz allows ~1 request/sec per IP. Do NOT run this while
wikipedia_bio_fetch.py --apply-mb-fix or mb_enrich.py is running.

Usage:
    python recover_artist_from_mb.py --limit 20        # dry run
    python recover_artist_from_mb.py --apply
"""
import argparse
import io
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry
from lastfm import clean_album_title
from mb_enrich import MB_BASE, USER_AGENT

# Below this, a title-only match is not trustworthy even at score 100.
MIN_SCORE = 90
# The winner must beat the best DIFFERENT-artist candidate by this much.
MIN_SCORE_GAP = 15

# Titles too generic to identify a record by name alone.
_GENERIC = re.compile(
    r"^(?:the\s+)?(?:greatest\s+hits?|best\s+of.*|hits?|live|live\s+in\s+.*|"
    r"anthology|collection|compilation|singles|the\s+singles|essential|"
    r"christmas|christmas\s+album|natal|self\s*titled|s/t|untitled|"
    r"vol(?:ume)?\.?\s*\d+|ep|lp|demo|demos|remixes|unplugged)$",
    re.IGNORECASE,
)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def mb_search_by_title(album: str) -> list[dict]:
    query = urllib.parse.urlencode(
        {"query": f'releasegroup:"{album}"', "fmt": "json", "limit": "8"}
    )
    req = urllib.request.Request(
        MB_BASE + "release-group/?" + query, headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read()).get("release-groups") or []
    except Exception:
        return []


def credited_artist(rg: dict) -> str | None:
    credits = rg.get("artist-credit") or []
    if not credits:
        return None
    name = "".join(c.get("name", "") + (c.get("joinphrase") or "") for c in credits)
    return name.strip() or None


def resolve(album_clean: str) -> tuple[str | None, str]:
    """Returns (artist, reason). artist is None when nothing is safe to write."""
    if _GENERIC.match(album_clean.strip()):
        return None, "generic title"
    if len(album_clean.strip()) < 4:
        return None, "title too short"

    groups = mb_search_by_title(album_clean)
    if not groups:
        return None, "no MB result"

    want = norm(album_clean)
    exact = []
    for g in groups:
        if norm(g.get("title", "")) != want:
            continue
        artist = credited_artist(g)
        score = int(g.get("score", 0))
        if artist and score >= MIN_SCORE:
            exact.append((score, artist, g))
    if not exact:
        return None, "no exact-title match at score >= %d" % MIN_SCORE

    exact.sort(key=lambda x: -x[0])
    top_score, top_artist, _g = exact[0]
    # Any different artist scoring close behind means the title alone cannot
    # tell these records apart.
    for score, artist, _ in exact[1:]:
        if norm(artist) != norm(top_artist) and (top_score - score) < MIN_SCORE_GAP:
            return None, f"ambiguous: also {artist} @ {score}"
    return top_artist, f"score {top_score}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=1.1, help="MB courtesy delay; keep >= 1.1")
    args = ap.parse_args()

    conn = connect_with_retry()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT slug, titulo FROM "Disco"
        WHERE artista ILIKE '%%o identificado%%'
          AND disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
        ORDER BY price_count DESC NULLS LAST
        """
    )
    rows = cur.fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"records to resolve: {len(rows)}  (mode: {'APPLY' if args.apply else 'DRY RUN'})\n")

    resolved = 0
    reasons: dict[str, int] = {}
    for i, (slug, titulo) in enumerate(rows, 1):
        album = clean_album_title(titulo, "").strip()
        artist, reason = resolve(album)
        time.sleep(args.delay)

        if artist:
            resolved += 1
            print(f"  OK   {artist[:30]:30s} <- {album[:52]}  ({reason})")
            if args.apply:
                cur.execute(
                    'UPDATE "Disco" SET artista = %s, "updatedAt" = NOW() WHERE slug = %s',
                    (artist, slug),
                )
                conn.commit()
        else:
            key = reason.split(":")[0]
            reasons[key] = reasons.get(key, 0) + 1

        if i % 50 == 0:
            print(f"  ...{i}/{len(rows)} | resolved {resolved}")

    print(f"\nresolved: {resolved}/{len(rows)}")
    print("skip reasons:")
    for k, v in sorted(reasons.items(), key=lambda kv: -kv[1]):
        print(f"   {v:>5}  {k}")
    if not args.apply:
        print("\nDRY RUN — nothing written.")
    conn.close()


if __name__ == "__main__":
    main()

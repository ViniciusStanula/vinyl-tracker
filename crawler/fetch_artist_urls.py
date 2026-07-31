"""
fetch_artist_urls.py — pull an artist's external URLs (official site, socials,
Bandcamp, SoundCloud, Discogs, Last.fm, streaming...) from MusicBrainz and
store them on ArtistMeta.

Why: artist pages currently emit sameAs from wikidata_url/wikipedia_url/
spotify_url, which only 1,658 artists have. 10,556 have an mbid, and
MusicBrainz publishes rich url-rels for them. Those links are exactly what
search engines and AI systems use to resolve "which entity is this page
about", so they are worth far more than the single MB link we emit today.

Bonus: MusicBrainz publishes the CANONICAL last.fm URL. The disco page
currently builds its Last.fm link by guessing from our own artista + cleaned
title, which can point at a page that does not exist.

Stored as JSONB {relation_type: [urls]} in ArtistMeta.mb_urls so new relation
types never need another migration. Resumable: rows that already have mb_urls
are skipped, so it can be stopped and restarted freely.

MusicBrainz allows ~1 request/sec per IP. Do NOT run alongside mb_enrich.py,
wikipedia_bio_fetch.py --apply-mb-fix, or recover_artist_from_mb.py.

Usage:
    python fetch_artist_urls.py --limit 20        # dry run
    python fetch_artist_urls.py --apply
    python fetch_artist_urls.py --apply --refresh # re-fetch rows already done
"""
import argparse
import io
import json
import sys
import time
import urllib.request
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from preflight import load_dotenv_if_present
load_dotenv_if_present()

from db_retry import connect_with_retry
from mb_enrich import MB_BASE, USER_AGENT

# Relation types worth keeping. MusicBrainz also returns a long tail
# ("purchase for mail-order", "other databases", VIAF, ticketing...) that adds
# no entity-resolution value and would just bloat the column.
KEEP = {
    "official homepage",
    "social network",      # instagram / twitter / facebook / mastodon
    "soundcloud",
    "bandcamp",
    "youtube",
    "youtube music",
    "discogs",
    "allmusic",
    "wikidata",
    "last.fm",
    "streaming",           # spotify / apple / tidal / deezer
    "free streaming",
    "blog",
    "IMDb",
}


def column_exists(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM information_schema.columns
               WHERE table_name = 'ArtistMeta' AND column_name = 'mb_urls'"""
        )
        return bool(cur.fetchone()[0])


def ensure_column(conn) -> None:
    """Adds ArtistMeta.mb_urls if missing. Idempotent raw DDL.

    Raw SQL on purpose: `prisma db push` is unsafe in this repo (it drops
    crawler-added Disco columns that aren't in schema.prisma).
    """
    if column_exists(conn):
        return
    with conn.cursor() as cur:
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute('ALTER TABLE "ArtistMeta" ADD COLUMN IF NOT EXISTS mb_urls JSONB')
    conn.commit()
    print("added ArtistMeta.mb_urls")


def fetch_urls(mbid: str) -> dict[str, list[str]] | None:
    url = f"{MB_BASE}artist/{mbid}?inc=url-rels&fmt=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except Exception:
        return None

    out: dict[str, list[str]] = {}
    for rel in data.get("relations") or []:
        rtype = rel.get("type", "")
        if rtype not in KEEP:
            continue
        # "ended" marks a relationship MusicBrainz records as no longer valid
        # (dead homepage, abandoned account) -- linking to it is worse than
        # omitting it.
        if rel.get("ended"):
            continue
        target = (rel.get("url") or {}).get("resource", "").strip()
        if not target:
            continue
        out.setdefault(rtype, [])
        if target not in out[rtype]:
            out[rtype].append(target)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--refresh", action="store_true", help="re-fetch rows already populated")
    ap.add_argument("--delay", type=float, default=1.1, help="MB courtesy delay; keep >= 1.1")
    args = ap.parse_args()

    conn = connect_with_retry()
    if args.apply:
        ensure_column(conn)
    cur = conn.cursor()

    # Only artists that actually have live records -- no point spending calls on
    # ArtistMeta rows whose discs are all delisted.
    # A dry run must not create the column, so when it doesn't exist yet there
    # is by definition nothing already-fetched to skip.
    skip_done = column_exists(conn) and not args.refresh
    where_done = "AND am.mb_urls IS NULL" if skip_done else ""
    cur.execute(
        f"""
        SELECT am.artista, am.mbid, COUNT(d.id) AS n
        FROM "ArtistMeta" am
        JOIN "Disco" d
          ON d.artista = am.artista
         AND d.disponivel = TRUE
         AND (d.format IS NULL OR d.format = 'vinyl')
        WHERE am.mbid IS NOT NULL AND am.mbid <> ''
          {where_done}
        GROUP BY am.artista, am.mbid
        ORDER BY n DESC
        """
    )
    rows = cur.fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"artists to fetch: {len(rows)}  (mode: {'APPLY' if args.apply else 'DRY RUN'})\n")

    seen_types: Counter = Counter()
    with_any = 0
    for i, (artista, mbid, n) in enumerate(rows, 1):
        urls = fetch_urls(mbid)
        time.sleep(args.delay)
        if urls is None:
            print(f"  ERR  {artista[:34]}")
            continue
        if urls:
            with_any += 1
            for t in urls:
                seen_types[t] += 1
        if args.apply:
            cur.execute(
                'UPDATE "ArtistMeta" SET mb_urls = %s WHERE artista = %s',
                (json.dumps(urls, ensure_ascii=False), artista),
            )
            conn.commit()
        if not args.apply or i <= 15:
            top = ", ".join(sorted(urls)[:4]) or "(none)"
            print(f"  {artista[:26]:26s} [{n:>3} discs] {len(urls)} types: {top}")
        if i % 100 == 0:
            print(f"  ...{i}/{len(rows)} | with links: {with_any}")

    print(f"\nartists with >=1 link: {with_any}/{len(rows)}")
    print("relation types found:")
    for t, c in seen_types.most_common():
        print(f"   {c:>5}  {t}")
    if not args.apply:
        print("\nDRY RUN — nothing written.")
    conn.close()


if __name__ == "__main__":
    main()

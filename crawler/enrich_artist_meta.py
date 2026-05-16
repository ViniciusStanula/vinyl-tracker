"""
enrich_artist_meta.py — Enriches ArtistMeta table with external links from MusicBrainz.

For each artist in the Disco table (prioritized by disco count), queries the
MusicBrainz API to find:
  - Wikidata entity URL   (e.g. https://www.wikidata.org/wiki/Q5041)
  - Wikipedia article URL (e.g. https://en.wikipedia.org/wiki/ABBA)
  - Spotify artist URL    (e.g. https://open.spotify.com/artist/...)

Each candidate URL is validated with an HTTP HEAD request before storing.
404/error responses are silently dropped so no dead links enter the DB.

Rate limit: 1 req/sec (MusicBrainz requirement).
Skips artists enriched within the last 30 days.

Usage:
    python enrich_artist_meta.py [--limit N] [--min-discos N]

Options:
    --limit      Max artists to enrich this run (default: 200)
    --min-discos Minimum disco count to qualify   (default: 3)
"""
import argparse
import logging
import time

import requests

from database import get_connection

log = logging.getLogger(__name__)

MB_BASE = "https://musicbrainz.org/ws/2"
MB_HEADERS = {
    "User-Agent": "GarimpaVinil/1.0 (vinicius.stanula@gmail.com)",
    "Accept": "application/json",
}
RATE_LIMIT = 1.1  # seconds between MusicBrainz requests

VALIDATE_HEADERS = {
    "User-Agent": "GarimpaVinil/1.0 (vinicius.stanula@gmail.com)",
}
# Spotify blocks HEAD; Wikipedia/Wikidata need a real UA to avoid 429.
# We follow redirects to catch moved articles.
def url_is_live(url: str, timeout: int = 8) -> bool:
    """Returns True if url responds 2xx/3xx (after following redirects)."""
    try:
        resp = requests.head(url, headers=VALIDATE_HEADERS, timeout=timeout,
                             allow_redirects=True)
        if resp.status_code == 405:
            # HEAD not allowed — fall back to GET with stream
            resp = requests.get(url, headers=VALIDATE_HEADERS, timeout=timeout,
                                stream=True, allow_redirects=True)
            resp.close()
        return resp.status_code < 400
    except Exception:
        return False


def _mb_get(path: str, params: dict) -> dict | None:
    url = f"{MB_BASE}/{path}"
    try:
        resp = requests.get(url, params=params, headers=MB_HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        log.debug("MusicBrainz request failed %s: %s", url, exc)
        return None


def find_mbid(artist_name: str) -> str | None:
    """Search MusicBrainz for an artist and return the best-match MBID."""
    data = _mb_get("artist", {"query": f'artist:"{artist_name}"', "fmt": "json", "limit": 3})
    if not data or not data.get("artists"):
        return None

    # Prefer exact name match (case-insensitive), fall back to first result
    name_lower = artist_name.lower()
    for artist in data["artists"]:
        if artist.get("name", "").lower() == name_lower:
            return artist["id"]
    return data["artists"][0]["id"]


def fetch_url_rels(mbid: str) -> dict:
    """Fetch URL relations for a MusicBrainz artist MBID."""
    data = _mb_get(f"artist/{mbid}", {"inc": "url-rels", "fmt": "json"})
    if not data:
        return {}

    candidates: dict[str, str] = {}
    wikipedia_pt: str | None = None
    wikipedia_en: str | None = None

    for rel in data.get("relations", []):
        url = rel.get("url", {}).get("resource", "")
        rel_type = rel.get("type", "")
        if rel_type == "wikidata" and "wikidata.org" in url:
            candidates["wikidata_url"] = url
        elif rel_type == "wikipedia" and "pt.wikipedia.org" in url:
            wikipedia_pt = url
        elif rel_type == "wikipedia" and "wikipedia.org" in url:
            wikipedia_en = url
        elif "open.spotify.com/artist" in url:
            candidates["spotify_url"] = url

    # Prefer pt.wikipedia.org, fall back to en.wikipedia.org
    if wikipedia_pt or wikipedia_en:
        candidates["wikipedia_url"] = wikipedia_pt or wikipedia_en  # type: ignore[assignment]

    # Validate each candidate — drop any that returns 4xx/5xx or times out
    result: dict[str, str] = {}
    for key, url in candidates.items():
        if url_is_live(url):
            result[key] = url
        else:
            log.debug("  %s returned dead — dropping %s", key, url)
    return result


def fetch_pending_artists(conn, limit: int, min_discos: int) -> list[dict]:
    """Return artists needing enrichment, ordered by disco count desc."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT d.artista, COUNT(*) AS disco_count
            FROM "Disco" d
            LEFT JOIN "ArtistMeta" am ON am.artista = d.artista
            WHERE d.disponivel = TRUE
              AND d.price_count >= 5
              AND (
                am.artista IS NULL
                OR am.enriched_at < NOW() - INTERVAL '30 days'
              )
            GROUP BY d.artista
            HAVING COUNT(*) >= %s
            ORDER BY disco_count DESC
            LIMIT %s
        """, (min_discos, limit))
        rows = cur.fetchall()
    return [{"artista": r[0], "disco_count": r[1]} for r in rows]


def upsert_artist_meta(conn, artista: str, mbid: str | None, urls: dict) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO "ArtistMeta" (artista, mbid, wikidata_url, wikipedia_url, spotify_url, enriched_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (artista) DO UPDATE SET
                mbid         = EXCLUDED.mbid,
                wikidata_url = EXCLUDED.wikidata_url,
                wikipedia_url = EXCLUDED.wikipedia_url,
                spotify_url  = EXCLUDED.spotify_url,
                enriched_at  = EXCLUDED.enriched_at
        """, (
            artista,
            mbid,
            urls.get("wikidata_url"),
            urls.get("wikipedia_url"),
            urls.get("spotify_url"),
        ))
    conn.commit()


def enrich_artists(limit: int = 200, min_discos: int = 3) -> None:
    conn = get_connection()
    try:
        artists = fetch_pending_artists(conn, limit=limit, min_discos=min_discos)
        log.info("Enriching %d artists via MusicBrainz.", len(artists))

        for i, row in enumerate(artists, 1):
            artista = row["artista"]
            log.info("[%d/%d] %s (%d discos)", i, len(artists), artista, row["disco_count"])

            mbid = find_mbid(artista)
            time.sleep(RATE_LIMIT)

            urls: dict = {}
            if mbid:
                urls = fetch_url_rels(mbid)
                time.sleep(RATE_LIMIT)
                log.debug("  mbid=%s wikidata=%s wikipedia=%s spotify=%s",
                          mbid,
                          bool(urls.get("wikidata_url")),
                          bool(urls.get("wikipedia_url")),
                          bool(urls.get("spotify_url")))
            else:
                log.debug("  No MBID found.")

            upsert_artist_meta(conn, artista, mbid, urls)

        log.info("Done. Enriched %d artists.", len(artists))
    finally:
        conn.close()


def revalidate_urls(limit: int = 500) -> None:
    """
    Re-checks stored URLs for existing ArtistMeta rows and nulls out any that
    now return 4xx/5xx. Does NOT re-query MusicBrainz — only validates what's
    already stored. Safe to run frequently (no MusicBrainz rate-limit cost).
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT artista, wikidata_url, wikipedia_url, spotify_url
                FROM "ArtistMeta"
                WHERE wikidata_url IS NOT NULL
                   OR wikipedia_url IS NOT NULL
                   OR spotify_url IS NOT NULL
                ORDER BY enriched_at ASC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()

        log.info("Revalidating URLs for %d artists.", len(rows))
        fixed = 0

        for artista, wikidata_url, wikipedia_url, spotify_url in rows:
            updates: dict[str, str | None] = {}
            for col, url in [
                ("wikidata_url", wikidata_url),
                ("wikipedia_url", wikipedia_url),
                ("spotify_url", spotify_url),
            ]:
                if url and not url_is_live(url):
                    log.info("  Dead URL nulled for %s: %s", artista, url)
                    updates[col] = None

            if updates:
                set_clause = ", ".join(f"{k} = %s" for k in updates)
                with conn.cursor() as cur:
                    cur.execute(
                        f'UPDATE "ArtistMeta" SET {set_clause} WHERE artista = %s',
                        [*updates.values(), artista],
                    )
                conn.commit()
                fixed += 1

        log.info("Revalidation done. Nulled dead URLs for %d artists.", fixed)
    finally:
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Enrich ArtistMeta from MusicBrainz")
    parser.add_argument("--limit", type=int, default=200, help="Max artists to process")
    parser.add_argument("--min-discos", type=int, default=3, help="Minimum disco count")
    parser.add_argument("--revalidate", action="store_true",
                        help="Only revalidate stored URLs, do not re-query MusicBrainz")
    parser.add_argument("--revalidate-limit", type=int, default=500,
                        help="Max rows to revalidate per run")
    args = parser.parse_args()

    if args.revalidate:
        revalidate_urls(limit=args.revalidate_limit)
    else:
        enrich_artists(limit=args.limit, min_discos=args.min_discos)

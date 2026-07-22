"""
backfill_artist_country.py — backfill ArtistMeta.country (ISO-3166 code, e.g.
"US", "GB", "BR") from MusicBrainz.

Two phases:
  A. Refresh — artists that already have an mbid but a NULL country. The regular
     enrich_artist_meta cron skips these for up to 30 days (their enriched_at is
     recent), so a dedicated pass is needed to light up the country pages now.
     1 MB call each.
  B. Expand (--expand) — artists with >= --min-discos discos and no ArtistMeta
     row yet: find_mbid + country = 2 MB calls each, capped by --expand-limit.
     Reuses enrich_artist_meta.find_mbid and upserts a full row (mbid + country;
     URLs are left for the regular enricher to fill later).

Rate limit: 1.1s between MB calls (MusicBrainz requirement). Safe to Ctrl-C and
re-run — phase A only ever selects NULL-country rows, so it resumes cleanly.

Usage:
    python backfill_artist_country.py                        # phase A only
    python backfill_artist_country.py --expand --expand-limit 4000
"""
import argparse
import logging
import time

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from database import get_connection
from enrich_artist_meta import _mb_get, find_mbid, RATE_LIMIT

log = logging.getLogger(__name__)


def fetch_country(mbid: str) -> str | None:
    """Return the ISO-3166 country code for an artist MBID, or None."""
    data = _mb_get(f"artist/{mbid}", {"fmt": "json"})
    if not data:
        return None
    return data.get("country")


def refresh_existing(conn) -> int:
    """Phase A: fill country for rows that have an mbid but no country yet."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT artista, mbid FROM "ArtistMeta"
            WHERE mbid IS NOT NULL AND country IS NULL
            ORDER BY enriched_at DESC
        """)
        rows = cur.fetchall()

    log.info("Phase A — %d artists with mbid but no country.", len(rows))
    filled = 0
    for i, (artista, mbid) in enumerate(rows, 1):
        country = fetch_country(mbid)
        time.sleep(RATE_LIMIT)
        if country:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "ArtistMeta" SET country = %s WHERE artista = %s',
                    (country, artista),
                )
            conn.commit()
            filled += 1
        if i % 50 == 0:
            log.info("  A: %d/%d checked, %d filled.", i, len(rows), filled)
    log.info("Phase A done — filled %d countries.", filled)
    return filled


def expand_new(conn, min_discos: int, limit: int) -> int:
    """Phase B: create rows (mbid + country) for artists with no ArtistMeta yet."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT d.artista, COUNT(*) AS n
            FROM "Disco" d
            LEFT JOIN "ArtistMeta" am ON am.artista = d.artista
            WHERE d.disponivel = TRUE
              AND (d.format IS NULL OR d.format = 'vinyl')
              AND d.price_count >= 5
              AND am.artista IS NULL
            GROUP BY d.artista
            HAVING COUNT(*) >= %s
            ORDER BY n DESC
            LIMIT %s
        """, (min_discos, limit))
        rows = cur.fetchall()

    log.info("Phase B — %d new artists to resolve (min_discos=%d).", len(rows), min_discos)
    filled = 0
    for i, (artista, n) in enumerate(rows, 1):
        mbid = find_mbid(artista)
        time.sleep(RATE_LIMIT)
        country = fetch_country(mbid) if mbid else None
        if mbid:
            time.sleep(RATE_LIMIT)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO "ArtistMeta" (artista, mbid, country, enriched_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (artista) DO UPDATE SET
                    mbid = EXCLUDED.mbid,
                    country = EXCLUDED.country,
                    enriched_at = EXCLUDED.enriched_at
            """, (artista, mbid, country))
        conn.commit()
        if country:
            filled += 1
        if i % 50 == 0:
            log.info("  B: %d/%d resolved, %d with country.", i, len(rows), filled)
    log.info("Phase B done — %d artists got a country.", filled)
    return filled


def retry_unmatched(conn, min_discos: int, limit: int) -> int:
    """
    Phase C: artists that have an ArtistMeta row but a NULL mbid — an earlier
    lookup failed and nothing ever retries them, so phase A (which requires an
    mbid) can never give them a country. Re-run find_mbid, then fetch country.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT am.artista, COUNT(c.id) AS n
            FROM "ArtistMeta" am
            JOIN "Disco" c ON c.artista = am.artista
            WHERE am.mbid IS NULL AND am.country IS NULL
              AND c.disponivel = TRUE
              AND (c.format IS NULL OR c.format = 'vinyl')
              AND c.price_count >= 5
            GROUP BY am.artista
            HAVING COUNT(c.id) >= %s
            ORDER BY n DESC
            LIMIT %s
        """, (min_discos, limit))
        rows = cur.fetchall()

    log.info("Phase C — %d artists with an ArtistMeta row but no mbid.", len(rows))
    filled = 0
    for i, (artista, _n) in enumerate(rows, 1):
        mbid = find_mbid(artista)
        time.sleep(RATE_LIMIT)
        country = fetch_country(mbid) if mbid else None
        if mbid:
            time.sleep(RATE_LIMIT)
        if mbid or country:
            with conn.cursor() as cur:
                cur.execute(
                    'UPDATE "ArtistMeta" SET mbid = %s, country = %s WHERE artista = %s',
                    (mbid, country, artista),
                )
            conn.commit()
        if country:
            filled += 1
        if i % 50 == 0:
            log.info("  C: %d/%d retried, %d with country.", i, len(rows), filled)
    log.info("Phase C done — %d artists got a country.", filled)
    return filled


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s",
                        datefmt="%H:%M:%S")
    p = argparse.ArgumentParser(description="Backfill ArtistMeta.country from MusicBrainz")
    p.add_argument("--expand", action="store_true",
                   help="Also resolve artists with no ArtistMeta row yet (phase B)")
    p.add_argument("--retry-unmatched", action="store_true",
                   help="Also retry artists whose ArtistMeta row has a NULL mbid (phase C)")
    p.add_argument("--min-discos", type=int, default=3)
    p.add_argument("--expand-limit", type=int, default=4000)
    args = p.parse_args()

    conn = get_connection()
    try:
        refresh_existing(conn)
        if args.expand:
            expand_new(conn, min_discos=args.min_discos, limit=args.expand_limit)
        if args.retry_unmatched:
            retry_unmatched(conn, min_discos=args.min_discos, limit=args.expand_limit)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

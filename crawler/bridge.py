#!/usr/bin/env python3
"""
bridge.py — Syncs active deals from Supabase into the bot_pending queue.

Reads Disco rows where deal_score >= 1 and disponivel = TRUE, upserts them
into bot_pending, and discards deals that have disappeared from Supabase.
Marks deals whose artist appears in the Last.fm top-5000 chart as is_top_artist
so bot.py can prioritize them in the send queue.
Exits non-zero on connection failure so the downstream bot.py step is skipped.
"""

import json
import logging
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

DATABASE_URL  = os.environ.get("DATABASE_URL")
LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS bot_pending (
    asin            TEXT PRIMARY KEY,
    titulo          TEXT NOT NULL,
    artista         TEXT NOT NULL,
    estilo          TEXT,
    img_url         TEXT,
    affiliate_url   TEXT NOT NULL,
    preco_brl       DECIMAL(10,2) NOT NULL,
    avg_30d         DECIMAL(10,2),
    low_all_time    DECIMAL(10,2),
    deal_score      SMALLINT NOT NULL,
    priority_score  REAL,
    is_top_artist   BOOLEAN NOT NULL DEFAULT FALSE,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS bot_sent (
    id                  SERIAL PRIMARY KEY,
    asin                TEXT NOT NULL,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    preco_brl           DECIMAL(10,2) NOT NULL,
    telegram_message_id BIGINT NOT NULL,
    last_edited_at      TIMESTAMPTZ,
    last_edit_price     DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS bot_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

_SCHEMA_EXTRAS = """
ALTER TABLE bot_pending ADD COLUMN IF NOT EXISTS is_top_artist BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS bot_sent_asin_idx ON bot_sent (asin, sent_at DESC);
"""


def connect() -> psycopg2.extensions.connection:
    if not DATABASE_URL:
        log.error("DATABASE_URL not set")
        sys.exit(1)
    try:
        conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
        conn.autocommit = False
        return conn
    except psycopg2.OperationalError as exc:
        log.error("Supabase connection failed: %s", exc)
        sys.exit(1)


def ensure_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(_SCHEMA)
        cur.execute(_SCHEMA_EXTRAS)
    conn.commit()


# ---------------------------------------------------------------------------
# Last.fm top-artist matching (mirrors frontend/lib/slugify.ts + lastfm.ts)
# ---------------------------------------------------------------------------

def _slugify_artist(name: str) -> str:
    """Mirrors the TypeScript slugifyArtist() used by the homepage carousel."""
    if "," in name:
        last, *rest = name.split(",")
        first = ",".join(rest).strip()
        name = f"{first} {last.strip()}" if first else name
    normalized = unicodedata.normalize("NFD", name)
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    slug = stripped.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug[:60]


LASTFM_CACHE_DAYS = 30


def _load_cached_slugs(conn) -> set | None:
    """Returns cached slug set if younger than LASTFM_CACHE_DAYS, else None."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT value FROM bot_state WHERE key = 'lastfm_slugs_fetched_at'"
        )
        row = cur.fetchone()
    if not row:
        return None
    fetched_at = datetime.fromisoformat(row[0])
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - fetched_at).days
    if age_days >= LASTFM_CACHE_DAYS:
        return None

    with conn.cursor() as cur:
        cur.execute("SELECT value FROM bot_state WHERE key = 'lastfm_slugs'")
        row = cur.fetchone()
    if not row:
        return None

    slugs = set(json.loads(row[0]))
    log.info("Loaded %d Last.fm slugs from cache (age: %d days)", len(slugs), age_days)
    return slugs


def _save_cached_slugs(conn, slugs: set) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO bot_state (key, value) VALUES ('lastfm_slugs', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, (json.dumps(list(slugs)),))
        cur.execute("""
            INSERT INTO bot_state (key, value) VALUES ('lastfm_slugs_fetched_at', %s)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, (now_iso,))
    conn.commit()
    log.info("Cached %d Last.fm slugs (TTL: %d days)", len(slugs), LASTFM_CACHE_DAYS)


def fetch_top_artist_slugs(conn) -> set:
    """Returns top-5000 Last.fm artist slugs, using a 30-day DB cache."""
    cached = _load_cached_slugs(conn)
    if cached is not None:
        return cached

    if not LASTFM_API_KEY:
        log.warning("LASTFM_API_KEY not set — is_top_artist will be FALSE for all deals")
        return set()

    slugs: set[str] = set()
    for page in range(1, 11):  # 10 pages × 500 = top 5000
        try:
            resp = requests.get(
                "https://ws.audioscrobbler.com/2.0/",
                params={
                    "method": "chart.getTopArtists",
                    "api_key": LASTFM_API_KEY,
                    "format":  "json",
                    "limit":   500,
                    "page":    page,
                },
                timeout=15,
            )
            data = resp.json()
            artists = (data.get("artists") or {}).get("artist") or []
            for artist in artists:
                name = artist.get("name", "")
                if name:
                    slugs.add(_slugify_artist(name))
        except Exception as exc:
            log.warning("Last.fm page %d fetch failed: %s", page, exc)

    log.info("Fetched %d Last.fm top-5000 artist slugs from API", len(slugs))
    if slugs:
        _save_cached_slugs(conn, slugs)
    return slugs


def fetch_active_deals(conn) -> dict:
    """Returns {asin: row_dict} for all deals with deal_score >= 1.

    Current price comes from the latest HistoricoPreco row (same approach as
    deal_scorer.py) because Disco has no precoBrl column.
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT deal_score, COUNT(*) AS n
            FROM "Disco"
            WHERE deal_score IS NOT NULL
            GROUP BY deal_score
            ORDER BY deal_score
        """)
        for row in cur.fetchall():
            log.info("deal_score=%s → %d rows", row["deal_score"], row["n"])

        cur.execute("""
            SELECT
                d.asin,
                d.titulo,
                d.artista,
                d.estilo,
                d."imgUrl" AS img_url,
                d.url      AS affiliate_url,
                l.preco_brl,
                d.avg_30d,
                d.low_all_time,
                d.deal_score
            FROM "Disco" d
            JOIN (
                SELECT DISTINCT ON ("discoId")
                    "discoId",
                    "precoBrl" AS preco_brl
                FROM "HistoricoPreco"
                WHERE "precoBrl" >= 30
                ORDER BY "discoId", "capturadoEm" DESC
            ) l ON l."discoId" = d.id
            WHERE d.deal_score >= 1
              AND d.disponivel = TRUE
              AND d.avg_30d IS NOT NULL
              AND d.avg_30d > 0
        """)
        return {row["asin"]: dict(row) for row in cur.fetchall()}


def sync_pending(conn, active: dict, top_slugs: set) -> None:
    now = datetime.now(timezone.utc)

    with conn.cursor() as cur:
        # 1. Batch upsert all active deals in one round trip.
        rows = []
        for asin, d in active.items():
            avg   = float(d["avg_30d"])
            price = float(d["preco_brl"])
            priority      = round((avg - price) / avg * 100, 2)
            is_top_artist = _slugify_artist(d["artista"]) in top_slugs
            rows.append((
                asin, d["titulo"], d["artista"], d.get("estilo"),
                d.get("img_url"), d["affiliate_url"],
                price, avg, d.get("low_all_time"),
                int(d["deal_score"]), priority, is_top_artist, now,
            ))

        psycopg2.extras.execute_values(cur, """
            INSERT INTO bot_pending
                (asin, titulo, artista, estilo, img_url, affiliate_url,
                 preco_brl, avg_30d, low_all_time, deal_score, priority_score,
                 is_top_artist, first_seen_at, status)
            VALUES %s
            ON CONFLICT (asin) DO UPDATE SET
                titulo         = EXCLUDED.titulo,
                artista        = EXCLUDED.artista,
                estilo         = EXCLUDED.estilo,
                img_url        = EXCLUDED.img_url,
                affiliate_url  = EXCLUDED.affiliate_url,
                preco_brl      = EXCLUDED.preco_brl,
                avg_30d        = EXCLUDED.avg_30d,
                low_all_time   = EXCLUDED.low_all_time,
                deal_score     = EXCLUDED.deal_score,
                priority_score = EXCLUDED.priority_score,
                is_top_artist  = EXCLUDED.is_top_artist,
                status = CASE
                    WHEN bot_pending.status = 'discarded' THEN 'pending'
                    ELSE bot_pending.status
                END
        """, rows, template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending')", page_size=500)

        # 2. Immediately discard pending deals no longer active in Supabase.
        active_asins = list(active.keys())
        if active_asins:
            cur.execute("""
                UPDATE bot_pending
                SET status = 'discarded'
                WHERE status = 'pending'
                  AND asin <> ALL(%s)
            """, (active_asins,))
        else:
            cur.execute(
                "UPDATE bot_pending SET status = 'discarded' WHERE status = 'pending'"
            )

        # 3. Re-open 'sent' deals where price dropped >10% vs last send/edit,
        #    but only if at least 6 hours have passed since the last action.
        cur.execute("""
            UPDATE bot_pending bp
            SET status = 'pending'
            FROM (
                SELECT DISTINCT ON (asin)
                    asin,
                    COALESCE(last_edit_price, preco_brl) AS ref_price,
                    COALESCE(last_edited_at, sent_at)    AS last_action_at
                FROM bot_sent
                ORDER BY asin, sent_at DESC
            ) ls
            WHERE bp.asin = ls.asin
              AND bp.status = 'sent'
              AND bp.preco_brl < ls.ref_price * 0.90
              AND ls.last_action_at < NOW() - INTERVAL '6 hours'
        """)

    conn.commit()
    top_count = sum(1 for d in active.values() if _slugify_artist(d["artista"]) in top_slugs)
    log.info("Sync complete — %d active deals (%d top artists)", len(active), top_count)


def main() -> None:
    log.info("Bridge starting")
    conn = connect()
    try:
        ensure_schema(conn)
        top_slugs = fetch_top_artist_slugs(conn)
        active    = fetch_active_deals(conn)
        log.info("Active deals in Supabase: %d", len(active))
        sync_pending(conn, active, top_slugs)
    except Exception as exc:
        log.error("Bridge error: %s", exc)
        try:
            conn.rollback()
        except Exception:
            pass
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

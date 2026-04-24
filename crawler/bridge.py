#!/usr/bin/env python3
"""
bridge.py — Syncs active deals from Supabase into the bot_pending queue.

Reads Disco rows where deal_score >= 2 and disponivel = TRUE, upserts them
into bot_pending, and discards deals that have disappeared from Supabase.
Exits non-zero on connection failure so the downstream bot.py step is skipped.
"""

import logging
import os
import sys
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL")

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
    conn.commit()


def fetch_active_deals(conn) -> dict:
    """Returns {asin: row_dict} for all deals with deal_score >= 2."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT
                asin,
                titulo,
                artista,
                estilo,
                "imgUrl"   AS img_url,
                url        AS affiliate_url,
                "precoBrl" AS preco_brl,
                avg_30d,
                low_all_time,
                deal_score
            FROM "Disco"
            WHERE deal_score >= 2
              AND disponivel = TRUE
              AND avg_30d IS NOT NULL
              AND avg_30d > 0
              AND "precoBrl" IS NOT NULL
        """)
        return {row["asin"]: dict(row) for row in cur.fetchall()}


def sync_pending(conn, active: dict) -> None:
    now = datetime.now(timezone.utc)

    with conn.cursor() as cur:
        # 1. Upsert every active deal into bot_pending.
        #    Preserve first_seen_at and status ('pending'/'sent'); only reopen 'discarded'.
        for asin, d in active.items():
            avg = float(d["avg_30d"])
            price = float(d["preco_brl"])
            priority = round((avg - price) / avg * 100, 2)

            cur.execute("""
                INSERT INTO bot_pending
                    (asin, titulo, artista, estilo, img_url, affiliate_url,
                     preco_brl, avg_30d, low_all_time, deal_score, priority_score,
                     first_seen_at, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
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
                    status = CASE
                        WHEN bot_pending.status = 'discarded' THEN 'pending'
                        ELSE bot_pending.status
                    END
            """, (
                asin, d["titulo"], d["artista"], d.get("estilo"),
                d.get("img_url"), d["affiliate_url"],
                price, avg, d.get("low_all_time"),
                int(d["deal_score"]), priority, now,
            ))

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

        # 3. TTL: discard pending deals first seen more than 6 hours ago.
        cur.execute("""
            UPDATE bot_pending
            SET status = 'discarded'
            WHERE status = 'pending'
              AND first_seen_at < NOW() - INTERVAL '6 hours'
        """)

        # 4. Re-open 'sent' deals where price dropped >10% vs last send/edit,
        #    but only if at least 6 hours have passed since the last action.
        #    bot.py will pick these up as new sends.
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
    log.info("Sync complete — %d active deals", len(active))


def main() -> None:
    log.info("Bridge starting")
    conn = connect()
    try:
        ensure_schema(conn)
        active = fetch_active_deals(conn)
        log.info("Active deals in Supabase: %d", len(active))
        sync_pending(conn, active)
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

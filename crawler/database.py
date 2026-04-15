"""
database.py — PostgreSQL persistence layer for the vinyl crawler.

Responsabilities:
  - Connect to Supabase via DATABASE_URL env var
  - Upsert Disco records (insert or update metadata)
  - Insert HistoricoPreco records (always append, never update)
  - Clean up HistoricoPreco records older than 365 days
"""
import os
import socket
import logging
import urllib.parse

import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)


def get_connection():
    """
    Returns a psycopg2 connection using DATABASE_URL from environment.
    Use the Transaction Pooler URL from Supabase (port 6543).

    Resolves the hostname to an IPv4 address and passes it via libpq's
    ``hostaddr`` parameter so GitHub Actions (which can't reach Supabase
    over IPv6) connects successfully.  The original hostname is kept in
    ``host`` for SSL certificate validation (SNI).
    """
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set.\n"
            "Export it before running:\n"
            "  export DATABASE_URL='postgresql://postgres:[SENHA]@...supabase.com:6543/postgres'"
        )

    # Force IPv4 to avoid IPv6 connectivity failures on GitHub Actions.
    # libpq's hostaddr overrides DNS resolution while host= still handles SSL SNI.
    try:
        parsed = urllib.parse.urlparse(database_url)
        hostname = parsed.hostname
        if hostname:
            ipv4_results = socket.getaddrinfo(hostname, None, socket.AF_INET)
            if ipv4_results:
                ipv4 = ipv4_results[0][4][0]
                log.debug("Resolved %s → %s (IPv4)", hostname, ipv4)
                return psycopg2.connect(database_url, hostaddr=ipv4)
    except Exception as exc:
        log.warning("IPv4 resolution failed (%s) — falling back to default DNS", exc)

    return psycopg2.connect(database_url)


def upsert_batch(conn, items: list[dict]) -> int:
    """
    Upserts a batch of crawled items into the database.

    For each item:
      - Inserts or updates the Disco row (metadata: title, artist, img, url, rating)
      - Always inserts a new HistoricoPreco row (price history is append-only)

    Uses executemany for performance.
    Returns the number of items processed.
    """
    if not items:
        return 0

    with conn.cursor() as cur:
        # ── Step 1: upsert Disco metadata ────────────────────────────────
        # ON CONFLICT (asin) → update mutable fields only.
        # slug and createdAt are never overwritten once set.
        disco_rows = [
            (
                item["asin"],
                item["titulo"],
                item["artista"],
                item["slug"],
                item.get("estilo") or None,
                item.get("imgUrl") or None,
                item["url"],
                item.get("rating"),      # float or None
            )
            for item in items
        ]

        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "Disco" (
                id, asin, titulo, artista, slug, estilo, "imgUrl", url, rating,
                "createdAt", "updatedAt"
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s,
                NOW(), NOW()
            )
            ON CONFLICT (asin) DO UPDATE SET
                titulo     = EXCLUDED.titulo,
                artista    = EXCLUDED.artista,
                estilo     = COALESCE(EXCLUDED.estilo, "Disco".estilo),
                "imgUrl"   = EXCLUDED."imgUrl",
                url        = EXCLUDED.url,
                rating     = EXCLUDED.rating,
                "updatedAt" = NOW()
            """,
            disco_rows,
            page_size=500,
        )

        log.debug("Upserted %d Disco rows.", len(disco_rows))

        # ── Step 2: fetch asin → id map for the items we just upserted ───
        asins = [item["asin"] for item in items]
        cur.execute(
            'SELECT asin, id FROM "Disco" WHERE asin = ANY(%s)',
            (asins,)
        )
        asin_to_id = {row[0]: row[1] for row in cur.fetchall()}

        # ── Step 3: insert HistoricoPreco (always append) ─────────────────
        preco_rows = [
            (
                asin_to_id[item["asin"]],
                item["precoBrl"],
                item["capturadoEm"],
            )
            for item in items
            if item["asin"] in asin_to_id
        ]

        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "HistoricoPreco" (id, "discoId", "precoBrl", "capturadoEm")
            VALUES (gen_random_uuid(), %s, %s, %s)
            """,
            preco_rows,
            page_size=500,
        )

        log.debug("Inserted %d HistoricoPreco rows.", len(preco_rows))

    conn.commit()
    return len(items)


def ensure_schema_extras(conn) -> None:
    """
    Idempotently adds columns required by the stale-records check that are
    not part of the Prisma schema (managed here via raw DDL so no migration
    tooling is needed).

    Currently adds:
      Disco.disponivel BOOLEAN NOT NULL DEFAULT TRUE
        — FALSE means the product page returned 404 or showed out-of-stock
          on the last individual fetch.  Records with disponivel = FALSE are
          still queried for stale checks so they can come back online.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE "Disco"
            ADD COLUMN IF NOT EXISTS disponivel BOOLEAN NOT NULL DEFAULT TRUE
            """
        )
    conn.commit()
    log.debug("ensure_schema_extras: disponivel column ensured.")


def fetch_stale_records(
    conn,
    seen_asins: set[str],
    limit: int = 500,
) -> list[dict]:
    """
    Returns Disco rows whose ASINs were NOT encountered during this crawl run.

    Rows are ordered oldest-updated first so that over successive runs every
    record gets cycled through even when limit < total stale count.

    Each returned dict has: asin, id, titulo.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT asin, id, titulo
            FROM "Disco"
            WHERE asin != ALL(%s)
            ORDER BY "updatedAt" ASC
            LIMIT %s
            """,
            (list(seen_asins) if seen_asins else ["__none__"], limit),
        )
        return [
            {"asin": row[0], "id": row[1], "titulo": row[2]}
            for row in cur.fetchall()
        ]


def mark_stale_price(
    conn,
    disco_id: str,
    price_brl: float,
    captured_at,
) -> None:
    """
    Inserts a new HistoricoPreco entry for a stale record whose product page
    confirmed it is still available, and resets disponivel to TRUE (in case it
    had previously been marked unavailable).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "HistoricoPreco" (id, "discoId", "precoBrl", "capturadoEm")
            VALUES (gen_random_uuid(), %s, %s, %s)
            """,
            (disco_id, price_brl, captured_at),
        )
        cur.execute(
            """
            UPDATE "Disco"
            SET disponivel = TRUE, "updatedAt" = NOW()
            WHERE id = %s
            """,
            (disco_id,),
        )
    conn.commit()


def mark_unavailable(conn, disco_id: str) -> None:
    """
    Marks a Disco record as unavailable (product page 404 or out-of-stock).
    Does NOT insert a HistoricoPreco entry.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "Disco"
            SET disponivel = FALSE, "updatedAt" = NOW()
            WHERE id = %s
            """,
            (disco_id,),
        )
    conn.commit()


def limpar_historico_antigo(conn, days: int = 365) -> int:
    """
    Deletes HistoricoPreco records older than `days` days.
    Called at the end of each crawl run to keep the DB tidy.

    With 5,000 discs × 2 crawls/day, keeping 365 days stores ~365MB.
    Stay within the free tier (500MB) or upgrade to Supabase Pro for more.
    Returns the number of rows deleted.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM "HistoricoPreco"
            WHERE "capturadoEm" < NOW() - (%s * INTERVAL '1 day')
            """,
            (days,)
        )
        deleted = cur.rowcount
    conn.commit()
    if deleted > 0:
        log.info("Cleaned up %d HistoricoPreco rows older than %d days.", deleted, days)
    return deleted

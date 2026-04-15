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
                return psycopg2.connect(
                    database_url,
                    hostaddr=ipv4,
                    keepalives=1,
                    keepalives_idle=60,
                    keepalives_interval=10,
                    keepalives_count=5,
                )
    except Exception as exc:
        log.warning("IPv4 resolution failed (%s) — falling back to default DNS", exc)

    return psycopg2.connect(
        database_url,
        keepalives=1,
        keepalives_idle=60,
        keepalives_interval=10,
        keepalives_count=5,
    )


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
                item.get("rating"),        # float or None
                item.get("reviewCount"),   # int or None
            )
            for item in items
        ]

        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "Disco" (
                id, asin, titulo, artista, slug, estilo, "imgUrl", url, rating,
                "reviewCount", "createdAt", "updatedAt"
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s,
                NOW(), NOW()
            )
            ON CONFLICT (asin) DO UPDATE SET
                titulo        = EXCLUDED.titulo,
                artista       = EXCLUDED.artista,
                estilo        = COALESCE(EXCLUDED.estilo, "Disco".estilo),
                "imgUrl"      = EXCLUDED."imgUrl",
                url           = EXCLUDED.url,
                rating        = EXCLUDED.rating,
                "reviewCount" = COALESCE(EXCLUDED."reviewCount", "Disco"."reviewCount"),
                "updatedAt"   = NOW()
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

        # ── Step 3: skip HistoricoPreco writes when price is unchanged ────
        # Fetch the most recent recorded price for every disco in this batch.
        # A single DISTINCT ON query is cheaper than N individual lookups.
        disco_ids = list(asin_to_id.values())
        cur.execute(
            """
            SELECT DISTINCT ON ("discoId") "discoId", "precoBrl"
            FROM "HistoricoPreco"
            WHERE "discoId" = ANY(%s)
            ORDER BY "discoId", "capturadoEm" DESC
            """,
            (disco_ids,),
        )
        last_price: dict[str, float] = {
            str(row[0]): float(row[1]) for row in cur.fetchall()
        }

        preco_rows = []
        skipped_unchanged = 0
        for item in items:
            disco_id = asin_to_id.get(item["asin"])
            if disco_id is None:
                continue
            new_price = item["precoBrl"]
            prev = last_price.get(str(disco_id))
            if prev is not None and abs(new_price - prev) < 0.01:
                skipped_unchanged += 1
                continue
            preco_rows.append((str(disco_id), new_price, item["capturadoEm"]))

        if skipped_unchanged:
            log.debug(
                "Skipped %d unchanged prices (out of %d items).",
                skipped_unchanged, len(items),
            )

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
    Idempotently adds columns that are not part of the Prisma schema
    (managed here via raw DDL so no migration tooling is needed).

    Columns added:
      Disco.disponivel BOOLEAN NOT NULL DEFAULT TRUE
        — FALSE when the product page returned 404 or showed out-of-stock.
          Records with disponivel = FALSE are still queried for stale checks
          so they can come back online.

      Disco.deal_score SMALLINT
        — Computed deal tier: 1 = Boa Oferta, 2 = Ótima Oferta,
          3 = Melhor Preço. NULL means no active deal.

      Disco.last_flagged_at TIMESTAMPTZ
        — UTC timestamp of the most recent deal flag (used for cooldown).

      Disco.last_flagged_price DECIMAL(10,2)
        — Price at time of last flag (used for early-re-flag detection).

      Disco.avg_30d / avg_90d / low_30d / low_all_time DECIMAL(10,2)
        — Rolling price benchmarks updated by the deal scorer after each crawl.

      Disco.confidence_level VARCHAR(30)
        — Scoring confidence tier: insufficient_data | low_confidence |
          moderate_confidence | high_confidence.

      Disco.history_days INTEGER
        — Number of days spanned by the product's price history.
    """
    with conn.cursor() as cur:
        # Fast path: check the catalog first. After the first successful run
        # all columns exist and we can skip DDL entirely (no lock needed).
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'Disco'
              AND column_name IN (
                'disponivel','deal_score','last_flagged_at','last_flagged_price',
                'avg_30d','avg_90d','low_30d','low_all_time','confidence_level','history_days'
              )
            """
        )
        existing = cur.fetchone()[0]
        if existing == 10:
            log.debug("ensure_schema_extras: schema already complete, skipping DDL.")
            return

        # Columns are missing — run DDL.
        # lock_timeout prevents hanging when Vercel/other clients hold a read lock;
        # statement_timeout = 0 disables Supabase's short per-statement cap.
        cur.execute("SET LOCAL lock_timeout = '10s'")
        cur.execute("SET LOCAL statement_timeout = 0")
        cur.execute(
            """
            ALTER TABLE "Disco"
                ADD COLUMN IF NOT EXISTS disponivel       BOOLEAN      NOT NULL DEFAULT TRUE,
                ADD COLUMN IF NOT EXISTS deal_score       SMALLINT,
                ADD COLUMN IF NOT EXISTS last_flagged_at  TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS last_flagged_price DECIMAL(10, 2),
                ADD COLUMN IF NOT EXISTS avg_30d          DECIMAL(10, 2),
                ADD COLUMN IF NOT EXISTS avg_90d          DECIMAL(10, 2),
                ADD COLUMN IF NOT EXISTS low_30d          DECIMAL(10, 2),
                ADD COLUMN IF NOT EXISTS low_all_time     DECIMAL(10, 2),
                ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(30),
                ADD COLUMN IF NOT EXISTS history_days     INTEGER
            """
        )
        # Partial index for fast active-deal lookups (Phase 0 re-validation)
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS "Disco_deal_score_idx"
                ON "Disco" (deal_score)
                WHERE deal_score IS NOT NULL
            """
        )
    conn.commit()
    log.info("ensure_schema_extras: schema migration applied.")


def fetch_active_deals(conn, limit: int = 500) -> list[dict]:
    """
    Returns Disco records that are currently on an active deal.

    A deal is active when deal_score IS NOT NULL — i.e. the deal scorer
    (deal_scorer.score_deals) has evaluated the product and assigned a tier.
    Results are ordered by deal_score DESC so the highest-quality deals are
    re-validated first in Phase 0.

    Each returned dict has: asin, id, titulo.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT asin, id, titulo
            FROM "Disco"
            WHERE deal_score IS NOT NULL
            ORDER BY deal_score DESC, "updatedAt" ASC
            LIMIT %s
            """,
            (limit,),
        )
        return [
            {"asin": row[0], "id": str(row[1]), "titulo": row[2]}
            for row in cur.fetchall()
        ]


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
    review_count: int | None = None,
) -> None:
    """
    Inserts a new HistoricoPreco entry for a stale record whose product page
    confirmed it is still available, and resets disponivel to TRUE (in case it
    had previously been marked unavailable).

    Skips the HistoricoPreco insert when the price matches the last recorded
    value (within R$0.01) to avoid polluting the history table on unchanged
    prices during frequent runs.

    If review_count is provided it overwrites the stored value; otherwise the
    existing count is preserved via COALESCE.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "HistoricoPreco" (id, "discoId", "precoBrl", "capturadoEm")
            SELECT gen_random_uuid(), %s, %s, %s
            WHERE NOT EXISTS (
                SELECT 1 FROM "HistoricoPreco"
                WHERE "discoId" = %s
                  AND ABS("precoBrl" - %s) < 0.01
                  AND "capturadoEm" > NOW() - INTERVAL '3 hours'
            )
            """,
            (disco_id, price_brl, captured_at, disco_id, price_brl),
        )
        cur.execute(
            """
            UPDATE "Disco"
            SET disponivel    = TRUE,
                "reviewCount" = COALESCE(%s, "reviewCount"),
                "updatedAt"   = NOW()
            WHERE id = %s
            """,
            (review_count, disco_id),
        )
    conn.commit()


def mark_unavailable(conn, disco_id: str) -> None:
    """
    Marks a Disco record as unavailable (product page 404 or out-of-stock).
    Also clears deal_score so the product stops appearing as a deal — we
    cannot confirm the price is still valid when the page is unreachable.
    Does NOT insert a HistoricoPreco entry.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE "Disco"
            SET disponivel  = FALSE,
                deal_score  = NULL,
                "updatedAt" = NOW()
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

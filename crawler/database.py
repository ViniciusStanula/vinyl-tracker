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

import contextlib

import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)


@contextlib.contextmanager
def _cursor(conn):
    """
    Opens a cursor and immediately disables the statement timeout for the
    current transaction.  Supabase's PgBouncer (transaction mode) resets
    session-level settings between transactions, so the only reliable way
    to override the role-level statement_timeout is with SET LOCAL inside
    every transaction block.
    """
    with conn.cursor() as cur:
        cur.execute("SET LOCAL statement_timeout = 0")
        yield cur


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
                    options="-c statement_timeout=0 -c idle_in_transaction_session_timeout=60000",
                    keepalives=1,
                    keepalives_idle=60,
                    keepalives_interval=10,
                    keepalives_count=5,
                )
    except Exception as exc:
        log.warning("IPv4 resolution failed (%s) — falling back to default DNS", exc)

    return psycopg2.connect(
        database_url,
        options="-c statement_timeout=0 -c idle_in_transaction_session_timeout=60000",
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

    with _cursor(conn) as cur:
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
                "reviewCount", "createdAt", "updatedAt", last_crawled_at
            )
            VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s,
                NOW(), NOW(), NOW()
            )
            ON CONFLICT (asin) DO UPDATE SET
                titulo          = EXCLUDED.titulo,
                artista         = EXCLUDED.artista,
                estilo          = COALESCE(EXCLUDED.estilo, "Disco".estilo),
                "imgUrl"        = EXCLUDED."imgUrl",
                url             = EXCLUDED.url,
                rating          = EXCLUDED.rating,
                "reviewCount"   = COALESCE(EXCLUDED."reviewCount", "Disco"."reviewCount"),
                "updatedAt"     = NOW(),
                last_crawled_at = NOW()
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

        # ── Step 3: write HistoricoPreco every crawl ──────────────────────────
        # Record every price capture regardless of whether the price changed.
        # Gives 2-hour granularity for the chart and deal scorer.
        #
        # Skip active deals (deal_score IS NOT NULL): their prices come from
        # Phase 0 product-page fetches which are authoritative. Search-result
        # cards can show the CD price for a multi-format vinyl ASIN (Amazon
        # aggregates the cheapest format in listings), which would corrupt the
        # chart and the deal scorer with a false low price.
        preco_rows = []
        for item in items:
            disco_id = asin_to_id.get(item["asin"])
            if disco_id is None:
                continue
            preco_rows.append((str(disco_id), item["precoBrl"], item["capturadoEm"], str(disco_id)))

        psycopg2.extras.execute_batch(
            cur,
            """
            WITH ins AS (
                INSERT INTO "HistoricoPreco" (id, "discoId", "precoBrl", "capturadoEm")
                SELECT gen_random_uuid(), %s, %s, %s
                WHERE NOT EXISTS (
                    SELECT 1 FROM "Disco" WHERE id = %s AND deal_score IS NOT NULL
                )
                RETURNING "discoId"
            )
            UPDATE "Disco" SET price_count = price_count + 1
            WHERE id IN (SELECT "discoId" FROM ins)
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

      Disco.last_crawled_at TIMESTAMPTZ
        — UTC timestamp of the most recent crawler visit (upsert or stale-check).
          Set on every write, including price-unchanged upserts. Used by the
          frontend to suppress deal badges older than 4 hours.

      Disco.price_count INTEGER
        — Total number of HistoricoPreco rows for this disco (all time).
          Incremented atomically via CTE on every HistoricoPreco insert.
          Used by the frontend to filter out discos with fewer than 5
          datapoints (price_count >= 5).
    """
    with _cursor(conn) as cur:
        # Fast path: check the catalog first. After the first successful run
        # all columns exist and we can skip DDL entirely (no lock needed).
        cur.execute(
            """
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'Disco'
              AND column_name IN (
                'disponivel','deal_score','last_flagged_at','last_flagged_price',
                'avg_30d','avg_90d','low_30d','low_all_time','confidence_level',
                'history_days','last_crawled_at','lastfm_tags','price_count'
              )
            """
        )
        existing = cur.fetchone()[0]
        if existing == 13:
            log.debug("ensure_schema_extras: schema already complete, skipping DDL.")
            return

        # Columns are missing — run DDL.
        # lock_timeout prevents hanging when Vercel/other clients hold a read lock.
        # statement_timeout=0 is already set at the connection level via options.
        cur.execute("SET LOCAL lock_timeout = '10s'")
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
                ADD COLUMN IF NOT EXISTS history_days     INTEGER,
                ADD COLUMN IF NOT EXISTS last_crawled_at  TIMESTAMPTZ,
                ADD COLUMN IF NOT EXISTS lastfm_tags      TEXT,
                ADD COLUMN IF NOT EXISTS price_count      INTEGER DEFAULT 0
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
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS "Disco_price_count_idx"
                ON "Disco" (price_count)
            """
        )
    conn.commit()
    log.info("ensure_schema_extras: schema migration applied.")


def fetch_active_deals(conn) -> list[dict]:
    """
    Returns all Disco records that are currently on an active deal.

    A deal is active when deal_score IS NOT NULL — i.e. the deal scorer
    (deal_scorer.score_deals) has evaluated the product and assigned a tier.
    All active deals are returned on every call (no recency filter) because
    deal prices can change within minutes. Results are ordered by deal_score
    DESC so the highest-quality deals are re-validated first in Phase 0.

    Each returned dict has: asin, id, titulo.
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            SELECT asin, id, COALESCE(titulo, '') AS titulo
            FROM "Disco"
            WHERE deal_score IS NOT NULL
            ORDER BY deal_score DESC, "updatedAt" ASC
            """,
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

    Priority order within the limit:
      1. Records with an active deal score — may have drifted off search results
         while still carrying a deal badge.
      2. Records flagged as a deal in the past 14 days — ensures recently-promoted
         records are re-checked even after dropping from search results.
      3. All others by last_crawled_at ASC NULLS FIRST — most neglected first.

    Each returned dict has: asin, id, titulo.
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            SELECT asin, id, COALESCE(titulo, '') AS titulo
            FROM "Disco"
            WHERE asin != ALL(%s)
            ORDER BY
                CASE
                    WHEN deal_score IS NOT NULL                        THEN 0
                    WHEN last_flagged_at > NOW() - INTERVAL '14 days' THEN 1
                    ELSE                                                    2
                END,
                last_crawled_at ASC NULLS FIRST
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

    Always inserts — no dedup window. Matches upsert_batch behaviour so Phase 0
    and Phase 3 records appear in the chart on every crawl cycle.

    If review_count is provided it overwrites the stored value; otherwise the
    existing count is preserved via COALESCE.
    """
    with _cursor(conn) as cur:
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
            SET disponivel      = TRUE,
                price_count     = price_count + 1,
                "reviewCount"   = COALESCE(%s, "reviewCount"),
                "updatedAt"     = NOW(),
                last_crawled_at = NOW()
            WHERE id = %s
            """,
            (review_count, disco_id),
        )
    conn.commit()


def clear_deal_score(conn, disco_id: str) -> None:
    """
    Clears deal_score so the product stops appearing as a deal, without
    marking it unavailable. Used when the scraper cannot confirm the vinyl
    price (e.g. multi-format page served with a non-vinyl format selected)
    but the product is still listed as in-stock.
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            UPDATE "Disco"
            SET deal_score      = NULL,
                "updatedAt"     = NOW(),
                last_crawled_at = NOW()
            WHERE id = %s
            """,
            (disco_id,),
        )
    conn.commit()


def mark_unavailable(conn, disco_id: str) -> None:
    """
    Marks a Disco record as unavailable (product page 404 or out-of-stock).
    Also clears deal_score so the product stops appearing as a deal — we
    cannot confirm the price is still valid when the page is unreachable.
    Does NOT insert a HistoricoPreco entry.
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            UPDATE "Disco"
            SET disponivel      = FALSE,
                deal_score      = NULL,
                "updatedAt"     = NOW(),
                last_crawled_at = NOW()
            WHERE id = %s
            """,
            (disco_id,),
        )
    conn.commit()


def ensure_category_tables(conn, category_seed: list[tuple[str, str]]) -> None:
    """
    Idempotently creates the Categoria and DiscoCategorias tables and seeds
    Categoria with the known genre URLs.

    category_seed: list of (url, nome) pairs, one per entry in CATEGORY_URLS.
    Safe to call on every startup — CREATE TABLE IF NOT EXISTS and
    INSERT ... ON CONFLICT DO NOTHING make it a no-op after the first run.
    """
    with _cursor(conn) as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS "Categoria" (
                id         SERIAL        PRIMARY KEY,
                nome       TEXT          NOT NULL,
                url        TEXT          NOT NULL UNIQUE,
                created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS "DiscoCategorias" (
                disco_id      TEXT        NOT NULL REFERENCES "Disco"(id)     ON DELETE CASCADE,
                categoria_id  INTEGER     NOT NULL REFERENCES "Categoria"(id) ON DELETE CASCADE,
                first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (disco_id, categoria_id)
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS "DiscoCategorias_categoria_id_idx"
                ON "DiscoCategorias" (categoria_id)
            """
        )
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "Categoria" (url, nome)
            VALUES (%s, %s)
            ON CONFLICT (url) DO NOTHING
            """,
            category_seed,
            page_size=200,
        )
    conn.commit()
    log.debug("ensure_category_tables: tables ready.")


def upsert_category_associations(
    conn,
    asin_categories: dict[str, set[str]],
) -> int:
    """
    Records which categories each product was found in during this crawl run.

    asin_categories: maps ASIN → set of category URLs where it appeared.
    Uses upsert so first_seen_at is preserved on repeat visits and
    last_seen_at is always bumped to NOW().
    Returns the number of (disco, categoria) rows written.
    """
    if not asin_categories:
        return 0

    with _cursor(conn) as cur:
        cur.execute('SELECT url, id FROM "Categoria"')
        url_to_cat_id: dict[str, int] = {row[0]: row[1] for row in cur.fetchall()}

        asins = list(asin_categories.keys())
        cur.execute(
            'SELECT asin, id FROM "Disco" WHERE asin = ANY(%s)',
            (asins,),
        )
        asin_to_id = {row[0]: row[1] for row in cur.fetchall()}

        rows = []
        for asin, cat_urls in asin_categories.items():
            disco_id = asin_to_id.get(asin)
            if disco_id is None:
                continue
            for cat_url in cat_urls:
                cat_id = url_to_cat_id.get(cat_url)
                if cat_id is None:
                    log.warning("Category URL not in DB (skipping): %.80s", cat_url)
                    continue
                rows.append((str(disco_id), cat_id))

        if not rows:
            return 0

        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO "DiscoCategorias" (disco_id, categoria_id, first_seen_at, last_seen_at)
            VALUES (%s, %s, NOW(), NOW())
            ON CONFLICT (disco_id, categoria_id) DO UPDATE
                SET last_seen_at = EXCLUDED.last_seen_at
            """,
            rows,
            page_size=500,
        )
        log.debug("Upserted %d DiscoCategorias rows.", len(rows))

    conn.commit()
    return len(rows)


def fetch_untagged_artists(conn, artistas: list[str] | None = None) -> list[str]:
    """
    Returns distinct artista values whose lastfm_tags column is NULL.

    If `artistas` is provided, only those names are checked (incremental mode).
    If None, returns all untagged artists in the table (backfill mode).
    """
    with _cursor(conn) as cur:
        if artistas:
            cur.execute(
                """
                SELECT DISTINCT artista FROM "Disco"
                WHERE lastfm_tags IS NULL
                  AND artista = ANY(%s)
                """,
                (artistas,),
            )
        else:
            cur.execute(
                """
                SELECT DISTINCT artista FROM "Disco"
                WHERE lastfm_tags IS NULL
                ORDER BY artista
                """
            )
        return [row[0] for row in cur.fetchall()]


def bulk_update_tags(conn, artista_to_tags: dict[str, str]) -> int:
    """
    Sets lastfm_tags for every artista key in artista_to_tags.
    An empty-string value marks the artist as "fetched but no genre tags found"
    so it is not re-fetched on future runs.
    Returns the number of rows updated.
    """
    if not artista_to_tags:
        return 0

    rows = [(tags, artista) for artista, tags in artista_to_tags.items()]
    with _cursor(conn) as cur:
        psycopg2.extras.execute_batch(
            cur,
            'UPDATE "Disco" SET lastfm_tags = %s WHERE artista = %s',
            rows,
            page_size=500,
        )
        updated = cur.rowcount
    conn.commit()
    log.debug("bulk_update_tags: updated tags for %d artista values.", len(rows))
    return updated


def limpar_historico_antigo(conn, days: int = 365) -> int:
    """
    Deletes HistoricoPreco records older than `days` days.
    Called at the end of each crawl run to keep the DB tidy.

    With 5,000 discs × 2 crawls/day, keeping 365 days stores ~365MB.
    Stay within the free tier (500MB) or upgrade to Supabase Pro for more.
    Returns the number of rows deleted.
    """
    with _cursor(conn) as cur:
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

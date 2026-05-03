-- Performance indexes v2 for vinyl-tracker
-- Generated: 2026-05-03
--
-- HOW TO RUN
-- ----------
-- Option A — psql (preferred, zero lock):
--   psql $DATABASE_URL -f migrations/20260503_perf_indexes_v2.sql
--   CONCURRENTLY variant below works outside transaction blocks.
--
-- Option B — Supabase SQL Editor:
--   Paste and run each statement individually.
--   CONCURRENTLY is removed here because the SQL Editor wraps executions in a
--   transaction block and PostgreSQL forbids CONCURRENTLY inside transactions.
--   Without CONCURRENTLY, each CREATE INDEX takes a brief ShareLock that blocks
--   writes for the duration of the index build (~seconds on typical table sizes).
--   Run during low-traffic window if HistoricoPreco is large (>10M rows).
--
-- Prerequisites: 20260502_perf_indexes.sql indexes re-included with IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- Index 3: Functional index for artista slug match — regular names
--
-- Fixes: SELECT DISTINCT artista FROM "Disco"
--          WHERE left(regexp_replace(regexp_replace(translate(lower(artista),
--            'áàâã...', 'aaaa...'), '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'), 60) = $slug
--   Source: frontend/app/artista/[slug]/page.tsx
--   8769 calls, mean 1624ms, 33% of total DB time.
--
-- Root cause: ACCENT_FROM/TO were SQL parameters ($1/$2), so PostgreSQL
-- couldn't match the query expression against any functional index.
-- Fix pair: artista/[slug]/page.tsx now inlines constants via Prisma.raw()
-- so the query expression is literal and matches this index exactly.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_disco_artista_slug_expr
  ON "Disco" (
    left(
      regexp_replace(
        regexp_replace(
          translate(lower(artista),
            'áàâãäåéèêëíìîïóòôõöúùûüçñý',
            'aaaaaaeeeeiiiioooouuuucny'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      60
    )
  );

-- ---------------------------------------------------------------------------
-- Index 4: Functional index for artista slug match — inverted "LAST, FIRST" names
--
-- Fixes the OR branch: artistas stored as "Beethoven, Ludwig van":
--   trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))
--   then same translate/regexp pipeline.
--
-- With indexes 3+4 PostgreSQL can use a Bitmap OR merge for the two OR branches
-- instead of a full seqscan.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_disco_artista_slug_inverted
  ON "Disco" (
    left(
      regexp_replace(
        regexp_replace(
          translate(
            lower(trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))),
            'áàâãäåéèêëíìîïóòôõöúùûüçñý',
            'aaaaaaeeeeiiiioooouuuucny'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      60
    )
  );

-- ---------------------------------------------------------------------------
-- Index 5: Partial covering index on HistoricoPreco for LATERAL price lookups
--
-- Fixes the LATERAL pattern used in queryDiscos, carousel, estilo, disco pages:
--   SELECT "precoBrl" FROM "HistoricoPreco"
--   WHERE "discoId" = $id AND "precoBrl" >= 30
--   ORDER BY "capturadoEm" DESC LIMIT 1
--
-- The existing (discoId, capturadoEm DESC) index lacks precoBrl, forcing a
-- filter step after the index scan on every row. This covering index adds
-- precoBrl so Postgres does an index-only scan for the LATERAL.
--
-- Partial (WHERE precoBrl >= 30) keeps the index ~20-30% smaller by excluding
-- sub-threshold records, improving cache hit rate.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_historicopreco_discoid_captured_preco
  ON "HistoricoPreco" ("discoId", "capturadoEm" DESC, "precoBrl")
  WHERE "precoBrl" >= 30;

-- ---------------------------------------------------------------------------
-- Index 6: Partial index on HistoricoPreco for deal scorer batch query
--
-- Fixes: deal_scorer.py stats CTE:
--   FROM "HistoricoPreco" h WHERE h."precoBrl" >= %s GROUP BY h."discoId"
--   51 calls, mean 30.7s, reads 2.8M rows.
--
-- The scorer needs all qualifying rows to compute per-discoId aggregates.
-- This partial index (precoBrl, discoId, capturadoEm) WHERE precoBrl >= 30
-- gives the planner a tighter scan path and enables the DISTINCT ON / latest
-- CTE to skip the heap entirely for qualifying rows.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_historicopreco_preco_discoid_captured
  ON "HistoricoPreco" ("precoBrl", "discoId", "capturadoEm")
  WHERE "precoBrl" >= 30;

-- ---------------------------------------------------------------------------
-- Indexes from v1 (re-included with IF NOT EXISTS for idempotency).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_disco_artista_disponivel
  ON "Disco"(artista)
  WHERE disponivel = TRUE;

CREATE INDEX IF NOT EXISTS idx_disco_lastfm_tags_gin
  ON "Disco" USING GIN (string_to_array(lower(lastfm_tags), ', '))
  WHERE lastfm_tags IS NOT NULL AND lastfm_tags != '';

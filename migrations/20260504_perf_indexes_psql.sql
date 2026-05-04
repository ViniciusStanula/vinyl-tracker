-- Performance indexes — psql version (CONCURRENTLY, zero write-blocking)
-- Generated: 2026-05-04
--
-- HOW TO RUN
-- ----------
-- psql $DATABASE_URL -f migrations/20260504_perf_indexes_psql.sql
--
-- DO NOT run in the Supabase SQL Editor — it wraps in a transaction block
-- and PostgreSQL forbids CONCURRENTLY inside transactions. Use the SQL
-- Editor version at migrations/20260503_perf_indexes_v2.sql instead
-- (accepts a brief ShareLock during low-traffic windows).
--
-- Each statement is idempotent (IF NOT EXISTS). Safe to re-run.

-- Artista slug match — regular names
-- Fixes: SELECT DISTINCT artista WHERE left(regexp_replace(translate(lower(artista),...))) = $slug
-- artista/[slug]/page.tsx — 8780 calls, 31.7% of total DB time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_artista_slug_expr
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

-- Artista slug match — inverted "LAST, FIRST" names
-- Covers the OR branch for artists stored as "Beethoven, Ludwig van".
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_artista_slug_inverted
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

-- Covering index for LATERAL price lookups and sparkline subqueries
-- Fixes: ORDER BY capturadoEm DESC LIMIT 1 per disco (queryDiscos, carousel, estilo, disco pages)
-- Partial (precoBrl >= 30) keeps index ~20-30% smaller.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_historicopreco_discoid_captured_preco
  ON "HistoricoPreco" ("discoId", "capturadoEm" DESC, "precoBrl")
  WHERE "precoBrl" >= 30;

-- Covering index for crawler deal scorer batch query
-- Fixes: deal_scorer.py GROUP BY discoId — 93 calls, 5.18M rows read, 6.2% total DB time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_historicopreco_preco_discoid_captured
  ON "HistoricoPreco" ("precoBrl", "discoId", "capturadoEm")
  WHERE "precoBrl" >= 30;

-- Partial index for DISTINCT artista carousel/sitemap query
-- Fixes: SELECT DISTINCT artista WHERE disponivel = TRUE — 193 calls, 2.6M rows/call.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_artista_disponivel
  ON "Disco"(artista)
  WHERE disponivel = TRUE;

-- GIN index for lastfm_tags array membership
-- Fixes: WHERE LOWER($1) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
-- and unnest-based tag canonicalization — 2790 calls, 8.8% total DB time.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_lastfm_tags_gin
  ON "Disco" USING GIN (string_to_array(lower(lastfm_tags), ', '))
  WHERE lastfm_tags IS NOT NULL AND lastfm_tags != '';

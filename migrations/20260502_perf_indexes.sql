-- Performance indexes for vinyl-tracker
-- Generated: 2026-05-02
-- Apply via: psql $DATABASE_URL -f migrations/20260502_perf_indexes.sql
-- Or paste into Supabase SQL Editor.
--
-- All indexes are CONCURRENT — no table lock, safe to run on live production.
-- Run each statement individually if using the Supabase SQL Editor
-- (it does not support multiple statements in one execution).

-- ---------------------------------------------------------------------------
-- Index 1: Distinct artista lookup for sitemap + carousel
--
-- Fixes: SELECT DISTINCT artista FROM "Disco" WHERE disponivel = $1
--   70 calls/24h, mean 9.8s, reads 961,885 rows (full table scan).
-- With this index Postgres can satisfy DISTINCT artista via index-only scan.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_artista_disponivel
  ON "Disco"(artista)
  WHERE disponivel = TRUE;

-- ---------------------------------------------------------------------------
-- Index 2: GIN index for lastfm_tags array membership queries
--
-- Fixes:
--   a) WITH tags AS (SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')))
--      915 calls/24h, mean 2.3s (estilo page tag slug lookup)
--   b) WHERE LOWER($1) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
--      710 calls/24h, mean 1.4s (artista/estilo page candidates query)
--
-- The GIN index on the array expression lets Postgres use bitmap index scan
-- for ANY(string_to_array(...)) membership checks instead of a seqscan +
-- unnest on every row.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_lastfm_tags_gin
  ON "Disco" USING GIN (string_to_array(lower(lastfm_tags), ', '))
  WHERE lastfm_tags IS NOT NULL AND lastfm_tags != '';

-- ---------------------------------------------------------------------------
-- Future work (not implemented here — requires schema + crawler change):
--
-- Index 3: Precomputed artista_slug column
--
-- Fixes: SELECT DISTINCT artista FROM "Disco" WHERE left(regexp_replace(...)) = $3
--   6,794 calls/24h, mean 1.9s (36% of total DB time).
--   The slug expression (regexp_replace + translate + left) cannot use a
--   standard B-tree index. Options:
--
--   Option A — functional index (no schema change, works for exact slug match):
--     CREATE INDEX CONCURRENTLY idx_disco_artista_slug
--       ON "Disco" (
--         left(regexp_replace(regexp_replace(translate(lower(artista),
--           'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiioooouuuucny'),
--           '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'), 60)
--       );
--   Caveat: only covers expression 1 (regular names), not the OR branch
--   for inverted "LAST, FIRST" names. Also the Prisma parameterized query
--   may not match the index expression exactly after parameter substitution.
--
--   Option B — add artista_slug TEXT column to Disco, populate in crawler
--   upsert, create B-tree index. Fully solves the problem at ~0ms per lookup.
--   Requires: ALTER TABLE + crawler change + Prisma schema sync.
-- ---------------------------------------------------------------------------

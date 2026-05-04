-- Full-text search on Disco.titulo + artista
-- 'simple' dictionary: lowercase only, no stemming — correct for proper nouns and music titles
--
-- HOW TO RUN
-- ----------
-- psql $DATABASE_URL -f migrations/20260504_fulltext_search.sql
--
-- The CREATE INDEX uses CONCURRENTLY — cannot run inside a transaction.
-- Use the Supabase SQL Editor only for the ALTER TABLE and UPDATE statements
-- if the index step must be run separately.
--
-- Idempotent: safe to re-run.

-- 1. Add column (no-op if already exists)
ALTER TABLE "Disco" ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Backfill all existing rows
--    Weight A = artista (higher relevance), Weight B = titulo
UPDATE "Disco"
SET search_vector =
  setweight(to_tsvector('simple', coalesce(artista, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(titulo,  '')), 'B')
WHERE search_vector IS NULL;

-- 3. GIN index for O(log n) FTS lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_search_vector
  ON "Disco" USING GIN(search_vector);

-- 4. Auto-update trigger so new/updated rows stay in sync
CREATE OR REPLACE FUNCTION disco_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.artista, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.titulo,  '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disco_search_vector_trig ON "Disco";
CREATE TRIGGER disco_search_vector_trig
  BEFORE INSERT OR UPDATE OF titulo, artista
  ON "Disco"
  FOR EACH ROW EXECUTE FUNCTION disco_search_vector_update();

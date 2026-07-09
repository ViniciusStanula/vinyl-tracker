-- Accent-insensitive full-text search on Disco.titulo + artista.
--
-- Problem: search_vector was built with to_tsvector('simple', ...) which keeps
-- accents, so a Brazilian user typing "Motorhead", "Nacao Zumbi" or "Cafe
-- Tacvba" (no accents — how people actually type) missed the accented records
-- ("Motörhead", "Nação Zumbi", "Café Tacvba"). The unaccent extension is not
-- available on Supabase, so we fold accents with translate() instead — the same
-- char map already used for artist slugs (20260503_perf_indexes_v2.sql).
--
-- HOW TO RUN
-- ----------
-- psql "$DATABASE_URL" -f migrations/20260709_search_unaccent.sql
-- Idempotent: safe to re-run. Backfill rewrites every row's search_vector.

-- 1. Immutable accent-folding helper (lowercases + strips Latin accents).
--    IMMUTABLE so it can be used in the trigger and future functional indexes.
CREATE OR REPLACE FUNCTION disco_unaccent(t text) RETURNS text AS $$
  SELECT translate(
    lower(coalesce(t, '')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñý',
    'aaaaaaeeeeiiiiooooouuuucny'
  )
$$ LANGUAGE sql IMMUTABLE;

-- 2. Trigger keeps new/updated rows accent-folded.
CREATE OR REPLACE FUNCTION disco_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', disco_unaccent(NEW.artista)), 'A') ||
    setweight(to_tsvector('simple', disco_unaccent(NEW.titulo)),  'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill every existing row (not just NULL — accents must be re-folded).
UPDATE "Disco"
SET search_vector =
  setweight(to_tsvector('simple', disco_unaccent(artista)), 'A') ||
  setweight(to_tsvector('simple', disco_unaccent(titulo)),  'B');

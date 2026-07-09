-- Fix the artist-slug functional indexes' accent map off-by-one.
--
-- idx_disco_artista_slug_expr / _inverted were built (20260503_perf_indexes_v2)
-- with a translate() TO string of only 4 o's ('...iiiioooouuuu...'), one short
-- of the 5 o-variants (óòôõö) in the FROM string. That shifts ö->u, ç->n, etc.
-- The live query (frontend/lib/db/artista.ts ACCENT_TO) uses the CORRECT 5-o
-- map, so the index expression no longer matches the query expression and
-- Postgres cannot use these indexes — artist-slug lookups fall back to a seqscan.
--
-- Rebuild both with the corrected map so they match the query and get used.
-- Slugs/URLs do NOT change (the query already produced correct slugs); this only
-- restores the index. CONCURRENTLY so prod writes are not locked.
--
-- HOW TO RUN (each statement separately; CONCURRENTLY cannot run in a txn):
--   psql "$DATABASE_URL" -f migrations/20260709_fix_artista_slug_index_map.sql

DROP INDEX CONCURRENTLY IF EXISTS idx_disco_artista_slug_expr;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_artista_slug_expr
  ON "Disco" (
    left(
      regexp_replace(
        regexp_replace(
          translate(lower(artista),
            'áàâãäåéèêëíìîïóòôõöúùûüçñý',
            'aaaaaaeeeeiiiiooooouuuucny'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      60
    )
  );

DROP INDEX CONCURRENTLY IF EXISTS idx_disco_artista_slug_inverted;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_disco_artista_slug_inverted
  ON "Disco" (
    left(
      regexp_replace(
        regexp_replace(
          translate(
            lower(trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))),
            'áàâãäåéèêëíìîïóòôõöúùûüçñý',
            'aaaaaaeeeeiiiiooooouuuucny'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      60
    )
  );

-- Fix accent map in artista slug indexes — psql version (CONCURRENTLY, zero write-blocking)
-- Generated: 2026-06-23
--
-- BUG
-- ---
-- The translate() target string was one char short ('...iiiioooouuuu...' has only
-- four o's against five accented o-variants ó ò ô õ ö). Positional misalignment made
-- translate() map ö→u, ü→c, ç→n, ñ→y and drop ý. So "Motörhead" normalized to
-- "moturhead", its slug index held "moturhead", and /artista/motorhead matched
-- nothing → 404. Same break hit any artist with ö/ü/ç/ñ/ý.
--
-- The query expressions in lib/db/artista.ts (and estilo.ts, sitemap.ts) are fixed
-- to use the correct 'aaaaaaeeeeiiiiooooouuuucny'. These indexes must be rebuilt with
-- the matching expression or the planner can't use them.
--
-- HOW TO RUN
-- ----------
-- psql $DATABASE_URL -f migrations/20260623_fix_artista_slug_accent.sql
--
-- DO NOT run in the Supabase SQL Editor — CONCURRENTLY is forbidden inside the
-- transaction it wraps statements in. For the SQL Editor, drop CONCURRENTLY from
-- each statement (accepts a brief ShareLock; run during a low-traffic window).
--
-- Each statement is idempotent. Safe to re-run.

DROP INDEX CONCURRENTLY IF EXISTS idx_disco_artista_slug_expr;
DROP INDEX CONCURRENTLY IF EXISTS idx_disco_artista_slug_inverted;

-- Artista slug match — regular names
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

-- Artista slug match — inverted "LAST, FIRST" names
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

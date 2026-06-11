-- CD-contamination incident (2026-06-11): physical format of the record.
-- NULL  = not yet verified (still shown on-site until the format sweep runs).
-- 'vinyl' = confirmed vinyl.
-- Any other value ('cd', 'cassette', ...) = excluded from all site surfaces
-- and never re-crawled (acts as the do-not-recrawl list).
ALTER TABLE "Disco" ADD COLUMN IF NOT EXISTS format TEXT;
CREATE INDEX IF NOT EXISTS disco_format_idx ON "Disco" (format) WHERE format IS NOT NULL;

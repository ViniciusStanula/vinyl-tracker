-- price_count_migration.sql
-- Adds a denormalized price_count column to Disco for fast datapoint filtering.
--
-- Run manually against your Supabase database before deploying:
--
--   psql "$DATABASE_URL" -f price_count_migration.sql
--
-- The crawler must maintain this column: increment on each new HistoricoPreco
-- insert, or recompute with:
--   UPDATE "Disco" SET price_count = (SELECT COUNT(*) FROM "HistoricoPreco" WHERE "discoId" = "Disco".id)
-- ---------------------------------------------------------------------------

-- price_count — total number of HistoricoPreco rows for this disco (all time)
ALTER TABLE "Disco"
    ADD COLUMN IF NOT EXISTS price_count INTEGER DEFAULT 0;

-- Backfill from existing data
UPDATE "Disco"
SET price_count = (
    SELECT COUNT(*)
    FROM "HistoricoPreco"
    WHERE "discoId" = "Disco".id
);

-- Index for fast >= 5 filtering
CREATE INDEX IF NOT EXISTS "Disco_price_count_idx"
    ON "Disco" (price_count);

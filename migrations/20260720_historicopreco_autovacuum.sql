-- HistoricoPreco autovacuum tuning + one-time vacuum
-- Generated: 2026-07-20
--
-- WHY
-- ---
-- Deal scoring (crawler/deal_scorer.py score_deals) times out: the benchmark
-- aggregate over "HistoricoPreco" (6.4M rows / 3.3 GB) exceeded its 10-min
-- statement_timeout, failing the crawl run. Root cause was NOT a missing index
-- (the partial covering index idx_historicopreco_discoid_captured_preco already
-- exists, see 20260503_perf_indexes_v2.sql) — it was a stale visibility map.
--
-- The table had never been vacuumed, so only ~66% of pages were all-visible.
-- Without a fresh visibility map PostgreSQL cannot use an index-only scan, so it
-- fell back to a full 3.3 GB sequential scan under concurrent write load → timeout.
--
-- After VACUUM the visibility map reached 100%, the plan switched to an
-- index-only scan on the partial covering index, and the benchmark query ran in
-- ~9.5 s (down from >600 s).
--
-- HOW TO RUN
-- ----------
-- psql "$DATABASE_URL" -f migrations/20260720_historicopreco_autovacuum.sql
-- Use a DIRECT/session connection (port 5432), not the transaction pooler (6543):
-- VACUUM cannot run inside a transaction block.
--
-- Idempotent. Safe to re-run.

-- 1) One-time sweep to populate the visibility map immediately.
VACUUM (ANALYZE) "HistoricoPreco";

-- 2) Keep the visibility map fresh so the index-only scan stays available.
--    Default autovacuum_*_scale_factor is 0.2 (20% churn ≈ 1.3M rows) — far too
--    lax for a 6.4M-row table with daily 180-day-prune DELETEs + price UPDATEs,
--    so autovacuum effectively never ran here. 0.05 (5% ≈ 325k rows) makes the
--    janitor visit ~4x more often, keeping the map current between crawls.
ALTER TABLE "HistoricoPreco" SET (
  autovacuum_vacuum_scale_factor  = 0.05,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_insert_scale_factor = 0.05
);

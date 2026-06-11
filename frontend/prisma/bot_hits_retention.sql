-- bot_hits_retention.sql
-- 6-month retention for the bot_hits log table, enforced inside the database
-- via pg_cron (available on Supabase). Runs daily at 03:00 UTC so each batch
-- stays small (one day's worth of expiring rows); the created_at DESC index
-- keeps the delete cheap.
--
-- Idempotent: cron.schedule() upserts by job name, safe to re-run.
-- Applied via node pg over DIRECT_URL (NOT prisma db push — see bot_hits_create.sql).
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'bot_hits_retention',
  '0 3 * * *',
  $$delete from public.bot_hits where created_at < now() - interval '6 months'$$
);

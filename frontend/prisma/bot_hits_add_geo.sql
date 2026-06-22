-- bot_hits_add_geo.sql
-- Adds city, region, accept_language columns and relaxes bot_name/bot_category
-- to nullable so unrecognized traffic (humans, unknown tools) can be logged.
--
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.

ALTER TABLE bot_hits
  ALTER COLUMN bot_name     DROP NOT NULL,
  ALTER COLUMN bot_category DROP NOT NULL;

ALTER TABLE bot_hits
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS region         TEXT,
  ADD COLUMN IF NOT EXISTS accept_language TEXT;

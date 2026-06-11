-- bot_hits_create.sql
-- Creates the bot_hits table exactly as `prisma db push` would for the BotHit
-- model in schema.prisma (same names, types, defaults, and indexes).
--
-- Applied via `prisma db execute --file` instead of `db push` because the live
-- Disco table intentionally carries crawler-managed columns (deal_scoring_migration.sql)
-- that are not in schema.prisma — db push would try to DROP them.
--
-- Idempotent: safe to re-run.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "bot_hits" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "query" TEXT,
    "user_agent" TEXT NOT NULL,
    "bot_name" TEXT NOT NULL,
    "bot_category" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "referer" TEXT,

    CONSTRAINT "bot_hits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bot_hits_created_at_idx" ON "bot_hits"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "bot_hits_bot_name_idx" ON "bot_hits"("bot_name");
CREATE INDEX IF NOT EXISTS "bot_hits_path_idx" ON "bot_hits"("path");

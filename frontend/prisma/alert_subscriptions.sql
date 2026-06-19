-- alert_subscriptions migration
-- Run once via psql or the Supabase SQL editor.
-- Requires pgcrypto (available on Supabase by default via gen_random_bytes).

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text        NOT NULL,
  filters             jsonb       NOT NULL,
  -- { "record_id": "<Disco.id uuid>", "max_price": numeric }
  status              text        NOT NULL DEFAULT 'pending',
  -- pending | confirmed | unsubscribed (kept for audit; row deleted on unsubscribe)
  manage_token        text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  last_known_price    numeric(10, 2),
  last_alert_sent_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  unsubscribed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alert_subs_record_id
  ON alert_subscriptions ((filters->>'record_id'));

CREATE INDEX IF NOT EXISTS idx_alert_subs_status
  ON alert_subscriptions (status);

-- RLS: anon can only INSERT (subscribe form goes through Next.js → service role,
-- but this blocks any direct Supabase REST API misuse).
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_only"
  ON alert_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- All server-side routes use DATABASE_URL (bypasses RLS via superuser role).
-- No additional policies needed for service-role access.

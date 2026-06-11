-- One-time setup for bot_hits: RLS + grants.
-- NOT managed by `prisma db push` — re-run if the table is ever dropped/recreated.

-- Enable RLS: with no policy, all access is denied by default.
alter table public.bot_hits enable row level security;

-- Allow anonymous inserts only.
create policy "anon can insert bot hits"
  on public.bot_hits
  for insert
  to anon
  with check (true);

-- Supabase grants broad table privileges to anon/authenticated by default
-- (via default privileges). Tighten at the grant level too, so even a future
-- permissive SELECT policy can't expose rows to the public API:
revoke select, update, delete, truncate, references, trigger
  on table public.bot_hits from anon, authenticated;
grant insert on table public.bot_hits to anon;
grant usage on sequence public.bot_hits_id_seq to anon;

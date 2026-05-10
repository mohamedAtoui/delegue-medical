-- Migration 011 — sign-up allowlist (invited_users)
--
-- Only emails that appear here (or that are in SUPERVISOR_EMAILS) can
-- complete sign-up. Enforcement happens in src/lib/clerk/sync-user.ts
-- and the Clerk webhook (src/app/api/webhooks/clerk/route.ts).

create extension if not exists "uuid-ossp";

create table if not exists public.invited_users (
  id          uuid         primary key default uuid_generate_v4(),
  email       text         not null    unique,
  invited_by  uuid         null    references public.users(id),
  created_at  timestamptz  not null default now()
);

create index if not exists idx_invited_users_email
  on public.invited_users (lower(email));

alter table public.invited_users enable row level security;
drop policy if exists "Allow all for anon" on public.invited_users;
create policy "Allow all for anon"
  on public.invited_users for all
  using (true) with check (true);

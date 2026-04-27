-- Migration 013 — notifications
--
-- One row per notification per user. Triggered on:
--   * comment posted (notifies visit author + parent comment author)
--   * supervisor creates assignment (notifies assignee)
--   * pending assignment within 24h or overdue (created lazily on the
--     assignee's next /api/notifications fetch — no cron needed)
--
-- entity_id + type form a uniqueness key for dedup (see
-- createNotificationIfMissing in src/lib/notifications/create.ts).

create extension if not exists "uuid-ossp";

create table if not exists public.notifications (
  id          uuid         primary key default uuid_generate_v4(),
  user_id     uuid         not null references public.users(id) on delete cascade,
  type        text         not null,
  title       text         not null,
  message     text         null,
  link        text         null,
  entity_id   uuid         null,
  entity_type text         null,
  read        boolean      not null default false,
  created_at  timestamptz  not null default now()
);

create index if not exists idx_notif_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notif_dedup
  on public.notifications (user_id, type, entity_id);

alter table public.notifications enable row level security;
drop policy if exists "Allow all for anon" on public.notifications;
create policy "Allow all for anon"
  on public.notifications for all
  using (true) with check (true);

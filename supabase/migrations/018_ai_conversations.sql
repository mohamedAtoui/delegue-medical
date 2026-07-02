-- Migration 018 — Assistant IA conversation history
--
-- Persists the supervisor's chat with the AI assistant so conversations can
-- be saved, listed, renamed and revisited. One conversation owns many
-- messages. ai_messages.parts stores the rich UI parts (text + tool calls
-- like SQL steps and chart specs) so saved chats re-render exactly.
--
-- Like every other table here, RLS is enabled with a permissive anon policy;
-- access is enforced at the application layer (Clerk auth + supervisor role +
-- per-owner scoping in the API routes).

create extension if not exists "uuid-ossp";

create table if not exists public.ai_conversations (
  id          uuid         primary key default uuid_generate_v4(),
  user_id     uuid         not null references public.users(id) on delete cascade,
  title       text         not null default 'Nouvelle conversation',
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists public.ai_messages (
  id              uuid         primary key default uuid_generate_v4(),
  conversation_id uuid         not null references public.ai_conversations(id) on delete cascade,
  role            text         not null check (role in ('user', 'assistant')),
  content         text         not null default '',
  parts           jsonb        null,
  created_at      timestamptz  not null default now()
);

create index if not exists idx_ai_conv_user_updated
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists idx_ai_msg_conv_created
  on public.ai_messages (conversation_id, created_at);

alter table public.ai_conversations enable row level security;
drop policy if exists "Allow all for anon" on public.ai_conversations;
create policy "Allow all for anon"
  on public.ai_conversations for all
  using (true) with check (true);

alter table public.ai_messages enable row level security;
drop policy if exists "Allow all for anon" on public.ai_messages;
create policy "Allow all for anon"
  on public.ai_messages for all
  using (true) with check (true);

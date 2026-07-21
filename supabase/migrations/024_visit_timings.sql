-- Migration 024 — per-visit stage timings + admin correction audit
--
-- A médecin visit can capture up to three timed stages — trajet (travel),
-- attente (waiting room), visite (with the doctor) — each optional and
-- independent. A stage stores its start/end (when timed with the chronometer),
-- the duration in seconds, and whether it was captured 'auto' (chronometer) or
-- 'manual' (typed). Timings are immutable for the délégué (there is simply no
-- délégué endpoint to change them); only a superviseur may correct a value,
-- and every correction is written to visit_timing_audits.
--
-- Idempotent.

create table if not exists public.visit_timings (
  id               uuid        primary key default uuid_generate_v4(),
  visit_id         uuid        not null references public.visits(id) on delete cascade,
  stage            text        not null check (stage in ('trajet', 'attente', 'visite')),
  started_at       timestamptz null,
  ended_at         timestamptz null,
  duration_seconds integer     not null check (duration_seconds >= 0),
  mode             text        not null check (mode in ('auto', 'manual')),
  created_at       timestamptz not null default now(),
  unique (visit_id, stage)
);
create index if not exists idx_visit_timings_visit on public.visit_timings(visit_id);

create table if not exists public.visit_timing_audits (
  id                   uuid        primary key default uuid_generate_v4(),
  visit_timing_id      uuid        null references public.visit_timings(id) on delete set null,
  visit_id             uuid        not null references public.visits(id) on delete cascade,
  stage                text        not null,
  edited_by            uuid        null references public.users(id) on delete set null,
  old_duration_seconds integer     null,
  new_duration_seconds integer     null,
  old_started_at       timestamptz null,
  new_started_at       timestamptz null,
  old_ended_at         timestamptz null,
  new_ended_at         timestamptz null,
  reason               text        null,
  created_at           timestamptz not null default now()
);
create index if not exists idx_visit_timing_audits_visit on public.visit_timing_audits(visit_id);
create index if not exists idx_visit_timing_audits_timing on public.visit_timing_audits(visit_timing_id);

-- RLS permissive (auth enforced in the API layer), matching project convention.
do $$
declare t text;
begin
  for t in select unnest(array['visit_timings', 'visit_timing_audits'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Allow all for anon" on public.%I', t);
    execute format('create policy "Allow all for anon" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

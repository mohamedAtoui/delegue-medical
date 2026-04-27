-- Migration 009 — visit assignment / planning system
--
-- Lets supervisors assign upcoming visits to delegues, and delegues
-- self-assign their own follow-ups. Logged visits auto-complete the
-- earliest matching pending assignment (logic in src/app/api/visits POST).

create extension if not exists "uuid-ossp";

create table if not exists public.visit_assignments (
  id            uuid         primary key default uuid_generate_v4(),
  assignee_id   uuid         not null references public.users(id),
  doctor_id     uuid         not null references public.doctors(id),
  assigned_by   uuid         not null references public.users(id),
  status        text         not null default 'pending'
                              check (status in ('pending', 'completed', 'overdue')),
  deadline      timestamptz  not null,
  note          text         null,
  completed_at  timestamptz  null,
  visit_id      uuid         null    references public.visits(id),
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create index if not exists idx_va_assignee          on public.visit_assignments(assignee_id);
create index if not exists idx_va_status            on public.visit_assignments(status);
create index if not exists idx_va_deadline          on public.visit_assignments(deadline);
create index if not exists idx_va_doctor            on public.visit_assignments(doctor_id);
create index if not exists idx_va_assignee_status   on public.visit_assignments(assignee_id, status);

alter table public.visit_assignments enable row level security;
drop policy if exists "Allow all for anon" on public.visit_assignments;
create policy "Allow all for anon"
  on public.visit_assignments for all
  using (true) with check (true);

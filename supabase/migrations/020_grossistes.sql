-- Migration 020 — grossiste (wholesaler) contacts + pharmacy↔grossiste links
--
-- Grossistes become first-class contacts stored in the doctors table with
-- doctor_type = 'grossiste' (so search, wilaya, phones, visit history all work
-- for free). Pharmacies link to the grossistes that supply them, both as a
-- current directory link (doctor_grossistes) and as a per-visit record
-- (visit_grossistes). The legacy free-text grossiste columns on doctors are
-- kept but no longer written by the UI; this migration seeds the new tables
-- from them.
--
-- Idempotent: safe to re-run.

-- 1. Allow 'grossiste' as a doctor_type and visit_type.
alter table public.doctors drop constraint if exists doctors_doctor_type_check;
alter table public.doctors
  add constraint doctors_doctor_type_check
  check (doctor_type in ('medecin', 'pharmacien', 'grossiste'));

alter table public.visits drop constraint if exists visits_visit_type_check;
alter table public.visits
  add constraint visits_visit_type_check
  check (visit_type in ('medecin', 'pharmacien', 'grossiste'));

-- 2. Join tables. A pharmacy's grossistes, per category (pharma / para-pharm).
create table if not exists public.doctor_grossistes (
  doctor_id    uuid        not null references public.doctors(id) on delete cascade,
  grossiste_id uuid        not null references public.doctors(id) on delete cascade,
  category     text        not null check (category in ('pharma', 'para_pharm')),
  created_at   timestamptz not null default now(),
  primary key (doctor_id, grossiste_id, category)
);
create index if not exists idx_doctor_grossistes_doctor    on public.doctor_grossistes(doctor_id);
create index if not exists idx_doctor_grossistes_grossiste on public.doctor_grossistes(grossiste_id);

create table if not exists public.visit_grossistes (
  visit_id     uuid        not null references public.visits(id) on delete cascade,
  grossiste_id uuid        not null references public.doctors(id) on delete cascade,
  category     text        not null check (category in ('pharma', 'para_pharm')),
  created_at   timestamptz not null default now(),
  primary key (visit_id, grossiste_id, category)
);
create index if not exists idx_visit_grossistes_visit     on public.visit_grossistes(visit_id);
create index if not exists idx_visit_grossistes_grossiste on public.visit_grossistes(grossiste_id);

-- RLS to match project convention (auth enforced in the API layer).
do $$
declare t text;
begin
  for t in select unnest(array['doctor_grossistes', 'visit_grossistes'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Allow all for anon" on public.%I', t);
    execute format('create policy "Allow all for anon" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

-- 3. Seed grossiste contacts from the legacy free-text columns (dedup on a
--    case/trim-insensitive name). Name lives in last_name; wilaya starts empty
--    (the quick-add UI asks for it going forward).
insert into public.doctors (first_name, last_name, doctor_type, wilaya, created_by)
select '', g.name, 'grossiste', '', null
from (
  select distinct trim(grossiste_pharma) as name
    from public.doctors
   where nullif(trim(grossiste_pharma), '') is not null
  union
  select distinct trim(grossiste_para_pharm)
    from public.doctors
   where nullif(trim(grossiste_para_pharm), '') is not null
) g
where not exists (
  select 1 from public.doctors d
   where d.doctor_type = 'grossiste'
     and lower(d.last_name) = lower(g.name)
);

-- 4. Backfill pharmacy→grossiste links from the seeded contacts.
insert into public.doctor_grossistes (doctor_id, grossiste_id, category)
select d.id, g.id, 'pharma'
  from public.doctors d
  join public.doctors g
    on g.doctor_type = 'grossiste'
   and lower(g.last_name) = lower(trim(d.grossiste_pharma))
 where d.doctor_type = 'pharmacien'
   and nullif(trim(d.grossiste_pharma), '') is not null
on conflict do nothing;

insert into public.doctor_grossistes (doctor_id, grossiste_id, category)
select d.id, g.id, 'para_pharm'
  from public.doctors d
  join public.doctors g
    on g.doctor_type = 'grossiste'
   and lower(g.last_name) = lower(trim(d.grossiste_para_pharm))
 where d.doctor_type = 'pharmacien'
   and nullif(trim(d.grossiste_para_pharm), '') is not null
on conflict do nothing;

-- A Focus targets one audience and can reference any number of directory contacts.
-- Existing Focus visits keep a NULL audience until edited/imported.
alter table public.visits
  add column if not exists focus_audience_type text
  check (focus_audience_type in ('medecin', 'pharmacien', 'grossiste'));

create table if not exists public.focus_visit_contacts (
  visit_id uuid not null references public.visits(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visit_id, doctor_id)
);

create index if not exists focus_visit_contacts_doctor_idx
  on public.focus_visit_contacts(doctor_id);

alter table public.focus_visit_contacts enable row level security;
drop policy if exists "Allow all for anon" on public.focus_visit_contacts;
create policy "Allow all for anon" on public.focus_visit_contacts
  for all using (true) with check (true);

-- Guard against mismatched contacts even if a client bypasses the API.
create or replace function public.validate_focus_visit_contact()
returns trigger language plpgsql as $$
declare
  audience text;
  contact_type text;
begin
  select focus_audience_type into audience from public.visits
    where id = new.visit_id and visit_type = 'focus';
  select doctor_type into contact_type from public.doctors where id = new.doctor_id;
  if audience is null or audience is distinct from contact_type then
    raise exception 'Le contact ne correspond pas au public du Focus';
  end if;
  return new;
end;
$$;

drop trigger if exists focus_visit_contact_type_check on public.focus_visit_contacts;
create trigger focus_visit_contact_type_check
  before insert or update on public.focus_visit_contacts
  for each row execute function public.validate_focus_visit_contact();

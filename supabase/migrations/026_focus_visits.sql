-- Focus events are visits without an individual doctor/pharmacy contact.
-- Apply before enabling the Focus form in production.
alter table public.visits
  alter column doctor_id drop not null;

alter table public.visits
  drop constraint if exists visits_visit_type_check;
alter table public.visits
  add constraint visits_visit_type_check
  check (visit_type in ('medecin', 'pharmacien', 'grossiste', 'focus'));

alter table public.visits
  add column if not exists focus_doctor_count integer,
  add column if not exists focus_lieu text,
  add column if not exists focus_budget numeric(12, 2),
  add column if not exists focus_animateur text;

alter table public.visits
  drop constraint if exists visits_focus_contact_check;
alter table public.visits
  add constraint visits_focus_contact_check
  check ((visit_type = 'focus' and doctor_id is null)
      or (visit_type <> 'focus' and doctor_id is not null));

alter table public.visits
  drop constraint if exists visits_focus_fields_check;
alter table public.visits
  add constraint visits_focus_fields_check
  check (visit_type <> 'focus' or (
    focus_doctor_count > 0
    and nullif(btrim(focus_lieu), '') is not null
    and focus_budget >= 0
    and nullif(btrim(focus_animateur), '') is not null
    and nullif(btrim(compte_rendu), '') is not null
  ));

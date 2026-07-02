-- Migration 019 — per-visit engagement + doctor engagement average
--
-- The doctor "engagement" (0–5 stars) used to be a single value typed by hand
-- on the doctor record. It now becomes the AVERAGE of the engagement scores
-- entered at each visit. The manually entered value is kept as the baseline
-- "first data point": until a visit carries an engagement score, the average
-- leaves it untouched.
--
-- Idempotent: safe to re-run.

-- 1. Per-visit engagement (1..5, nullable). Optional rating captured per visit.
alter table public.visits
  add column if not exists engagement integer null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'visits_engagement_check'
  ) then
    alter table public.visits
      add constraint visits_engagement_check
      check (engagement is null or engagement between 1 and 5);
  end if;
end $$;

-- 2. doctors.engagement holds the average — widen to numeric so the mean isn't
--    truncated. Existing integer values (0..5) cast cleanly.
alter table public.doctors
  alter column engagement type numeric(3,2) using engagement::numeric;

-- 3. Recompute a doctor's engagement as the mean of its non-null visit
--    engagements. When the doctor has no rated visit yet, COALESCE keeps the
--    current value (the manual baseline) — the "first data point" rule.
create or replace function public.recalc_doctor_engagement(target_id uuid)
returns void
language sql
as $$
  update public.doctors d
     set engagement = coalesce(
           (select round(avg(v.engagement)::numeric, 2)
              from public.visits v
             where v.doctor_id = target_id
               and v.engagement is not null),
           d.engagement),
         updated_at = now()
   where d.id = target_id;
$$;

create or replace function public.trg_recalc_doctor_engagement()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_doctor_engagement(old.doctor_id);
    return old;
  end if;
  perform public.recalc_doctor_engagement(new.doctor_id);
  -- If an UPDATE re-pointed the visit to a different doctor, refresh both.
  if (tg_op = 'UPDATE' and new.doctor_id is distinct from old.doctor_id) then
    perform public.recalc_doctor_engagement(old.doctor_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_visits_engagement on public.visits;
create trigger trg_visits_engagement
  after insert or update of engagement, doctor_id or delete on public.visits
  for each row
  execute function public.trg_recalc_doctor_engagement();

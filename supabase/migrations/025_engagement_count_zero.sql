-- Migration 025 — count an unrated visit as 0 in the doctor engagement average
--
-- Previously the doctor engagement average considered only visits that carried
-- a star (engagement IS NOT NULL); unrated visits were ignored. The business
-- rule is now: a visit with no star counts as 0, so it drags the average down.
--
-- We average COALESCE(engagement, 0) over the doctor's *rateable* visits —
-- i.e. every visit except grossiste visits, which structurally never carry an
-- engagement. When the doctor has no rateable visit at all, COALESCE keeps the
-- current value (the manual baseline / "first data point" rule stays).
--
-- Scale-agnostic: works whether engagement is 1..3 (current, see migration 023)
-- or any other range — it only averages the stored values, treating a missing
-- star as 0.
--
-- Idempotent: safe to re-run.

create or replace function public.recalc_doctor_engagement(target_id uuid)
returns void
language sql
as $$
  update public.doctors d
     set engagement = coalesce(
           (select round(avg(coalesce(v.engagement, 0))::numeric, 2)
              from public.visits v
             where v.doctor_id = target_id
               and v.visit_type <> 'grossiste'),
           d.engagement),
         updated_at = now()
   where d.id = target_id;
$$;

-- The trigger (migration 019) already fires on every insert/delete and on
-- updates of engagement/doctor_id, so no trigger change is needed — a new
-- unrated visit now recomputes the average with itself counted as 0.

-- Backfill: recompute every doctor under the new rule.
do $$
declare
  r record;
begin
  for r in select id from public.doctors loop
    perform public.recalc_doctor_engagement(r.id);
  end loop;
end $$;

-- Migration 023 — rescale engagement from 5 stars to 3 stars
--
-- New scale is 1..3. Existing recorded values are remapped:
--   0 -> 0 (kept; shouldn't occur under the 1..5 check but be safe)
--   1, 2 -> 1
--   3, 4 -> 2
--   5    -> 3
--
-- Per-visit engagements are remapped individually; the recalc trigger then
-- recomputes each doctor's average from the remapped values. Doctors that only
-- ever had a manual baseline (no per-visit engagement) are remapped directly.
--
-- Idempotent: guarded on the visits_engagement_check still covering the old
-- 1..5 range (its definition mentions "5"). After migrating, the constraint no
-- longer mentions 5, so a re-run is a no-op.

do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'visits_engagement_check';

  -- Only migrate while still on the old 1..5 scale.
  if def is null or position('5' in def) > 0 then

    -- 1. Remap per-visit engagements (trigger recomputes doctor averages).
    update public.visits
       set engagement = case
             when engagement <= 2 then 1
             when engagement <= 4 then 2
             else 3
           end
     where engagement is not null;

    -- 2. Remap manual baselines on doctors that have no per-visit engagement
    --    (those with visits were just recomputed to the new-scale average).
    update public.doctors d
       set engagement = case
             when d.engagement = 0 then 0
             when d.engagement <= 2 then 1
             when d.engagement <= 4 then 2
             else 3
           end
     where d.engagement is not null
       and not exists (
         select 1 from public.visits v
          where v.doctor_id = d.id and v.engagement is not null
       );

    -- 3. Tighten the per-visit constraint to the new 1..3 scale.
    alter table public.visits drop constraint if exists visits_engagement_check;
    alter table public.visits
      add constraint visits_engagement_check
      check (engagement is null or engagement between 1 and 3);

  end if;
end $$;

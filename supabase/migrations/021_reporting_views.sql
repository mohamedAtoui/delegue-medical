-- Migration 021 — additive reporting views for the Assistant IA
--
-- IMPORTANT: the existing v_*_rows views were created directly in the Supabase
-- SQL editor and their definitions are NOT tracked in this repo. This migration
-- deliberately does NOT recreate them — a wrong guess would break the Assistant
-- IA's favourite tables. Instead, the assistant now reads the LIVE schema by
-- introspection (see src/lib/insights/schema.ts), so the new per-visit
-- engagement column and the grossiste tables are already visible to it.
--
-- The views below are pure convenience helpers over the new grossiste tables.
-- They only ADD objects, so they cannot break anything existing. ai_ro reads
-- them automatically via the default privileges set in migration 017.
--
-- Idempotent: safe to re-run.

create or replace view public.v_visit_grossistes_rows as
select
  vg.visit_id,
  v.doctor_id  as pharmacy_id,
  ph.last_name as pharmacy_name,
  ph.wilaya    as pharmacy_wilaya,
  vg.grossiste_id,
  g.last_name  as grossiste_name,
  vg.category,
  v.created_at as visit_date
from public.visit_grossistes vg
join public.visits  v  on v.id = vg.visit_id
join public.doctors ph on ph.id = v.doctor_id
join public.doctors g  on g.id = vg.grossiste_id;

create or replace view public.v_doctor_grossistes_rows as
select
  dg.doctor_id as pharmacy_id,
  ph.last_name as pharmacy_name,
  ph.wilaya    as pharmacy_wilaya,
  dg.grossiste_id,
  g.last_name  as grossiste_name,
  dg.category
from public.doctor_grossistes dg
join public.doctors ph on ph.id = dg.doctor_id
join public.doctors g  on g.id = dg.grossiste_id;

-- Migration 012 — daily visit goal per delegue
--
-- Supervisor sets a target number of visits/day per delegue from the
-- /delegues page. The delegue's /visites page shows live progress.
-- 0 = no goal set (UI hides the progress card).

alter table public.users
  add column if not exists daily_visit_goal integer default 0;

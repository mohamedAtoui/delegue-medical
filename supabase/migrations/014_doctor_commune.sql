-- Migration 014 — optional Commune field on doctors
--
-- Display order in UI is now: wilaya, commune — address.

alter table public.doctors
  add column if not exists commune text;

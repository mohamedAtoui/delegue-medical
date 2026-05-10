-- Migration 015 — product catalog extensions
--
-- Adds stock + commercial info for the /produits page (supervisor-only
-- catalog management).

alter table public.products
  add column if not exists reference   text,
  add column if not exists laboratory  text,
  add column if not exists quantity    integer,
  add column if not exists price       numeric(10, 2),
  add column if not exists notes       text,
  add column if not exists updated_at  timestamptz default now();

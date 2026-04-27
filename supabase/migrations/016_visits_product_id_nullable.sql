-- Migration 016 — pharmacien visits cover all products
--
-- Pharmacien visits are portfolio-wide (one visit answers questions for
-- Synapgen + every other active product). They have no single product_id.
-- Médecin visits remain product-specific (enforced in API).

alter table public.visits
  alter column product_id drop not null;

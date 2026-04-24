-- Migration 008 — per-product question sets + dynamic visit answers
--
-- Introduces two tables:
--   * product_questions — editable question catalogue, one row per question
--     per product per target role (medecin | pharmacien). Soft-deletable.
--   * visit_answers     — one row per answered question per visit. Polymorphic
--     value (boolean | text | number) with a check keeping at most one column
--     populated.
--
-- Access control stays at the application layer (mirrors src/app/api/products
-- pattern). No RLS.
--
-- Legacy visit columns (synapgen_solves, already_prescribed, magnesium_brand,
-- …) are intentionally left in place: pre-existing visits still render from
-- them while new visits use visit_answers.

create extension if not exists "uuid-ossp";

-- Ensure visits.product_id exists (the column was in 001_initial_schema but
-- never populated; add defensively in case this migration is applied to a
-- DB that predates it).
alter table public.visits
  add column if not exists product_id uuid references public.products(id);

-- ─── product_questions ──────────────────────────────────────────────────
create table if not exists public.product_questions (
  id             uuid         primary key default uuid_generate_v4(),
  product_id     uuid         not null    references public.products(id) on delete cascade,
  target_role    text         not null    check (target_role in ('medecin', 'pharmacien')),
  label          text         not null,
  input_type     text         not null    check (input_type in ('yes_no', 'short_text', 'textarea', 'number')),
  required       boolean      not null    default false,
  display_order  integer      not null    default 0,
  visible_when   jsonb        null,
  deleted_at     timestamptz  null,
  created_at     timestamptz  not null    default now(),
  updated_at     timestamptz  not null    default now()
);

create index if not exists idx_product_questions_product
  on public.product_questions(product_id);
create index if not exists idx_product_questions_active
  on public.product_questions(product_id, target_role, display_order)
  where deleted_at is null;

-- ─── visit_answers ──────────────────────────────────────────────────────
create table if not exists public.visit_answers (
  id             uuid         primary key default uuid_generate_v4(),
  visit_id       uuid         not null    references public.visits(id)           on delete cascade,
  question_id    uuid         not null    references public.product_questions(id) on delete restrict,
  value_boolean  boolean      null,
  value_text     text         null,
  value_number   numeric      null,
  created_at     timestamptz  not null    default now(),
  unique (visit_id, question_id),
  check (num_nonnulls(value_boolean, value_text, value_number) <= 1)
);

create index if not exists idx_visit_answers_visit
  on public.visit_answers(visit_id);
create index if not exists idx_visit_answers_question
  on public.visit_answers(question_id);

-- ─── Seed SynapGen's question set + backfill visits.product_id ──────────
do $$
declare
  v_product_id              uuid;
  v_prescribes_magnesium_id uuid;
  v_patient_feedback_id     uuid;
begin
  select id into v_product_id
  from public.products
  where name = 'SynapGen'
  limit 1;

  if v_product_id is null then
    raise exception 'Product "SynapGen" not found — create it in products before running migration 008';
  end if;

  -- Guard against double-seeding on re-runs
  if exists (select 1 from public.product_questions where product_id = v_product_id) then
    raise notice 'SynapGen questions already seeded — skipping seed';
  else
    -- Médecin questions, in the order they appear in visit-form.tsx:306-375
    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'Synapgen répond-il aux besoins de ses patients ?', 'yes_no', 0);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'A-t-il déjà prescrit le produit ?', 'yes_no', 1);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'A-t-il promis de le suggérer ?', 'yes_no', 2);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'Objection prix ?', 'yes_no', 3);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'Prescrit-il beaucoup de magnésium ?', 'yes_no', 4)
    returning id into v_prescribes_magnesium_id;

    insert into public.product_questions (product_id, target_role, label, input_type, display_order, visible_when)
    values (
      v_product_id, 'medecin', 'Quelle marque ?', 'short_text', 5,
      jsonb_build_object('op', 'eq', 'question_id', v_prescribes_magnesium_id, 'value', true)
    );

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'Crainte d''effets secondaires ?', 'yes_no', 6);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'Retours de patients reçus ?', 'yes_no', 7)
    returning id into v_patient_feedback_id;

    insert into public.product_questions (product_id, target_role, label, input_type, display_order, visible_when)
    values (
      v_product_id, 'medecin', 'Détails des retours patients', 'textarea', 8,
      jsonb_build_object('op', 'eq', 'question_id', v_patient_feedback_id, 'value', true)
    );

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'A-t-il reçu un retour d''ordonnance ?', 'yes_no', 9);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'medecin', 'Échantillon gratuit donné pendant cette visite ?', 'yes_no', 10);

    -- Pharmacien questions, matching visit-form.tsx:386-439
    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'pharmacien', 'Nombre de Synapgen en stock', 'number', 0);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'pharmacien', 'Nombre de prescriptions reçues', 'number', 1);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'pharmacien', 'Prescriptions de quel médecin ?', 'short_text', 2);

    insert into public.product_questions (product_id, target_role, label, input_type, display_order)
    values (v_product_id, 'pharmacien', 'A-t-il accepté de faire une commande (bon de commande) ?', 'yes_no', 3);
  end if;

  -- Link pre-existing visits to SynapGen so the read path can resolve a
  -- product. Legacy answer columns remain the source of truth for these rows
  -- (visit_answers stays empty for them).
  update public.visits
    set product_id = v_product_id
    where product_id is null;
end $$;

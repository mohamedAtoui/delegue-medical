-- Migration 001 — initial schema baseline
--
-- Consolidates the schema state of the project up to (but not including)
-- migration 008. Idempotent: every CREATE uses `if not exists`, every
-- ALTER guards with `if not exists`, so this file is safe to apply to an
-- existing production DB (it'll be a no-op).
--
-- Tables created:
--   users, doctors, products, visits, visit_comments, territory_assignments
--
-- Permissive RLS policies are added because authentication is enforced
-- at the application layer (Clerk + getOrCreateUser + role checks in API
-- routes). Tightening RLS would be a follow-up hardening pass.

create extension if not exists "uuid-ossp";

-- ─── users ──────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid         primary key default uuid_generate_v4(),
  clerk_id    text         not null    unique,
  email       text         not null,
  first_name  text         null,
  last_name   text         null,
  phone       text         null,
  avatar_url  text         null,
  role        text         not null    default 'delegue'
                            check (role in ('delegue', 'superviseur')),
  created_at  timestamptz  not null    default now(),
  updated_at  timestamptz  not null    default now()
);

create index if not exists idx_users_clerk_id on public.users(clerk_id);
create index if not exists idx_users_email     on public.users(lower(email));
create index if not exists idx_users_role      on public.users(role);

-- ─── doctors ────────────────────────────────────────────────────────────
create table if not exists public.doctors (
  id                    uuid         primary key default uuid_generate_v4(),
  first_name            text         not null,
  last_name             text         not null,
  doctor_type           text         not null    default 'medecin'
                                       check (doctor_type in ('medecin', 'pharmacien')),
  specialty             text         null,
  address               text         null,
  google_maps_url       text         null,
  latitude              numeric      null,
  longitude             numeric      null,
  wilaya                text         not null,
  phone                 text         null,
  phone_fixe            text         null,
  phone_mobile          text         null,
  email                 text         null,
  grossiste_pharma      text         null,
  grossiste_para_pharm  text         null,
  potentiel             text         null    check (potentiel in ('A', 'B', 'C')),
  engagement            integer      null    default 0,
  created_by            uuid         null    references public.users(id) on delete set null,
  created_at            timestamptz  not null default now(),
  updated_at            timestamptz  not null default now()
);

create index if not exists idx_doctors_type      on public.doctors(doctor_type);
create index if not exists idx_doctors_wilaya    on public.doctors(wilaya);
create index if not exists idx_doctors_specialty on public.doctors(specialty);
create index if not exists idx_doctors_name      on public.doctors(lower(last_name), lower(first_name));

-- ─── products ───────────────────────────────────────────────────────────
create table if not exists public.products (
  id          uuid         primary key default uuid_generate_v4(),
  name        text         not null,
  description text         null,
  active      boolean      not null default true,
  created_at  timestamptz  not null default now()
);

-- Seed the initial SynapGen product so migration 008 can find it.
insert into public.products (name, description, active)
select 'SynapGen', 'Complément alimentaire à base de magnésium', true
where not exists (select 1 from public.products where name = 'SynapGen');

-- ─── visits ─────────────────────────────────────────────────────────────
create table if not exists public.visits (
  id                          uuid         primary key default uuid_generate_v4(),
  user_id                     uuid         not null references public.users(id)   on delete cascade,
  doctor_id                   uuid         not null references public.doctors(id),
  product_id                  uuid         null    references public.products(id),
  visit_type                  text         not null default 'medecin'
                                            check (visit_type in ('medecin', 'pharmacien')),
  objective                   text         null,
  compte_rendu                text         null,
  -- Legacy médecin checklist (pre-product_questions). Kept for old visits;
  -- new visits use visit_answers (migration 008).
  synapgen_solves             boolean      null,
  already_prescribed          boolean      null,
  promised_to_suggest         boolean      null,
  price_objection             boolean      null,
  prescribes_magnesium        boolean      null,
  magnesium_brand             text         null,
  fears_side_effects          boolean      null,
  patient_feedback            boolean      null,
  patient_feedback_comment    text         null,
  ordonnance_return           boolean      null,
  free_sample                 boolean      null,
  -- Legacy pharmacien fields
  synapgen_count              integer      null,
  prescriptions_received      integer      null,
  prescribing_doctor          text         null,
  accepted_order              boolean      null,
  created_at                  timestamptz  not null default now()
);

create index if not exists idx_visits_user_id    on public.visits(user_id);
create index if not exists idx_visits_doctor_id  on public.visits(doctor_id);
create index if not exists idx_visits_product_id on public.visits(product_id);
create index if not exists idx_visits_created_at on public.visits(created_at desc);
create index if not exists idx_visits_user_date  on public.visits(user_id, created_at desc);

-- ─── visit_comments (with replies via parent_id and image attachments) ──
create table if not exists public.visit_comments (
  id          uuid         primary key default uuid_generate_v4(),
  visit_id    uuid         not null references public.visits(id)         on delete cascade,
  user_id     uuid         not null references public.users(id)          on delete cascade,
  parent_id   uuid         null    references public.visit_comments(id)  on delete cascade,
  content     text         null,
  image_url   text         null,
  created_at  timestamptz  not null default now(),
  check (content is not null or image_url is not null)
);

create index if not exists idx_visit_comments_visit  on public.visit_comments(visit_id);
create index if not exists idx_visit_comments_parent on public.visit_comments(parent_id);

-- ─── territory_assignments (a delegue's wilayas) ────────────────────────
create table if not exists public.territory_assignments (
  id          uuid         primary key default uuid_generate_v4(),
  user_id     uuid         not null references public.users(id) on delete cascade,
  wilaya      text         not null,
  assigned_by uuid         null    references public.users(id) on delete set null,
  created_at  timestamptz  not null default now(),
  unique (user_id, wilaya)
);

create index if not exists idx_territory_user_id on public.territory_assignments(user_id);

-- ─── RLS: enable + permissive policies (auth enforced in API layer) ─────
do $$
declare
  t text;
begin
  for t in
    select unnest(array['users', 'doctors', 'products', 'visits',
                        'visit_comments', 'territory_assignments'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'drop policy if exists "Allow all for anon" on public.%I',
      t
    );
    execute format(
      'create policy "Allow all for anon" on public.%I for all using (true) with check (true)',
      t
    );
  end loop;
end $$;

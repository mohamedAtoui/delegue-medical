-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- USERS (synced from Clerk via webhook)
create table public.users (
  id            uuid primary key default uuid_generate_v4(),
  clerk_id      text unique not null,
  email         text not null,
  first_name    text,
  last_name     text,
  role          text not null default 'delegue' check (role in ('delegue', 'superviseur')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- PRODUCTS
create table public.products (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  active        boolean default true,
  created_at    timestamptz default now()
);

-- Seed Synapgene
insert into public.products (name, description)
values ('Synapgene', 'Produit pharmaceutique Handson');

-- DOCTORS
create table public.doctors (
  id            uuid primary key default uuid_generate_v4(),
  first_name    text not null,
  last_name     text not null,
  specialty     text,
  wilaya        text not null,
  phone         text,
  created_by    uuid references public.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_doctors_wilaya on public.doctors(wilaya);
create index idx_doctors_name on public.doctors(last_name, first_name);

-- VISITS
create table public.visits (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id),
  doctor_id     uuid not null references public.doctors(id),
  product_id    uuid not null references public.products(id),
  notes         text,
  created_at    timestamptz default now()
);

create index idx_visits_user on public.visits(user_id);
create index idx_visits_doctor on public.visits(doctor_id);
create index idx_visits_created on public.visits(created_at desc);

-- TERRITORY ASSIGNMENTS
create table public.territory_assignments (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id),
  wilaya        text not null,
  assigned_by   uuid references public.users(id),
  created_at    timestamptz default now(),
  unique(user_id, wilaya)
);

create index idx_territory_user on public.territory_assignments(user_id);

-- Enable Realtime on visits table
alter publication supabase_realtime add table visits;

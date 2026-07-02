-- Migration 022 — clean up the grossiste directory
--
-- Migration 020 seeded grossistes by treating each free-text field as ONE name,
-- but those fields actually list several grossistes ("Attia medic 2 upro" =
-- Attia + Medic 2 + Upro). That produced ~130 bogus combined entities. This
-- migration resets the grossiste directory to the canonical list and re-links
-- each pharmacy by parsing its old free-text against that list (+ known
-- aliases). The legacy free-text columns are kept as a reference.
--
-- Safe to re-run: it keeps only the canonical grossistes and re-derives links.
-- NOTE: a re-run also removes any grossiste added by hand that isn't in the
-- canonical list (intended — the directory is "the canonical list only").

-- 1. Drop every grossiste that isn't in the canonical list. Cascades to
--    doctor_grossistes / visit_grossistes, clearing the wrong links.
delete from public.doctors
 where doctor_type = 'grossiste'
   and lower(last_name) not in (
     'attia','medic 1','upro','medic 2','somepharm','setifismed','biban',
     'vecopharm','az','saouli','bennada','paravenir','souci','planet','bercos',
     'impsa','bioreal','biopure','abc','genipharm','siphaoui'
   );

-- 2. Insert the canonical grossistes (idempotent, case-insensitive dedup).
insert into public.doctors (first_name, last_name, doctor_type, wilaya, created_by)
select '', name, 'grossiste', '', null
from (values
  ('Attia'),('Medic 1'),('Upro'),('Medic 2'),('Somepharm'),('Setifismed'),
  ('Biban'),('Vecopharm'),('Az'),('Saouli'),('Bennada'),('Paravenir'),
  ('Souci'),('Planet'),('Bercos'),('Impsa'),('Bioreal'),('Biopure'),
  ('Abc'),('Genipharm'),('Siphaoui')
) as v(name)
where not exists (
  select 1 from public.doctors d
   where d.doctor_type = 'grossiste' and lower(d.last_name) = lower(v.name)
);

-- 3. Re-link pharmacies to their grossistes by matching the legacy free-text
--    against canonical names + aliases (word-boundary, case-insensitive).
with terms(canonical, pat) as (
  values
    ('Attia','attia'),
    ('Medic 1','medic 1'),('Medic 1','medic1'),('Medic 1','setif medic 1'),
    ('Medic 2','medic 2'),('Medic 2','medic2'),('Medic 2','setif medic 2'),('Medic 2','medi2'),
    ('Upro','upro'),
    ('Somepharm','somepharm'),('Somepharm','sophram'),('Somepharm','sopharm'),
    ('Setifismed','setifismed'),('Setifismed','setifis'),
    ('Biban','biban'),
    ('Vecopharm','vecopharm'),('Vecopharm','veco'),
    ('Az','az'),
    ('Saouli','saouli'),
    ('Bennada','bennada'),('Bennada','benada'),
    ('Paravenir','paravenir'),
    ('Souci','souci'),('Souci','souici'),
    ('Planet','planet'),('Planet','planète'),('Planet','planete'),
    ('Bercos','bercos'),
    ('Impsa','impsa'),
    ('Bioreal','bioreal'),('Bioreal','biooreal'),
    ('Biopure','biopure'),
    ('Abc','abc'),
    ('Genipharm','genipharm'),
    ('Siphaoui','siphaoui')
),
matches as (
  select d.id as doctor_id, g.id as grossiste_id, 'pharma'::text as category
    from public.doctors d
    join terms t on d.grossiste_pharma ~* ('\y' || t.pat || '\y')
    join public.doctors g
      on g.doctor_type = 'grossiste' and lower(g.last_name) = lower(t.canonical)
   where d.doctor_type = 'pharmacien'
  union
  select d.id, g.id, 'para_pharm'
    from public.doctors d
    join terms t on d.grossiste_para_pharm ~* ('\y' || t.pat || '\y')
    join public.doctors g
      on g.doctor_type = 'grossiste' and lower(g.last_name) = lower(t.canonical)
   where d.doctor_type = 'pharmacien'
)
insert into public.doctor_grossistes (doctor_id, grossiste_id, category)
select doctor_id, grossiste_id, category from matches
on conflict do nothing;

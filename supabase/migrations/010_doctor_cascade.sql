-- Migration 010 — cascade delete from doctors
--
-- Supervisor doctor deletion (src/app/api/doctors/[id] DELETE) needs the
-- doctor's visits and pending assignments to be wiped along with the
-- doctor row. visit_comments already cascade via visits → visit_comments.

alter table public.visits
  drop constraint if exists visits_doctor_id_fkey,
  add  constraint visits_doctor_id_fkey
    foreign key (doctor_id) references public.doctors(id) on delete cascade;

alter table public.visit_assignments
  drop constraint if exists visit_assignments_doctor_id_fkey,
  add  constraint visit_assignments_doctor_id_fkey
    foreign key (doctor_id) references public.doctors(id) on delete cascade;

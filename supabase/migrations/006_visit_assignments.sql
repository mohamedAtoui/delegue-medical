-- Migration 006: Visit assignment / planning feature

CREATE TABLE public.visit_assignments (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignee_id   uuid NOT NULL REFERENCES public.users(id),
  doctor_id     uuid NOT NULL REFERENCES public.doctors(id),
  assigned_by   uuid NOT NULL REFERENCES public.users(id),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'completed', 'overdue')),
  deadline      timestamptz NOT NULL,
  note          text,
  completed_at  timestamptz,
  visit_id      uuid REFERENCES public.visits(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_va_assignee ON public.visit_assignments(assignee_id);
CREATE INDEX idx_va_status ON public.visit_assignments(status);
CREATE INDEX idx_va_deadline ON public.visit_assignments(deadline);
CREATE INDEX idx_va_doctor ON public.visit_assignments(doctor_id);
CREATE INDEX idx_va_assignee_status ON public.visit_assignments(assignee_id, status);

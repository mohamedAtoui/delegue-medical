-- Add threaded replies to visit comments
ALTER TABLE public.visit_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.visit_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS visit_comments_parent_id_idx ON public.visit_comments(parent_id);

-- Migration 004: Visit overhaul, type-specific fields, comments thread

-- Wipe existing visits (pre-launch, fresh start)
TRUNCATE public.visits RESTART IDENTITY CASCADE;

-- Make product_id optional, drop notes
ALTER TABLE public.visits ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.visits DROP COLUMN IF EXISTS notes;

-- Visit type + narrative fields
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visit_type text CHECK (visit_type IN ('medecin','pharmacien'));
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS compte_rendu text;

-- Médecin checklist (nullable = unanswered)
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS synapgen_solves boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS already_prescribed boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS promised_to_suggest boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS price_objection boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS prescribes_magnesium boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS magnesium_brand text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS fears_side_effects boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS patient_feedback boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS patient_feedback_comment text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS ordonnance_return boolean;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS free_sample boolean;

-- Pharmacien fields
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS synapgen_count integer;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS prescriptions_received integer;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS prescribing_doctor text;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS accepted_order boolean;

-- Doctors: new contact + pharmacie-specific fields
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone_fixe text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS phone_mobile text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS google_maps_url text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS grossiste_pharma text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS grossiste_para_pharm text;

-- Backfill phone_mobile from old phone column
UPDATE public.doctors SET phone_mobile = phone WHERE phone_mobile IS NULL AND phone IS NOT NULL;

-- Users: avatar
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Visit comments thread
CREATE TABLE IF NOT EXISTS public.visit_comments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id    uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_comments_visit_id_idx ON public.visit_comments(visit_id);
CREATE INDEX IF NOT EXISTS visit_comments_user_id_idx  ON public.visit_comments(user_id);

-- Enable realtime for live comment updates
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_comments;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

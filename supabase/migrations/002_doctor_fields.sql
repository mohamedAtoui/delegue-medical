-- Add new fields to doctors table
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS doctor_type text NOT NULL DEFAULT 'medecin' CHECK (doctor_type IN ('medecin', 'pharmacien'));
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS potentiel text CHECK (potentiel IN ('A', 'B', 'C'));
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS engagement integer DEFAULT 0 CHECK (engagement >= 0 AND engagement <= 5);

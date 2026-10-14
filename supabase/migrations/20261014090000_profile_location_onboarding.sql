-- Save each user's selected SPATDEL launch area.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_community text,
  ADD COLUMN IF NOT EXISTS selected_location text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET onboarding_completed = true
WHERE role::text = 'admin'
  AND onboarding_completed = false;

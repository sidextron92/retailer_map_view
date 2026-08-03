-- Migration: add location_source audit column to rmv_tam_retailers
-- Date: 2026-08-03

ALTER TABLE public.rmv_tam_retailers
ADD COLUMN IF NOT EXISTS location_source TEXT DEFAULT 'auto';

-- Optional check constraint for data quality
-- Only apply if the table already has data and we want strict values.
-- If the constraint fails on existing rows, remove the strict check.
DO $$
BEGIN
  ALTER TABLE public.rmv_tam_retailers
  ADD CONSTRAINT chk_location_source
  CHECK (location_source IN ('auto', 'manual'));
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'Could not add strict check constraint due to existing rows. Skipping.';
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint chk_location_source already exists. Skipping.';
END $$;

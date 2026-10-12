-- Associate pincode boundaries with external darkstore IDs.
ALTER TABLE public.rmv_pincode_boundaries
  ADD COLUMN IF NOT EXISTS darkstore_id INTEGER;

CREATE INDEX IF NOT EXISTS rmv_pincode_boundaries_darkstore_id_idx
  ON public.rmv_pincode_boundaries (darkstore_id);

COMMENT ON COLUMN public.rmv_pincode_boundaries.darkstore_id IS
  'External darkstore ID. Nullable for pincodes without an assigned darkstore.';

NOTIFY pgrst, 'reload schema';

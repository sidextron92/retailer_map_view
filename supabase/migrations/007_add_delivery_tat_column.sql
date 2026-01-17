-- Add deliveryTAT column to pincode_boundaries table
-- Values stored in seconds
ALTER TABLE pincode_boundaries
ADD COLUMN IF NOT EXISTS deliverytat NUMERIC DEFAULT NULL;

-- Add comment for the column
COMMENT ON COLUMN pincode_boundaries.deliverytat IS 'Delivery turnaround time in seconds. NULL means not serviceable.';

-- Create index for filtering by delivery TAT
CREATE INDEX IF NOT EXISTS pincode_boundaries_deliverytat_idx
  ON pincode_boundaries (deliverytat)
  WHERE deliverytat IS NOT NULL;

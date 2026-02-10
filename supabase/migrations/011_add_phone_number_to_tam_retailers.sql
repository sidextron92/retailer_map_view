-- Migration to add phone_number column to tam_retailers table
-- This column stores optional phone numbers for retailers captured in TAM mode

-- Add phone_number column to tam_retailers table
ALTER TABLE tam_retailers
ADD COLUMN phone_number VARCHAR(10);

-- Add comment to document the column
COMMENT ON COLUMN tam_retailers.phone_number IS 'Optional 10-digit phone number for the retailer';

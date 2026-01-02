-- Migration to modify retailers table structure based on new requirements
-- This migration:
-- 1. Adds new columns: state, city, pincode, last_order_date, sk_id, trader_name, retailer_status, buying_category, teamlead_name, darkstore
-- 2. Removes columns: email, contact_person, type, is_visited, payment_status, category, created_at, updated_at
-- 3. Retains: last_visit_date, next_scheduled_visit, is_active, notes, geolocation, latitude, longitude
-- 4. retailer_status links to retailer_categories table (via name) for color/icon mapping

-- First, add the new columns
ALTER TABLE retailers
  ADD COLUMN state VARCHAR(100),
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN pincode VARCHAR(20),
  ADD COLUMN last_order_date TIMESTAMPTZ,
  ADD COLUMN sk_id VARCHAR(50),
  ADD COLUMN trader_name VARCHAR(255),
  ADD COLUMN retailer_status VARCHAR(50),
  ADD COLUMN buying_category VARCHAR(100),
  ADD COLUMN teamlead_name VARCHAR(255),
  ADD COLUMN darkstore VARCHAR(100);

-- Create indexes for frequently searched columns
CREATE INDEX idx_retailers_state ON retailers(state);
CREATE INDEX idx_retailers_city ON retailers(city);
CREATE INDEX idx_retailers_pincode ON retailers(pincode);
CREATE INDEX idx_retailers_sk_id ON retailers(sk_id);
CREATE INDEX idx_retailers_trader_name ON retailers(trader_name);
CREATE INDEX idx_retailers_last_order_date ON retailers(last_order_date);
CREATE INDEX idx_retailers_retailer_status ON retailers(retailer_status);
CREATE INDEX idx_retailers_buying_category ON retailers(buying_category);
CREATE INDEX idx_retailers_teamlead_name ON retailers(teamlead_name);
CREATE INDEX idx_retailers_darkstore ON retailers(darkstore);

-- Drop old indexes that reference removed columns
DROP INDEX IF EXISTS idx_retailers_category;
DROP INDEX IF EXISTS idx_retailers_status;

-- Recreate the status index with only is_active
CREATE INDEX idx_retailers_active ON retailers(is_active);

-- Remove old columns
ALTER TABLE retailers
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS contact_person,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS is_visited,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

-- Drop the trigger that updated the updated_at field (since column is removed)
DROP TRIGGER IF EXISTS trigger_update_updated_at ON retailers;
DROP FUNCTION IF EXISTS update_updated_at();

-- Update the name search index to use GIN for better performance
DROP INDEX IF EXISTS idx_retailers_name_search;
CREATE INDEX idx_retailers_name_search ON retailers USING gin(to_tsvector('english', name || ' ' || COALESCE(trader_name, '')));

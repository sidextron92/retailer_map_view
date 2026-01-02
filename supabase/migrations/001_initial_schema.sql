-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Retailers table
CREATE TABLE retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  contact_person VARCHAR(255),

  -- Location (required)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geolocation GEOGRAPHY(POINT, 4326), -- PostGIS (auto-generated from lat/lng)

  -- Categorization
  category VARCHAR(100) NOT NULL, -- 'restaurant', 'retail', 'wholesale', 'pharmacy', 'other'
  type VARCHAR(100), -- Sub-category

  -- Status fields
  is_active BOOLEAN DEFAULT true,
  is_visited BOOLEAN DEFAULT false,
  payment_status VARCHAR(50) DEFAULT 'pending', -- 'paid', 'pending', 'overdue'

  -- Date/time fields
  last_visit_date TIMESTAMPTZ,
  next_scheduled_visit TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Notes
  notes TEXT
);

-- Indexes for filtering performance
CREATE INDEX idx_retailers_category ON retailers(category);
CREATE INDEX idx_retailers_status ON retailers(is_active, payment_status);
CREATE INDEX idx_retailers_visit_dates ON retailers(last_visit_date, next_scheduled_visit);
CREATE INDEX idx_retailers_geolocation ON retailers USING GIST(geolocation);
CREATE INDEX idx_retailers_name_search ON retailers USING gin(to_tsvector('english', name));

-- Trigger to update geolocation from lat/lng
CREATE OR REPLACE FUNCTION update_geolocation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geolocation = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_geolocation
BEFORE INSERT OR UPDATE OF latitude, longitude ON retailers
FOR EACH ROW
EXECUTE FUNCTION update_geolocation();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON retailers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Category colors lookup table
CREATE TABLE retailer_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color_hex VARCHAR(7) NOT NULL, -- e.g., '#E74C3C'
  icon_name VARCHAR(50)
);

-- Sample categories with colors
INSERT INTO retailer_categories (name, color_hex, icon_name) VALUES
  ('restaurant', '#E74C3C', 'utensils'),
  ('retail', '#3498DB', 'store'),
  ('wholesale', '#2ECC71', 'warehouse'),
  ('pharmacy', '#9B59B6', 'cross'),
  ('other', '#95A5A6', 'map-pin');

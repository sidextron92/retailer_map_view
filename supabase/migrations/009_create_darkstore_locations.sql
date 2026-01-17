-- Migration to create darkstore_locations table
-- This table stores darkstore information for operations mode

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create darkstore_locations table
CREATE TABLE darkstore_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  darkstore VARCHAR(255) NOT NULL UNIQUE,
  address TEXT NOT NULL,

  -- Location (required)
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geolocation GEOGRAPHY(POINT, 4326), -- PostGIS (auto-generated from lat/lng)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_darkstore_locations_darkstore ON darkstore_locations(darkstore);
CREATE INDEX idx_darkstore_locations_geolocation ON darkstore_locations USING GIST(geolocation);

-- Trigger to update geolocation from lat/lng (reusing function from retailers table)
CREATE TRIGGER trigger_darkstore_update_geolocation
BEFORE INSERT OR UPDATE OF latitude, longitude ON darkstore_locations
FOR EACH ROW
EXECUTE FUNCTION update_geolocation();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_darkstore_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_darkstore_update_updated_at
BEFORE UPDATE ON darkstore_locations
FOR EACH ROW
EXECUTE FUNCTION update_darkstore_updated_at();

-- Migration to create tam_retailers table and storage bucket
-- This table stores retailer data captured in TAM mode

-- Enable PostGIS extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create storage bucket for shop photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tam-shop-photos', 'tam-shop-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create tam_retailers table
CREATE TABLE tam_retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  shop_name VARCHAR(255),
  shop_photo_url TEXT NOT NULL, -- URL to image in Supabase storage
  category_tags JSONB DEFAULT '[]'::jsonb, -- Array of category tags

  -- Location data
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geolocation GEOGRAPHY(POINT, 4326), -- PostGIS (auto-generated from lat/lng)
  location_accuracy DECIMAL(10, 2), -- GPS accuracy in meters
  pincode VARCHAR(10) NOT NULL,

  -- Darkstore association
  darkstore VARCHAR(255) NOT NULL,

  -- Device/User tracking
  user_agent TEXT,
  device_info JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_tam_retailers_darkstore ON tam_retailers(darkstore);
CREATE INDEX idx_tam_retailers_pincode ON tam_retailers(pincode);
CREATE INDEX idx_tam_retailers_geolocation ON tam_retailers USING GIST(geolocation);
CREATE INDEX idx_tam_retailers_created_at ON tam_retailers(created_at DESC);
CREATE INDEX idx_tam_retailers_category_tags ON tam_retailers USING GIN(category_tags);

-- Trigger to update geolocation from lat/lng (reusing function from retailers table)
CREATE TRIGGER trigger_tam_retailers_update_geolocation
BEFORE INSERT OR UPDATE OF latitude, longitude ON tam_retailers
FOR EACH ROW
EXECUTE FUNCTION update_geolocation();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tam_retailers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tam_retailers_update_updated_at
BEFORE UPDATE ON tam_retailers
FOR EACH ROW
EXECUTE FUNCTION update_tam_retailers_updated_at();

-- Storage policies for tam-shop-photos bucket
-- Allow public read access
CREATE POLICY "Public read access for shop photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'tam-shop-photos');

-- Allow authenticated insert
CREATE POLICY "Allow insert for shop photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tam-shop-photos');

-- Allow authenticated update of own uploads
CREATE POLICY "Allow update for shop photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tam-shop-photos');

-- Allow authenticated delete of own uploads
CREATE POLICY "Allow delete for shop photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'tam-shop-photos');

-- RLS policies for tam_retailers table
ALTER TABLE tam_retailers ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access for tam_retailers"
ON tam_retailers FOR SELECT
USING (true);

-- Allow public insert (for TAM mode captures)
CREATE POLICY "Public insert access for tam_retailers"
ON tam_retailers FOR INSERT
WITH CHECK (true);

-- Allow public update
CREATE POLICY "Public update access for tam_retailers"
ON tam_retailers FOR UPDATE
USING (true);

-- Allow public delete
CREATE POLICY "Public delete access for tam_retailers"
ON tam_retailers FOR DELETE
USING (true);

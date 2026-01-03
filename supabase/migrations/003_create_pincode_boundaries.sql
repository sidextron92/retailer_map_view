-- Enable PostGIS extension for spatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create pincode_boundaries table with geometry column
CREATE TABLE IF NOT EXISTS pincode_boundaries (
  id BIGSERIAL PRIMARY KEY,
  pincode VARCHAR(10) NOT NULL,
  office_name VARCHAR(255),
  district VARCHAR(100),
  state VARCHAR(100),
  geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create spatial index on geometry column for fast queries
CREATE INDEX IF NOT EXISTS pincode_boundaries_geometry_idx
  ON pincode_boundaries
  USING GIST (geometry);

-- Create index on pincode for quick lookups
CREATE INDEX IF NOT EXISTS pincode_boundaries_pincode_idx
  ON pincode_boundaries (pincode);

-- Create index on state for filtering
CREATE INDEX IF NOT EXISTS pincode_boundaries_state_idx
  ON pincode_boundaries (state);

-- Add comment
COMMENT ON TABLE pincode_boundaries IS 'India pincode boundaries with spatial geometry for map visualization';

-- Create RPC function to get pincodes within viewport bounds
CREATE OR REPLACE FUNCTION get_pincodes_in_viewport(
  min_lng FLOAT,
  min_lat FLOAT,
  max_lng FLOAT,
  max_lat FLOAT,
  zoom_level INT DEFAULT 12
)
RETURNS TABLE (
  id BIGINT,
  pincode VARCHAR(10),
  office_name VARCHAR(255),
  district VARCHAR(100),
  state VARCHAR(100),
  geometry GEOMETRY
) AS $$
BEGIN
  -- Only return data if zoom level is 12 or higher
  IF zoom_level < 12 THEN
    RETURN;
  END IF;

  -- Create bounding box from viewport coordinates
  RETURN QUERY
  SELECT
    pb.id,
    pb.pincode,
    pb.office_name,
    pb.district,
    pb.state,
    pb.geometry
  FROM pincode_boundaries pb
  WHERE ST_Intersects(
    pb.geometry,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  );
END;
$$ LANGUAGE plpgsql;

-- Create helper function to execute raw SQL (for data import)
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON pincode_boundaries TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_pincodes_in_viewport TO anon, authenticated;
GRANT EXECUTE ON FUNCTION exec_sql TO service_role;

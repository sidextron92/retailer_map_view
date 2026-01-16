-- Add new RPC function to get pincodes within radius of a center point
-- This provides more consistent rendering compared to viewport-based queries

CREATE OR REPLACE FUNCTION get_pincodes_by_radius(
  center_lng FLOAT,
  center_lat FLOAT,
  radius_km FLOAT,
  zoom_level INT DEFAULT 8
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
  -- Only return data if zoom level is 8 or higher (country/region level)
  IF zoom_level < 8 THEN
    RETURN;
  END IF;

  -- Use ST_DWithin with geography type for accurate distance calculations
  -- Convert radius from kilometers to meters
  RETURN QUERY
  SELECT
    pb.id,
    pb.pincode,
    pb.office_name,
    pb.district,
    pb.state,
    pb.geometry
  FROM pincode_boundaries pb
  WHERE ST_DWithin(
    pb.geometry::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_km * 1000  -- Convert km to meters
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pincodes_by_radius TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION get_pincodes_by_radius IS 'Get pincode boundaries within specified radius (km) of a center point. Uses ST_DWithin for accurate circular distance calculation.';

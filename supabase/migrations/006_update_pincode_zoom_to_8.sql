-- Update function to load pincodes at zoom level 8 (instead of 10)
-- This allows pincode boundaries to appear at country/region level

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
    radius_km * 1000
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_pincodes_by_radius TO anon, authenticated;

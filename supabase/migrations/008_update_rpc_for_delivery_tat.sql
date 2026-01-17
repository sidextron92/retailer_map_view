-- Update RPC function to include deliverytat in the response
-- Drop existing function first since we're changing the return type
DROP FUNCTION IF EXISTS get_pincodes_by_radius(FLOAT, FLOAT, FLOAT, INT);

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
  geometry GEOMETRY,
  deliverytat NUMERIC
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
    pb.geometry,
    pb.deliverytat
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

-- Update comment
COMMENT ON FUNCTION get_pincodes_by_radius IS 'Get pincode boundaries with delivery TAT within specified radius (km) of a center point. Uses ST_DWithin for accurate circular distance calculation.';

-- Update RPC function to load pincodes at zoom level 10 (instead of 12)
-- This allows pincode boundaries to appear more zoomed out (state level)
CREATE OR REPLACE FUNCTION get_pincodes_in_viewport(
  min_lng FLOAT,
  min_lat FLOAT,
  max_lng FLOAT,
  max_lat FLOAT,
  zoom_level INT DEFAULT 10
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
  -- Only return data if zoom level is 10 or higher (state level)
  IF zoom_level < 10 THEN
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

-- Create custom market boundaries table for TAM mode catchment analysis
CREATE TABLE IF NOT EXISTS public.rmv_market_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  darkstore TEXT NOT NULL,
  geometry GEOMETRY(POLYGON, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Spatial index for fast point-in-polygon and overlap queries
CREATE INDEX IF NOT EXISTS rmv_market_boundaries_geometry_idx
  ON public.rmv_market_boundaries USING GIST (geometry);

-- Geography expression index for area calculations
CREATE INDEX IF NOT EXISTS rmv_market_boundaries_geography_idx
  ON public.rmv_market_boundaries USING GIST ((geometry::geography));

-- Index for darkstore-scoped fetches
CREATE INDEX IF NOT EXISTS rmv_market_boundaries_darkstore_idx
  ON public.rmv_market_boundaries (darkstore);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION public.rmv_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rmv_market_boundaries_updated_at
  BEFORE UPDATE ON public.rmv_market_boundaries
  FOR EACH ROW
  EXECUTE FUNCTION public.rmv_update_updated_at_column();

-- RLS: permissive by default while admin authorization is URL-based
ALTER TABLE IF EXISTS public.rmv_market_boundaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rmv_market_boundaries" ON public.rmv_market_boundaries;
CREATE POLICY "Allow all operations on rmv_market_boundaries"
  ON public.rmv_market_boundaries
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Returns TAM retailers that fall inside a specific market boundary
CREATE OR REPLACE FUNCTION public.rmv_get_retailers_in_market(
  p_market_id UUID,
  p_darkstore TEXT
)
RETURNS SETOF public.rmv_tam_retailers
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT r.*
  FROM public.rmv_tam_retailers r
  JOIN public.rmv_market_boundaries m
    ON m.id = p_market_id
   AND m.darkstore ILIKE p_darkstore
  WHERE r.darkstore ILIKE p_darkstore
    AND ST_Contains(
      m.geometry,
      ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
    );
$$;

-- Returns market-level aggregation for a darkstore, including an "Outside Market" bucket
CREATE OR REPLACE FUNCTION public.rmv_get_market_data(
  p_darkstore TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  area_sqm DOUBLE PRECISION,
  retailer_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  -- Markets with retailer counts
  SELECT
    m.id,
    m.name,
    ST_Area(m.geometry::geography) AS area_sqm,
    COUNT(r.id) AS retailer_count
  FROM public.rmv_market_boundaries m
  LEFT JOIN public.rmv_tam_retailers r
    ON r.darkstore ILIKE p_darkstore
   AND ST_Contains(
        m.geometry,
        ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
      )
  WHERE m.darkstore ILIKE p_darkstore
  GROUP BY m.id, m.name, m.geometry

  UNION ALL

  -- Outside market bucket
  SELECT
    NULL::UUID AS id,
    'Outside Market'::TEXT AS name,
    NULL::DOUBLE PRECISION AS area_sqm,
    COUNT(r.id) AS retailer_count
  FROM public.rmv_tam_retailers r
  WHERE r.darkstore ILIKE p_darkstore
    AND NOT EXISTS (
      SELECT 1
      FROM public.rmv_market_boundaries m
      WHERE m.darkstore ILIKE p_darkstore
        AND ST_Contains(
          m.geometry,
          ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
        )
    );
$$;

-- Checks whether a new market boundary would cross an existing boundary.
-- Returns the ID and name of the first conflicting market, or no rows if valid.
CREATE OR REPLACE FUNCTION public.rmv_check_market_boundary_crossing(
  p_darkstore TEXT,
  p_geometry GEOMETRY(POLYGON, 4326),
  p_exclude_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT m.id, m.name
  FROM public.rmv_market_boundaries m
  WHERE m.darkstore ILIKE p_darkstore
    AND (p_exclude_id IS NULL OR m.id <> p_exclude_id)
    AND ST_Crosses(m.geometry, p_geometry);
$$;

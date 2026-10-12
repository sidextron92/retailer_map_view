-- Add external darkstore IDs and use them for all darkstore-scoped operations.
BEGIN;

ALTER TABLE public.rmv_darkstore_locations
  ADD COLUMN IF NOT EXISTS darkstore_id INTEGER;
ALTER TABLE public.rmv_retailers
  ADD COLUMN IF NOT EXISTS darkstore_id INTEGER;
ALTER TABLE public.rmv_tam_retailers
  ADD COLUMN IF NOT EXISTS darkstore_id INTEGER;
ALTER TABLE public.rmv_market_boundaries
  ADD COLUMN IF NOT EXISTS darkstore_id INTEGER;

UPDATE public.rmv_darkstore_locations AS target
SET darkstore_id = CASE lower(trim(target.darkstore))
  WHEN 'agra' THEN 10
  WHEN 'nagpur' THEN 12
  WHEN 'aurangabad' THEN 16
  WHEN 'solapur' THEN 17
  WHEN 'nashik' THEN 18
  WHEN 'kolhapur' THEN 19
  WHEN 'raipur' THEN 20
  WHEN 'kurnool' THEN 22
  WHEN 'vizag' THEN 21
  WHEN 'warangal' THEN 23
  WHEN 'pune' THEN 24
  WHEN 'malda' THEN 26
  WHEN 'murshidabad' THEN 27
  WHEN 'nagaon' THEN 28
  WHEN 'ranchi' THEN 29
  WHEN 'madurai' THEN 30
  WHEN 'patna' THEN 31
  WHEN 'bhubneshwar' THEN 32
  WHEN 'north24parganas' THEN 34
  WHEN 'silchar' THEN 35
  WHEN 'siliguri' THEN 36
  WHEN 'coochbehar' THEN 37
  WHEN 'darbhanga' THEN 38
  WHEN 'agartala' THEN 39
  WHEN 'dibrugarh' THEN 40
  ELSE target.darkstore_id
END;

UPDATE public.rmv_retailers AS target
SET darkstore_id = location.darkstore_id
FROM public.rmv_darkstore_locations AS location
WHERE lower(trim(target.darkstore)) = lower(trim(location.darkstore));

UPDATE public.rmv_tam_retailers AS target
SET darkstore_id = location.darkstore_id
FROM public.rmv_darkstore_locations AS location
WHERE lower(trim(target.darkstore)) = lower(trim(location.darkstore));

UPDATE public.rmv_market_boundaries AS target
SET darkstore_id = location.darkstore_id
FROM public.rmv_darkstore_locations AS location
WHERE lower(trim(target.darkstore)) = lower(trim(location.darkstore));

DO $$
DECLARE
  unknown_darkstores TEXT;
BEGIN
  SELECT string_agg(source || ': ' || darkstore, ', ' ORDER BY source, darkstore)
  INTO unknown_darkstores
  FROM (
    SELECT DISTINCT 'rmv_darkstore_locations' AS source, darkstore
    FROM public.rmv_darkstore_locations
    WHERE darkstore_id IS NULL
    UNION ALL
    SELECT DISTINCT 'rmv_retailers', darkstore
    FROM public.rmv_retailers
    WHERE darkstore IS NOT NULL AND darkstore_id IS NULL
    UNION ALL
    SELECT DISTINCT 'rmv_tam_retailers', darkstore
    FROM public.rmv_tam_retailers
    WHERE darkstore_id IS NULL
    UNION ALL
    SELECT DISTINCT 'rmv_market_boundaries', darkstore
    FROM public.rmv_market_boundaries
    WHERE darkstore_id IS NULL
  ) AS unknowns;

  IF unknown_darkstores IS NOT NULL THEN
    RAISE EXCEPTION 'Missing darkstore ID mappings for: %', unknown_darkstores;
  END IF;
END;
$$;

ALTER TABLE public.rmv_darkstore_locations
  ALTER COLUMN darkstore_id SET NOT NULL;
ALTER TABLE public.rmv_tam_retailers
  ALTER COLUMN darkstore_id SET NOT NULL;
ALTER TABLE public.rmv_market_boundaries
  ALTER COLUMN darkstore_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rmv_darkstore_locations_darkstore_id_idx
  ON public.rmv_darkstore_locations (darkstore_id);
CREATE INDEX IF NOT EXISTS rmv_retailers_darkstore_id_idx
  ON public.rmv_retailers (darkstore_id);
CREATE INDEX IF NOT EXISTS rmv_tam_retailers_darkstore_id_idx
  ON public.rmv_tam_retailers (darkstore_id);
CREATE INDEX IF NOT EXISTS rmv_market_boundaries_darkstore_id_idx
  ON public.rmv_market_boundaries (darkstore_id);

CREATE OR REPLACE FUNCTION public.rmv_get_retailers_in_market(
  p_market_id UUID,
  p_darkstore_id INTEGER
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
   AND m.darkstore_id = p_darkstore_id
  WHERE r.darkstore_id = p_darkstore_id
    AND ST_Contains(
      m.geometry,
      ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
    );
$$;

CREATE OR REPLACE FUNCTION public.rmv_get_normal_retailers_in_market(
  p_market_id UUID,
  p_darkstore_id INTEGER
)
RETURNS SETOF public.rmv_retailers
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT r.*
  FROM public.rmv_retailers r
  JOIN public.rmv_market_boundaries m
    ON m.id = p_market_id
   AND m.darkstore_id = p_darkstore_id
  WHERE r.darkstore_id = p_darkstore_id
    AND ST_Contains(
      m.geometry,
      ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
    )
  ORDER BY r.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.rmv_get_market_data(
  p_darkstore_id INTEGER
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
  SELECT
    m.id,
    m.name,
    ST_Area(m.geometry::geography) AS area_sqm,
    COUNT(r.id) AS retailer_count
  FROM public.rmv_market_boundaries m
  LEFT JOIN public.rmv_tam_retailers r
    ON r.darkstore_id = p_darkstore_id
   AND ST_Contains(
        m.geometry,
        ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
      )
  WHERE m.darkstore_id = p_darkstore_id
  GROUP BY m.id, m.name, m.geometry

  UNION ALL

  SELECT
    NULL::UUID AS id,
    'Outside Market'::TEXT AS name,
    NULL::DOUBLE PRECISION AS area_sqm,
    COUNT(r.id) AS retailer_count
  FROM public.rmv_tam_retailers r
  WHERE r.darkstore_id = p_darkstore_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.rmv_market_boundaries m
      WHERE m.darkstore_id = p_darkstore_id
        AND ST_Contains(
          m.geometry,
          ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.rmv_check_market_boundary_crossing(
  p_darkstore_id INTEGER,
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
  WHERE m.darkstore_id = p_darkstore_id
    AND (p_exclude_id IS NULL OR m.id <> p_exclude_id)
    AND ST_Crosses(m.geometry, p_geometry);
$$;

GRANT EXECUTE ON FUNCTION public.rmv_get_retailers_in_market(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rmv_get_normal_retailers_in_market(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rmv_get_market_data(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rmv_check_market_boundary_crossing(INTEGER, GEOMETRY, UUID) TO anon, authenticated;

-- Keep historical signatures installed for migration safety, but prevent runtime use.
REVOKE EXECUTE ON FUNCTION public.rmv_get_retailers_in_market(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rmv_get_normal_retailers_in_market(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rmv_get_market_data(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rmv_check_market_boundary_crossing(TEXT, GEOMETRY, UUID) FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.rmv_darkstore_locations.darkstore_id IS 'Darkstore ID from the external source database.';
COMMENT ON COLUMN public.rmv_retailers.darkstore_id IS 'External darkstore ID used for filtering and matching.';
COMMENT ON COLUMN public.rmv_tam_retailers.darkstore_id IS 'External darkstore ID used for filtering and matching.';
COMMENT ON COLUMN public.rmv_market_boundaries.darkstore_id IS 'External darkstore ID used for filtering and matching.';

COMMIT;

NOTIFY pgrst, 'reload schema';

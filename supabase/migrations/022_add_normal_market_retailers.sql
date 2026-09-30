-- Returns normal-mode retailers inside a market boundary.
-- Results are scoped only by darkstore and intentionally ignore client-side filters.
CREATE OR REPLACE FUNCTION public.rmv_get_normal_retailers_in_market(
  p_market_id UUID,
  p_darkstore TEXT
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
   AND m.darkstore ILIKE p_darkstore
  WHERE r.darkstore ILIKE p_darkstore
    AND ST_Contains(
      m.geometry,
      ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)
    )
  ORDER BY r.name ASC;
$$;

-- Ensure PostgREST discovers the function immediately after a manual SQL run.
NOTIFY pgrst, 'reload schema';

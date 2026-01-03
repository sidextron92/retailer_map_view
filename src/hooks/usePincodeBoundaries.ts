'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { LngLatBounds } from 'react-map-gl/mapbox';

interface UsePincodeBoundariesProps {
  /**
   * Current zoom level of the map
   */
  zoom: number;
  /**
   * Current viewport bounds of the map
   */
  bounds?: LngLatBounds | null;
  /**
   * Minimum zoom level at which to load pincode boundaries
   * @default 12
   */
  minZoom?: number;
}

interface UsePincodeBoundariesResult {
  data: any | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch India pincode boundaries from Supabase based on viewport
 * Uses PostGIS spatial queries to only fetch pincodes visible in current map view
 */
export function usePincodeBoundaries({
  zoom,
  bounds,
  minZoom = 12,
}: UsePincodeBoundariesProps): UsePincodeBoundariesResult {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPincodes = useCallback(async (
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number,
    zoomLevel: number
  ) => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      console.log('🗺️  Fetching pincodes for viewport:', {
        bounds: { minLng, minLat, maxLng, maxLat },
        zoom: zoomLevel
      });

      const startTime = performance.now();

      // Call Supabase RPC function for spatial query
      const { data: pincodeData, error: fetchError } = await supabase
        .rpc('get_pincodes_in_viewport', {
          min_lng: minLng,
          min_lat: minLat,
          max_lng: maxLng,
          max_lat: maxLat,
          zoom_level: zoomLevel
        });

      if (fetchError) throw fetchError;

      // Convert to GeoJSON format for Mapbox
      const geojson = {
        type: 'FeatureCollection' as const,
        features: (pincodeData || []).map((pincode: any) => ({
          type: 'Feature' as const,
          properties: {
            pincode: pincode.pincode,
            office_name: pincode.office_name,
            district: pincode.district,
            state: pincode.state,
          },
          geometry: pincode.geometry,
        })),
      };

      const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Loaded ${geojson.features.length} pincodes in ${loadTime}s`);

      setData(geojson);
    } catch (err: any) {
      // Ignore aborted requests
      if (err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error('Failed to fetch pincode boundaries');
      console.error('❌ Error fetching pincodes:', error);
      setError(error);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Only fetch if zoom is at or above threshold
    if (zoom < minZoom) {
      setData(null);
      return;
    }

    // Need valid bounds to query
    if (!bounds) {
      return;
    }

    // Extract viewport coordinates
    const minLng = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLng = bounds.getEast();
    const maxLat = bounds.getNorth();

    // Debounce fetch to avoid too many requests while panning
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPincodes(minLng, minLat, maxLng, maxLat, zoom);
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [zoom, bounds, minZoom, fetchPincodes]);

  return { data, loading, error };
}

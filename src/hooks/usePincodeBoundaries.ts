'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { LngLatBounds } from 'react-map-gl/mapbox';
import { getPincodeColor, getPincodeOutlineColor } from '@/lib/utils/pincode-colors';
import type { PincodeFeature, PincodeFeatureCollection, PincodeGeometry } from '@/lib/utils/pincode-detector';

interface UsePincodeBoundariesProps {
  zoom: number;
  bounds?: LngLatBounds | null;
  minZoom?: number;
  persistCache?: boolean; // If true, cache won't be cleared on zoom out (for TAM mode)
}

interface UsePincodeBoundariesResult {
  data: PincodeFeatureCollection | null;
  loading: boolean;
  error: Error | null;
  fetchPincodes: (centerLng: number, centerLat: number) => Promise<void>;
  cacheStats?: {
    cachedPincodes: number;
    cacheCenter: { lat: number; lng: number } | null;
  };
}

interface PincodeRpcRow {
  id: number;
  pincode: string;
  office_name: string;
  district: string;
  state: string;
  geometry: PincodeGeometry;
  deliverytat: number | null;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || fallback);
  }
  return fallback;
}

/**
 * Simplified hook to fetch India pincode boundaries
 *
 * Strategy:
 * - Manual fetch: Fetch all pincodes within 70km radius of center when user clicks "Load Pincodes"
 * - Cache the result and use it until user clears cache
 * - Clear cache when zoom < 8
 */
export function usePincodeBoundaries({
  zoom,
  minZoom = 8,
  persistCache = false,
}: UsePincodeBoundariesProps): UsePincodeBoundariesResult {
  const [data, setData] = useState<PincodeFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Cache storage
  const cachedPincodes = useRef<PincodeFeature[]>([]);
  const cacheCenter = useRef<{ lat: number; lng: number } | null>(null);
  const previousZoom = useRef<number>(zoom);

  const fetchPincodes = useCallback(async (
    centerLng: number,
    centerLat: number
  ) => {
    setLoading(true);
    setError(null);

    try {

      console.log('🗺️  Fetching pincodes within 70km radius:', {
        center: { lat: centerLat.toFixed(4), lng: centerLng.toFixed(4) },
        radius: '70km'
      });

      const startTime = performance.now();

      // Call Supabase RPC function
      const { data: pincodeData, error: fetchError } = await supabase
        .rpc('rmv_get_pincodes_by_radius', {
          center_lng: centerLng,
          center_lat: centerLat,
          radius_km: 70,
          zoom_level: 10
        });

      if (fetchError) throw fetchError;

      // Convert to features with colors
      const features: PincodeFeature[] = ((pincodeData || []) as PincodeRpcRow[]).map((pincode) => ({
        type: 'Feature' as const,
        properties: {
          id: pincode.id,
          pincode: pincode.pincode,
          office_name: pincode.office_name,
          district: pincode.district,
          state: pincode.state,
          fillColor: getPincodeColor(pincode.pincode),
          outlineColor: getPincodeOutlineColor(pincode.pincode),
          deliverytat: pincode.deliverytat,
        },
        geometry: pincode.geometry,
      }));

      // Cache the results
      cachedPincodes.current = features;
      cacheCenter.current = { lat: centerLat, lng: centerLng };

      const geojson = {
        type: 'FeatureCollection' as const,
        features: features,
      };

      const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Loaded and cached ${features.length} pincodes in ${loadTime}s`);
      console.log(`📍 Cache center: (${centerLat.toFixed(3)}, ${centerLng.toFixed(3)})`);

      setData(geojson);
    } catch (err: unknown) {
      const error = new Error(getErrorMessage(err, 'Failed to fetch pincode boundaries'));
      console.error('❌ Error fetching pincodes:', JSON.stringify(err, null, 2));
      setError(error);
      throw error; // Rethrow so parent can handle it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear cache and data if zoom goes below minimum (level 8) - unless persistCache is true
    if (zoom < minZoom && !persistCache) {
      if (cachedPincodes.current.length > 0) {
        console.log('🗑️  Clearing pincode cache (zoomed out below level 8)');
        cachedPincodes.current = [];
        cacheCenter.current = null;
        setData(null);
      }
      previousZoom.current = zoom;
      return;
    }

    // Use cached data if available
    if (cachedPincodes.current.length > 0 && cacheCenter.current) {
      console.log('✨ Using cached pincodes');
      const geojson = {
        type: 'FeatureCollection' as const,
        features: cachedPincodes.current,
      };
      setData(geojson);
    }

    previousZoom.current = zoom;
  }, [zoom, minZoom, persistCache]);

  return {
    data,
    loading,
    error,
    fetchPincodes,
    cacheStats: {
      cachedPincodes: cachedPincodes.current.length,
      cacheCenter: cacheCenter.current,
    }
  };
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { LngLatBounds } from 'react-map-gl/mapbox';
import { getPincodeColor, getPincodeOutlineColor } from '@/lib/utils/pincode-colors';

interface UsePincodeBoundariesProps {
  zoom: number;
  bounds?: LngLatBounds | null;
  minZoom?: number;
}

interface UsePincodeBoundariesResult {
  data: any | null;
  loading: boolean;
  error: Error | null;
  fetchPincodes: (centerLng: number, centerLat: number) => Promise<void>;
  cacheStats?: {
    cachedPincodes: number;
    cacheCenter: { lat: number; lng: number } | null;
  };
}

interface PincodeFeature {
  type: 'Feature';
  properties: {
    id?: number;
    pincode: string;
    office_name: string;
    district: string;
    state: string;
    fillColor: string;
    outlineColor: string;
    deliverytat?: number | null;
  };
  geometry: any;
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  bounds,
  minZoom = 8,
}: UsePincodeBoundariesProps): UsePincodeBoundariesResult {
  const [data, setData] = useState<any | null>(null);
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
        .rpc('get_pincodes_by_radius', {
          center_lng: centerLng,
          center_lat: centerLat,
          radius_km: 70,
          zoom_level: 10
        });

      if (fetchError) throw fetchError;

      // Convert to features with colors
      const features: PincodeFeature[] = (pincodeData || []).map((pincode: any) => ({
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
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error('Failed to fetch pincode boundaries');
      console.error('❌ Error fetching pincodes:', error);
      setError(error);
      throw error; // Rethrow so parent can handle it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear cache and data if zoom goes below minimum (level 8)
    if (zoom < minZoom) {
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
  }, [zoom, minZoom]);

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

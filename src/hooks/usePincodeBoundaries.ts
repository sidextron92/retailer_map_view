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
 * - At zoom 8: Fetch all pincodes within 100km radius of center
 * - Cache the result and use it for all zoom >= 8
 * - Clear cache when zoom < 8
 * - Re-fetch only when zooming back to 8 at a different location
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
    try {
      setLoading(true);
      setError(null);

      console.log('🗺️  Fetching pincodes within 100km radius:', {
        center: { lat: centerLat.toFixed(4), lng: centerLng.toFixed(4) },
        radius: '100km'
      });

      const startTime = performance.now();

      // Call Supabase RPC function
      const { data: pincodeData, error: fetchError } = await supabase
        .rpc('get_pincodes_by_radius', {
          center_lng: centerLng,
          center_lat: centerLat,
          radius_km: 100,
          zoom_level: 8
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear cache if zoom goes below minimum
    if (zoom < minZoom) {
      if (cachedPincodes.current.length > 0) {
        console.log('🗑️  Clearing pincode cache (zoomed out below level 8)');
        cachedPincodes.current = [];
        cacheCenter.current = null;
      }
      setData(null);
      previousZoom.current = zoom;
      return;
    }

    // Need valid bounds to calculate center
    if (!bounds) {
      return;
    }

    // Calculate map center
    const centerLng = (bounds.getWest() + bounds.getEast()) / 2;
    const centerLat = (bounds.getSouth() + bounds.getNorth()) / 2;

    // Check if we have cached data
    if (cachedPincodes.current.length > 0 && cacheCenter.current) {
      // Use cached data
      console.log('✨ Using cached pincodes');
      const geojson = {
        type: 'FeatureCollection' as const,
        features: cachedPincodes.current,
      };
      setData(geojson);
      previousZoom.current = zoom;
      return;
    }

    // Check if just crossed zoom threshold (zoom in to 8)
    const justCrossedThreshold = previousZoom.current < minZoom && zoom >= minZoom;

    if (justCrossedThreshold) {
      // Check if we need to fetch (different location or no cache)
      if (!cacheCenter.current) {
        // No cache, fetch new data
        console.log('📡 First time at zoom 8, fetching pincodes...');
        fetchPincodes(centerLng, centerLat);
      } else {
        // Check distance from cached center
        const distance = haversineDistance(
          centerLat,
          centerLng,
          cacheCenter.current.lat,
          cacheCenter.current.lng
        );

        if (distance > 50) {
          // More than 50km from cached center, fetch new data
          console.log(`📡 Moved ${distance.toFixed(1)}km from cached center, fetching new pincodes...`);
          fetchPincodes(centerLng, centerLat);
        } else {
          // Within range, use cache
          console.log('✨ Within cached area, using existing pincodes');
          const geojson = {
            type: 'FeatureCollection' as const,
            features: cachedPincodes.current,
          };
          setData(geojson);
        }
      }
    }

    previousZoom.current = zoom;
  }, [zoom, bounds, minZoom, fetchPincodes]);

  return {
    data,
    loading,
    error,
    cacheStats: {
      cachedPincodes: cachedPincodes.current.length,
      cacheCenter: cacheCenter.current,
    }
  };
}

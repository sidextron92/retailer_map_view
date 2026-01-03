'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Map, {
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
  Marker,
  MapRef
} from 'react-map-gl/mapbox';
import type { Retailer } from '@/types/retailer';
import { MAPBOX_TOKEN, DEFAULT_MAP_CONFIG, CLUSTER_CONFIG } from '@/lib/mapbox/config';
import { getMarkerColor } from '@/lib/utils/markers';
import { usePincodeBoundaries } from '@/hooks/usePincodeBoundaries';

interface MapViewProps {
  retailers: Retailer[];
  onMarkerClick: (retailer: Retailer) => void;
  onLocationChange?: (location: { latitude: number; longitude: number } | null) => void;
}

export function MapView({ retailers, onMarkerClick, onLocationChange }: MapViewProps) {
  const [viewState, setViewState] = useState(DEFAULT_MAP_CONFIG.initialViewState);
  const [cursor, setCursor] = useState<string>('auto');
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [overlappingRetailers, setOverlappingRetailers] = useState<Retailer[]>([]);
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get current map bounds for viewport-based queries
  const [mapBounds, setMapBounds] = useState<any>(null);

  // Lazy-load pincode boundaries based on zoom level and viewport
  const { data: pincodeData, loading: pincodeLoading } = usePincodeBoundaries({
    zoom: viewState.zoom,
    bounds: mapBounds,
    minZoom: 12, // Only load when zoomed to city/locality level
  });

  // Convert user location to GeoJSON format
  const userLocationGeojson = useMemo(() => {
    if (!userLocation) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Point' as const,
          coordinates: [userLocation.longitude, userLocation.latitude],
        },
      }],
    };
  }, [userLocation]);

  // Convert retailers to GeoJSON format
  const geojsonData = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: retailers.map((retailer) => ({
        type: 'Feature' as const,
        properties: {
          id: retailer.id,
          name: retailer.name,
          category: retailer.retailer_status,
          color: getMarkerColor(retailer),
          // Store full retailer data for click handling
          retailer: JSON.stringify(retailer),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [retailer.longitude, retailer.latitude],
        },
      })),
    };
  }, [retailers]);

  // Fit map to show all markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || retailers.length === 0) return;

    const map = mapRef.current.getMap();

    // Calculate bounds from all retailers
    const bounds = retailers.reduce(
      (acc, retailer) => {
        return {
          minLng: Math.min(acc.minLng, retailer.longitude),
          maxLng: Math.max(acc.maxLng, retailer.longitude),
          minLat: Math.min(acc.minLat, retailer.latitude),
          maxLat: Math.max(acc.maxLat, retailer.latitude),
        };
      },
      {
        minLng: retailers[0].longitude,
        maxLng: retailers[0].longitude,
        minLat: retailers[0].latitude,
        maxLat: retailers[0].latitude,
      }
    );

    // Fit map to bounds with padding
    map.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      {
        padding: 50,
        duration: 1000,
        maxZoom: 15,
      }
    );
  }, [retailers, mapLoaded]);

  // Handle cluster click - zoom to cluster bounds with smooth animation
  const handleClusterClick = useCallback((event: any) => {
    const feature = event.features?.[0];
    if (!feature || !mapRef.current) return;

    const map = mapRef.current.getMap();
    const clusterId = feature.properties.cluster_id;
    const [longitude, latitude] = feature.geometry.coordinates;

    // Get current zoom level
    const currentZoom = map.getZoom();

    // Animation options for smooth transition
    const animationOptions = {
      center: [longitude, latitude] as [number, number],
      duration: 1500, // Slower, smoother animation
      essential: true, // Animation will happen even if user has reduced motion preferences
      easing: (t: number) => t * (2 - t), // Ease-out quad for smooth deceleration
    };

    // Try to get cluster expansion zoom from source
    const mapboxSource = map.getSource('retailers') as any;

    if (mapboxSource && mapboxSource.getClusterExpansionZoom) {
      // Use Mapbox's cluster expansion zoom calculation
      mapboxSource.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) {
          // Fallback: zoom in by 2 levels
          const newZoom = Math.min(currentZoom + 2, 20);
          map.flyTo({
            ...animationOptions,
            zoom: newZoom,
          });
          return;
        }

        map.flyTo({
          ...animationOptions,
          zoom: zoom,
        });
      });
    } else {
      // Fallback: zoom in by 2 levels
      const newZoom = Math.min(currentZoom + 2, 20);
      map.flyTo({
        ...animationOptions,
        zoom: newZoom,
      });
    }
  }, []);

  // Handle marker click - show details or list if multiple at same location
  const handleMarkerClick = useCallback(
    (event: any) => {
      if (!mapRef.current) return;

      const map = mapRef.current.getMap();
      const point = event.point;

      // Query all features at the clicked point (within a small radius)
      const features = map.queryRenderedFeatures(
        [
          [point.x - 10, point.y - 10],
          [point.x + 10, point.y + 10],
        ],
        {
          layers: ['unclustered-point'],
        }
      );

      if (!features || features.length === 0) return;

      // Parse all retailers at this location
      const retailersAtLocation = features
        .filter((f) => f.properties && f.properties.retailer)
        .map((f) => JSON.parse(f.properties!.retailer));

      if (retailersAtLocation.length === 0) return;

      // If only one retailer, open it directly
      if (retailersAtLocation.length === 1) {
        onMarkerClick(retailersAtLocation[0]);
      } else {
        // Multiple retailers at same location - show selection dialog
        setOverlappingRetailers(retailersAtLocation);
        setShowOverlapDialog(true);
      }
    },
    [onMarkerClick]
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">
            Mapbox token not configured
          </p>
          <p className="text-sm text-gray-500">
            Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env.local file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          // Update bounds for pincode queries
          if (mapRef.current) {
            setMapBounds(mapRef.current.getBounds());
          }
        }}
        onLoad={() => {
          setMapLoaded(true);
          // Set initial bounds
          if (mapRef.current) {
            setMapBounds(mapRef.current.getBounds());
          }
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DEFAULT_MAP_CONFIG.mapStyle}
        style={{ width: '100%', height: '100%' }}
        maxZoom={20}
        minZoom={3}
        dragRotate={false}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        onMouseMove={(e) => {
          const features = e.features;
          if (features && features.length > 0) {
            setCursor('pointer');
          } else {
            setCursor('auto');
          }
        }}
        onMouseLeave={() => setCursor('auto')}
        onClick={(e) => {
          const features = e.features;

          if (!features || features.length === 0) return;

          const feature = features[0];

          // Check if it's a cluster
          if (feature.properties && (feature.properties.cluster || feature.properties.point_count)) {
            e.preventDefault();
            handleClusterClick(e);
          } else if (feature.layer && feature.layer.id === 'unclustered-point') {
            handleMarkerClick(e);
          }
        }}
        cursor={cursor}
      >
        {/* Navigation Controls */}
        <NavigationControl position="top-right" />

        {/* Geolocation Control */}
        <GeolocateControl
          position="top-right"
          trackUserLocation
          onGeolocate={(e) => {
            const location = {
              latitude: e.coords.latitude,
              longitude: e.coords.longitude,
            };
            setUserLocation(location);
            onLocationChange?.(location);
          }}
        />

        {/* Pincode Boundaries Layer - Only visible when zoomed in (minzoom: 12) */}
        {pincodeData && (
          <Source
            id="pincode-boundaries"
            type="geojson"
            data={pincodeData}
          >
            {/* Polygon fill - subtle background */}
            <Layer
              id="pincode-fill"
              type="fill"
              paint={{
                'fill-color': '#627BC1',
                'fill-opacity': 0.08,
              }}
              minzoom={12}
            />
            {/* Polygon outline - visible boundary lines */}
            <Layer
              id="pincode-outline"
              type="line"
              paint={{
                'line-color': '#627BC1',
                'line-width': 1,
                'line-opacity': 0.5,
              }}
              minzoom={12}
            />
          </Source>
        )}

        {/* Current Location Layer - Rendered first to appear below retailer markers */}
        {userLocationGeojson && (
          <Source
            id="user-location"
            type="geojson"
            data={userLocationGeojson}
          >
            {/* Outer pulsing circle */}
            <Layer
              id="user-location-pulse"
              type="circle"
              paint={{
                'circle-radius': 12,
                'circle-color': '#3B82F6',
                'circle-opacity': 0.3,
                'circle-blur': 0.5,
              }}
            />
            {/* Inner solid circle */}
            <Layer
              id="user-location-dot"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#3B82F6',
                'circle-opacity': 0.8,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FFFFFF',
              }}
            />
            {/* Center white dot */}
            <Layer
              id="user-location-center"
              type="circle"
              paint={{
                'circle-radius': 3,
                'circle-color': '#FFFFFF',
              }}
            />
          </Source>
        )}

        {/* Retailers Data Source with Clustering */}
        <Source
          id="retailers"
          type="geojson"
          data={geojsonData}
          cluster={true}
          clusterMaxZoom={CLUSTER_CONFIG.clusterMaxZoom}
          clusterRadius={CLUSTER_CONFIG.clusterRadius}
        >
          {/* Cluster circles */}
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                '#3498DB', // Blue for small clusters
                10,
                '#F39C12', // Orange for medium clusters
                30,
                '#E74C3C', // Red for large clusters
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                20, // Small clusters
                10,
                30, // Medium clusters
                30,
                40, // Large clusters
              ],
              'circle-opacity': 0.8,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
            layout={{
              'visibility': 'visible',
            }}
          />

          {/* Cluster count labels */}
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 14,
            }}
            paint={{
              'text-color': '#ffffff',
            }}
          />

          {/* Unclustered points (individual markers) */}
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['get', 'color'],
              'circle-radius': 12,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.9,
            }}
          />

          {/* Marker icons for unclustered points */}
          <Layer
            id="unclustered-point-icon"
            type="symbol"
            filter={['!', ['has', 'point_count']]}
            layout={{
              'icon-image': 'marker-15',
              'icon-size': 0.8,
              'icon-allow-overlap': true,
            }}
            paint={{
              'icon-color': '#ffffff',
            }}
          />
        </Source>
      </Map>

      {/* Retailer count badge */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-white px-4 py-2 shadow-lg">
        <p className="text-sm font-medium text-gray-700">
          {retailers.length} {retailers.length === 1 ? 'retailer' : 'retailers'}
        </p>
      </div>

      {/* Overlapping retailers selection dialog */}
      {showOverlapDialog && overlappingRetailers.length > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Multiple Retailers at This Location ({overlappingRetailers.length})
              </h3>
              <button
                onClick={() => {
                  setShowOverlapDialog(false);
                  setOverlappingRetailers([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Select a retailer to view details:
            </p>
            <div className="space-y-2">
              {overlappingRetailers.map((retailer) => (
                <button
                  key={retailer.id}
                  onClick={() => {
                    setShowOverlapDialog(false);
                    setOverlappingRetailers([]);
                    onMarkerClick(retailer);
                  }}
                  className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                >
                  <div className="font-medium text-gray-900">{retailer.name}</div>
                  <div className="mt-1 text-sm text-gray-600">{retailer.address}</div>
                  {retailer.trader_name && (
                    <div className="mt-1 text-xs text-gray-500">
                      Trader: {retailer.trader_name}
                    </div>
                  )}
                  {retailer.retailer_status && (
                    <div className="mt-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          retailer.retailer_status.toLowerCase() === 'active'
                            ? 'bg-green-100 text-green-800'
                            : retailer.retailer_status.toLowerCase() === 'idle'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {retailer.retailer_status}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

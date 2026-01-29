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
import type { Darkstore } from '@/types/darkstore';
import type { TamRetailer } from '@/types/tam-retailer';
import { MAPBOX_TOKEN, DEFAULT_MAP_CONFIG, CLUSTER_CONFIG } from '@/lib/mapbox/config';
import { getMarkerColor } from '@/lib/utils/markers';
import { usePincodeBoundaries } from '@/hooks/usePincodeBoundaries';
import { formatDeliveryTAT } from '@/lib/utils/delivery-tat';
import { calculateDistance, formatDistance } from '@/lib/utils/distance';

interface DistanceLine {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  distance: number;
  color: string;
}

interface MapViewProps {
  retailers: Retailer[];
  tamRetailers?: TamRetailer[];
  darkstore?: Darkstore | null;
  isOpsMode?: boolean;
  isTamMode?: boolean;
  onMarkerClick: (retailer: Retailer) => void;
  onLocationChange?: (location: { latitude: number; longitude: number; accuracy?: number } | null) => void;
  onZoomChange?: (zoom: number) => void;
  onPincodeLoadReady?: (loadPincodes: () => Promise<void>) => void;
  onPincodeDataStatus?: (isLoaded: boolean) => void;
  onPincodeDataUpdate?: (data: any) => void;
}

// Color palette for distance lines
const LINE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#14b8a6', // teal
];

export function MapView({ retailers, tamRetailers = [], darkstore, isOpsMode, isTamMode, onMarkerClick, onLocationChange, onZoomChange, onPincodeLoadReady, onPincodeDataStatus, onPincodeDataUpdate }: MapViewProps) {
  const [viewState, setViewState] = useState(DEFAULT_MAP_CONFIG.initialViewState);
  const [cursor, setCursor] = useState<string>('auto');
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [overlappingRetailers, setOverlappingRetailers] = useState<Retailer[]>([]);
  const [showOverlapDialog, setShowOverlapDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showDarkstorePopup, setShowDarkstorePopup] = useState(false);

  // Track if pincodes have been auto-loaded in TAM mode
  const tamPincodesAutoLoaded = useRef(false);
  const tamAutoLoadRetryCount = useRef(0);

  // Distance line drawing state (only in ops mode)
  const [distanceLines, setDistanceLines] = useState<DistanceLine[]>([]);
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [currentLineEnd, setCurrentLineEnd] = useState<{ lat: number; lng: number } | null>(null);

  // Pincode hover state
  const [hoveredPincode, setHoveredPincode] = useState<{
    pincode: string;
    office_name: string;
    deliverytat?: number | null;
    x: number;
    y: number;
  } | null>(null);

  // Get current map bounds for viewport-based queries
  const [mapBounds, setMapBounds] = useState<any>(null);

  // Lazy-load pincode boundaries based on zoom level and viewport
  const { data: pincodeData, loading: pincodeLoading, error: pincodeError, fetchPincodes, cacheStats } = usePincodeBoundaries({
    zoom: viewState.zoom,
    bounds: mapBounds,
    minZoom: 8, // Only load when zoomed to country/region level (more zoomed out)
    persistCache: isTamMode, // In TAM mode, keep pincodes visible even when zoomed out
  });

  // Notify parent about zoom changes
  useEffect(() => {
    onZoomChange?.(viewState.zoom);
  }, [viewState.zoom, onZoomChange]);

  // Notify parent about pincode data loaded status
  useEffect(() => {
    onPincodeDataStatus?.(!!pincodeData);
  }, [pincodeData, onPincodeDataStatus]);

  // Notify parent about pincode data updates (for TAM mode)
  useEffect(() => {
    if (pincodeData) {
      onPincodeDataUpdate?.(pincodeData);
    }
  }, [pincodeData, onPincodeDataUpdate]);

  // Create stable load function that returns a promise
  const loadPincodesHandler = useCallback(async () => {
    if (!mapBounds) return;
    const centerLng = (mapBounds.getWest() + mapBounds.getEast()) / 2;
    const centerLat = (mapBounds.getSouth() + mapBounds.getNorth()) / 2;
    await fetchPincodes(centerLng, centerLat);
  }, [mapBounds, fetchPincodes]);

  // Notify parent about pincode load function (only once when map is ready)
  useEffect(() => {
    if (!onPincodeLoadReady || !mapBounds) return;
    onPincodeLoadReady(loadPincodesHandler);
  }, [onPincodeLoadReady, mapBounds, loadPincodesHandler]);

  // Auto-load pincodes in TAM mode when darkstore is available (with 1 retry)
  useEffect(() => {
    if (!isTamMode || !darkstore || !mapLoaded || tamPincodesAutoLoaded.current) {
      console.log('🟡 TAM Mode auto-load check:', {
        isTamMode,
        hasDarkstore: !!darkstore,
        mapLoaded,
        alreadyLoaded: tamPincodesAutoLoaded.current
      });
      return;
    }

    // Auto-load pincodes centered on darkstore
    const autoLoadPincodes = async () => {
      const maxRetries = 1;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`🟡 TAM Mode: Retrying auto-load (attempt ${attempt + 1}/${maxRetries + 1})`);
            // Wait 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log('🟡 TAM Mode: Auto-loading pincodes for darkstore:', darkstore.darkstore);
          }

          await fetchPincodes(darkstore.longitude, darkstore.latitude);

          // Success - mark as loaded
          tamPincodesAutoLoaded.current = true;
          tamAutoLoadRetryCount.current = 0;
          console.log('✅ TAM Mode: Pincodes auto-loaded successfully');
          return;
        } catch (error) {
          console.error(`❌ TAM Mode auto-load failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
          tamAutoLoadRetryCount.current = attempt + 1;

          // If this was the last attempt, give up
          if (attempt === maxRetries) {
            console.warn('⚠️ TAM Mode: Auto-load failed after retry. User can manually load via CTA.');
            // Don't mark as loaded so the effect won't run again on re-mount
            return;
          }
        }
      }
    };

    autoLoadPincodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTamMode, darkstore, mapLoaded]);

  // Reset auto-load flag when leaving TAM mode
  useEffect(() => {
    if (!isTamMode) {
      tamPincodesAutoLoaded.current = false;
      tamAutoLoadRetryCount.current = 0;
    }
  }, [isTamMode]);

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

  // Get next line color
  const getNextLineColor = useCallback(() => {
    return LINE_COLORS[distanceLines.length % LINE_COLORS.length];
  }, [distanceLines.length]);

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

  // Convert TAM retailers to GeoJSON format (purple/magenta color)
  const tamGeojsonData = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: tamRetailers.map((tamRetailer) => ({
        type: 'Feature' as const,
        properties: {
          id: tamRetailer.id,
          name: tamRetailer.shop_name || 'Unnamed Shop',
          color: '#9333ea', // Purple color for TAM retailers
          isTamRetailer: true,
          // Store full tam retailer data for click handling
          tamRetailer: JSON.stringify(tamRetailer),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [tamRetailer.longitude, tamRetailer.latitude],
        },
      })),
    };
  }, [tamRetailers]);

  // Convert distance lines to GeoJSON format
  const distanceLinesGeoJSON = useMemo(() => {
    const allLines = [...distanceLines];

    // Add current drawing line if active
    if (isDrawingLine && currentLineEnd && darkstore) {
      const currentDistance = calculateDistance(
        darkstore.latitude,
        darkstore.longitude,
        currentLineEnd.lat,
        currentLineEnd.lng
      );

      allLines.push({
        id: 'current-drawing',
        startLat: darkstore.latitude,
        startLng: darkstore.longitude,
        endLat: currentLineEnd.lat,
        endLng: currentLineEnd.lng,
        distance: currentDistance,
        color: getNextLineColor(),
      });
    }

    return {
      type: 'FeatureCollection' as const,
      features: allLines.map((line) => ({
        type: 'Feature' as const,
        properties: {
          id: line.id,
          color: line.color,
          distance: line.distance,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [line.startLng, line.startLat],
            [line.endLng, line.endLat],
          ],
        },
      })),
    };
  }, [distanceLines, isDrawingLine, currentLineEnd, darkstore, getNextLineColor]);

  // Fit map to show all markers (only if no darkstore)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || retailers.length === 0 || darkstore) return;

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
  }, [retailers, mapLoaded, darkstore]);

  // Auto-center to darkstore location when loaded
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !darkstore) return;

    const map = mapRef.current.getMap();

    // Fly to darkstore location
    map.flyTo({
      center: [darkstore.longitude, darkstore.latitude],
      zoom: 14,
      duration: 1500,
      essential: true,
    });
  }, [darkstore, mapLoaded]);

  // Clear distance lines when leaving ops mode
  useEffect(() => {
    if (!isOpsMode) {
      setDistanceLines([]);
      setIsDrawingLine(false);
      setCurrentLineEnd(null);
    }
  }, [isOpsMode]);

  // Handle darkstore marker mouse down - start drawing (only in ops mode)
  const handleDarkstoreMouseDown = useCallback((e: any) => {
    if (!isOpsMode || !darkstore || isTamMode) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDrawingLine(true);
    setCurrentLineEnd({ lat: darkstore.latitude, lng: darkstore.longitude });
  }, [isOpsMode, darkstore, isTamMode]);

  // Handle map mouse move - update line end position
  const handleMapMouseMove = useCallback((e: any) => {
    if (!isDrawingLine || !darkstore) return;
    const { lng, lat } = e.lngLat;
    setCurrentLineEnd({ lat, lng });
  }, [isDrawingLine, darkstore]);

  // Handle mouse up - finalize line
  const handleMouseUp = useCallback(() => {
    if (!isDrawingLine || !currentLineEnd || !darkstore) return;

    const distance = calculateDistance(
      darkstore.latitude,
      darkstore.longitude,
      currentLineEnd.lat,
      currentLineEnd.lng
    );

    const newLine: DistanceLine = {
      id: `line-${Date.now()}`,
      startLat: darkstore.latitude,
      startLng: darkstore.longitude,
      endLat: currentLineEnd.lat,
      endLng: currentLineEnd.lng,
      distance,
      color: getNextLineColor(),
    };

    setDistanceLines((prev) => [...prev, newLine]);
    setIsDrawingLine(false);
    setCurrentLineEnd(null);
  }, [isDrawingLine, currentLineEnd, darkstore, getNextLineColor]);

  // Delete distance line
  const deleteLine = useCallback((lineId: string) => {
    setDistanceLines((prev) => prev.filter((line) => line.id !== lineId));
  }, []);

  // Clear all distance lines
  const clearAllLines = useCallback(() => {
    setDistanceLines([]);
  }, []);

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
        interactiveLayerIds={['clusters', 'unclustered-point', 'tam-retailer-point', 'pincode-fill', 'pincode-outline']}
        onMouseMove={(e) => {
          // Handle distance line drawing
          handleMapMouseMove(e);

          const features = e.features;

          // Check for pincode hover
          const pincodeFeature = features?.find(
            f => f.layer?.id === 'pincode-fill' || f.layer?.id === 'pincode-outline'
          );

          if (pincodeFeature && pincodeFeature.properties) {
            setHoveredPincode({
              pincode: pincodeFeature.properties.pincode || '',
              office_name: pincodeFeature.properties.office_name || '',
              deliverytat: pincodeFeature.properties.deliverytat,
              x: e.point.x,
              y: e.point.y,
            });
            setCursor('pointer');
          } else if (features && features.length > 0) {
            setHoveredPincode(null);
            setCursor('pointer');
          } else {
            setHoveredPincode(null);
            setCursor('auto');
          }
        }}
        onMouseLeave={() => {
          setCursor('auto');
          setHoveredPincode(null);
        }}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          const features = e.features;

          if (!features || features.length === 0) return;

          // Filter out pincode layers - prioritize markers and clusters
          const clickableFeature = features.find(
            f => f.layer?.id !== 'pincode-fill' && f.layer?.id !== 'pincode-outline'
          );

          if (!clickableFeature) return;

          // Create a modified event with only the clickable feature
          const modifiedEvent = {
            ...e,
            features: [clickableFeature]
          };

          // Check if it's a TAM retailer
          if (clickableFeature.layer && clickableFeature.layer.id === 'tam-retailer-point') {
            // Handle TAM retailer click
            if (clickableFeature.properties && clickableFeature.properties.tamRetailer) {
              const tamRetailer = JSON.parse(clickableFeature.properties.tamRetailer);
              console.log('TAM Retailer clicked:', tamRetailer);
              // TODO: Show TAM retailer detail modal
              alert(`TAM Retailer: ${tamRetailer.shop_name || 'Unnamed Shop'}\nPincode: ${tamRetailer.pincode}\nCategories: ${tamRetailer.category_tags.join(', ') || 'None'}`);
            }
          }
          // Check if it's a cluster
          else if (clickableFeature.properties && (clickableFeature.properties.cluster || clickableFeature.properties.point_count)) {
            e.preventDefault();
            handleClusterClick(modifiedEvent);
          } else if (clickableFeature.layer && clickableFeature.layer.id === 'unclustered-point') {
            handleMarkerClick(modifiedEvent);
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
              accuracy: e.coords.accuracy,
            };
            setUserLocation(location);
            onLocationChange?.(location);
          }}
        />

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

        {/* TAM Retailers Data Source (no clustering, distinct color) */}
        {isTamMode && tamRetailers.length > 0 && (
          <Source
            id="tam-retailers"
            type="geojson"
            data={tamGeojsonData}
          >
            {/* TAM Retailer markers */}
            <Layer
              id="tam-retailer-point"
              type="circle"
              paint={{
                'circle-color': ['get', 'color'],
                'circle-radius': 14,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.95,
              }}
            />

            {/* TAM Marker icons */}
            <Layer
              id="tam-retailer-icon"
              type="symbol"
              layout={{
                'icon-image': 'marker-15',
                'icon-size': 0.9,
                'icon-allow-overlap': true,
              }}
              paint={{
                'icon-color': '#ffffff',
              }}
            />
          </Source>
        )}

        {/* Pincode Boundaries Layer - Rendered last but placed at bottom of visual stack */}
        {pincodeData && (
          <Source
            id="pincode-boundaries"
            type="geojson"
            data={pincodeData}
          >
            {/* Polygon fill - varied colors for each pincode, rendered at the very bottom */}
            <Layer
              id="pincode-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'fillColor'],
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.15,
                  0.04
                ],
              }}
              minzoom={8}
              beforeId="clusters"
            />
            {/* Polygon outline - varied colors, rendered at bottom */}
            <Layer
              id="pincode-outline"
              type="line"
              paint={{
                'line-color': ['get', 'outlineColor'],
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  2.5,
                  1.2
                ],
                'line-opacity': 0.6,
              }}
              minzoom={8}
              beforeId="clusters"
            />
          </Source>
        )}

        {/* Distance Lines Layer */}
        {isOpsMode && distanceLinesGeoJSON.features.length > 0 && (
          <Source
            id="distance-lines"
            type="geojson"
            data={distanceLinesGeoJSON}
          >
            <Layer
              id="distance-lines-layer"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 3,
                'line-opacity': 0.8,
              }}
            />
          </Source>
        )}

        {/* Darkstore Marker */}
        {darkstore && (
          <Marker
            longitude={darkstore.longitude}
            latitude={darkstore.latitude}
            anchor="bottom"
            onClick={(e) => {
              // Only allow interaction in ops mode, not in TAM mode
              if (!isTamMode && (!isOpsMode || isDrawingLine)) {
                e.originalEvent.stopPropagation();
                setShowDarkstorePopup(true);
              }
            }}
          >
            <div
              className={isTamMode ? "cursor-default" : "cursor-pointer"}
              onMouseDown={handleDarkstoreMouseDown}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40px" height="40px" fill="#1e3a8a">
                <path d="M 12 2 A 1 1 0 0 0 11.289062 2.296875 L 1.203125 11.097656 A 0.5 0.5 0 0 0 1 11.5 A 0.5 0.5 0 0 0 1.5 12 L 4 12 L 4 20 C 4 20.552 4.448 21 5 21 L 9 21 C 9.552 21 10 20.552 10 20 L 10 14 L 14 14 L 14 20 C 14 20.552 14.448 21 15 21 L 19 21 C 19.552 21 20 20.552 20 20 L 20 12 L 22.5 12 A 0.5 0.5 0 0 0 23 11.5 A 0.5 0.5 0 0 0 22.796875 11.097656 L 12.716797 2.3027344 A 1 1 0 0 0 12.710938 2.296875 A 1 1 0 0 0 12 2 z"/>
              </svg>
            </div>
          </Marker>
        )}
      </Map>

      {/* Retailer count badge and Clear All Lines button */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="rounded-lg bg-white px-4 py-2 shadow-lg">
          <p className="text-sm font-medium text-gray-700">
            {isTamMode
              ? `${tamRetailers.length} TAM ${tamRetailers.length === 1 ? 'retailer' : 'retailers'}`
              : `${retailers.length} ${retailers.length === 1 ? 'retailer' : 'retailers'}`}
          </p>
        </div>

        {/* Clear All Lines Button - Only visible in ops mode with lines */}
        {isOpsMode && distanceLines.length > 0 && (
          <button
            onClick={clearAllLines}
            className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-2 shadow-lg text-sm font-medium transition-colors"
          >
            Clear All Lines ({distanceLines.length})
          </button>
        )}
      </div>

      {/* Distance Line Tooltips */}
      {isOpsMode && distanceLines.map((line) => {
        if (!mapRef.current) return null;

        const map = mapRef.current.getMap();
        const point = map.project([line.endLng, line.endLat]);

        return (
          <div
            key={line.id}
            className="absolute z-40 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white shadow-lg"
            style={{
              left: point.x,
              top: point.y - 40,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
            }}
          >
            <span>{formatDistance(line.distance)}</span>
            <button
              onClick={() => deleteLine(line.id)}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}

      {/* Current Drawing Line Tooltip */}
      {isOpsMode && isDrawingLine && currentLineEnd && darkstore && mapRef.current && (
        <div
          className="absolute z-40 rounded-lg px-3 py-2 text-sm font-medium text-white shadow-lg pointer-events-none"
          style={{
            left: mapRef.current.getMap().project([currentLineEnd.lng, currentLineEnd.lat]).x,
            top: mapRef.current.getMap().project([currentLineEnd.lng, currentLineEnd.lat]).y - 40,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
          }}
        >
          {formatDistance(calculateDistance(darkstore.latitude, darkstore.longitude, currentLineEnd.lat, currentLineEnd.lng))}
        </div>
      )}

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

      {/* Pincode hover tooltip */}
      {hoveredPincode && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg"
          style={{
            left: hoveredPincode.x + 10,
            top: hoveredPincode.y + 10,
          }}
        >
          <div className="font-semibold">PIN: {hoveredPincode.pincode}</div>
          {hoveredPincode.office_name && (
            <div className="text-xs text-gray-300">{hoveredPincode.office_name}</div>
          )}
          {/* Delivery TAT */}
          <div className={`text-xs font-medium mt-1 ${
            hoveredPincode.deliverytat === null || hoveredPincode.deliverytat === undefined
              ? 'text-red-400'
              : 'text-green-400'
          }`}>
            {formatDeliveryTAT(hoveredPincode.deliverytat)}
          </div>
        </div>
      )}

      {/* Darkstore Popup */}
      {showDarkstorePopup && darkstore && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Darkstore Location
              </h3>
              <button
                onClick={() => setShowDarkstorePopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-base font-semibold text-gray-900">{darkstore.darkstore}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <p className="text-base text-gray-900">{darkstore.address}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Latitude</label>
                  <p className="text-sm text-gray-900">{darkstore.latitude}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Longitude</label>
                  <p className="text-sm text-gray-900">{darkstore.longitude}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

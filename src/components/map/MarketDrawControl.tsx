'use client';

import { useEffect, useRef, useState } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl, useMap } from 'react-map-gl/mapbox';
import type { ControlPosition } from 'react-map-gl/mapbox';
import type { DrawCreateEvent, DrawUpdateEvent, DrawDeleteEvent, DrawModeChangeEvent } from '@mapbox/mapbox-gl-draw';
import type { Polygon, FeatureCollection } from 'geojson';

// Custom mapbox-gl-draw styles based on the default theme, with the first polygon
// vertex highlighted so users can easily close the shape by clicking it.
const DRAW_STYLES = [
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': ['case', ['==', ['get', 'active'], 'true'], '#f97316', '#3b82f6'],
      'fill-opacity': 0.15,
    },
  },
  {
    id: 'gl-draw-lines',
    type: 'line',
    filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ['case', ['==', ['get', 'active'], 'true'], '#f97316', '#3b82f6'],
      'line-dasharray': ['case', ['==', ['get', 'active'], 'true'], [0.2, 2], [2, 0]],
      'line-width': 2.5,
    },
  },
  {
    id: 'gl-draw-point-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
      'circle-color': '#fff',
    },
  },
  {
    id: 'gl-draw-point-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': ['case', ['==', ['get', 'active'], 'true'], '#f97316', '#3b82f6'],
    },
  },
  {
    id: 'gl-draw-vertex-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 8, 6],
      'circle-color': '#fff',
    },
  },
  {
    id: 'gl-draw-vertex-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': ['case', ['==', ['get', 'active'], 'true'], '#ef4444', '#f97316'],
    },
  },
  {
    id: 'gl-draw-vertex-first-outer',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'vertex'],
      ['==', 'active', 'true'],
      ['==', 'coord_path', '0.0'],
    ],
    paint: {
      'circle-radius': 11,
      'circle-color': '#fff',
    },
  },
  {
    id: 'gl-draw-vertex-first-inner',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'vertex'],
      ['==', 'active', 'true'],
      ['==', 'coord_path', '0.0'],
    ],
    paint: {
      'circle-radius': 7,
      'circle-color': '#dc2626',
    },
  },
  {
    id: 'gl-draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 3,
      'circle-color': '#f97316',
    },
  },
];

interface MarketDrawControlProps {
  position?: ControlPosition;
  features?: FeatureCollection<Polygon>;
  drawing?: boolean;
  editingFeatureId?: string | null;
  onCreate?: (polygon: Polygon) => void;
  onUpdate?: (featureId: string, polygon: Polygon) => void;
  onDelete?: (featureId: string) => void;
  onSelectionChange?: (featureId: string | null) => void;
  onModeChange?: (mode: string) => void;
}

function polygonFeatureCollectionToDrawFeatures(
  collection: FeatureCollection<Polygon> | undefined
) {
  if (!collection) return { type: 'FeatureCollection' as const, features: [] };
  return {
    type: 'FeatureCollection' as const,
    features: collection.features.map((feature) => ({
      ...feature,
      id: feature.properties?.id ?? feature.id,
    })),
  };
}

export function MarketDrawControl({
  position,
  features,
  drawing = false,
  editingFeatureId = null,
  onCreate,
  onUpdate,
  onDelete,
  onSelectionChange,
  onModeChange,
}: MarketDrawControlProps) {
  const [isReady, setIsReady] = useState(false);
  const mapRef = useMap().current;

  // Keep callbacks accessible inside stable event listeners
  const callbacksRef = useRef({ onCreate, onUpdate, onDelete, onSelectionChange, onModeChange });
  useEffect(() => {
    callbacksRef.current = { onCreate, onUpdate, onDelete, onSelectionChange, onModeChange };
  }, [onCreate, onUpdate, onDelete, onSelectionChange, onModeChange]);

  const draw = useControl(
    () => {
      return new MapboxDraw({
          displayControlsDefault: false,
          defaultMode: 'simple_select',
          clickBuffer: 10,
          touchBuffer: 25,
          styles: DRAW_STYLES,
        });
    },
    () => {
      setIsReady(true);
    },
    () => {
      setIsReady(false);
    },
    { position }
  );

  // Sync external features into draw control
  useEffect(() => {
    if (!isReady) return;

    const currentMode = draw.getMode();
    // Avoid overwriting a polygon the user is currently drawing or editing
    if (currentMode === 'draw_polygon' || currentMode === 'direct_select') {
      return;
    }

    draw.set(polygonFeatureCollectionToDrawFeatures(features));
  }, [draw, features, isReady]);

  // Drive drawing / editing mode from props
  useEffect(() => {
    if (!isReady) return;

    if (drawing) {
      draw.changeMode('draw_polygon');
      return;
    }

    if (editingFeatureId) {
      draw.changeMode('direct_select', { featureId: editingFeatureId });
      return;
    }

    // Return to simple select when neither drawing nor editing
    draw.changeMode('simple_select');
  }, [draw, drawing, editingFeatureId, features, isReady]);

  // Attach draw event listeners
  useEffect(() => {
    if (!mapRef?.getMap || !isReady) return;

    const map = mapRef.getMap();

    const handleCreate = (e: DrawCreateEvent) => {
      const feature = e.features[0];
      if (feature?.geometry.type === 'Polygon') {
        callbacksRef.current.onCreate?.(feature.geometry);
      }
    };

    const handleUpdate = (e: DrawUpdateEvent) => {
      const feature = e.features[0];
      if (feature?.geometry.type === 'Polygon') {
        callbacksRef.current.onUpdate?.(String(feature.id), feature.geometry);
      }
    };

    const handleDelete = (e: DrawDeleteEvent) => {
      const feature = e.features[0];
      if (feature?.id) {
        callbacksRef.current.onDelete?.(String(feature.id));
      }
    };

    const handleSelectionChange = () => {
      const selected = draw.getSelectedIds();
      callbacksRef.current.onSelectionChange?.(selected[0] ?? null);
    };

    const handleModeChange = (e: DrawModeChangeEvent) => {
      callbacksRef.current.onModeChange?.(e.mode);
    };

    map.on('draw.create', handleCreate);
    map.on('draw.update', handleUpdate);
    map.on('draw.delete', handleDelete);
    map.on('draw.selectionchange', handleSelectionChange);
    map.on('draw.modechange', handleModeChange);

    return () => {
      map.off('draw.create', handleCreate);
      map.off('draw.update', handleUpdate);
      map.off('draw.delete', handleDelete);
      map.off('draw.selectionchange', handleSelectionChange);
      map.off('draw.modechange', handleModeChange);
    };
  }, [draw, mapRef, isReady]);

  return null;
}

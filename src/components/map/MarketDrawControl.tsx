'use client';

import { useEffect, useRef, useState } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useControl, useMap } from 'react-map-gl/mapbox';
import type { ControlPosition } from 'react-map-gl/mapbox';
import type { DrawCreateEvent, DrawUpdateEvent, DrawDeleteEvent } from '@mapbox/mapbox-gl-draw';
import type { Polygon, FeatureCollection } from 'geojson';

interface MarketDrawControlProps {
  position?: ControlPosition;
  features?: FeatureCollection<Polygon>;
  drawing?: boolean;
  editingFeatureId?: string | null;
  onCreate?: (polygon: Polygon) => void;
  onUpdate?: (featureId: string, polygon: Polygon) => void;
  onDelete?: (featureId: string) => void;
  onSelectionChange?: (featureId: string | null) => void;
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
}: MarketDrawControlProps) {
  const [isReady, setIsReady] = useState(false);
  const mapRef = useMap().current;

  // Keep callbacks accessible inside stable event listeners
  const callbacksRef = useRef({ onCreate, onUpdate, onDelete, onSelectionChange });
  useEffect(() => {
    callbacksRef.current = { onCreate, onUpdate, onDelete, onSelectionChange };
  }, [onCreate, onUpdate, onDelete, onSelectionChange]);

  const draw = useControl(
    () => {
      return new MapboxDraw({
        displayControlsDefault: false,
        defaultMode: 'simple_select',
        clickBuffer: 10,
        touchBuffer: 25,
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

    map.on('draw.create', handleCreate);
    map.on('draw.update', handleUpdate);
    map.on('draw.delete', handleDelete);
    map.on('draw.selectionchange', handleSelectionChange);

    return () => {
      map.off('draw.create', handleCreate);
      map.off('draw.update', handleUpdate);
      map.off('draw.delete', handleDelete);
      map.off('draw.selectionchange', handleSelectionChange);
    };
  }, [draw, mapRef, isReady]);

  return null;
}

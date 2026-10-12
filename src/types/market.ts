import type { Polygon } from 'geojson';

export interface MarketBoundary {
  id: string;
  name: string;
  darkstore_id: number;
  darkstore: string;
  geometry: Polygon;
  created_at: string | null;
  updated_at: string | null;
}

export interface MarketBoundaryFeatureProperties {
  id: string;
  name: string;
  darkstore_id: number;
  darkstore: string;
  fillColor: string;
  outlineColor: string;
}

export type ViewMode = 'pincode' | 'markets';

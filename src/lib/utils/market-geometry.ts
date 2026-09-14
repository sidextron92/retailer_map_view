import area from '@turf/area';
import kinks from '@turf/kinks';
import booleanCrosses from '@turf/boolean-crosses';
import { lineString } from '@turf/helpers';
import type { Polygon, Feature, LineString, Position } from 'geojson';

export interface MarketValidationResult {
  valid: boolean;
  errors: string[];
}

const MIN_AREA_SQM = 200;

function polygonToFeature(polygon: Polygon): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: polygon,
  };
}

function getBoundaryLine(polygon: Polygon): Feature<LineString> {
  return lineString(polygon.coordinates[0]);
}

/**
 * Validate a market polygon before saving.
 * - Must have at least 3 distinct points (closed polygon).
 * - Area must be >= 200 m².
 * - Must not self-intersect.
 * - Boundary must not cross any existing market boundary (overlapping interiors are allowed).
 */
export function validateMarketPolygon(
  polygon: Polygon,
  existingMarkets: Polygon[] = []
): MarketValidationResult {
  const errors: string[] = [];

  // Check ring structure
  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    errors.push('Polygon has no coordinates.');
    return { valid: false, errors };
  }

  const outerRing = polygon.coordinates[0];
  const distinctPoints = new Set(outerRing.map((coord) => `${coord[0]},${coord[1]}`)).size;

  if (distinctPoints < 4) {
    // A closed polygon needs at least 4 coordinates (3 distinct points + closing point)
    errors.push('A market must have at least 3 distinct points.');
  }

  // Area check
  const areaSqm = area(polygonToFeature(polygon));
  if (areaSqm < MIN_AREA_SQM) {
    errors.push(`Market area must be at least ${MIN_AREA_SQM} m² (current: ${Math.round(areaSqm)} m²).`);
  }

  // Self-intersection check
  const selfIntersections = kinks(polygonToFeature(polygon));
  if (selfIntersections.features.length > 0) {
    errors.push('Market boundary must not cross itself.');
  }

  // Boundary crossing with existing markets.
  // We compare the boundary LineStrings rather than the Polygon geometries so that
  // overlapping interiors are allowed but boundary lines cannot cross.
  const newBoundary = getBoundaryLine(polygon);
  for (const existing of existingMarkets) {
    if (booleanCrosses(newBoundary, getBoundaryLine(existing))) {
      errors.push('Market boundary must not cross an existing market boundary.');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate area of a polygon in square meters.
 */
export function getMarketAreaSqm(polygon: Polygon): number {
  return area(polygonToFeature(polygon));
}

/**
 * Convert square meters to a human-readable string.
 */
export function formatMarketArea(areaSqm: number): string {
  if (areaSqm >= 1_000_000) {
    return `${(areaSqm / 1_000_000).toFixed(2)} km²`;
  }
  if (areaSqm >= 10_000) {
    return `${(areaSqm / 10_000).toFixed(2)} ha`;
  }
  return `${Math.round(areaSqm)} m²`;
}

/**
 * Ensure a polygon ring is closed (last coordinate equals first).
 */
export function closePolygonRing(ring: Position[]): Position[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, first];
  }
  return ring;
}

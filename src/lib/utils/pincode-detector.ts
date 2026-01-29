/**
 * Detects the pincode from user's location by checking which pincode boundary contains the point
 * Uses point-in-polygon algorithm
 */
export function detectPincodeFromLocation(
  latitude: number,
  longitude: number,
  pincodeData: any
): string | null {
  if (!pincodeData || !pincodeData.features) {
    return null;
  }

  // Check each pincode boundary
  for (const feature of pincodeData.features) {
    if (isPointInPolygon(latitude, longitude, feature.geometry)) {
      return feature.properties.pincode;
    }
  }

  return null;
}

/**
 * Check if a point is inside a polygon or multipolygon
 */
function isPointInPolygon(lat: number, lng: number, geometry: any): boolean {
  if (!geometry) return false;

  if (geometry.type === 'Polygon') {
    return isPointInPolygonRings(lat, lng, geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    // Check each polygon in the multipolygon
    for (const polygon of geometry.coordinates) {
      if (isPointInPolygonRings(lat, lng, polygon)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

/**
 * Check if point is inside polygon rings (outer ring and holes)
 */
function isPointInPolygonRings(lat: number, lng: number, rings: number[][][]): boolean {
  // Check outer ring (first ring)
  if (!isPointInRing(lat, lng, rings[0])) {
    return false;
  }

  // Check holes (subsequent rings) - point should NOT be in holes
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(lat, lng, rings[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Ray casting algorithm to check if point is inside a ring
 */
function isPointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  const x = lng;
  const y = lat;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

# Pincode Radius-Based Query System

This document explains the radius-based pincode query system implemented to fix inconsistent rendering issues.

---

## Problem Solved

### Previous Issue (Viewport-Based)
- ❌ Some pincodes didn't render even when visible
- ❌ Zoom out → missing pincodes suddenly appear
- ❌ Large polygons with first coordinate outside viewport were filtered out
- ❌ Inconsistent rendering based on viewport edges

### New Solution (Radius-Based)
- ✅ Fetch all pincodes within radius of map center
- ✅ Consistent rendering regardless of pan/zoom direction
- ✅ No missing pincodes at any zoom level
- ✅ Radius scales with zoom for optimal performance

---

## How It Works

### 1. Center Point Detection
Instead of viewport bounding box, we use **map center coordinates**:

```typescript
const centerLng = (bounds.getWest() + bounds.getEast()) / 2;
const centerLat = (bounds.getSouth() + bounds.getNorth()) / 2;
```

### 2. Zoom-Based Radius Scaling

Radius automatically adjusts based on zoom level:

| Zoom Level | Radius | Coverage Area |
|------------|--------|---------------|
| 10 | 100 km | State level |
| 11 | 70 km | Large city |
| 12 | 50 km | City level |
| 13 | 35 km | District |
| 14 | 25 km | Neighborhood |
| 15+ | 15 km | Locality level |

**Why scaling?**
- Lower zoom (state view) → need more pincodes
- Higher zoom (street view) → fewer pincodes needed
- Better performance at all zoom levels

### 3. Circular Query (PostGIS ST_DWithin)

Database uses accurate circular distance calculation:

```sql
SELECT * FROM pincode_boundaries
WHERE ST_DWithin(
  geometry::geography,
  ST_MakePoint(center_lng, center_lat)::geography,
  radius_km * 1000  -- Convert km to meters
);
```

**Advantages:**
- Accurate distance calculation using Earth's curvature
- Uses PostGIS spatial indexes (fast!)
- No corner artifacts from rectangular boxes

### 4. Circular Cache Regions

Cache stores fetched circles instead of rectangles:

```typescript
interface CachedCircle {
  centerLng: number;
  centerLat: number;
  radius: number;  // in km
}
```

**Cache Hit Logic:**
```typescript
// Check if new center is within cached circle
const distance = haversineDistance(
  newCenter.lat, newCenter.lng,
  cachedCenter.lat, cachedCenter.lng
);

if (distance + newRadius <= cachedRadius * 1.1) {
  // Cache HIT - use cached pincodes
}
```

---

## Console Logs

You'll see more informative logs:

```
🗺️  Fetching pincodes by radius: {
  center: { lat: "28.6139", lng: "77.2090" },
  radius: "50km",
  zoom: 12
}
✅ Loaded 127 new pincodes in 0.18s
📊 Cache: 127 total, 0% hit rate, 1 areas cached

✨ Cache HIT - using cached pincodes (no Supabase query needed)
   Cached circle center: (28.614, 77.209), radius: 50km
📦 Loaded 127 pincodes from cache
```

---

## Migration Required

Run the new migration to add the radius-based query function:

### Using Supabase CLI
```bash
supabase db push
```

### Using Supabase Dashboard
1. Go to SQL Editor
2. Run `supabase/migrations/005_add_radius_based_pincode_query.sql`

---

## Performance Comparison

### Before (Viewport-Based)
- Query area: Rectangular bounding box
- Zoom 10: ~80-150 pincodes
- Issue: Missing pincodes at viewport edges
- Cache: Rectangular regions

### After (Radius-Based)
- Query area: Circular radius
- Zoom 10 (100km radius): ~150-300 pincodes
- Benefit: All visible pincodes guaranteed loaded
- Cache: Circular regions with better hit rate

---

## Testing

### Visual Test
1. Refresh browser
2. Zoom to level 10 over any area
3. **Check:** All pincode boundaries should render immediately
4. Pan in any direction
5. **Check:** No missing pincodes, consistent rendering

### Console Test
```javascript
// Watch console logs:
🗺️  Fetching pincodes by radius: {
  center: { lat: "28.6139", lng: "77.2090" },
  radius: "100km",  // ← Note radius based on zoom
  zoom: 10
}
```

### Cache Test
1. Pan to Delhi (zoom 12)
2. Note: Fetches ~127 pincodes with 50km radius
3. Pan around Delhi
4. Pan back to original position
5. **Check:** See "✨ Cache HIT" - no new fetch!

---

## Technical Details

### Haversine Distance Formula

Used for cache checking:

```typescript
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
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
```

### Cache Buffer

Cached circles have a **10% buffer** to reduce edge fetches:

```typescript
if (distance + radius <= cached.radius * 1.1) {
  // Cache hit with 10% buffer
}
```

---

## Benefits Summary

✅ **Consistent Rendering** - No more missing pincodes
✅ **Zoom-Adaptive** - Radius scales automatically
✅ **Better Performance** - Circular cache with higher hit rate
✅ **Accurate Distance** - PostGIS geography type
✅ **Spatial Indexes** - Fast database queries
✅ **User-Friendly** - Seamless experience at all zoom levels

---

## Troubleshooting

### Issue: Pincodes still missing
**Check:**
1. Migration 005 ran successfully
2. Function `get_pincodes_by_radius` exists in database
3. Console shows radius-based logs (not viewport-based)

### Issue: Performance slow at zoom 10
**Solution:** Reduce radius at zoom 10:
```typescript
if (zoom <= 10) return 75;  // Reduced from 100km
```

### Issue: Too frequent fetches
**Increase debounce:**
```typescript
debounceTimerRef.current = setTimeout(() => {
  fetchPincodes(...);
}, 500);  // Increased from 300ms
```

---

## Future Enhancements

Potential improvements:
1. **Predictive prefetching** - Fetch adjacent circles based on pan direction
2. **Elliptical queries** - Match viewport aspect ratio
3. **Adaptive radius** - Auto-adjust based on pincode density
4. **Cache compression** - Store simplified geometries
5. **Background updates** - Refresh cached regions periodically

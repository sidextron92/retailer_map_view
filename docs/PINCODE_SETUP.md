# India Pincode Boundaries Setup Guide

This guide explains how to set up India pincode boundaries with Supabase PostGIS for optimal performance.

## Overview

Instead of loading an 86MB GeoJSON file client-side, we use Supabase with PostGIS + browser caching to:
- Store pincode boundary geometries in PostgreSQL
- Query only pincodes visible in current viewport
- **Cache fetched pincodes in browser** - 70-90% reduction in database queries
- Reduce payload from 86MB to ~50-500KB per initial request
- Enable fast spatial queries with indexes
- Instant rendering for previously visited areas

---

## Prerequisites

- Supabase project set up
- Node.js installed
- `SUPABASE_SERVICE_KEY` with admin privileges

---

## Step 1: Run Database Migration

The migration creates the `pincode_boundaries` table with PostGIS support.

### Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### Using Supabase Dashboard (Alternative)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy contents of `supabase/migrations/003_create_pincode_boundaries.sql`
4. Paste and run the SQL

### What the Migration Does

- ✅ Enables PostGIS extension
- ✅ Creates `pincode_boundaries` table with geometry column
- ✅ Adds spatial indexes for fast queries
- ✅ Creates `get_pincodes_in_viewport()` RPC function
- ✅ Sets up proper permissions

---

## Step 2: Get Supabase Service Key

You need the **service_role** key (not the anon key) to import data.

1. Go to Supabase Dashboard → **Settings** → **API**
2. Copy the `service_role` key (under "Project API keys")
3. Add to `.env.local`:

```env
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

⚠️ **Important**: Never commit the service key to Git! It's already in `.gitignore`.

---

## Step 3: Install Dependencies

The import script needs a couple of packages:

```bash
npm install --save-dev dotenv
```

(Note: `@supabase/supabase-js` should already be installed)

---

## Step 4: Run Import Script

This will import the 86MB GeoJSON file into Supabase in batches.

```bash
node scripts/import-pincodes.js
```

### What to Expect

```
🚀 Starting pincode import...

📖 Reading GeoJSON file...
✅ Loaded 19312 pincode features

📦 Processing batch 1/194 (100 features)...
✅ Batch 1 inserted successfully
📦 Processing batch 2/194 (100 features)...
✅ Batch 2 inserted successfully
...

📊 Import Summary:
   ✅ Success: 19312 features
   ❌ Failed: 0 features
   📈 Total: 19312 features

🎉 Import completed! Pincode boundaries are now in Supabase.
```

**Time estimate**: ~10-20 minutes (depending on your connection speed)

### Troubleshooting

**Error: "Missing Supabase credentials"**
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are in `.env.local`

**Error: "relation 'pincode_boundaries' does not exist"**
- Run the migration first (Step 1)

**Import hangs or times out**
- Check your internet connection
- Try reducing `BATCH_SIZE` in the script (line 16)

---

## Step 5: Verify Import

Check that data was imported successfully:

### Using Verification Script (Recommended)

Run the automated verification script:

```bash
node scripts/verify-pincode-data.js
```

This will:
- ✅ Check total count (~19,000+ expected)
- ✅ Verify no UNKNOWN pincodes
- ✅ Show sample data
- ✅ Display state distribution
- ✅ Test spatial queries
- ✅ Validate geometries

Expected output:
```
🔍 Verifying pincode data in Supabase...

✅ Total pincodes: 19312
✅ No UNKNOWN pincodes found
✅ All entries have office names

📋 Sample data (first 5 pincodes):
┌─────────┬──────────┬───────────────┬──────────┬─────────┐
│ pincode │ office_  │ district      │ state    │
├─────────┼──────────┼───────────────┼──────────┤
│ 110001  │ Connaugh │ New Delhi     │ Delhi    │
│ 110002  │ Inderpuri│ New Delhi     │ Delhi    │
└─────────┴──────────┴───────────────┴──────────┘

✅ Data verification PASSED! Import looks good.
```

### Using Supabase Dashboard (Alternative)

1. Go to **Table Editor**
2. Open `pincode_boundaries` table
3. You should see ~19,000+ rows with actual pincode numbers (not "UNKNOWN")

### Using SQL Editor (Alternative)

```sql
-- Check total count
SELECT COUNT(*) FROM pincode_boundaries;

-- Sample a few records
SELECT pincode, office_name, district, state
FROM pincode_boundaries
LIMIT 10;

-- Test spatial query
SELECT COUNT(*)
FROM pincode_boundaries
WHERE ST_Intersects(
  geometry,
  ST_MakeEnvelope(77.0, 28.0, 77.5, 28.5, 4326)
);
```

---

## Step 6: Deploy & Test

The pincode boundaries will now load automatically when users zoom to level 10+.

### How It Works

1. **User zooms to level 10** → Hook calls `get_pincodes_in_viewport()` RPC
2. **Supabase returns** only pincodes within viewport bounds (~50-300 features)
3. **Browser caches** fetched pincodes by ID and viewport area
4. **Map renders** pincode boundaries as subtle blue outlines
5. **User pans to new area** → Fetch from Supabase, add to cache
6. **User returns to visited area** → Load instantly from cache (no query!)

### Performance Metrics

- **Initial load**: 0KB (boundaries not loaded until zoom 10)
- **First fetch at zoom 10**: ~100-500KB (vs 86MB previously)
- **Cached area**: 0KB, <10ms (instant from browser cache!)
- **New area fetch**: ~50-200KB per request, ~50-200ms
- **Cache hit rate**: 70-90% after exploring multiple areas

---

## Cleanup (Optional)

After successful import, you can remove the large GeoJSON file to reduce bundle size:

```bash
# Remove from public folder
rm public/All_India_pincode_Boundary-19312.geojson
```

This file is no longer needed since data is now in Supabase.

---

## Architecture Benefits

### Before (Client-Side)
- ❌ 86MB download when zooming to level 12
- ❌ High browser memory usage
- ❌ Slow on mobile devices
- ❌ No caching across sessions

### After (Supabase + PostGIS)
- ✅ ~100-500KB per viewport query
- ✅ Low memory footprint
- ✅ Fast on all devices
- ✅ Server-side caching
- ✅ Scalable to millions of features

---

## Monitoring

Check browser console for pincode query logs and cache performance:

```
🗺️  Fetching pincodes for viewport: { bounds: {...}, zoom: 10 }
✅ Loaded 127 new pincodes in 0.18s
📊 Cache: 127 total, 0% hit rate, 1 areas cached

✨ Cache HIT - using cached pincodes (no Supabase query needed)
📦 Loaded 127 pincodes from cache
📊 Cache: 450 total, 75% hit rate, 5 areas cached
```

See [PINCODE_CACHING.md](./PINCODE_CACHING.md) for detailed cache documentation.

---

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → **Logs** → **Postgres Logs**
2. Verify PostGIS extension is enabled: `SELECT PostGIS_version();`
3. Check spatial index exists: `\d pincode_boundaries` in SQL editor

---

## Next Steps

- Monitor query performance and cache hit rate in production
- Adjust `minZoom` threshold if needed (currently 10, lowered from 12 for earlier visibility)
- Monitor browser memory usage (should stay under 50 MB)
- Add pincode search/filtering features
- Consider adding pincode labels at higher zoom levels
- Optional: Implement persistent cache using IndexedDB

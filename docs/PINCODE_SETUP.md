# India Pincode Boundaries Setup Guide

This guide explains how to set up India pincode boundaries with Supabase PostGIS for optimal performance.

## Overview

Instead of loading an 86MB GeoJSON file client-side, we use Supabase with PostGIS to:
- Store pincode boundary geometries in PostgreSQL
- Query only pincodes visible in current viewport
- Reduce payload from 86MB to ~50-500KB per request
- Enable fast spatial queries with indexes

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

### Using Supabase Dashboard

1. Go to **Table Editor**
2. Open `pincode_boundaries` table
3. You should see ~19,000+ rows

### Using SQL Editor

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

The pincode boundaries will now load automatically when users zoom to level 12+.

### How It Works

1. **User zooms to level 12** → Hook calls `get_pincodes_in_viewport()` RPC
2. **Supabase returns** only pincodes within viewport bounds (~10-50 features)
3. **Map renders** pincode boundaries as subtle blue outlines
4. **User pans/zooms** → Debounced fetch (300ms) updates boundaries

### Performance Metrics

- **Initial load**: 0KB (boundaries not loaded until zoom 12)
- **Zoom to 12**: ~100-500KB (vs 86MB previously)
- **Pan/zoom**: ~50-200KB per request
- **Query time**: ~50-200ms (PostGIS spatial index)

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

Check browser console for pincode query logs:

```
🗺️  Fetching pincodes for viewport: { bounds: {...}, zoom: 13 }
✅ Loaded 42 pincodes in 0.15s
```

---

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → **Logs** → **Postgres Logs**
2. Verify PostGIS extension is enabled: `SELECT PostGIS_version();`
3. Check spatial index exists: `\d pincode_boundaries` in SQL editor

---

## Next Steps

- Monitor query performance in production
- Adjust `minZoom` threshold if needed (currently 12)
- Add pincode search/filtering features
- Consider adding pincode labels at higher zoom levels

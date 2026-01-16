# Scripts

This directory contains utility scripts for managing pincode boundary data.

## Available Scripts

### 1. `import-pincodes.js`

**Purpose:** Import India pincode GeoJSON data into Supabase PostGIS database

**Usage:**
```bash
node scripts/import-pincodes.js
```

**Prerequisites:**
- Migration `003_create_pincode_boundaries.sql` must be run first
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env.local`
- GeoJSON file at `/public/All_India_pincode_Boundary-19312.geojson`

**What it does:**
- Reads 86MB GeoJSON file containing ~19,000 pincode boundaries
- Imports data in batches of 50 features
- Converts geometries to PostGIS MultiPolygon format
- Shows progress and sample data during import
- Handles errors with fallback to individual inserts

**Output:**
```
🚀 Starting pincode import...
✅ Loaded 19312 pincode features

📋 Sample data from first feature:
   Pincode: 110001
   Office Name: Connaught Place
   District: New Delhi
   State: Delhi

📦 Processing batch 1/387 (50 features)...
   → First pincode in batch: 110001 - Connaught Place
✅ Batch 1 inserted successfully
...
```

**Time:** ~10-20 minutes depending on connection speed

---

### 2. `verify-pincode-data.js`

**Purpose:** Verify data integrity after import

**Usage:**
```bash
node scripts/verify-pincode-data.js
```

**What it does:**
- Checks total count of imported pincodes
- Verifies no UNKNOWN or invalid pincodes
- Shows sample data from database
- Displays state distribution
- Tests spatial queries (viewport-based fetching)
- Validates geometry columns

**Output:**
```
🔍 Verifying pincode data in Supabase...

✅ Total pincodes: 19312
✅ No UNKNOWN pincodes found
✅ All entries have office names

📋 Sample data (first 5 pincodes):
[table showing actual data]

🗺️ Testing spatial query (Delhi region)...
✅ Found 42 pincodes in Delhi viewport

✅ Data verification PASSED! Import looks good.
```

---

## Typical Workflow

### Initial Setup
1. Run migration: `supabase db push` or via Supabase Dashboard
2. Import data: `node scripts/import-pincodes.js`
3. Verify import: `node scripts/verify-pincode-data.js`

### Re-importing Data
If you need to re-import (e.g., after fixing data issues):

```sql
-- Clear existing data (run in Supabase SQL Editor)
TRUNCATE TABLE pincode_boundaries;
```

Then re-run:
```bash
node scripts/import-pincodes.js
node scripts/verify-pincode-data.js
```

---

## Troubleshooting

**"Missing Supabase credentials"**
- Check `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Ensure no spaces around `=` sign

**"relation 'pincode_boundaries' does not exist"**
- Run migration first (Step 1 in PINCODE_SETUP.md)

**"Geometry type does not match"**
- This should be handled automatically with `ST_Multi()`
- If you still see this, check migration defines `GEOMETRY(MultiPolygon, 4326)`

**Import shows UNKNOWN pincodes**
- Check GeoJSON property names match script expectations
- Current mapping: `Pincode`, `Office_Name`, `Division`, `Circle`

---

## Environment Variables Required

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

Get service key from: Supabase Dashboard → Settings → API → service_role key

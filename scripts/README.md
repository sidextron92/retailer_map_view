# Scripts

This directory contains utility scripts for managing pincode boundary data.

## Available Scripts

### 1. `import-pincodes.js`

**Purpose:** Import India pincode GeoJSON data into the target Supabase `rmv_pincode_boundaries` PostGIS table.

**Usage:**
```bash
node scripts/import-pincodes.js
```

**Prerequisites:**
- Target project already has the `rmv_pincode_boundaries` table and PostGIS enabled
- `SUPABASE_ACCESS_TOKEN` in your environment or `.env.local`
- Optional `SUPABASE_PROJECT_REF`; defaults to the reqFlow target project
- GeoJSON file at `/public/All_India_pincode_Boundary-19312.geojson`

**What it does:**
- Reads 86MB GeoJSON file containing ~19,000 pincode boundaries
- Imports data into `rmv_pincode_boundaries` in batches of 50 features
- Converts geometries to PostGIS MultiPolygon format
- Uses the Supabase Management SQL API instead of the legacy `exec_sql` RPC
- Handles errors with fallback to individual inserts

**Output:**
```
Starting pincode import into rmv_pincode_boundaries...
Loaded 19312 pincode features
Batch 1/387 inserted (50/19312)
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
- Checks total count of imported pincodes in `rmv_pincode_boundaries`
- Verifies no UNKNOWN or invalid pincodes
- Shows sample data from database
- Displays state distribution
- Tests spatial queries through `rmv_get_pincodes_in_viewport`
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
1. Run the prefixed target schema migration
2. Import data: `node scripts/import-pincodes.js`
3. Verify import: `node scripts/verify-pincode-data.js`

### Re-importing Data
If you need to re-import (e.g., after fixing data issues):

```sql
-- Clear existing data (run in Supabase SQL Editor)
TRUNCATE TABLE public.rmv_pincode_boundaries;
```

Then re-run:
```bash
node scripts/import-pincodes.js
node scripts/verify-pincode-data.js
```

---

## Troubleshooting

**"Missing Supabase credentials"**
- Check `.env.local` or your shell has `SUPABASE_ACCESS_TOKEN`
- Ensure no spaces around `=` sign

**"relation 'rmv_pincode_boundaries' does not exist"**
- Run the prefixed target schema migration first

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
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
SUPABASE_PROJECT_REF=bsprnfjpqraesvhwdtgx
```

Create an access token from Supabase Dashboard → Account → Access Tokens.

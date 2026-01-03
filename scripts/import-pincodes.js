/**
 * Script to import India pincode GeoJSON data into Supabase
 *
 * Usage: node scripts/import-pincodes.js
 *
 * Make sure to:
 * 1. Run migration 003_create_pincode_boundaries.sql first
 * 2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create Supabase client with service key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GEOJSON_PATH = path.join(__dirname, '../public/All_India_pincode_Boundary-19312.geojson');
const BATCH_SIZE = 50; // Smaller batches for better error handling

async function importPincodes() {
  console.log('🚀 Starting pincode import...\n');

  // Read GeoJSON file
  console.log('📖 Reading GeoJSON file...');
  const geojsonData = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const features = geojsonData.features;

  console.log(`✅ Loaded ${features.length} pincode features\n`);

  // Process in batches
  const totalBatches = Math.ceil(features.length / BATCH_SIZE);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} features)...`);

    try {
      // Build SQL INSERT statement with ST_GeomFromGeoJSON
      const values = batch.map((feature, idx) => {
        const props = feature.properties || {};
        const pincode = (props.Pincode || props.pincode || props.PIN || 'UNKNOWN').toString().replace(/'/g, "''");
        const officeName = (props.Office_Name || props.office_name || '').toString().replace(/'/g, "''");
        const district = (props.Division || props.district || props.DISTRICT || '').toString().replace(/'/g, "''");
        const state = (props.Circle || props.state || props.STATE || '').toString().replace(/'/g, "''");

        // Escape single quotes in GeoJSON string
        const geometryJson = JSON.stringify(feature.geometry).replace(/'/g, "''");

        return `(
          '${pincode}',
          '${officeName}',
          '${district}',
          '${state}',
          ST_Multi(ST_GeomFromGeoJSON('${geometryJson}'))
        )`;
      }).join(',\n');

      const sql = `
        INSERT INTO pincode_boundaries (pincode, office_name, district, state, geometry)
        VALUES ${values}
      `;

      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // Fallback: Try inserting one by one to identify problematic features
        console.log('⚠️  Batch insert failed, trying individual inserts...');

        for (const feature of batch) {
          const props = feature.properties || {};
          const pincode = (props.Pincode || props.pincode || props.PIN || 'UNKNOWN').toString().replace(/'/g, "''");
          const officeName = (props.Office_Name || props.office_name || '').toString().replace(/'/g, "''");
          const district = (props.Division || props.district || props.DISTRICT || '').toString().replace(/'/g, "''");
          const state = (props.Circle || props.state || props.STATE || '').toString().replace(/'/g, "''");
          const geometryJson = JSON.stringify(feature.geometry).replace(/'/g, "''");

          const singleSql = `
            INSERT INTO pincode_boundaries (pincode, office_name, district, state, geometry)
            VALUES (
              '${pincode}',
              '${officeName}',
              '${district}',
              '${state}',
              ST_Multi(ST_GeomFromGeoJSON('${geometryJson}'))
            )
          `;

          const { error: singleError } = await supabase.rpc('exec_sql', { sql_query: singleSql });

          if (singleError) {
            console.error(`  ❌ Failed to insert pincode ${pincode}:`, singleError.message);
            errorCount++;
          } else {
            successCount++;
          }
        }
      } else {
        successCount += batch.length;
        console.log(`✅ Batch ${batchNum} inserted successfully`);
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      console.error(`❌ Error in batch ${batchNum}:`, err.message);
      errorCount += batch.length;
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`   ✅ Success: ${successCount} features`);
  console.log(`   ❌ Failed: ${errorCount} features`);
  console.log(`   📈 Total: ${features.length} features`);

  if (successCount > 0) {
    console.log('\n🎉 Import completed! Pincode boundaries are now in Supabase.');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify data in Supabase Dashboard → Table Editor → pincode_boundaries');
    console.log('   2. Test the map at zoom level 12+');
    console.log('   3. Optionally remove the large GeoJSON file from /public folder');
  }
}

// Run import
importPincodes().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

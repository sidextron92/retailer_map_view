/**
 * Script to verify pincode data in Supabase after import
 *
 * Usage: node scripts/verify-pincode-data.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyData() {
  console.log('🔍 Verifying pincode data in Supabase...\n');

  try {
    // 1. Check total count
    console.log('📊 Checking total count...');
    const { count, error: countError } = await supabase
      .from('pincode_boundaries')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting count:', countError.message);
      return;
    }

    console.log(`✅ Total pincodes: ${count}\n`);

    // 2. Check for UNKNOWN pincodes
    console.log('🔍 Checking for invalid data...');
    const { count: unknownCount } = await supabase
      .from('pincode_boundaries')
      .select('*', { count: 'exact', head: true })
      .eq('pincode', 'UNKNOWN');

    if (unknownCount && unknownCount > 0) {
      console.log(`⚠️  Found ${unknownCount} pincodes with UNKNOWN value`);
    } else {
      console.log('✅ No UNKNOWN pincodes found\n');
    }

    // 3. Check for empty office names
    const { count: emptyOfficeCount } = await supabase
      .from('pincode_boundaries')
      .select('*', { count: 'exact', head: true })
      .or('office_name.is.null,office_name.eq.');

    if (emptyOfficeCount && emptyOfficeCount > 0) {
      console.log(`⚠️  Found ${emptyOfficeCount} entries with empty office_name`);
    } else {
      console.log('✅ All entries have office names\n');
    }

    // 4. Show sample data
    console.log('📋 Sample data (first 5 pincodes):');
    const { data: sampleData, error: sampleError } = await supabase
      .from('pincode_boundaries')
      .select('pincode, office_name, district, state')
      .limit(5);

    if (sampleError) {
      console.error('❌ Error getting sample data:', sampleError.message);
    } else {
      console.table(sampleData);
    }

    // 5. Show state distribution
    console.log('\n📍 Pincode distribution by state (top 10):');
    const { data: stateData, error: stateError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT state, COUNT(*) as count
          FROM pincode_boundaries
          WHERE state IS NOT NULL AND state != ''
          GROUP BY state
          ORDER BY count DESC
          LIMIT 10
        `
      });

    if (stateError) {
      // Fallback: use aggregation query
      console.log('   (Using fallback query method)');
      const { data: fallbackData } = await supabase
        .from('pincode_boundaries')
        .select('state');

      if (fallbackData) {
        const stateCounts = fallbackData.reduce((acc, row) => {
          if (row.state) {
            acc[row.state] = (acc[row.state] || 0) + 1;
          }
          return acc;
        }, {});

        const topStates = Object.entries(stateCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);

        topStates.forEach(([state, count]) => {
          console.log(`   ${state}: ${count}`);
        });
      }
    } else {
      stateData?.forEach(row => {
        console.log(`   ${row.state}: ${row.count}`);
      });
    }

    // 6. Test spatial query
    console.log('\n🗺️  Testing spatial query (Delhi region)...');
    const { data: spatialData, error: spatialError } = await supabase
      .rpc('get_pincodes_in_viewport', {
        min_lng: 77.0,
        min_lat: 28.4,
        max_lng: 77.5,
        max_lat: 28.9,
        zoom_level: 13
      });

    if (spatialError) {
      console.error('❌ Spatial query error:', spatialError.message);
    } else {
      console.log(`✅ Found ${spatialData?.length || 0} pincodes in Delhi viewport`);
      if (spatialData && spatialData.length > 0) {
        console.log('   Sample pincodes in viewport:');
        spatialData.slice(0, 3).forEach(p => {
          console.log(`   - ${p.pincode}: ${p.office_name}, ${p.state}`);
        });
      }
    }

    // 7. Check geometry validity
    console.log('\n🔍 Checking geometry validity...');
    const { data: geometryCheck, error: geoError } = await supabase
      .from('pincode_boundaries')
      .select('id, pincode')
      .is('geometry', null)
      .limit(1);

    if (geoError) {
      console.error('❌ Error checking geometries:', geoError.message);
    } else if (geometryCheck && geometryCheck.length > 0) {
      console.log('⚠️  Found pincodes with null geometry');
    } else {
      console.log('✅ All pincodes have valid geometries\n');
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('📈 VERIFICATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Pincodes: ${count}`);
    console.log(`Invalid Pincodes: ${unknownCount || 0}`);
    console.log(`Empty Office Names: ${emptyOfficeCount || 0}`);
    console.log(`Spatial Query: ${spatialData?.length || 0} results in test viewport`);
    console.log('='.repeat(50));

    if ((unknownCount || 0) === 0 && (emptyOfficeCount || 0) < (count || 0) * 0.1) {
      console.log('\n✅ Data verification PASSED! Import looks good.');
      console.log('\n📝 Next steps:');
      console.log('   1. Start the Next.js dev server: npm run dev');
      console.log('   2. Open the map at http://localhost:3000');
      console.log('   3. Zoom to level 12+ over India');
      console.log('   4. You should see blue pincode boundary outlines');
    } else {
      console.log('\n⚠️  Data verification found issues. Consider re-importing.');
    }

  } catch (err) {
    console.error('💥 Fatal error:', err);
    process.exit(1);
  }
}

verifyData();

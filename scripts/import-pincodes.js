#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Import India pincode GeoJSON data into the prefixed Supabase PostGIS table.
 *
 * Required env:
 * - SUPABASE_ACCESS_TOKEN: Supabase personal access token
 * - SUPABASE_PROJECT_REF: Target project ref. Defaults to reqFlow.
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'bsprnfjpqraesvhwdtgx';
const GEOJSON_PATH = path.join(__dirname, '../public/All_India_pincode_Boundary-19312.geojson');
const BATCH_SIZE = 50;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('Error: Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function runSql(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`SQL request failed (${response.status}): ${JSON.stringify(body)}`);
  }

  return body;
}

function featureToValues(feature) {
  const props = feature.properties || {};
  const pincode = (props.Pincode || props.pincode || props.PIN || 'UNKNOWN').toString();
  const officeName = (props.Office_Name || props.office_name || '').toString();
  const district = (props.Division || props.district || props.DISTRICT || '').toString();
  const state = (props.Circle || props.state || props.STATE || '').toString();
  const geometryJson = JSON.stringify(feature.geometry);

  return `(
    ${sqlString(pincode)},
    ${sqlString(officeName)},
    ${sqlString(district)},
    ${sqlString(state)},
    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${sqlString(geometryJson)}), 4326))
  )`;
}

async function importPincodes() {
  console.log('Starting pincode import into rmv_pincode_boundaries...');
  console.log(`Project ref: ${SUPABASE_PROJECT_REF}`);

  const geojsonData = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  const features = geojsonData.features || [];
  const totalBatches = Math.ceil(features.length / BATCH_SIZE);
  let successCount = 0;
  let errorCount = 0;

  console.log(`Loaded ${features.length} pincode features`);

  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      const values = batch.map(featureToValues).join(',\n');
      await runSql(`
        INSERT INTO public.rmv_pincode_boundaries (pincode, office_name, district, state, geometry)
        VALUES ${values}
      `);
      successCount += batch.length;
      console.log(`Batch ${batchNum}/${totalBatches} inserted (${successCount}/${features.length})`);
    } catch {
      console.log(`Batch ${batchNum}/${totalBatches} failed, retrying individually`);

      for (const feature of batch) {
        try {
          await runSql(`
            INSERT INTO public.rmv_pincode_boundaries (pincode, office_name, district, state, geometry)
            VALUES ${featureToValues(feature)}
          `);
          successCount++;
        } catch (singleError) {
          const props = feature.properties || {};
          const pincode = props.Pincode || props.pincode || props.PIN || 'UNKNOWN';
          console.error(`Failed to insert pincode ${pincode}:`, singleError.message);
          errorCount++;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log('Import summary:');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Total: ${features.length}`);
}

importPincodes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

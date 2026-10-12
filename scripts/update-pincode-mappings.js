#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Updates rmv_pincode_boundaries.darkstore_id and deliverytat from a CSV file.
 * Blank or NULL deliveryTat values preserve the existing database value.
 *
 * Usage:
 *   node scripts/update-pincode-mappings.js /path/to/file.csv
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
const csvPath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

if (!csvPath) {
  console.error('Usage: node scripts/update-pincode-mappings.js /path/to/file.csv [--dry-run]');
  process.exit(1);
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const character = line[i];
    if (character === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function readMappings(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (lines.length < 2) throw new Error('CSV contains no data rows');

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const pincodeIndex = headers.indexOf('pincode');
  const darkstoreIdIndex = headers.indexOf('darkstore_id');
  const deliveryTatIndex = headers.indexOf('deliverytat');

  if (pincodeIndex === -1 || darkstoreIdIndex === -1 || deliveryTatIndex === -1) {
    throw new Error('CSV headers must include pincode, darkstore_id, and deliveryTat');
  }

  const mappings = new Map();

  for (let index = 1; index < lines.length; index++) {
    const values = parseCsvLine(lines[index]);
    const pincode = values[pincodeIndex];
    const darkstoreId = Number(values[darkstoreIdIndex]);
    const rawDeliveryTat = values[deliveryTatIndex];
    const deliveryTat = !rawDeliveryTat || rawDeliveryTat.toUpperCase() === 'NULL'
      ? null
      : Number(rawDeliveryTat);

    if (!/^\d{6}$/.test(pincode)) {
      throw new Error(`Invalid pincode on CSV line ${index + 1}: ${pincode}`);
    }
    if (!Number.isSafeInteger(darkstoreId) || darkstoreId <= 0) {
      throw new Error(`Invalid darkstore_id on CSV line ${index + 1}: ${values[darkstoreIdIndex]}`);
    }
    if (deliveryTat !== null && (!Number.isFinite(deliveryTat) || deliveryTat < 0)) {
      throw new Error(`Invalid deliveryTat on CSV line ${index + 1}: ${rawDeliveryTat}`);
    }

    const existing = mappings.get(pincode);
    if (existing && existing.darkstoreId !== darkstoreId) {
      throw new Error(`Conflicting darkstore_id values for pincode ${pincode}`);
    }
    if (
      existing &&
      existing.deliveryTat !== null &&
      deliveryTat !== null &&
      existing.deliveryTat !== deliveryTat
    ) {
      throw new Error(`Conflicting deliveryTat values for pincode ${pincode}`);
    }

    mappings.set(pincode, {
      pincode,
      darkstoreId,
      deliveryTat: deliveryTat ?? existing?.deliveryTat ?? null,
    });
  }

  return [...mappings.values()];
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

  return body || [];
}

function mappingValues(mapping) {
  const deliveryTat = mapping.deliveryTat === null ? 'NULL' : mapping.deliveryTat;
  return `('${mapping.pincode}', ${mapping.darkstoreId}, ${deliveryTat})`;
}

async function updatePincodeMappings() {
  const resolvedPath = path.resolve(csvPath);
  const mappings = readMappings(resolvedPath);
  let updatedRows = 0;
  let matchedPincodes = 0;

  console.log(`Loaded ${mappings.length} unique pincode mappings from ${resolvedPath}`);

  if (dryRun) {
    console.log('Dry run complete; no database changes were made.');
    return;
  }

  if (!SUPABASE_ACCESS_TOKEN) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN');
  }

  for (let index = 0; index < mappings.length; index += BATCH_SIZE) {
    const batch = mappings.slice(index, index + BATCH_SIZE);
    const values = batch.map(mappingValues).join(',\n');
    const result = await runSql(`
      WITH mapping(pincode, darkstore_id, deliverytat) AS (
        VALUES ${values}
      ), updated AS (
        UPDATE public.rmv_pincode_boundaries AS boundary
        SET
          darkstore_id = mapping.darkstore_id,
          deliverytat = COALESCE(mapping.deliverytat, boundary.deliverytat)
        FROM mapping
        WHERE boundary.pincode = mapping.pincode
        RETURNING boundary.pincode
      )
      SELECT
        COUNT(*)::integer AS updated_rows,
        COUNT(DISTINCT pincode)::integer AS matched_pincodes
      FROM updated;
    `);

    updatedRows += Number(result[0]?.updated_rows || 0);
    matchedPincodes += Number(result[0]?.matched_pincodes || 0);
    console.log(`Processed ${Math.min(index + batch.length, mappings.length)}/${mappings.length}`);
  }

  console.log('Update summary:');
  console.log(`CSV pincodes: ${mappings.length}`);
  console.log(`Matched pincodes: ${matchedPincodes}`);
  console.log(`Updated boundary rows: ${updatedRows}`);
  console.log(`Unmatched pincodes: ${mappings.length - matchedPincodes}`);
}

updatePincodeMappings().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

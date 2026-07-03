#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Migrates retailer_map_view Supabase objects into reqFlow with rmv_ prefixes.
 *
 * Source project is read-only. All writes go to the target project.
 * Required env: SUPABASE_ACCESS_TOKEN
 */

const { createClient } = require('@supabase/supabase-js');

const SOURCE_REF = 'ojkyyboorjlsthyomktb';
const TARGET_REF = 'bsprnfjpqraesvhwdtgx';
const SOURCE_URL = `https://${SOURCE_REF}.supabase.co`;
const TARGET_URL = `https://${TARGET_REF}.supabase.co`;
const SOURCE_BUCKET = 'tam-shop-photos';
const TARGET_BUCKET = 'rmv_tam-shop-photos';
const API_BASE = 'https://api.supabase.com/v1';
const PAGE_SIZE = 1000;
const SQL_CHUNK_SIZE = 100;

const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return String(value);
}

async function managementFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`Management API ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function query(projectRef, sql) {
  const body = await managementFetch(`/projects/${projectRef}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query: sql }),
  });

  if (body && body.message) {
    throw new Error(body.message);
  }

  return body || [];
}

async function getProjectKeys(projectRef) {
  const keys = await managementFetch(`/projects/${projectRef}/api-keys`);
  const anon = keys.find((key) => key.id === 'anon' || key.name === 'anon');
  const serviceRole = keys.find((key) => key.id === 'service_role' || key.name === 'service_role');

  if (!anon?.api_key || !serviceRole?.api_key) {
    throw new Error(`Could not fetch anon/service_role keys for ${projectRef}`);
  }

  return {
    anonKey: anon.api_key,
    serviceRoleKey: serviceRole.api_key,
  };
}

async function createTargetSchema() {
  const ddl = `
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.rmv_update_geolocation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geolocation = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.rmv_retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(50),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geolocation GEOGRAPHY(POINT, 4326),
  is_active BOOLEAN DEFAULT true,
  last_visit_date TIMESTAMPTZ,
  next_scheduled_visit TIMESTAMPTZ,
  notes TEXT,
  userid INTEGER,
  state VARCHAR(100),
  city VARCHAR(100),
  pincode VARCHAR(20),
  last_order_date TIMESTAMPTZ,
  sk_id VARCHAR(50),
  trader_name VARCHAR(255),
  retailer_status VARCHAR(50),
  buying_category VARCHAR(100),
  teamlead_name VARCHAR(255),
  darkstore VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS rmv_idx_retailers_visit_dates ON public.rmv_retailers(last_visit_date, next_scheduled_visit);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_geolocation ON public.rmv_retailers USING GIST(geolocation);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_state ON public.rmv_retailers(state);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_city ON public.rmv_retailers(city);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_pincode ON public.rmv_retailers(pincode);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_sk_id ON public.rmv_retailers(sk_id);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_trader_name ON public.rmv_retailers(trader_name);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_last_order_date ON public.rmv_retailers(last_order_date);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_retailer_status ON public.rmv_retailers(retailer_status);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_buying_category ON public.rmv_retailers(buying_category);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_teamlead_name ON public.rmv_retailers(teamlead_name);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_darkstore ON public.rmv_retailers(darkstore);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_active ON public.rmv_retailers(is_active);
CREATE INDEX IF NOT EXISTS rmv_idx_retailers_name_search ON public.rmv_retailers USING gin(to_tsvector('english', name || ' ' || COALESCE(trader_name, '')));

DROP TRIGGER IF EXISTS rmv_trigger_update_geolocation ON public.rmv_retailers;
CREATE TRIGGER rmv_trigger_update_geolocation
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.rmv_retailers
FOR EACH ROW EXECUTE FUNCTION public.rmv_update_geolocation();

CREATE TABLE IF NOT EXISTS public.rmv_retailer_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color_hex VARCHAR(7) NOT NULL,
  icon_name VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS public.rmv_pincode_boundaries (
  id BIGSERIAL PRIMARY KEY,
  pincode VARCHAR(10) NOT NULL,
  office_name VARCHAR(255),
  district VARCHAR(100),
  state VARCHAR(100),
  geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deliverytat NUMERIC DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS rmv_pincode_boundaries_geometry_idx ON public.rmv_pincode_boundaries USING GIST (geometry);
CREATE INDEX IF NOT EXISTS rmv_pincode_boundaries_geography_idx ON public.rmv_pincode_boundaries USING GIST ((geometry::geography));
CREATE INDEX IF NOT EXISTS rmv_pincode_boundaries_pincode_idx ON public.rmv_pincode_boundaries (pincode);
CREATE INDEX IF NOT EXISTS rmv_pincode_boundaries_state_idx ON public.rmv_pincode_boundaries (state);
CREATE INDEX IF NOT EXISTS rmv_pincode_boundaries_deliverytat_idx ON public.rmv_pincode_boundaries (deliverytat) WHERE deliverytat IS NOT NULL;
COMMENT ON TABLE public.rmv_pincode_boundaries IS 'India pincode boundaries with spatial geometry for map visualization';
COMMENT ON COLUMN public.rmv_pincode_boundaries.deliverytat IS 'Delivery turnaround time in seconds. NULL means not serviceable.';

CREATE OR REPLACE FUNCTION public.rmv_get_pincodes_in_viewport(
  min_lng FLOAT,
  min_lat FLOAT,
  max_lng FLOAT,
  max_lat FLOAT,
  zoom_level INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  pincode VARCHAR(10),
  office_name VARCHAR(255),
  district VARCHAR(100),
  state VARCHAR(100),
  geometry GEOMETRY
) AS $$
BEGIN
  IF zoom_level < 10 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pb.id, pb.pincode, pb.office_name, pb.district, pb.state, pb.geometry
  FROM public.rmv_pincode_boundaries pb
  WHERE ST_Intersects(pb.geometry, ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.rmv_get_pincodes_by_radius(
  center_lng FLOAT,
  center_lat FLOAT,
  radius_km FLOAT,
  zoom_level INT DEFAULT 8
)
RETURNS TABLE (
  id BIGINT,
  pincode VARCHAR(10),
  office_name VARCHAR(255),
  district VARCHAR(100),
  state VARCHAR(100),
  geometry GEOMETRY,
  deliverytat NUMERIC
) AS $$
BEGIN
  IF zoom_level < 8 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pb.id, pb.pincode, pb.office_name, pb.district, pb.state, pb.geometry, pb.deliverytat
  FROM public.rmv_pincode_boundaries pb
  WHERE ST_DWithin(
    pb.geometry::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_km * 1000
  );
END;
$$ LANGUAGE plpgsql;

GRANT SELECT ON public.rmv_pincode_boundaries TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rmv_get_pincodes_in_viewport TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rmv_get_pincodes_by_radius TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.rmv_darkstore_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  darkstore VARCHAR(255) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geolocation GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rmv_idx_darkstore_locations_darkstore ON public.rmv_darkstore_locations(darkstore);
CREATE INDEX IF NOT EXISTS rmv_idx_darkstore_locations_geolocation ON public.rmv_darkstore_locations USING GIST(geolocation);

DROP TRIGGER IF EXISTS rmv_trigger_darkstore_update_geolocation ON public.rmv_darkstore_locations;
CREATE TRIGGER rmv_trigger_darkstore_update_geolocation
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.rmv_darkstore_locations
FOR EACH ROW EXECUTE FUNCTION public.rmv_update_geolocation();

CREATE OR REPLACE FUNCTION public.rmv_update_darkstore_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rmv_trigger_darkstore_update_updated_at ON public.rmv_darkstore_locations;
CREATE TRIGGER rmv_trigger_darkstore_update_updated_at
BEFORE UPDATE ON public.rmv_darkstore_locations
FOR EACH ROW EXECUTE FUNCTION public.rmv_update_darkstore_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('rmv_tam-shop-photos', 'rmv_tam-shop-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE TABLE IF NOT EXISTS public.rmv_tam_retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name VARCHAR(255),
  shop_photo_url TEXT NOT NULL,
  category_tags JSONB DEFAULT '[]'::jsonb,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geolocation GEOGRAPHY(POINT, 4326),
  location_accuracy DECIMAL(10, 2),
  pincode VARCHAR(10) NOT NULL,
  darkstore VARCHAR(255) NOT NULL,
  user_agent TEXT,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  phone_number VARCHAR(10)
);

CREATE INDEX IF NOT EXISTS rmv_idx_tam_retailers_darkstore ON public.rmv_tam_retailers(darkstore);
CREATE INDEX IF NOT EXISTS rmv_idx_tam_retailers_pincode ON public.rmv_tam_retailers(pincode);
CREATE INDEX IF NOT EXISTS rmv_idx_tam_retailers_geolocation ON public.rmv_tam_retailers USING GIST(geolocation);
CREATE INDEX IF NOT EXISTS rmv_idx_tam_retailers_created_at ON public.rmv_tam_retailers(created_at DESC);
CREATE INDEX IF NOT EXISTS rmv_idx_tam_retailers_category_tags ON public.rmv_tam_retailers USING GIN(category_tags);

DROP TRIGGER IF EXISTS rmv_trigger_tam_retailers_update_geolocation ON public.rmv_tam_retailers;
CREATE TRIGGER rmv_trigger_tam_retailers_update_geolocation
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.rmv_tam_retailers
FOR EACH ROW EXECUTE FUNCTION public.rmv_update_geolocation();

CREATE OR REPLACE FUNCTION public.rmv_update_tam_retailers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rmv_trigger_tam_retailers_update_updated_at ON public.rmv_tam_retailers;
CREATE TRIGGER rmv_trigger_tam_retailers_update_updated_at
BEFORE UPDATE ON public.rmv_tam_retailers
FOR EACH ROW EXECUTE FUNCTION public.rmv_update_tam_retailers_updated_at();

ALTER TABLE public.rmv_tam_retailers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rmv_public_read_access_for_shop_photos" ON storage.objects;
CREATE POLICY "rmv_public_read_access_for_shop_photos" ON storage.objects FOR SELECT USING (bucket_id = 'rmv_tam-shop-photos');
DROP POLICY IF EXISTS "rmv_allow_insert_for_shop_photos" ON storage.objects;
CREATE POLICY "rmv_allow_insert_for_shop_photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'rmv_tam-shop-photos');
DROP POLICY IF EXISTS "rmv_allow_update_for_shop_photos" ON storage.objects;
CREATE POLICY "rmv_allow_update_for_shop_photos" ON storage.objects FOR UPDATE USING (bucket_id = 'rmv_tam-shop-photos');
DROP POLICY IF EXISTS "rmv_allow_delete_for_shop_photos" ON storage.objects;
CREATE POLICY "rmv_allow_delete_for_shop_photos" ON storage.objects FOR DELETE USING (bucket_id = 'rmv_tam-shop-photos');

DROP POLICY IF EXISTS "rmv_public_read_access_for_tam_retailers" ON public.rmv_tam_retailers;
CREATE POLICY "rmv_public_read_access_for_tam_retailers" ON public.rmv_tam_retailers FOR SELECT USING (true);
DROP POLICY IF EXISTS "rmv_public_insert_access_for_tam_retailers" ON public.rmv_tam_retailers;
CREATE POLICY "rmv_public_insert_access_for_tam_retailers" ON public.rmv_tam_retailers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "rmv_public_update_access_for_tam_retailers" ON public.rmv_tam_retailers;
CREATE POLICY "rmv_public_update_access_for_tam_retailers" ON public.rmv_tam_retailers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "rmv_public_delete_access_for_tam_retailers" ON public.rmv_tam_retailers;
CREATE POLICY "rmv_public_delete_access_for_tam_retailers" ON public.rmv_tam_retailers FOR DELETE USING (true);

NOTIFY pgrst, 'reload schema';
`;

  await query(TARGET_REF, ddl);
}

async function getCount(projectRef, tableName) {
  const result = await query(projectRef, `SELECT COUNT(*)::bigint AS count FROM public.${tableName}`);
  return Number(result[0]?.count || 0);
}

async function fetchAll(client, tableName, columns, orderColumn = 'id') {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(tableName)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function upsertRows(client, tableName, rows) {
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    const chunk = rows.slice(i, i + PAGE_SIZE);
    const { error } = await client.from(tableName).upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
    console.log(`  ${tableName}: upserted ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
}

function rewritePhotoUrl(url) {
  if (!url) return url;
  return url
    .replace(SOURCE_URL, TARGET_URL)
    .replace('/storage/v1/object/public/tam-shop-photos/', '/storage/v1/object/public/rmv_tam-shop-photos/');
}

async function copySimpleTables(sourceClient, targetClient) {
  if (await getCount(TARGET_REF, 'rmv_retailers') === await getCount(SOURCE_REF, 'retailers')) {
    console.log('  rmv_retailers: already matches source count, skipping');
  } else {
  const retailers = await fetchAll(
    sourceClient,
    'retailers',
    'id,name,address,phone,latitude,longitude,is_active,last_visit_date,next_scheduled_visit,notes,userid,state,city,pincode,last_order_date,sk_id,trader_name,retailer_status,buying_category,teamlead_name,darkstore'
  );
  await upsertRows(targetClient, 'rmv_retailers', retailers);
  }

  if (await getCount(TARGET_REF, 'rmv_retailer_categories') === await getCount(SOURCE_REF, 'retailer_categories')) {
    console.log('  rmv_retailer_categories: already matches source count, skipping');
  } else {
  const categories = await fetchAll(sourceClient, 'retailer_categories', 'id,name,color_hex,icon_name');
  await upsertRows(targetClient, 'rmv_retailer_categories', categories);
  }

  if (await getCount(TARGET_REF, 'rmv_darkstore_locations') === await getCount(SOURCE_REF, 'darkstore_locations')) {
    console.log('  rmv_darkstore_locations: already matches source count, skipping');
  } else {
  const darkstores = await fetchAll(
    sourceClient,
    'darkstore_locations',
    'id,darkstore,address,latitude,longitude,created_at,updated_at'
  );
  await upsertRows(targetClient, 'rmv_darkstore_locations', darkstores);
  }

  if (await getCount(TARGET_REF, 'rmv_tam_retailers') === await getCount(SOURCE_REF, 'tam_retailers')) {
    console.log('  rmv_tam_retailers: already matches source count, skipping');
  } else {
  const tamRetailers = await fetchAll(
    sourceClient,
    'tam_retailers',
    'id,shop_name,shop_photo_url,category_tags,latitude,longitude,location_accuracy,pincode,darkstore,user_agent,device_info,created_at,updated_at,phone_number'
  );
  await upsertRows(
    targetClient,
    'rmv_tam_retailers',
    tamRetailers.map((row) => ({ ...row, shop_photo_url: rewritePhotoUrl(row.shop_photo_url) }))
  );
  }
}

async function copyPincodeBoundaries() {
  const total = await getCount(SOURCE_REF, 'pincode_boundaries');
  const existing = await query(TARGET_REF, 'SELECT COALESCE(MAX(id), 0)::bigint AS max_id, COUNT(*)::bigint AS count FROM public.rmv_pincode_boundaries');
  let lastId = Number(existing[0]?.max_id || 0);
  let copied = Number(existing[0]?.count || 0);

  if (copied >= total) {
    console.log('  rmv_pincode_boundaries: already matches source count, skipping');
    return;
  }

  while (copied < total) {
    const rows = await query(
      SOURCE_REF,
      `SELECT id, pincode, office_name, district, state, ST_AsGeoJSON(geometry)::json AS geometry, created_at, deliverytat FROM public.pincode_boundaries WHERE id > ${lastId} ORDER BY id LIMIT ${SQL_CHUNK_SIZE}`
    );

    if (!rows.length) break;
    lastId = Number(rows[rows.length - 1].id);

    const values = rows.map((row) => `(
      ${sqlNumber(row.id)},
      ${sqlString(row.pincode)},
      ${sqlString(row.office_name)},
      ${sqlString(row.district)},
      ${sqlString(row.state)},
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${sqlString(JSON.stringify(row.geometry))}), 4326)),
      ${sqlString(row.created_at)},
      ${sqlNumber(row.deliverytat)}
    )`).join(',');

    await query(TARGET_REF, `
      INSERT INTO public.rmv_pincode_boundaries (id, pincode, office_name, district, state, geometry, created_at, deliverytat)
      VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET
        pincode = EXCLUDED.pincode,
        office_name = EXCLUDED.office_name,
        district = EXCLUDED.district,
        state = EXCLUDED.state,
        geometry = EXCLUDED.geometry,
        created_at = EXCLUDED.created_at,
        deliverytat = EXCLUDED.deliverytat
    `);

    copied += rows.length;
    console.log(`  rmv_pincode_boundaries: copied ${Math.min(copied, total)}/${total}`);
  }
}

async function resetSequences() {
  await query(TARGET_REF, `
    SELECT setval(pg_get_serial_sequence('public.rmv_retailer_categories', 'id'), COALESCE((SELECT MAX(id) FROM public.rmv_retailer_categories), 1), true);
    SELECT setval(pg_get_serial_sequence('public.rmv_pincode_boundaries', 'id'), COALESCE((SELECT MAX(id) FROM public.rmv_pincode_boundaries), 1), true);
  `);
}

async function getStorageObjectNames(projectRef, bucketId) {
  const rows = await query(
    projectRef,
    `SELECT name FROM storage.objects WHERE bucket_id = ${sqlString(bucketId)} ORDER BY name`
  );
  return rows.map((row) => row.name);
}

async function copyStorageByObjectNames(sourceClient, targetClient) {
  const [sourceNames, targetNames] = await Promise.all([
    getStorageObjectNames(SOURCE_REF, SOURCE_BUCKET),
    getStorageObjectNames(TARGET_REF, TARGET_BUCKET),
  ]);
  const targetSet = new Set(targetNames);
  const missing = sourceNames.filter((name) => !targetSet.has(name));

  console.log(`  storage: ${sourceNames.length} source / ${targetNames.length} target / ${missing.length} missing`);

  for (let i = 0; i < missing.length; i++) {
    const path = missing[i];
    let blob;
    const { data: downloadedBlob, error: downloadError } = await sourceClient.storage.from(SOURCE_BUCKET).download(path);
    if (downloadError) {
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const publicUrl = `${SOURCE_URL}/storage/v1/object/public/${SOURCE_BUCKET}/${encodedPath}`;
      const fallbackResponse = await fetch(publicUrl);
      if (!fallbackResponse.ok) {
        throw new Error(`Failed downloading ${path}: ${downloadError.message || JSON.stringify(downloadError)}`);
      }
      blob = await fallbackResponse.blob();
    } else {
      blob = downloadedBlob;
    }

    const { error: uploadError } = await targetClient.storage.from(TARGET_BUCKET).upload(path, blob, {
      contentType: blob.type || 'application/octet-stream',
      upsert: true,
    });

    if (uploadError) {
      throw new Error(`Failed uploading ${path}: ${uploadError.message}`);
    }

    if ((i + 1) % 100 === 0 || i + 1 === missing.length) {
      console.log(`  storage: copied ${i + 1}/${missing.length} missing objects`);
    }
  }
}

async function verify() {
  const pairs = [
    ['retailers', 'rmv_retailers'],
    ['retailer_categories', 'rmv_retailer_categories'],
    ['pincode_boundaries', 'rmv_pincode_boundaries'],
    ['darkstore_locations', 'rmv_darkstore_locations'],
    ['tam_retailers', 'rmv_tam_retailers'],
  ];

  for (const [sourceTable, targetTable] of pairs) {
    const sourceCount = await getCount(SOURCE_REF, sourceTable);
    const targetCount = await getCount(TARGET_REF, targetTable);
    console.log(`  ${sourceTable} -> ${targetTable}: ${sourceCount} source / ${targetCount} target`);
    if (sourceCount !== targetCount) {
      throw new Error(`Count mismatch for ${sourceTable}`);
    }
  }

  const rpcResult = await query(TARGET_REF, `
    SELECT COUNT(*)::bigint AS count
    FROM public.rmv_get_pincodes_by_radius(77.2, 28.6, 70, 10)
  `);
  console.log(`  rmv_get_pincodes_by_radius Delhi test rows: ${rpcResult[0]?.count || 0}`);
}

async function main() {
  console.log('Fetching project API keys...');
  const [sourceKeys, targetKeys] = await Promise.all([
    getProjectKeys(SOURCE_REF),
    getProjectKeys(TARGET_REF),
  ]);

  const sourceClient = createClient(SOURCE_URL, sourceKeys.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const targetClient = createClient(TARGET_URL, targetKeys.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('Creating target schema and policies...');
  await createTargetSchema();

  console.log('Copying table data...');
  await copySimpleTables(sourceClient, targetClient);
  await copyPincodeBoundaries();
  await resetSequences();

  console.log('Copying storage objects...');
  await copyStorageByObjectNames(sourceClient, targetClient);

  console.log('Verifying migration...');
  await verify();

  console.log('Migration completed successfully.');
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Target anon key: ${targetKeys.anonKey}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

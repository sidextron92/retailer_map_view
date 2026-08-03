# CLAUDE.md

This project uses the merged Supabase target project for runtime data access.

## Supabase Target

- Runtime project: `reqFlow`
- Project ref: `bsprnfjpqraesvhwdtgx`
- Public URL: `https://bsprnfjpqraesvhwdtgx.supabase.co`
- Browser-safe key: use the target publishable or anon key only
- Never put a `service_role` key in any `NEXT_PUBLIC_*` variable

Required app environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bsprnfjpqraesvhwdtgx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<target publishable or anon key>
```

## Migrated Database Objects

All retailer-map-owned objects in the target project use the `rmv_` prefix.

Tables:

- `rmv_retailers`
- `rmv_retailer_categories`
- `rmv_pincode_boundaries`
- `rmv_darkstore_locations`
- `rmv_tam_retailers`

Storage bucket:

- `rmv_tam-shop-photos`

RPC/functions:

- `rmv_get_pincodes_by_radius`
- `rmv_get_pincodes_in_viewport`
- `rmv_update_geolocation`
- `rmv_update_darkstore_updated_at`
- `rmv_update_tam_retailers_updated_at`

Do not use or recreate the old `exec_sql` RPC in the target project.

## Legacy Source Project

The old source project was `retailer_map_view` with project ref `ojkyyboorjlsthyomktb`.

Do not point runtime app code at the source project. It should be treated as a fallback/archive unless the user explicitly asks otherwise.

## Runtime Code References

Current app code should use:

- `supabase.from('rmv_retailers')`
- `supabase.from('rmv_darkstore_locations')`
- `supabase.from('rmv_tam_retailers')`
- `supabase.rpc('rmv_get_pincodes_by_radius')`
- `supabase.storage.from('rmv_tam-shop-photos')`

Do not reintroduce unprefixed runtime references such as:

- `retailers`
- `retailer_categories`
- `pincode_boundaries`
- `darkstore_locations`
- `tam_retailers`
- `tam-shop-photos`
- `get_pincodes_by_radius`
- `get_pincodes_in_viewport`
- `exec_sql`

The one-time migration helper `scripts/migrate-rmv-to-reqflow.js` intentionally references old source object names while copying from the source project into target `rmv_` objects.

## TAM Mode Location Capture

In TAM mode (`mode=tam`), adding a retailer requires a location. The app uses the browser Geolocation API and enforces a quality threshold.

- **Auto-detect threshold:** GPS accuracy must be **≤ 200 m**.
- **Accuracy > 200 m:** The "Add Retailer" sheet shows a red warning and disables Submit. A **"Place Pin on Map"** button is offered.
- **Manual pin placement:** Tapping the button closes the sheet and puts the map into pin-placement mode with a centered crosshair. The user pans/zooms to align the crosshair on the exact shop front, then taps **Confirm Location**. The sheet reopens with a blue **"Manually placed"** badge and Submit is enabled.
- **User location reference:** During manual pin placement, the user's current GPS dot remains visible on the map as a positional reference.

### `location_source` Audit Column

All new rows in `rmv_tam_retailers` record how the coordinates were obtained:

| `location_source` | Meaning |
|-------------------|---------|
| `auto` (default) | Coordinates came from GPS with accuracy ≤ 200 m |
| `manual` | Coordinates were manually placed via map crosshair |

| `location_accuracy` | Meaning |
|---------------------|---------|
| Actual meter value (e.g. `12.5`) | GPS accuracy for auto-detected pins |
| `9999` | Sentinel value for manual pins |

**Migration:** `supabase/migrations/020_add_location_source.sql`

```sql
ALTER TABLE public.rmv_tam_retailers
ADD COLUMN IF NOT EXISTS location_source TEXT DEFAULT 'auto';
```

## Query Params

The app reads URL search params with `useSearchParams`. `mode` is normalized to lowercase, so values like `TAM`, `Tam`, and `tam` are equivalent.

Supported `mode` values:

- Empty or omitted: normal retailer map mode
- `mode=ops`: operations mode
- `mode=tam`: TAM capture mode

Common URL formats:

```text
/?mode=tam&darkstore=Agra
/?mode=TAM&darkstore=Agra
/?mode=ops&darkstore=Agra
/?darkstore=Agra
```

Supported query params:

- `mode`: optional mode selector, currently `tam` or `ops`
- `darkstore`: filters/centers by darkstore name and is required for TAM mode
- `sk_id`: server-side retailer filter
- `buying_category`: server-side retailer filter

The app also tolerates malformed shared links where `darkstore` is accidentally appended after a second `?` inside `mode`:

```text
/?mode=tam?darkstore=Agra
/?mode=TAM?darkstore=Agra
```

## PostGIS Performance

The target `rmv_pincode_boundaries` table must have both geometry and geography indexes:

- `rmv_pincode_boundaries_geometry_idx` on `geometry`
- `rmv_pincode_boundaries_geography_idx` on `(geometry::geography)`

The geography expression index is required for `rmv_get_pincodes_by_radius` to avoid statement timeouts.

## Scripts

- `scripts/import-pincodes.js` imports into `rmv_pincode_boundaries` using the Supabase Management SQL API and `SUPABASE_ACCESS_TOKEN`.
- `scripts/verify-pincode-data.js` verifies `rmv_pincode_boundaries` and `rmv_get_pincodes_in_viewport`.
- `scripts/migrate-rmv-to-reqflow.js` is a resumable one-time migration helper that reads from source and writes to target.

## Verification

Before deployment, run:

```bash
npm run lint
npm run build
```

Both should pass.

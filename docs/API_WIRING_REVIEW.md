# API Wiring Review

## Context
- **Scope**: Audit the `api/` directory, validate environment usage, and ensure `GeoApplicationNew` consumes the same ZIP/county/city sources and fallbacks used in the legacy `GeoApplication.jsx`.
- **Data Sources**: Supabase (primary), public static payload (`public/zipdata.json`), optional PostGIS boundary APIs, Mapbox/OSM geocoding.

## API Layer Findings (`api/`)

### Shared Utilities (`api/_lib`)
- `env.js` already exposed `getEnv` / `getRequiredEnv`; legacy handlers were not using it. Updated v1 routes now consistently call `getEnv`.
- Added `static-zip-data.js` with cached readers for `zipdata.json`, exposing:
  - `getStaticStates`
  - `getStaticCounties(state)`
  - `getStaticCities(state, county)`
  - `isStaticZipDataAvailable()` guard
- Caching keeps repeated calls cheap; missing file logs once and returns `false`.

### Versioned Routes (`api/v1`)
| Route | Was | Now |
| --- | --- | --- |
| `health.js` | Mixed direct `process.env` usage | Delegates to `getEnv`, maintains CORS & warning list |
| `states.js` | Supabase-only, direct env access | Tries Supabase (service role) → static fallback → 503 |
| `counties.js` | Supabase-only, direct env access | Same fallback ladder, requires `state` query |
| `cities.js` | Supabase-only, direct env access | Same fallback ladder, respects optional `county` filter |

**Behavior Notes**
- Fallbacks return sorted lists matching front-end expectations (`{ name, code }`, etc.).
- All handlers send uniform CORS headers via `applyCors` helper.
- Service-role usage remains; absence of creds is treated as non-fatal when static data is available.

## Front-End Wiring (`src/`)

### Providers
- Reordered `GeoApplicationNew` so that children mount under `UI → Results → Map → Search`. Search now has access to both `ResultsContext` and `MapContext`, matching old monolith behavior.

### `SearchContext`
- Integrates with `ResultsContext` setters to hydrate ZIP/city/county/state collections, replacing bespoke logic from `GeoApplication.jsx`.
- Introduced normalization pipeline:
  - dedupe by ZIP
  - harmonize field names (`zipCode`, `lat`, `lng`, etc.)
  - ensure `area`/`overlap` fields exist (default 0) for UI consumers
- Aggregation mirrors legacy behavior (averaged coordinates per city/county/state, state name lookup).
- Map auto-centers on first result with zoom tuned per mode (radius, hierarchy, other).
- `clearResults()` now shared with Results context; resets counts/pagination.
- History/radius chips preserved; “re-run” flow reuses processed results.

### `ResultsContext`
- Reset helper now clears totals, pagination flags, and selection state to keep drawer tabs synchronous after fallbacks trigger.

### `MapContainer`
- No code changes required; receives normalized `zipResults` with consistent shape.

## Environment & Keys
- Supabase service-role credentials remain mandatory for live data, but missing keys no longer break hierarchy dropdowns thanks to static fallback.
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` govern front-end Supabase client; `SUPABASE_SERVICE_ROLE_KEY` used only in API layer.
- `VITE_GEO_API_BASE` (optional) for PostGIS boundaries; unchanged.
- Geocoding services (Mapbox token / OSM) untouched but verified unaffected by refactor.

## Operational Checks
- `npm run lint` currently errors: `typescript-eslint` missing, referenced by `eslint.config.js`. Install or adjust config before CI.
- Fallback relies on bundled `public/zipdata.json` (2.7 MB). Keep file updated via `scripts/convert-csv-to-json.cjs` when refreshing data.

## Outstanding / Follow-Ups
1. Add `@typescript-eslint/*` deps (or remove plugin) to restore linting.
2. Consider consolidating CORS helpers and response helpers (v1 still uses Express-style handlers vs. Edge-style in `_lib/response.js`).
3. Add automated tests (Node scripts) to verify Supabase-down fallback path for states/counties/cities endpoints.
4. Confirm deployment environment exposes `public/zipdata.json` to the lambda runtime; Vercel file access works when bundled.

## Quick Reference
- **Primary data path**: Supabase → fallback to `public/zipdata.json`
- **Key files touched**:
  - `api/_lib/static-zip-data.js`
  - `api/v1/{health,states,counties,cities}.js`
  - `src/GeoApplicationNew.jsx`
  - `src/contexts/{SearchContext,ResultsContext}.jsx`
- **Fallback indicator**: server logs `[api] states handler error` (or similar) before serving static response.

## Verification Checklist
- [x] Radius search populates ZIP/city/county/state tabs
- [x] Hierarchy search works with static fallback (disconnect Supabase to verify)
- [x] Drawer reset clears counts/tabs
- [ ] Lint passes (`npm run lint`)
- [ ] Integration tests (if any) rerun after lint fix


# Security and Configuration Changes

This document records changes that remove secrets from the client bundle and hardcoded defaults.

## Summary
- Removed PostGIS credentials from client code. The browser now talks only to the public HTTPS API.
- Removed hardcoded Supabase URL and anon key defaults. Supabase now requires environment variables and RLS.
- Added graceful fallbacks so the UI continues to work if Supabase is disabled.

## What Changed
- `src/services/postgisService.js`:
  - Deleted embedded `host/database/username/password`. No client-side connection strings remain.
  - Uses `VITE_GEO_API_BASE` (or defaults to `https://geo.edwinlovett.com`) for HTTPS calls only.
  - Clarified that direct DB connections from the browser are not permitted.
- `src/services/supabaseService.js`:
  - Removed hardcoded defaults for URL/key. Reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - If env vars are missing, Supabase is disabled and the service returns empty results; the app falls back to static data.
  - Added client-side polygon filter to align with app features (no security impact).
- `src/services/zipCodeService.js` (earlier change):
  - Added robust fallback to static dataset when Supabase yields no results or errors.

## Deployment Notes
- PostGIS:
  - Store DB credentials on the server only. Expose read endpoints via HTTPS (e.g., `GET /zip/:zipcode`).
  - Set `VITE_GEO_API_BASE` to your API origin if different from default.
- Supabase:
  - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your environment.
  - Enforce RLS on table `zipcodes` with read policies for anonymous role as required.
  - Do not commit real keys in the repo; remove keys from `.env` before pushing.

## Backend Base URL (Fail-Fast)
- Removed `http://localhost:3001/api` default from `ZipCodeService`.
- The app now expects a single `VITE_API_URL` when the API backend is used; it throws a clear error if missing.
- In environments without an API, the UI continues via static dataset fallback or Supabase (when configured).

### Localhost Testing Convenience
- When `VITE_API_URL` is not set and the app runs on `localhost`, `ZipCodeService` will try common local API endpoints automatically:
  - Same-origin path: `${window.location.origin}/api`
  - Common ports: `http://localhost:{5173,3001,8000,8001,8080,5000,7000}/api` (and `127.0.0.1` variants)
- It picks the first healthy endpoint; otherwise, it fails fast with the same clear error.

## Vite Dev Proxy
- Added a dev proxy in `vite.config.js` to forward same-origin `/api` calls to your backend during development.
- Configure target with `VITE_API_PROXY_TARGET` (default: `http://localhost:3001`).
- Example: set `VITE_API_PROXY_TARGET=http://localhost:8000` to use a different local port.

## Rollback
- If functionality breaks, you can temporarily re-enable static-only behavior by disabling Supabase env vars. The UI will continue to function using `public/zipdata.json`.

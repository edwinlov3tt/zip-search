# Supabase Integration

Primary database service for GeoSearch Pro.

## Overview

| Property | Value |
|----------|-------|
| Service | Supabase (PostgreSQL + PostGIS) |
| Purpose | ZIP code data, boundaries, VTD data, share storage |
| SDK | `@supabase/supabase-js` ^2.57.4 |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anonymous/public API key |

## Files Using This Service

- `src/services/zipCodeService.js` - ZIP code queries
- `src/services/zipBoundariesService.js` - Boundary GeoJSON
- `src/services/vtdBoundariesService.js` - VTD district data
- `src/contexts/ShareContext.jsx` - Share link storage

## Database Tables

### `zipcodes`
Main ZIP code data table.
- `zipcode` (text, primary key)
- `city`, `state`, `county`
- `latitude`, `longitude`
- `population`, `households`

### `zip_boundaries`
GeoJSON boundaries for ZIP codes.
- `zipcode` (text, primary key)
- `boundary` (geometry)
- `geojson` (jsonb)

### `vtd_boundaries`
Voting Tabulation Districts.
- `geoid` (text, primary key)
- `state_fips`, `county_fips`
- `boundary` (geometry)

### `shared_searches`
Shared search links storage.
- `id` (uuid, primary key)
- `search_data` (jsonb)
- `created_at` (timestamp)

## Common Queries

### Search ZIP codes by radius
```javascript
const { data } = await supabase.rpc('search_zips_by_radius', {
  lat: 40.7128,
  lng: -74.0060,
  radius_miles: 10
});
```

### Get ZIP boundary
```javascript
const { data } = await supabase
  .from('zip_boundaries')
  .select('geojson')
  .eq('zipcode', '10001')
  .single();
```

## Rate Limits

- Free tier: 500 MB database, 2 GB bandwidth/month
- API requests: Unlimited on free tier
- Realtime connections: 200 concurrent

## Gotchas

1. **PostGIS functions**: Must be enabled in database settings
2. **RLS policies**: Ensure anon key has SELECT access to required tables
3. **Large GeoJSON**: Boundaries can be large, consider pagination

## Official Documentation

- [Supabase Docs](https://supabase.com/docs)
- [PostGIS Reference](https://postgis.net/documentation/)

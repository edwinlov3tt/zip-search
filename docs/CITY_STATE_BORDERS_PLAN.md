# Plan: City & State Borders (API + DB)

This plan outlines two viable paths to add state and city borders like existing ZIP boundaries: (A) serve from your DigitalOcean droplet via PostGIS, or (B) store in Supabase with PostGIS and query via RPC. Pick one or mix: API for heavy polygons, Supabase for unified auth.

## Data Sources
- States (US):
  - Census Cartographic Boundaries (generalized): https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html (State, 1:500k)
  - Natural Earth (admin-1): https://www.naturalearthdata.com (if you need global)
- Cities (US):
  - Census Places (tl_2024_us_place / incorporated + CDP): https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
  - Optional: OSM extracts (admin_level=8) via Geofabrik for worldwide coverage: https://download.geofabrik.de

## Option A: PostGIS API on Droplet (Recommended for performance)
1) Install PostGIS
- `sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib postgis gdal-bin unzip`
- `sudo -u postgres psql -c "CREATE DATABASE geodata;"`
- `sudo -u postgres psql -d geodata -c "CREATE EXTENSION postgis;"`

2) Download and import
- States (Census 1:500k):
  - `wget -O states.zip https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip && unzip states.zip`
  - `ogr2ogr -f PostgreSQL PG:"dbname=geodata" cb_2023_us_state_500k.shp -nln states -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -lco FID=gid -lco PRECISION=NO -t_srs EPSG:4326`
- Cities (Places):
  - `wget -O places.zip https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_us_place.zip && unzip places.zip`
  - `ogr2ogr -f PostgreSQL PG:"dbname=geodata" tl_2024_us_place.shp -nln places -nlt MULTIPOLYGON -lco GEOMETRY_NAME=geom -lco FID=gid -lco PRECISION=NO -t_srs EPSG:4326`

3) Indexes + columns
- `psql geodata <<'SQL'
  ALTER TABLE states ADD COLUMN IF NOT EXISTS code text, ADD COLUMN IF NOT EXISTS name text;
  UPDATE states SET code=stusps, name=NAME WHERE code IS NULL;
  CREATE INDEX IF NOT EXISTS states_gix ON states USING GIST (geom);
  CREATE INDEX IF NOT EXISTS states_code_idx ON states(code);
  
  ALTER TABLE places ADD COLUMN IF NOT EXISTS name text, ADD COLUMN IF NOT EXISTS state_code text;
  UPDATE places p SET name = COALESCE(p.name, p.NAME), state_code = p.STATEFP::text; -- STATEFP to join to state FIPS -> code if needed
  CREATE INDEX IF NOT EXISTS places_gix ON places USING GIST (geom);
  CREATE INDEX IF NOT EXISTS places_name_idx ON places(LOWER(name));
SQL`

4) API endpoints (extend your droplet API)
- Add routes similar to ZIP boundaries (see `scripts/server-postgres.js` for patterns):
  - `GET /state/:code` → single state polygon (with optional `?simplified=true&tol=0.01` using `ST_SimplifyPreserveTopology`).
  - `GET /states/viewport?north=..&south=..&east=..&west=..&limit=..&simplified=true` → FeatureCollection for visible states.
  - `GET /city?name=Dallas&state=TX` → single/multiple place polygons (filter by name + join to state).
  - `GET /cities/viewport?...` → FeatureCollection of places intersecting viewport.
- SQL pattern:
  - Viewport: `SELECT gid, code, name, ST_AsGeoJSON(CASE WHEN $simplified THEN ST_SimplifyPreserveTopology(geom, $tol) ELSE geom END) AS geo FROM states WHERE geom && ST_MakeEnvelope($west,$south,$east,$north,4326) LIMIT $limit;`

5) Front-end integration
- Add `stateBoundariesService`/`cityBoundariesService` mirroring `zipBoundariesService` with caching + viewport loaders.
- Add toggles in the Layers drawer; render via `<GeoJSON data=... />` like ZIP.

## Option B: Supabase + PostGIS
1) Enable PostGIS in Supabase:
- SQL: `create extension if not exists postgis;`

2) Create tables and import
- Create tables:
```sql
create table if not exists states (
  id bigserial primary key,
  code text,
  name text,
  geom geometry(MultiPolygon, 4326)
);
create index if not exists states_gix on states using gist (geom);
create index if not exists states_code_idx on states(code);

create table if not exists places (
  id bigserial primary key,
  name text,
  state_code text,
  geom geometry(MultiPolygon, 4326)
);
create index if not exists places_gix on places using gist (geom);
create index if not exists places_name_idx on places(lower(name));
```
- Import options:
  - Use a one-off import from your droplet (psql) connected to Supabase (recommended), or
  - Convert to GeoJSON newline-delimited and `
    copy places (name,state_code,geom) from program 'curl -s https://.../places.ndjson' csv quote '"' delimiter ',';` (advanced).

3) RPCs
```sql
create or replace function states_in_viewport(north double precision, south double precision, east double precision, west double precision, limit_i int default 50, tol double precision default 0.01)
returns table (code text, name text, geo jsonb)
language sql stable as $$
  select s.code, s.name,
         ST_AsGeoJSON(ST_SimplifyPreserveTopology(s.geom, tol))::jsonb as geo
  from states s
  where s.geom && ST_MakeEnvelope(west, south, east, north, 4326)
  limit limit_i;
$$;

create or replace function places_in_viewport(north double precision, south double precision, east double precision, west double precision, limit_i int default 100, tol double precision default 0.001)
returns table (name text, state_code text, geo jsonb)
language sql stable as $$
  select p.name, p.state_code,
         ST_AsGeoJSON(ST_SimplifyPreserveTopology(p.geom, tol))::jsonb as geo
  from places p
  where p.geom && ST_MakeEnvelope(west, south, east, north, 4326)
  limit limit_i;
$$;
```
- RLS: enable and add SELECT policy for `anon, authenticated`.

4) Front-end
- Add `supabaseBoundariesService` calling `rpc('states_in_viewport', ...)` / `rpc('places_in_viewport', ...)` and adapt to GeoJSON FeatureCollection.

## Notes
- Use simplified geometries for map display; keep full-res in DB.
- Cache responses in `localStorage` (like `boundaryCache`) keyed by viewport.
- For global cities, prefer OSM/Geofabrik + tag filtering.

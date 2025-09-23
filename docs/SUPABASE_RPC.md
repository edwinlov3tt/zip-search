# Supabase RPC for Spatial Searches

This adds precise, server-side spatial filtering using PostGIS so the client fetches only matching ZIPs.

## Prerequisites
- Enable PostGIS:
```sql
create extension if not exists postgis;
```
- Ensure table has coordinates:
  - `zipcodes(latitude numeric, longitude numeric, state_code text, zipcode text, city text, county text)`
  - Add indexes for performance:
```sql
create index if not exists idx_zipcodes_lat on zipcodes(latitude);
create index if not exists idx_zipcodes_lng on zipcodes(longitude);
-- Optional: composite index
create index if not exists idx_zipcodes_lat_lng on zipcodes(latitude, longitude);
```

## Functions
### 1) zips_within_radius
```sql
create or replace function public.zips_within_radius(
  lat double precision,
  lng double precision,
  radius_miles double precision,
  lim integer default 1000,
  off integer default 0
)
returns setof zipcodes
language sql
stable
as $$
  with candidates as (
    select * from zipcodes
    where latitude between lat - (radius_miles/69.0) and lat + (radius_miles/69.0)
      and longitude between lng - (radius_miles/(69.0 * greatest(cos(radians(lat)), 0.01)))
                       and lng + (radius_miles/(69.0 * greatest(cos(radians(lat)), 0.01)))
  )
  select c.*
  from candidates c
  where st_dwithin(
    st_setsrid(st_makepoint(c.longitude, c.latitude), 4326)::geography,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    radius_miles * 1609.34
  )
  offset off
  limit lim;
$$;
```

### 2) zips_within_polygon
Pass a GeoJSON Polygon (WGS84) as `polygon_geojson`.
```sql
create or replace function public.zips_within_polygon(
  polygon_geojson jsonb,
  lim integer default 2000,
  off integer default 0
)
returns setof zipcodes
language sql
stable
as $$
  with poly as (
    select st_setsrid(st_geomfromgeojson(polygon_geojson), 4326) as g
  )
  select z.*
  from zipcodes z, poly
  where st_within(
    st_setsrid(st_makepoint(z.longitude, z.latitude), 4326),
    poly.g
  )
  offset off
  limit lim;
$$;
```

### 3) distinct_states (optional but recommended)
Returns one row per distinct state code.
```sql
create or replace function public.distinct_states()
returns table (code text)
language sql
stable
as $$
  select state_code as code
  from zipcodes
  where state_code is not null
  group by state_code
  order by state_code;
$$;
```

## RLS
RPC respects RLS on `zipcodes`. Ensure read policy exists:
```sql
alter table public.zipcodes enable row level security;
create policy "read zipcodes (public)" on public.zipcodes for select to anon, authenticated using (true);
grant usage on schema public to anon, authenticated;
grant select on public.zipcodes to anon, authenticated;
```

## Client Usage
Already wired in `src/services/supabaseService.js`:
- Radius: `rpc('zips_within_radius', { lat, lng, radius_miles, lim, off })`
- Polygon: `rpc('zips_within_polygon', { polygon_geojson, lim, off })`
 - States: `rpc('distinct_states')` (falls back to select + client de-dup)
Falls back to bounding-box + client-side filters if RPC is absent.

## Verify
- In SQL editor:
```sql
select count(*) from zips_within_radius(32.7767, -96.7970, 10);
select count(*) from zips_within_polygon('{"type":"Polygon","coordinates":[[[-96.9,32.7],[-96.6,32.7],[-96.6,32.9],[-96.9,32.9],[-96.9,32.7]]]}');
```
- In browser devtools Network tab you should see `rpc/zips_within_radius` or `rpc/zips_within_polygon` requests with much smaller payloads.

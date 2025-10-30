# Supabase Database Setup Instructions

## Why Supabase?
- **Free Tier**: 500MB database (perfect for 41,000 ZIP codes)
- **PostgreSQL**: Full SQL capabilities
- **Easy Setup**: 5-minute setup process
- **Vercel Compatible**: Works seamlessly with Vercel deployments

## Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Create a new project:
   - **Project Name**: `zip-search-db`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
   - Click "Create new project" (takes ~2 minutes)

## Step 2: Get Your API Keys

Once your project is ready:

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy these values:
   - **Project URL**: (looks like `https://xxxxx.supabase.co`)
   - **anon public key**: (starts with `eyJ...`)
   - **service_role key**: (also starts with `eyJ...`, keep this SECRET!)

## Step 3: Set Up Environment Variables

### For Local Development

Add the secrets to a `.env` file in the repository root so both Vite and the Edge functions can see them:

```bash
# .env
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

> ⚠️ The Edge functions run on Vercel's Edge Runtime and read from `process.env`. Keep this file out of source control.

### For Vercel Deployment

1. Go to your Vercel dashboard
2. Select the project
3. Navigate to **Settings → Environment Variables**
4. Add the same keys for each environment (Preview/Production):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (mark as Secret)

## Step 4: Enable PostGIS and Create Core Tables

> All SQL below can be pasted into the Supabase SQL editor and run in a single transaction.

```sql
-- Enable spatial + text search extensions
create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ZIP level geographies with high resolution boundaries
create table if not exists public.postal_geographies (
  id bigserial primary key,
  zip_code text not null unique,
  primary_city text,
  county_name text,
  county_fips text,
  state_name text,
  state_code text not null,
  population integer,
  households integer,
  land_area_sq_mi numeric,
  water_area_sq_mi numeric,
  geom geometry(multipolygon, 4326) not null,
  centroid geometry(point, 4326) generated always as (st_centroid(geom)) stored,
  created_at timestamptz default now()
);

create index if not exists postal_geographies_geom_idx on public.postal_geographies using gist (geom);
create index if not exists postal_geographies_zip_idx on public.postal_geographies (zip_code);
create index if not exists postal_geographies_city_idx on public.postal_geographies using gin (primary_city gin_trgm_ops);
create index if not exists postal_geographies_county_idx on public.postal_geographies using gin (county_name gin_trgm_ops);

-- County and state reference layers share the same SRID
create table if not exists public.county_geographies (
  id bigserial primary key,
  county_name text not null,
  county_fips text,
  state_name text,
  state_code text not null,
  population integer,
  geom geometry(multipolygon, 4326) not null,
  centroid geometry(point, 4326) generated always as (st_centroid(geom)) stored
);

create index if not exists county_geographies_geom_idx on public.county_geographies using gist (geom);

create table if not exists public.state_geographies (
  id bigserial primary key,
  state_name text not null,
  state_code text not null unique,
  population integer,
  geom geometry(multipolygon, 4326) not null,
  centroid geometry(point, 4326) generated always as (st_centroid(geom)) stored
);

create index if not exists state_geographies_geom_idx on public.state_geographies using gist (geom);
```

> 💡 Import your preferred TIGER/Line or commercial boundary datasets into these tables. Ensure the geometries are SRID 4326 (WGS84).

## Step 5: Create Search & Boundary RPC Helpers

The Edge functions call SQL helpers instead of issuing ad-hoc queries. Run the snippet below after the tables are populated.

```sql
-- Helper to keep responses consistent
create or replace view public.postal_geographies_enriched as
select
  pg.*,
  st_asgeojson(pg.geom)::jsonb as geometry_geojson,
  st_asgeojson(pg.centroid)::jsonb as centroid_geojson,
  st_asgeojson(st_envelope(pg.geom))::jsonb as bounding_box
from public.postal_geographies pg;

create or replace function public.search_zipcodes(
  query text default null,
  state_filter text default null,
  county_filter text default null,
  city_filter text default null,
  result_limit integer default 200,
  result_offset integer default 0
)
returns table (
  zip_code text,
  primary_city text,
  county_name text,
  county_fips text,
  state_name text,
  state_code text,
  population integer,
  households integer,
  land_area_sq_mi numeric,
  water_area_sq_mi numeric,
  geometry_geojson jsonb,
  centroid_geojson jsonb,
  bounding_box jsonb,
  rank numeric,
  total_count bigint
)
language sql
stable
as $$
with filtered as (
  select
    p.*, 
    case
      when query is null then 1
      when query ~ '^\\d{5}$' and p.zip_code = query then 0
      when query ~ '^\\d{5}$' then 5
      else 10 - similarity(p.primary_city, query)
    end as rank_score
  from public.postal_geographies_enriched p
  where (query is null
         or (query ~ '^\\d{5}$' and p.zip_code = query)
         or (query !~ '^\\d{5}$' and (p.primary_city ilike '%' || query || '%' or p.zip_code ilike query || '%')))
    and (state_filter is null
         or upper(p.state_code) = upper(state_filter)
         or p.state_name ilike '%' || state_filter || '%')
    and (county_filter is null or p.county_name ilike '%' || county_filter || '%')
    and (city_filter is null or p.primary_city ilike '%' || city_filter || '%')
)
select
  f.zip_code,
  f.primary_city,
  f.county_name,
  f.county_fips,
  f.state_name,
  f.state_code,
  f.population,
  f.households,
  f.land_area_sq_mi,
  f.water_area_sq_mi,
  f.geometry_geojson,
  f.centroid_geojson,
  f.bounding_box,
  f.rank_score as rank,
  count(*) over() as total_count
from filtered f
order by f.rank_score, f.zip_code
limit result_limit
offset result_offset;
$$;

create or replace function public.search_zipcodes_within_radius(
  lat double precision,
  lng double precision,
  radius_miles double precision,
  result_limit integer default 200,
  result_offset integer default 0
)
returns table (
  zip_code text,
  primary_city text,
  county_name text,
  county_fips text,
  state_name text,
  state_code text,
  population integer,
  households integer,
  land_area_sq_mi numeric,
  water_area_sq_mi numeric,
  geometry_geojson jsonb,
  centroid_geojson jsonb,
  bounding_box jsonb,
  distance_miles numeric,
  total_count bigint
)
language sql
stable
as $$
with origin as (
  select st_setsrid(st_point(lng, lat), 4326) as geom
),
matches as (
  select
    p.*,
    st_distance(o.geom::geography, p.centroid::geography) / 1609.344 as distance_miles
  from public.postal_geographies_enriched p
  cross join origin o
  where st_dwithin(p.geom::geography, o.geom::geography, radius_miles * 1609.344)
)
select
  m.zip_code,
  m.primary_city,
  m.county_name,
  m.county_fips,
  m.state_name,
  m.state_code,
  m.population,
  m.households,
  m.land_area_sq_mi,
  m.water_area_sq_mi,
  m.geometry_geojson,
  m.centroid_geojson,
  m.bounding_box,
  m.distance_miles,
  count(*) over() as total_count
from matches m
order by m.distance_miles
limit result_limit
offset result_offset;
$$;

create or replace function public.search_zipcodes_within_polygon(
  polygon_geojson jsonb,
  result_limit integer default 200,
  result_offset integer default 0
)
returns table (
  zip_code text,
  primary_city text,
  county_name text,
  county_fips text,
  state_name text,
  state_code text,
  population integer,
  households integer,
  land_area_sq_mi numeric,
  water_area_sq_mi numeric,
  geometry_geojson jsonb,
  centroid_geojson jsonb,
  bounding_box jsonb,
  total_count bigint
)
language sql
stable
as $$
with poly as (
  select st_setsrid(st_geomfromgeojson(polygon_geojson::text), 4326) as geom
)
select
  p.zip_code,
  p.primary_city,
  p.county_name,
  p.county_fips,
  p.state_name,
  p.state_code,
  p.population,
  p.households,
  p.land_area_sq_mi,
  p.water_area_sq_mi,
  p.geometry_geojson,
  p.centroid_geojson,
  p.bounding_box,
  count(*) over() as total_count
from public.postal_geographies_enriched p
cross join poly
where st_intersects(p.geom, poly.geom)
order by p.zip_code
limit result_limit
offset result_offset;
$$;

create or replace function public.get_zip_boundary(zip_code text)
returns table (
  zip_code text,
  primary_city text,
  county_name text,
  county_fips text,
  state_name text,
  state_code text,
  population integer,
  land_area_sq_mi numeric,
  geometry_geojson jsonb,
  centroid_geojson jsonb,
  bounding_box jsonb,
  geometry_type text
)
language sql
stable
as $$
select
  p.zip_code,
  p.primary_city,
  p.county_name,
  p.county_fips,
  p.state_name,
  p.state_code,
  p.population,
  p.land_area_sq_mi,
  p.geometry_geojson,
  p.centroid_geojson,
  p.bounding_box,
  'MultiPolygon'::text as geometry_type
from public.postal_geographies_enriched p
where p.zip_code = zip_code
limit 1;
$$;

create or replace function public.get_county_boundary(
  state_filter text,
  county_filter text
)
returns table (
  county_name text,
  county_fips text,
  state_name text,
  state_code text,
  population integer,
  geometry_geojson jsonb,
  centroid_geojson jsonb,
  bounding_box jsonb,
  geometry_type text
)
language sql
stable
as $$
select
  c.county_name,
  c.county_fips,
  c.state_name,
  c.state_code,
  c.population,
  st_asgeojson(c.geom)::jsonb as geometry_geojson,
  st_asgeojson(c.centroid)::jsonb as centroid_geojson,
  st_asgeojson(st_envelope(c.geom))::jsonb as bounding_box,
  'MultiPolygon'::text as geometry_type
from public.county_geographies c
where (upper(c.state_code) = upper(state_filter) or c.state_name ilike '%' || state_filter || '%')
  and c.county_name ilike '%' || county_filter || '%'
limit 1;
$$;

create or replace function public.get_state_boundary(state_filter text)
returns table (
  state_name text,
  state_code text,
  population integer,
  geometry_geojson jsonb,
  centroid_geojson jsonb,
  bounding_box jsonb,
  geometry_type text
)
language sql
stable
as $$
select
  s.state_name,
  s.state_code,
  s.population,
  st_asgeojson(s.geom)::jsonb as geometry_geojson,
  st_asgeojson(s.centroid)::jsonb as centroid_geojson,
  st_asgeojson(st_envelope(s.geom))::jsonb as bounding_box,
  'MultiPolygon'::text as geometry_type
from public.state_geographies s
where upper(s.state_code) = upper(state_filter) or s.state_name ilike '%' || state_filter || '%'
limit 1;
$$;

grant execute on function public.search_zipcodes to anon, authenticated, service_role;
grant execute on function public.search_zipcodes_within_radius to anon, authenticated, service_role;
grant execute on function public.search_zipcodes_within_polygon to anon, authenticated, service_role;
grant execute on function public.get_zip_boundary to anon, authenticated, service_role;
grant execute on function public.get_county_boundary to anon, authenticated, service_role;
grant execute on function public.get_state_boundary to anon, authenticated, service_role;
```

## Step 6: Test Locally

```bash
# Start the API server
cd api
npm start

# Test the health endpoint
curl http://localhost:3001/api/health
```

You should see:
```json
{
  "status": "OK",
  "database": "connected",
  "provider": "Supabase",
  "totalZipCodes": 41706
}
```

## Step 7: Deploy to Vercel

```bash
git add .
git commit -m "Switch to Supabase database"
git push
```

## Troubleshooting

### "Missing Supabase credentials" Error
- Make sure environment variables are set correctly
- For Vercel: Check Settings → Environment Variables
- For local: Check `.env` file exists in `api` directory

### "Table does not exist" Error
- Run the SQL command in Step 4 to create the table
- Make sure you're in the correct Supabase project

### Import Takes Too Long
- The script imports in batches of 500 records
- Full import of 41,000+ records takes about 2-3 minutes
- Check Supabase dashboard for rate limits if errors occur

### CORS Issues
- The API already has CORS configured for all origins
- If issues persist, check Supabase dashboard → Authentication → URL Configuration

## Monitoring Your Database

1. Go to your Supabase dashboard
2. Click on **Table Editor** to view your data
3. Use **SQL Editor** to run queries
4. Check **Database** tab for usage metrics

## Free Tier Limits

Supabase free tier includes:
- 500 MB database space (ZIP data uses ~10MB)
- 2 GB bandwidth
- 50,000 monthly active users
- Unlimited API requests

Perfect for this application!

## Support

- Supabase Docs: https://supabase.com/docs
- Status Page: https://status.supabase.com
- Discord Community: https://discord.supabase.com

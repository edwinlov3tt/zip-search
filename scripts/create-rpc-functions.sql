-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create VTDs table
CREATE TABLE IF NOT EXISTS vtds (
  id SERIAL PRIMARY KEY,

  -- VTD identification
  vtd_code VARCHAR(20) NOT NULL,
  geoid VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100),

  -- Geographic hierarchy
  state_fips VARCHAR(2) NOT NULL,
  county_fips VARCHAR(3) NOT NULL,
  full_county_fips VARCHAR(5) NOT NULL,

  -- Area measurements
  land_area BIGINT,
  water_area BIGINT,

  -- Geometry (PostGIS)
  geometry GEOMETRY(MultiPolygon, 4326),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_vtds_geoid ON vtds(geoid);
CREATE INDEX IF NOT EXISTS idx_vtds_state_fips ON vtds(state_fips);
CREATE INDEX IF NOT EXISTS idx_vtds_county_fips ON vtds(full_county_fips);
CREATE INDEX IF NOT EXISTS idx_vtds_vtd_code ON vtds(vtd_code);
CREATE INDEX IF NOT EXISTS idx_vtds_geometry ON vtds USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_vtds_state_county ON vtds(state_fips, county_fips);

-- RPC Function: Get VTDs by county FIPS codes
CREATE OR REPLACE FUNCTION get_vtds_by_counties(county_fips_list TEXT[])
RETURNS TABLE (
  vtd_code VARCHAR,
  geoid VARCHAR,
  name VARCHAR,
  state_fips VARCHAR,
  county_fips VARCHAR,
  full_county_fips VARCHAR,
  land_area BIGINT,
  water_area BIGINT,
  geometry_geojson JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.vtd_code,
    v.geoid,
    v.name,
    v.state_fips,
    v.county_fips,
    v.full_county_fips,
    v.land_area,
    v.water_area,
    ST_AsGeoJSON(v.geometry)::JSON as geometry_geojson
  FROM vtds v
  WHERE v.full_county_fips = ANY(county_fips_list);
END;
$$ LANGUAGE plpgsql;

-- RPC Function: Get VTDs within bounding box (fallback)
CREATE OR REPLACE FUNCTION get_vtds_by_bbox(
  min_lng DECIMAL,
  min_lat DECIMAL,
  max_lng DECIMAL,
  max_lat DECIMAL,
  result_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  vtd_code VARCHAR,
  geoid VARCHAR,
  name VARCHAR,
  state_fips VARCHAR,
  county_fips VARCHAR,
  full_county_fips VARCHAR,
  land_area BIGINT,
  water_area BIGINT,
  geometry_geojson JSON
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.vtd_code,
    v.geoid,
    v.name,
    v.state_fips,
    v.county_fips,
    v.full_county_fips,
    v.land_area,
    v.water_area,
    ST_AsGeoJSON(v.geometry)::JSON as geometry_geojson
  FROM vtds v
  WHERE ST_Intersects(
    v.geometry,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  )
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

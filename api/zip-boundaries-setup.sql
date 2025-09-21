-- ZIP Boundaries PostGIS Setup for Supabase
-- Run this after importing ZIP boundary data

-- Create the ZIP boundaries table if it doesn't exist
CREATE TABLE IF NOT EXISTS zip_boundaries (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10) NOT NULL UNIQUE,
  geometry GEOGRAPHY(MULTIPOLYGON, 4326),
  simplified_geometry GEOGRAPHY(MULTIPOLYGON, 4326),
  state_code VARCHAR(2),
  state_name VARCHAR(100),
  county_name VARCHAR(100),
  land_area BIGINT,
  water_area BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_zip_boundaries_geometry
  ON zip_boundaries USING GIST(geometry);

CREATE INDEX IF NOT EXISTS idx_zip_boundaries_simplified
  ON zip_boundaries USING GIST(simplified_geometry);

CREATE INDEX IF NOT EXISTS idx_zip_boundaries_zipcode
  ON zip_boundaries(zipcode);

CREATE INDEX IF NOT EXISTS idx_zip_boundaries_state
  ON zip_boundaries(state_code);

-- Function to get boundaries for visible area (viewport)
CREATE OR REPLACE FUNCTION get_visible_zip_boundaries(
  min_lng FLOAT,
  max_lng FLOAT,
  min_lat FLOAT,
  max_lat FLOAT,
  simplification_tolerance FLOAT DEFAULT 0.001
)
RETURNS TABLE (
  zipcode VARCHAR,
  geojson JSON,
  state_code VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    CASE
      WHEN simplification_tolerance > 0 THEN
        ST_AsGeoJSON(
          ST_Simplify(geometry::geometry, simplification_tolerance)
        )::json
      ELSE
        ST_AsGeoJSON(geometry)::json
    END as geojson,
    state_code
  FROM zip_boundaries
  WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  LIMIT 100; -- Prevent overwhelming the client
$$;

-- Function to get a single ZIP boundary
CREATE OR REPLACE FUNCTION get_zip_boundary(zip_code VARCHAR)
RETURNS TABLE (
  zipcode VARCHAR,
  geojson JSON,
  state_code VARCHAR,
  state_name VARCHAR,
  county_name VARCHAR,
  land_area BIGINT,
  water_area BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    ST_AsGeoJSON(
      ST_Simplify(geometry::geometry, 0.0005)
    )::json as geojson,
    state_code,
    state_name,
    county_name,
    land_area,
    water_area
  FROM zip_boundaries
  WHERE zipcode = zip_code;
$$;

-- Function to search ZIPs that intersect with a polygon
CREATE OR REPLACE FUNCTION get_zips_in_polygon(
  polygon_coords FLOAT[][],
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  zipcode VARCHAR,
  geojson JSON,
  state_code VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH polygon AS (
    SELECT ST_GeomFromText(
      'POLYGON((' ||
      array_to_string(
        ARRAY(
          SELECT coord[1] || ' ' || coord[2]
          FROM unnest(polygon_coords) AS coord
        ),
        ','
      ) || '))',
      4326
    )::geography AS geom
  )
  SELECT
    z.zipcode,
    ST_AsGeoJSON(
      ST_Simplify(z.geometry::geometry, 0.001)
    )::json as geojson,
    z.state_code
  FROM zip_boundaries z, polygon p
  WHERE ST_Intersects(z.geometry, p.geom)
  LIMIT max_results;
$$;

-- Function to get neighboring ZIP codes
CREATE OR REPLACE FUNCTION get_neighboring_zips(
  zip_code VARCHAR,
  max_distance_meters FLOAT DEFAULT 1000
)
RETURNS TABLE (
  zipcode VARCHAR,
  distance_meters FLOAT,
  state_code VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH target_zip AS (
    SELECT geometry
    FROM zip_boundaries
    WHERE zipcode = zip_code
    LIMIT 1
  )
  SELECT
    z.zipcode,
    ST_Distance(z.geometry, t.geometry) as distance_meters,
    z.state_code
  FROM zip_boundaries z, target_zip t
  WHERE z.zipcode != zip_code
    AND ST_DWithin(z.geometry, t.geometry, max_distance_meters)
  ORDER BY distance_meters;
$$;

-- Function to get ZIP boundary statistics
CREATE OR REPLACE FUNCTION get_zip_boundary_stats()
RETURNS TABLE (
  total_zips BIGINT,
  states_covered BIGINT,
  avg_land_area NUMERIC,
  avg_water_area NUMERIC,
  last_updated TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::BIGINT as total_zips,
    COUNT(DISTINCT state_code)::BIGINT as states_covered,
    ROUND(AVG(land_area), 2) as avg_land_area,
    ROUND(AVG(water_area), 2) as avg_water_area,
    MAX(created_at) as last_updated
  FROM zip_boundaries;
$$;

-- Pre-generate simplified geometries for common zoom levels
-- Run this after importing data for better performance
CREATE OR REPLACE PROCEDURE update_simplified_geometries()
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE zip_boundaries
  SET simplified_geometry = ST_Simplify(geometry::geometry, 0.001)::geography
  WHERE simplified_geometry IS NULL;

  RAISE NOTICE 'Simplified geometries updated successfully';
END;
$$;

-- Grant permissions for Supabase access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON zip_boundaries TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_visible_zip_boundaries TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_zip_boundary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_zips_in_polygon TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_neighboring_zips TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_zip_boundary_stats TO anon, authenticated;

-- Create a view for basic ZIP boundary info (without geometry)
CREATE OR REPLACE VIEW zip_boundary_info AS
SELECT
  zipcode,
  state_code,
  state_name,
  county_name,
  land_area,
  water_area,
  created_at
FROM zip_boundaries;

GRANT SELECT ON zip_boundary_info TO anon, authenticated;

-- Test the setup
SELECT 'ZIP Boundaries setup complete!' as status,
       COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_name = 'zip_boundaries';
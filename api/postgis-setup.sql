-- =====================================================
-- PostGIS Setup for ZIP Code Spatial Search
-- =====================================================

-- Step 1: Enable PostGIS Extension
-- Run this first to enable spatial capabilities
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Create the new spatial table
DROP TABLE IF EXISTS zipcodes_spatial CASCADE;

CREATE TABLE zipcodes_spatial (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10) NOT NULL UNIQUE,
  city VARCHAR(100),
  state VARCHAR(50),
  state_code VARCHAR(2),
  county VARCHAR(100),
  county_code VARCHAR(10),
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6),
  -- PostGIS spatial column - stores as geography for accurate distance calculations
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create indexes for performance
-- Spatial index for geography queries (most important!)
CREATE INDEX idx_zipcodes_spatial_location ON zipcodes_spatial USING GIST(location);

-- Regular indexes for text searches
CREATE INDEX idx_zipcodes_spatial_zipcode ON zipcodes_spatial(zipcode);
CREATE INDEX idx_zipcodes_spatial_state_code ON zipcodes_spatial(state_code);
CREATE INDEX idx_zipcodes_spatial_city ON zipcodes_spatial(LOWER(city));
CREATE INDEX idx_zipcodes_spatial_county ON zipcodes_spatial(LOWER(county));

-- Composite index for state + city searches
CREATE INDEX idx_zipcodes_spatial_state_city ON zipcodes_spatial(state_code, LOWER(city));

-- Step 4: Migrate data from existing table
INSERT INTO zipcodes_spatial (
  zipcode, city, state, state_code, county, county_code,
  latitude, longitude, location
)
SELECT
  zipcode,
  city,
  state,
  state_code,
  county,
  county_code,
  latitude,
  longitude,
  -- Create PostGIS point from coordinates
  ST_MakePoint(longitude, latitude)::geography
FROM zipcodes
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude BETWEEN -90 AND 90
  AND longitude BETWEEN -180 AND 180;

-- Step 5: Create optimized RPC functions for the API

-- Function 1: Radius Search
-- Returns all ZIP codes within X miles of a point
CREATE OR REPLACE FUNCTION search_by_radius(
  center_lng DOUBLE PRECISION,
  center_lat DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION,
  max_results INTEGER DEFAULT 1000
)
RETURNS TABLE (
  zipcode VARCHAR,
  city VARCHAR,
  state VARCHAR,
  state_code VARCHAR,
  county VARCHAR,
  county_code VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_miles DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    city,
    state,
    state_code,
    county,
    county_code,
    latitude,
    longitude,
    ROUND((ST_Distance(location, ST_MakePoint(center_lng, center_lat)::geography) / 1609.34)::NUMERIC, 2)::DOUBLE PRECISION as distance_miles
  FROM zipcodes_spatial
  WHERE ST_DWithin(
    location,
    ST_MakePoint(center_lng, center_lat)::geography,
    radius_miles * 1609.34  -- Convert miles to meters
  )
  ORDER BY distance_miles
  LIMIT max_results;
$$;

-- Function 2: Polygon Search
-- Returns all ZIP codes within a polygon
CREATE OR REPLACE FUNCTION search_by_polygon(
  polygon_coords JSON,
  max_results INTEGER DEFAULT 1000
)
RETURNS TABLE (
  zipcode VARCHAR,
  city VARCHAR,
  state VARCHAR,
  state_code VARCHAR,
  county VARCHAR,
  county_code VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  polygon_text TEXT;
  coord JSON;
  points TEXT[] := '{}';
  first_point TEXT;
BEGIN
  -- Convert JSON array [{lat, lng}, ...] to WKT format
  FOR coord IN SELECT * FROM json_array_elements(polygon_coords)
  LOOP
    points := array_append(points,
      (coord->>'lng')::TEXT || ' ' || (coord->>'lat')::TEXT
    );
  END LOOP;

  -- Store first point to close polygon
  IF array_length(points, 1) > 0 THEN
    first_point := points[1];
    -- Close the polygon by adding first point at end if not already closed
    IF points[array_length(points, 1)] != first_point THEN
      points := array_append(points, first_point);
    END IF;
  END IF;

  -- Create WKT polygon string
  polygon_text := 'POLYGON((' || array_to_string(points, ', ') || '))';

  -- Return ZIP codes within polygon
  RETURN QUERY
  SELECT
    z.zipcode,
    z.city,
    z.state,
    z.state_code,
    z.county,
    z.county_code,
    z.latitude,
    z.longitude
  FROM zipcodes_spatial z
  WHERE ST_Within(
    z.location::geometry,
    ST_GeomFromText(polygon_text, 4326)
  )
  LIMIT max_results;
END;
$$;

-- Function 3: Nearest Neighbors
-- Find the N closest ZIP codes to a point
CREATE OR REPLACE FUNCTION search_nearest(
  center_lng DOUBLE PRECISION,
  center_lat DOUBLE PRECISION,
  num_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  zipcode VARCHAR,
  city VARCHAR,
  state VARCHAR,
  state_code VARCHAR,
  county VARCHAR,
  county_code VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_miles DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    city,
    state,
    state_code,
    county,
    county_code,
    latitude,
    longitude,
    ROUND((ST_Distance(location, ST_MakePoint(center_lng, center_lat)::geography) / 1609.34)::NUMERIC, 2)::DOUBLE PRECISION as distance_miles
  FROM zipcodes_spatial
  ORDER BY location <-> ST_MakePoint(center_lng, center_lat)::geography
  LIMIT num_results;
$$;

-- Function 4: Bounding Box Search
-- Returns all ZIP codes within a rectangular area
CREATE OR REPLACE FUNCTION search_by_bounds(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_results INTEGER DEFAULT 1000
)
RETURNS TABLE (
  zipcode VARCHAR,
  city VARCHAR,
  state VARCHAR,
  state_code VARCHAR,
  county VARCHAR,
  county_code VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    city,
    state,
    state_code,
    county,
    county_code,
    latitude,
    longitude
  FROM zipcodes_spatial
  WHERE latitude BETWEEN min_lat AND max_lat
    AND longitude BETWEEN min_lng AND max_lng
  LIMIT max_results;
$$;

-- Step 6: Create materialized view for unique states (for performance)
CREATE MATERIALIZED VIEW states_view AS
SELECT DISTINCT
  state_code as code,
  state as name
FROM zipcodes_spatial
WHERE state_code IS NOT NULL
  AND state IS NOT NULL
  AND state_code != ''
  AND state != ''
ORDER BY state;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_states_view_code ON states_view(code);

-- Step 7: Grant permissions (for Row Level Security)
ALTER TABLE zipcodes_spatial ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON zipcodes_spatial
  FOR SELECT USING (true);

-- Step 8: Verify the migration
DO $$
DECLARE
  old_count INTEGER;
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_count FROM zipcodes;
  SELECT COUNT(*) INTO new_count FROM zipcodes_spatial;

  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Original table: % records', old_count;
  RAISE NOTICE 'Spatial table: % records', new_count;
  RAISE NOTICE 'Difference: % records', old_count - new_count;

  -- Test spatial queries
  RAISE NOTICE 'Testing spatial functions...';

  -- Test radius search
  PERFORM * FROM search_by_radius(-96.7970, 32.7767, 10, 5);
  RAISE NOTICE '✓ Radius search working';

  -- Test nearest neighbor
  PERFORM * FROM search_nearest(-96.7970, 32.7767, 5);
  RAISE NOTICE '✓ Nearest neighbor search working';

  RAISE NOTICE 'All tests passed! PostGIS setup complete.';
END $$;
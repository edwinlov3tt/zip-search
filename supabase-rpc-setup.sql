-- Supabase RPC Functions for Boundary Data
-- Run these commands in your Supabase SQL Editor

-- 1. ZIP Boundary RPC Function
CREATE OR REPLACE FUNCTION get_zip_boundary(zip_code text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    SELECT row_to_json(z.*) INTO result
    FROM zip_codes z
    WHERE z.zip_code = get_zip_boundary.zip_code
    LIMIT 1;

    RETURN result;
END;
$$;

-- 2. State Boundary RPC Function
CREATE OR REPLACE FUNCTION get_state_boundary(state_filter text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Try to match by state code (2-letter) or state name
    SELECT row_to_json(s.*) INTO result
    FROM (
        SELECT DISTINCT
            state as state_code,
            state as state_name,
            NULL as geometry_geojson,
            NULL as centroid_geojson,
            NULL as bounding_box,
            NULL as population,
            NULL as area_sq_mi,
            'MultiPolygon' as geometry_type
        FROM zip_codes
        WHERE UPPER(state) = UPPER(state_filter)
        LIMIT 1
    ) s;

    RETURN result;
END;
$$;

-- 3. County Boundary RPC Function
CREATE OR REPLACE FUNCTION get_county_boundary(state_filter text, county_filter text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Try to match by county and state
    SELECT row_to_json(c.*) INTO result
    FROM (
        SELECT DISTINCT
            county as county_name,
            state as state_code,
            state as state_name,
            NULL as geometry_geojson,
            NULL as centroid_geojson,
            NULL as bounding_box,
            NULL as county_fips,
            NULL as population,
            NULL as area_sq_mi,
            'MultiPolygon' as geometry_type
        FROM zip_codes
        WHERE UPPER(state) = UPPER(state_filter)
        AND UPPER(county) LIKE '%' || UPPER(county_filter) || '%'
        LIMIT 1
    ) c;

    RETURN result;
END;
$$;

-- 4. City Boundary RPC Function (for future use)
CREATE OR REPLACE FUNCTION get_city_boundary(city_filter text, state_filter text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    -- Try to match by city and state
    SELECT row_to_json(c.*) INTO result
    FROM (
        SELECT DISTINCT
            city as city_name,
            state as state_code,
            state as state_name,
            NULL as geometry_geojson,
            NULL as centroid_geojson,
            NULL as bounding_box,
            NULL as population,
            NULL as area_sq_mi,
            'MultiPolygon' as geometry_type
        FROM zip_codes
        WHERE UPPER(state) = UPPER(state_filter)
        AND UPPER(city) LIKE '%' || UPPER(city_filter) || '%'
        LIMIT 1
    ) c;

    RETURN result;
END;
$$;

-- Grant permissions (adjust based on your needs)
GRANT EXECUTE ON FUNCTION get_zip_boundary(text) TO anon;
GRANT EXECUTE ON FUNCTION get_zip_boundary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_state_boundary(text) TO anon;
GRANT EXECUTE ON FUNCTION get_state_boundary(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_county_boundary(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_county_boundary(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_city_boundary(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_city_boundary(text, text) TO authenticated;
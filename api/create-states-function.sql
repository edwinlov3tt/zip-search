-- Create an RPC function to get distinct states efficiently
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_distinct_states()
RETURNS TABLE (
  state_code VARCHAR,
  state VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    state_code,
    state
  FROM zipcodes_spatial
  WHERE state_code IS NOT NULL
    AND state IS NOT NULL
    AND state_code != ''
    AND state != ''
  ORDER BY state;
$$;

-- Test the function
SELECT * FROM get_distinct_states();
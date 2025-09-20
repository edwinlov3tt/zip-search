-- Create the zipcodes table in Supabase
CREATE TABLE IF NOT EXISTS zipcodes (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10) NOT NULL UNIQUE,
  city VARCHAR(100),
  state VARCHAR(50),
  state_code VARCHAR(2),
  county VARCHAR(100),
  county_code VARCHAR(10),
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_zipcode ON zipcodes(zipcode);
CREATE INDEX IF NOT EXISTS idx_city ON zipcodes(LOWER(city));
CREATE INDEX IF NOT EXISTS idx_state ON zipcodes(state_code);
CREATE INDEX IF NOT EXISTS idx_county ON zipcodes(LOWER(county));

-- Grant permissions (Supabase handles this automatically, but included for completeness)
GRANT ALL ON zipcodes TO anon;
GRANT ALL ON zipcodes TO authenticated;
GRANT USAGE ON SEQUENCE zipcodes_id_seq TO anon;
GRANT USAGE ON SEQUENCE zipcodes_id_seq TO authenticated;
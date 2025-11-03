# VTD (Voting Tabulation Districts) Setup Guide

## Overview

This guide explains how to set up VTD boundaries in your ZIP search application using Census Cartographic Boundary Files and Supabase, creating your own VTD API similar to the ZIP code system.

## Problem Solved

The Census Tiger API has limitations that prevent querying VTD features with geometry. This solution downloads static VTD data from Census, converts it to GeoJSON, and loads it into Supabase for fast, reliable queries.

## Architecture

```
Census Bureau → Shapefiles → GeoJSON → Supabase PostGIS → Your API
```

**County-Based Loading Strategy:**
- User searches for ZIPs in specific areas
- System extracts counties from results
- Queries Supabase for VTDs by county FIPS codes
- Example: Lubbock County returns ~150 VTDs (not 8,000+ statewide)

## Files Created

### Scripts
- **`scripts/convert-vtd-shapefile.cjs`** - Converts Census shapefiles to GeoJSON
- **`scripts/setup-vtd-table.cjs`** - Generates SQL for VTD table creation
- **`scripts/import-vtd-data.cjs`** - Imports GeoJSON data into Supabase

### Services
- **`src/services/countyFipsService.js`** - Maps county names to FIPS codes (30+ major counties included)
- **`src/services/vtdBoundariesService.js`** - VTD API with county-based query method

### Components
- **`src/components/Map/BoundaryManager.jsx`** - Updated with county-based VTD loading
- **`src/components/Map/layers/VtdBoundaryLayer.jsx`** - Interactive VTD map layer
- **`src/components/Results/BoundarySettings.jsx`** - VTD toggle control

## Data Sources

**Census Cartographic Boundary Files (2020):**
- URL: https://www2.census.gov/geo/tiger/GENZ2020/shp/
- Format: `cb_2020_[FIPS]_vtd_500k.zip`
- Texas example: `cb_2020_48_vtd_500k.zip` (6.4MB → 9,007 VTDs)

**State FIPS Codes (commonly needed):**
- Texas (TX): 48
- California (CA): 06
- New York (NY): 36
- Florida (FL): 12
- Illinois (IL): 17

## Setup Instructions

### Step 1: Create VTD Table in Supabase

Go to: https://supabase.com/dashboard/project/xpdvxliqbrctzyxmijmm/sql/new

Run this SQL:

```sql
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
CREATE INDEX idx_vtds_geoid ON vtds(geoid);
CREATE INDEX idx_vtds_state_fips ON vtds(state_fips);
CREATE INDEX idx_vtds_county_fips ON vtds(full_county_fips);
CREATE INDEX idx_vtds_vtd_code ON vtds(vtd_code);
CREATE INDEX idx_vtds_geometry ON vtds USING GIST(geometry);
CREATE INDEX idx_vtds_state_county ON vtds(state_fips, county_fips);
```

### Step 2: Enable PostGIS Extension

If not already enabled:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Step 3: Download and Convert Texas VTD Data

```bash
# Already completed - files in temp-vtd-data/
# texas-vtd.geojson (47MB, 9,007 features)
```

### Step 4: Import Texas VTD Data

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-key-here"
node scripts/import-vtd-data.cjs temp-vtd-data/texas-vtd.geojson
```

Expected output:
```
[VTD Import] Total features to import: 9007
[VTD Import] Progress: 100/9007 (1%)
[VTD Import] Progress: 200/9007 (2%)
...
[VTD Import] Complete!
[VTD Import] Imported: 9007
[VTD Import] Errors: 0
```

### Step 5: Add More States (Optional)

Download and process additional states:

```bash
# Download California VTDs
cd temp-vtd-data
curl -o california_vtd.zip "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_06_vtd_500k.zip"
unzip california_vtd.zip

# Convert to GeoJSON
cd ..
node scripts/convert-vtd-shapefile.cjs temp-vtd-data/cb_2020_06_vtd_500k.shp temp-vtd-data/california-vtd.geojson

# Import to Supabase
export SUPABASE_SERVICE_ROLE_KEY="your-service-key-here"
node scripts/import-vtd-data.cjs temp-vtd-data/california-vtd.geojson
```

### Step 6: Create Supabase RPC Functions

Go to SQL Editor and create these functions:

```sql
-- Get VTDs by county FIPS codes
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

-- Get VTDs within bounding box (fallback)
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
```

### Step 7: Update VTD Service (TODO)

Update `src/services/vtdBoundariesService.js` to use Supabase RPC functions instead of Tiger API.

## Data Statistics

### Texas VTDs
- **Total VTDs**: 9,007
- **GeoJSON Size**: 47MB
- **Counties**: 254
- **Largest County**: Harris (Houston) - ~800 VTDs
- **Typical County**: Lubbock - ~150 VTDs

### All US VTDs (Estimated)
- **Total VTDs**: ~150,000
- **Total Size**: 1-2GB
- **States**: 50 + DC + Puerto Rico

## Query Examples

### By County FIPS
```javascript
// Lubbock County, TX (FIPS: 48303)
const { data } = await supabase.rpc('get_vtds_by_counties', {
  county_fips_list: ['48303']
});
// Returns ~150 VTDs
```

### By Multiple Counties
```javascript
// Lubbock + Harris counties
const { data } = await supabase.rpc('get_vtds_by_counties', {
  county_fips_list: ['48303', '48201']
});
// Returns ~950 VTDs
```

### By Bounding Box (Fallback)
```javascript
// Lubbock area
const { data } = await supabase.rpc('get_vtds_by_bbox', {
  min_lng: -102.0,
  min_lat: 33.3,
  max_lng: -101.6,
  max_lat: 33.7,
  result_limit: 500
});
```

## Frontend Integration

### How It Works

1. **User searches** → ZIP results returned
2. **Extract counties** → "Lubbock, TX" from results
3. **Lookup FIPS** → countyFipsService.getCountyFips("Lubbock", "TX") → "48303"
4. **Query Supabase** → get_vtds_by_counties(['48303'])
5. **Display VTDs** → 150 boundaries shown on map

### County FIPS Lookup

The `countyFipsService.js` includes 30+ major US counties:
- All Texas metro areas (Houston, Dallas, Austin, San Antonio, etc.)
- Major cities (NYC, LA, Chicago, etc.)

For unmapped counties, it falls back to Census API lookup.

## Performance Optimizations

- **PostGIS Spatial Indexes**: Fast geometry queries
- **County-based caching**: 5-minute TTL per county
- **Batch queries**: Multiple counties in single request
- **Simplified geometry**: 500k resolution (good for web display)

## Troubleshooting

### Import Fails with Geometry Error
```bash
# Check if PostGIS is enabled
SELECT PostGIS_version();
```

### No VTDs Returned
```bash
# Check data exists
SELECT state_fips, COUNT(*) FROM vtds GROUP BY state_fips;

# Check specific county
SELECT * FROM vtds WHERE full_county_fips = '48303' LIMIT 5;
```

### County FIPS Not Found
```javascript
// Add to countyFipsService.js COUNTY_FIPS_MAP
'Your County,ST': '12345',
```

## Next Steps

1. ✅ Table created in Supabase
2. ✅ Texas VTDs imported
3. ✅ RPC functions created
4. ⏳ Update vtdBoundariesService.js to use Supabase
5. ⏳ Add more states as needed
6. ⏳ Test with real searches

## Resources

- **Census VTD Files**: https://www2.census.gov/geo/tiger/GENZ2020/shp/
- **PostGIS Documentation**: https://postgis.net/docs/
- **Supabase PostGIS Guide**: https://supabase.com/docs/guides/database/extensions/postgis
- **FIPS Codes**: https://www.census.gov/library/reference/code-lists/ansi.html

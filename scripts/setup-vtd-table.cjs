#!/usr/bin/env node
/**
 * Setup VTD (Voting Tabulation Districts) table in Supabase
 * Creates table, imports GeoJSON data, and sets up spatial indexes
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xpdvxliqbrctzyxmijmm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Set it with: export SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupVTDTable() {
  console.log('[VTD Setup] Creating VTD table in Supabase...\n');

  // SQL to create VTD table with PostGIS geometry
  const createTableSQL = `
    -- Drop existing table if it exists (be careful!)
    -- DROP TABLE IF EXISTS vtds CASCADE;

    -- Create VTDs table
    CREATE TABLE IF NOT EXISTS vtds (
      id SERIAL PRIMARY KEY,

      -- VTD identification
      vtd_code VARCHAR(20) NOT NULL,           -- VTD code (VTDST20)
      geoid VARCHAR(20) NOT NULL UNIQUE,       -- Full GEOID (state+county+vtd)
      name VARCHAR(100),                        -- VTD name

      -- Geographic hierarchy
      state_fips VARCHAR(2) NOT NULL,          -- State FIPS code
      county_fips VARCHAR(3) NOT NULL,         -- County FIPS code (3 digits)
      full_county_fips VARCHAR(5) NOT NULL,    -- Full county FIPS (state+county)

      -- Area measurements
      land_area BIGINT,                        -- Land area in square meters
      water_area BIGINT,                       -- Water area in square meters

      -- Geometry (PostGIS)
      geometry GEOMETRY(MultiPolygon, 4326),   -- WGS84 coordinate system

      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for fast queries
    CREATE INDEX IF NOT EXISTS idx_vtds_geoid ON vtds(geoid);
    CREATE INDEX IF NOT EXISTS idx_vtds_state_fips ON vtds(state_fips);
    CREATE INDEX IF NOT EXISTS idx_vtds_county_fips ON vtds(full_county_fips);
    CREATE INDEX IF NOT EXISTS idx_vtds_vtd_code ON vtds(vtd_code);

    -- Create spatial index on geometry
    CREATE INDEX IF NOT EXISTS idx_vtds_geometry ON vtds USING GIST(geometry);

    -- Create composite index for county queries
    CREATE INDEX IF NOT EXISTS idx_vtds_state_county ON vtds(state_fips, county_fips);
  `;

  console.log('SQL to execute in Supabase SQL Editor:\n');
  console.log('=' + '='.repeat(79));
  console.log(createTableSQL);
  console.log('=' + '='.repeat(79));
  console.log('\n⚠️  NOTE: You need to run this SQL manually in Supabase SQL Editor');
  console.log('    (Supabase client does not support CREATE TABLE via RPC)\n');
  console.log('Steps:');
  console.log('1. Go to https://supabase.com/dashboard/project/xpdvxliqbrctzyxmijmm/sql/new');
  console.log('2. Copy and paste the SQL above');
  console.log('3. Click "Run" to execute');
  console.log('4. Then run: node scripts/import-vtd-data.cjs <geojson-file>');
  console.log();

  return createTableSQL;
}

// Main execution
if (require.main === module) {
  setupVTDTable()
    .then(() => {
      console.log('✅ Setup instructions displayed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { setupVTDTable };

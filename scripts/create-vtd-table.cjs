#!/usr/bin/env node
/**
 * Create VTD table in Supabase programmatically
 * Usage: node scripts/create-vtd-table.cjs
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xpdvxliqbrctzyxmijmm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createVTDTable() {
  console.log('[VTD Table] Creating VTD table in Supabase...\n');

  // SQL to create VTD table
  const createTableSQL = `
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
  `;

  try {
    // Execute SQL via RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
      // If exec_sql doesn't exist, we need to create it first or use alternative approach
      console.log('[VTD Table] Direct SQL execution not available.');
      console.log('[VTD Table] Please execute the following SQL manually in Supabase SQL Editor:\n');
      console.log('=' + '='.repeat(79));
      console.log(createTableSQL);
      console.log('=' + '='.repeat(79));
      console.log('\n📋 Steps:');
      console.log('1. Go to https://supabase.com/dashboard/project/xpdvxliqbrctzyxmijmm/sql/new');
      console.log('2. Copy and paste the SQL above');
      console.log('3. Click "Run" to execute');
      console.log('4. Return here and press Enter to continue\n');

      // Wait for user confirmation
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => {
        console.log('✅ Continuing with import...\n');
        process.exit(0);
      });
      return;
    }

    console.log('✅ VTD table created successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);

    // Fallback: Print SQL for manual execution
    console.log('\n[VTD Table] Please execute the following SQL manually in Supabase SQL Editor:\n');
    console.log('=' + '='.repeat(79));
    console.log(createTableSQL);
    console.log('=' + '='.repeat(79));
    console.log('\n📋 Steps:');
    console.log('1. Go to https://supabase.com/dashboard/project/xpdvxliqbrctzyxmijmm/sql/new');
    console.log('2. Copy and paste the SQL above');
    console.log('3. Click "Run" to execute\n');
  }
}

// Main execution
if (require.main === module) {
  createVTDTable()
    .then(() => {
      console.log('✅ Setup complete');
    })
    .catch((error) => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { createVTDTable };

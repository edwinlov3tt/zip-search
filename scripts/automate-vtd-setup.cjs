#!/usr/bin/env node
/**
 * Automated VTD Setup Script
 * This script automates the entire VTD setup process:
 * 1. Checks if table exists
 * 2. Imports Texas VTD data
 * 3. Verifies import success
 *
 * Prerequisites:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 * - temp-vtd-data/texas-vtd.geojson must exist
 * - SQL table and functions must be created manually first (see create-rpc-functions.sql)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xpdvxliqbrctzyxmijmm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Set it with: export SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTableExists() {
  console.log('[VTD Setup] Checking if vtds table exists...');

  try {
    const { data, error } = await supabase
      .from('vtds')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('relation "public.vtds" does not exist')) {
        return false;
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[VTD Setup] Error checking table:', error.message);
    return false;
  }
}

async function getVtdCount() {
  try {
    const { count, error } = await supabase
      .from('vtds')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('[VTD Setup] Error counting VTDs:', error.message);
    return 0;
  }
}

async function importVTDData(geojsonPath) {
  console.log(`[VTD Import] Reading GeoJSON: ${geojsonPath}`);

  if (!fs.existsSync(geojsonPath)) {
    throw new Error(`GeoJSON file not found: ${geojsonPath}`);
  }

  const geojsonContent = fs.readFileSync(geojsonPath, 'utf8');
  const geojson = JSON.parse(geojsonContent);

  console.log(`[VTD Import] Total features to import: ${geojson.features.length}`);

  const BATCH_SIZE = 100;
  let imported = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < geojson.features.length; i += BATCH_SIZE) {
    const batch = geojson.features.slice(i, i + BATCH_SIZE);

    // Transform features to database records
    const records = batch.map(feature => {
      const props = feature.properties;
      const geom = feature.geometry;

      return {
        vtd_code: props.VTDST20,
        geoid: props.GEOID20,
        name: props.NAME20 || props.NAMELSAD20,
        state_fips: props.STATEFP20,
        county_fips: props.COUNTYFP20,
        full_county_fips: props.STATEFP20 + props.COUNTYFP20,
        land_area: parseInt(props.ALAND20) || 0,
        water_area: parseInt(props.AWATER20) || 0,
        geometry: `SRID=4326;${convertToWKT(geom)}`
      };
    });

    try {
      const { error } = await supabase
        .from('vtds')
        .insert(records);

      if (error) {
        console.error(`[VTD Import] Batch ${Math.floor(i/BATCH_SIZE) + 1} error:`, error.message);
        errors += batch.length;
      } else {
        imported += batch.length;
        const progress = Math.round(imported/geojson.features.length*100);
        process.stdout.write(`\r[VTD Import] Progress: ${imported}/${geojson.features.length} (${progress}%)`);
      }
    } catch (error) {
      console.error(`\n[VTD Import] Batch ${Math.floor(i/BATCH_SIZE) + 1} exception:`, error.message);
      errors += batch.length;
    }
  }

  console.log(`\n\n[VTD Import] Complete!`);
  console.log(`[VTD Import] Imported: ${imported}`);
  console.log(`[VTD Import] Errors: ${errors}`);

  return { imported, errors };
}

function convertToWKT(geometry) {
  if (geometry.type === 'Polygon') {
    return `MULTIPOLYGON(${polygonToWKT(geometry.coordinates)})`;
  } else if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates.map(poly => polygonToWKT([poly[0]])).join(',');
    return `MULTIPOLYGON(${polygons})`;
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`);
}

function polygonToWKT(coordinates) {
  return coordinates.map(ring => {
    const points = ring.map(coord => `${coord[0]} ${coord[1]}`).join(',');
    return `((${points}))`;
  }).join(',');
}

async function main() {
  console.log('═'.repeat(80));
  console.log('VTD AUTOMATED SETUP');
  console.log('═'.repeat(80));
  console.log();

  // Step 1: Check if table exists
  const tableExists = await checkTableExists();

  if (!tableExists) {
    console.log('❌ VTDs table does not exist in Supabase');
    console.log('\n📋 Please run the SQL in scripts/create-rpc-functions.sql first:');
    console.log('   1. Go to https://supabase.com/dashboard/project/xpdvxliqbrctzyxmijmm/sql/new');
    console.log('   2. Copy and paste the SQL from scripts/create-rpc-functions.sql');
    console.log('   3. Click "Run" to execute');
    console.log('   4. Run this script again\n');
    process.exit(1);
  }

  console.log('✅ VTDs table exists');

  // Step 2: Check current count
  const currentCount = await getVtdCount();
  console.log(`[VTD Setup] Current VTD count: ${currentCount}`);

  if (currentCount > 0) {
    console.log('\n⚠️  VTDs table already contains data');
    console.log('   Do you want to:');
    console.log('   1. Skip import (table already populated)');
    console.log('   2. Continue anyway (may create duplicates)');
    console.log('\nRecommendation: If you have ~9,000 VTDs, the import is complete. Exiting...\n');

    if (currentCount > 8000) {
      console.log('✅ Import appears to be complete!');
      console.log(`   ${currentCount} VTDs found in database`);
      process.exit(0);
    }
  }

  // Step 3: Import data
  const geojsonPath = 'temp-vtd-data/texas-vtd.geojson';

  console.log('\n[VTD Setup] Starting import...\n');
  const { imported, errors } = await importVTDData(geojsonPath);

  // Step 4: Verify import
  const finalCount = await getVtdCount();

  console.log('\n═'.repeat(80));
  console.log('SETUP COMPLETE');
  console.log('═'.repeat(80));
  console.log(`Total VTDs in database: ${finalCount}`);
  console.log(`Imported this run: ${imported}`);
  console.log(`Errors: ${errors}`);
  console.log();

  if (errors === 0 && finalCount > 8000) {
    console.log('✅ VTD setup successful!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update vtdBoundariesService.js to use Supabase');
    console.log('   2. Test with a Lubbock search');
    console.log();
  } else if (errors > 0) {
    console.log('⚠️  Import completed with errors');
    console.log('   Review error messages above');
  }
}

// Run main
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  });

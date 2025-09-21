#!/usr/bin/env node

/**
 * ZIP Boundaries Import Script for Supabase
 *
 * This script helps import ZIP boundary data from Census Bureau shapefiles
 * into your Supabase PostGIS database.
 *
 * Usage:
 *   node import-zip-boundaries.js [options]
 *
 * Options:
 *   --download    Download the Census Bureau ZIP boundaries
 *   --convert     Convert shapefile to GeoJSON
 *   --import      Import to Supabase
 *   --test        Test the imported data
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Import using ES modules in Node
async function loadDependencies() {
  const { createClient } = await import('@supabase/supabase-js');
  return { createClient };
}

// Configuration
const CONFIG = {
  CENSUS_URL: 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip',
  DOWNLOAD_DIR: path.join(process.cwd(), 'temp_boundaries'),
  SHAPEFILE_NAME: 'cb_2020_us_zcta520_500k',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📘',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    step: '🔹'
  }[type] || '📘';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`, 'success');
  }
}

// Step 1: Download Census Bureau data
async function downloadBoundaries() {
  log('Starting download of Census Bureau ZIP boundaries...', 'step');

  await ensureDirectory(CONFIG.DOWNLOAD_DIR);

  const zipFile = path.join(CONFIG.DOWNLOAD_DIR, 'zcta.zip');

  try {
    // Download using curl
    const downloadCmd = `curl -L "${CONFIG.CENSUS_URL}" -o "${zipFile}" --progress-bar`;
    log(`Downloading from: ${CONFIG.CENSUS_URL}`);

    await execPromise(downloadCmd);
    log('Download complete!', 'success');

    // Extract the zip file
    log('Extracting shapefile...', 'step');
    await execPromise(`unzip -o "${zipFile}" -d "${CONFIG.DOWNLOAD_DIR}"`);
    log('Extraction complete!', 'success');

    // List extracted files
    const files = fs.readdirSync(CONFIG.DOWNLOAD_DIR);
    log(`Extracted files: ${files.join(', ')}`);

    return true;
  } catch (error) {
    log(`Download failed: ${error.message}`, 'error');
    return false;
  }
}

// Step 2: Convert shapefile to GeoJSON
async function convertToGeoJSON() {
  log('Converting shapefile to GeoJSON...', 'step');

  const shapeFile = path.join(CONFIG.DOWNLOAD_DIR, `${CONFIG.SHAPEFILE_NAME}.shp`);
  const geoJsonFile = path.join(CONFIG.DOWNLOAD_DIR, 'zip_boundaries.geojson');

  if (!fs.existsSync(shapeFile)) {
    log(`Shapefile not found: ${shapeFile}`, 'error');
    log('Please run with --download first', 'warning');
    return false;
  }

  try {
    // Check if ogr2ogr is installed
    try {
      await execPromise('which ogr2ogr');
    } catch {
      log('ogr2ogr not found. Installing instructions:', 'warning');
      log('  macOS: brew install gdal');
      log('  Ubuntu: sudo apt-get install gdal-bin');
      log('  Windows: Download from https://gdal.org/download.html');
      return false;
    }

    // Convert with simplification to reduce file size
    const convertCmd = `ogr2ogr -f GeoJSON "${geoJsonFile}" "${shapeFile}" -simplify 0.001 -progress`;
    log('Converting with simplification...');

    const { stdout, stderr } = await execPromise(convertCmd);
    if (stderr && !stderr.includes('Warning')) {
      log(`Conversion warning: ${stderr}`, 'warning');
    }

    // Check output file
    const stats = fs.statSync(geoJsonFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    log(`GeoJSON created: ${sizeMB} MB`, 'success');

    // Parse and show sample
    const geoJson = JSON.parse(fs.readFileSync(geoJsonFile, 'utf8'));
    log(`Total features: ${geoJson.features.length}`);

    if (geoJson.features.length > 0) {
      const sample = geoJson.features[0].properties;
      log(`Sample ZIP: ${sample.ZCTA5CE20 || sample.GEOID20}`);
    }

    return geoJsonFile;
  } catch (error) {
    log(`Conversion failed: ${error.message}`, 'error');
    return false;
  }
}

// Step 3: Import to Supabase
async function importToSupabase() {
  log('Importing to Supabase...', 'step');

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    log('Missing Supabase credentials!', 'error');
    log('Please set environment variables:', 'warning');
    log('  export SUPABASE_URL="your-url"');
    log('  export SUPABASE_SERVICE_KEY="your-key"');
    return false;
  }

  const geoJsonFile = path.join(CONFIG.DOWNLOAD_DIR, 'zip_boundaries.geojson');

  if (!fs.existsSync(geoJsonFile)) {
    log('GeoJSON file not found. Run with --convert first', 'error');
    return false;
  }

  try {
    const { createClient } = await loadDependencies();
    const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    log('Reading GeoJSON file...');
    const geoJson = JSON.parse(fs.readFileSync(geoJsonFile, 'utf8'));

    log(`Processing ${geoJson.features.length} ZIP boundaries...`);

    // Process in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < geoJson.features.length; i += BATCH_SIZE) {
      const batch = geoJson.features.slice(i, i + BATCH_SIZE);

      const records = batch.map(feature => {
        const props = feature.properties;
        return {
          zipcode: props.ZCTA5CE20 || props.GEOID20,
          geometry: feature.geometry, // PostGIS will handle the conversion
          state_code: props.STATE || null,
          land_area: parseInt(props.ALAND20) || 0,
          water_area: parseInt(props.AWATER20) || 0
        };
      });

      const { error } = await supabase
        .from('zip_boundaries')
        .upsert(records, { onConflict: 'zipcode' });

      if (error) {
        log(`Batch error: ${error.message}`, 'warning');
        errors++;
      } else {
        processed += batch.length;
        log(`Imported ${processed}/${geoJson.features.length} boundaries...`);
      }
    }

    if (errors > 0) {
      log(`Import completed with ${errors} errors`, 'warning');
    } else {
      log('Import completed successfully!', 'success');
    }

    // Run the simplification procedure
    log('Generating simplified geometries...', 'step');
    const { error: procError } = await supabase.rpc('update_simplified_geometries');

    if (procError) {
      log(`Simplification warning: ${procError.message}`, 'warning');
    } else {
      log('Simplified geometries created!', 'success');
    }

    return true;
  } catch (error) {
    log(`Import failed: ${error.message}`, 'error');
    return false;
  }
}

// Step 4: Test the imported data
async function testImportedData() {
  log('Testing imported data...', 'step');

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    log('Missing Supabase credentials!', 'error');
    return false;
  }

  try {
    const { createClient } = await loadDependencies();
    const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // Test 1: Check table stats
    log('Getting boundary statistics...');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_zip_boundary_stats');

    if (statsError) {
      log(`Stats error: ${statsError.message}`, 'error');
    } else if (stats && stats.length > 0) {
      const stat = stats[0];
      log(`Total ZIPs: ${stat.total_zips}`, 'success');
      log(`States covered: ${stat.states_covered}`, 'success');
      log(`Average land area: ${stat.avg_land_area} sq meters`, 'success');
    }

    // Test 2: Get a sample ZIP boundary
    log('Testing single ZIP boundary retrieval...');
    const { data: boundary, error: boundaryError } = await supabase
      .rpc('get_zip_boundary', { zip_code: '10001' });

    if (boundaryError) {
      log(`Boundary error: ${boundaryError.message}`, 'warning');
    } else if (boundary && boundary.length > 0) {
      log(`Sample boundary retrieved: ZIP ${boundary[0].zipcode}`, 'success');
      log(`State: ${boundary[0].state_code || 'N/A'}`);
    }

    // Test 3: Test viewport query
    log('Testing viewport query...');
    const { data: viewport, error: viewportError } = await supabase
      .rpc('get_visible_zip_boundaries', {
        min_lng: -74.0,
        max_lng: -73.9,
        min_lat: 40.7,
        max_lat: 40.8,
        simplification_tolerance: 0.001
      });

    if (viewportError) {
      log(`Viewport error: ${viewportError.message}`, 'warning');
    } else {
      log(`Viewport test: ${viewport ? viewport.length : 0} boundaries found`, 'success');
    }

    // Test 4: Test the API endpoint
    log('Testing API endpoint...');
    const testUrl = 'http://localhost:5173/api/zip-boundaries?zipcode=10001';
    log(`Test URL: ${testUrl}`);
    log('You can test this in your browser once the dev server is running');

    log('All tests completed!', 'success');
    return true;
  } catch (error) {
    log(`Test failed: ${error.message}`, 'error');
    return false;
  }
}

// Clean up temporary files
async function cleanup() {
  log('Cleaning up temporary files...', 'step');

  if (fs.existsSync(CONFIG.DOWNLOAD_DIR)) {
    try {
      await execPromise(`rm -rf "${CONFIG.DOWNLOAD_DIR}"`);
      log('Cleanup complete!', 'success');
    } catch (error) {
      log(`Cleanup failed: ${error.message}`, 'warning');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  log('ZIP Boundaries Import Tool', 'info');
  log('=========================\n');

  if (args.length === 0 || args.includes('--help')) {
    log('Usage: node import-zip-boundaries.js [options]\n');
    log('Options:');
    log('  --download    Download Census Bureau data');
    log('  --convert     Convert shapefile to GeoJSON');
    log('  --import      Import to Supabase');
    log('  --test        Test imported data');
    log('  --all         Run all steps');
    log('  --cleanup     Remove temporary files');
    return;
  }

  let success = true;

  if (args.includes('--all') || args.includes('--download')) {
    success = await downloadBoundaries() && success;
  }

  if (success && (args.includes('--all') || args.includes('--convert'))) {
    success = await convertToGeoJSON() && success;
  }

  if (success && (args.includes('--all') || args.includes('--import'))) {
    success = await importToSupabase() && success;
  }

  if (success && (args.includes('--all') || args.includes('--test'))) {
    success = await testImportedData() && success;
  }

  if (args.includes('--cleanup')) {
    await cleanup();
  }

  if (success) {
    log('\n🎉 All operations completed successfully!', 'success');
    log('Your ZIP boundaries are ready to use.');
  } else {
    log('\n⚠️ Some operations failed. Check the logs above.', 'warning');
  }
}

// Run the script
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
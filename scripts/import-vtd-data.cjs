#!/usr/bin/env node
/**
 * Import VTD GeoJSON data into Supabase
 * Usage: node scripts/import-vtd-data.cjs <geojson-file>
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xpdvxliqbrctzyxmijmm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importVTDData(geojsonPath) {
  console.log(`[VTD Import] Reading GeoJSON: ${geojsonPath}`);

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
        console.log(`[VTD Import] Progress: ${imported}/${geojson.features.length} (${Math.round(imported/geojson.features.length*100)}%)`);
      }
    } catch (error) {
      console.error(`[VTD Import] Batch ${Math.floor(i/BATCH_SIZE) + 1} exception:`, error.message);
      errors += batch.length;
    }
  }

  console.log(`\n[VTD Import] Complete!`);
  console.log(`[VTD Import] Imported: ${imported}`);
  console.log(`[VTD Import] Errors: ${errors}`);

  return { imported, errors };
}

/**
 * Convert GeoJSON geometry to WKT (Well-Known Text) format
 */
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

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node import-vtd-data.cjs <geojson-file>');
    console.error('Example: node scripts/import-vtd-data.cjs temp-vtd-data/texas-vtd.geojson');
    process.exit(1);
  }

  const [geojsonPath] = args;

  if (!fs.existsSync(geojsonPath)) {
    console.error(`❌ ERROR: File not found: ${geojsonPath}`);
    process.exit(1);
  }

  importVTDData(geojsonPath)
    .then(({ imported, errors }) => {
      if (errors === 0) {
        console.log('\n✅ Import successful!');
        process.exit(0);
      } else {
        console.log(`\n⚠️  Import completed with ${errors} errors`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Import failed:', error.message);
      process.exit(1);
    });
}

module.exports = { importVTDData };

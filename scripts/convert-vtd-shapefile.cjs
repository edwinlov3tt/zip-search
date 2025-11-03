#!/usr/bin/env node
/**
 * Convert Census VTD Shapefiles to GeoJSON
 * Usage: node scripts/convert-vtd-shapefile.js <shapefile-path> <output-geojson-path>
 */

const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

async function convertShapefileToGeoJSON(shapefilePath, outputPath) {
  console.log(`[VTD Converter] Reading shapefile: ${shapefilePath}`);

  const features = [];
  let count = 0;

  try {
    const source = await shapefile.open(shapefilePath);

    while (true) {
      const result = await source.read();
      if (result.done) break;

      features.push(result.value);
      count++;

      if (count % 1000 === 0) {
        console.log(`[VTD Converter] Processed ${count} features...`);
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      features: features
    };

    console.log(`[VTD Converter] Total features: ${count}`);
    console.log(`[VTD Converter] Writing GeoJSON to: ${outputPath}`);

    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`[VTD Converter] Conversion complete!`);
    console.log(`[VTD Converter] File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

    // Show sample feature
    if (features.length > 0) {
      console.log('\n[VTD Converter] Sample feature properties:');
      console.log(JSON.stringify(features[0].properties, null, 2));
    }

    return geojson;
  } catch (error) {
    console.error('[VTD Converter] Error:', error);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node convert-vtd-shapefile.js <shapefile-path> <output-geojson-path>');
    console.error('Example: node convert-vtd-shapefile.js temp-vtd-data/cb_2020_48_vtd_500k.shp temp-vtd-data/texas-vtd.geojson');
    process.exit(1);
  }

  const [shapefilePath, outputPath] = args;

  convertShapefileToGeoJSON(shapefilePath, outputPath)
    .then(() => {
      console.log('\n✅ Conversion successful!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Conversion failed:', error.message);
      process.exit(1);
    });
}

module.exports = { convertShapefileToGeoJSON };

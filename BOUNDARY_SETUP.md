# ZIP Search Boundary Data Setup Guide

This guide explains exactly what you need to do to set up the boundary data files for the County Borders and ZIP Boundaries features in your ZIP Search application.

## Overview

The application now supports displaying:
- **County Borders**: US county boundaries as GeoJSON overlays
- **ZIP Boundaries**: US ZIP code boundaries as GeoJSON overlays

Both features are controlled by checkboxes in the bottom drawer and will display interactive boundary lines on the map.

## Current Status

✅ **County Boundaries**: Ready to use!
- File: `/public/boundaries/us-counties.geojson` (3.2MB)
- Source: Plotly datasets with FIPS codes
- Contains all US counties with proper geographic boundaries

⚠️ **ZIP Boundaries**: Requires manual setup
- Placeholder: `/public/boundaries/us-zip-codes.geojson.placeholder`
- Real file needed: `/public/boundaries/us-zip-codes.geojson`

## File Structure

```
zip-search/
├── public/
│   └── boundaries/
│       ├── us-counties.geojson              ✅ Ready (3.2MB)
│       ├── us-zip-codes.geojson.placeholder ⚠️ Placeholder
│       └── us-zip-codes.geojson             ❌ Missing (you need this)
```

## ZIP Boundaries Setup

### Option 1: US Census Bureau (Recommended - Official Source)

**File:** ZIP Code Tabulation Areas (ZCTAs) 2020

1. **Download from Census Bureau:**
   ```bash
   cd /Users/edwinlovettiii/zip-search/public/boundaries
   curl -L "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip" -o zcta.zip
   ```

2. **Extract and convert to GeoJSON:**
   ```bash
   unzip zcta.zip
   # You'll need ogr2ogr tool (part of GDAL) to convert shapefile to GeoJSON
   ogr2ogr -f GeoJSON us-zip-codes.geojson cb_2020_us_zcta520_500k.shp
   ```

3. **Install GDAL if needed (macOS):**
   ```bash
   brew install gdal
   ```

**File Size:** ~200MB+ (Warning: This is a large file)

### Option 2: Simplified ZIP Boundaries (Smaller File)

**Source:** Simplified/reduced resolution boundaries

1. **Download simplified version:**
   ```bash
   cd /Users/edwinlovettiii/zip-search/public/boundaries
   curl -L "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/us_counties_20m.json" -o temp.json
   # Note: This is just an example - you may need to find a good simplified ZIP boundaries source
   ```

### Option 3: Create Your Own Subset

If you only need specific states or regions:

1. **Download full dataset** (Option 1)
2. **Use a tool like mapshaper.org** to:
   - Upload the GeoJSON file
   - Filter by state or region
   - Simplify geometry to reduce file size
   - Export as GeoJSON

## Testing the Setup

### 1. Verify File Exists

```bash
ls -la /Users/edwinlovettiii/zip-search/public/boundaries/
```

You should see:
- `us-counties.geojson` (~3.2MB) ✅
- `us-zip-codes.geojson` (size varies by source) ❓

### 2. Test in Application

1. **Start the development server:**
   ```bash
   cd /Users/edwinlovettiii/zip-search
   npm run dev
   ```

2. **Open the application** in your browser

3. **Open the bottom drawer** by clicking the drawer handle

4. **Test County Borders:**
   - Check "County Borders" checkbox
   - You should see county boundary lines appear on the map
   - Uncheck to hide them

5. **Test ZIP Boundaries:**
   - Check "ZIP Boundaries" checkbox
   - If file exists: ZIP boundary lines should appear
   - If file missing: Check browser console for 404 error

### 3. Verify GeoJSON Format

Your `us-zip-codes.geojson` file should have this structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "ZCTA5CE20": "12345",  // ZIP code
        "AFFGEOID20": "...",   // Additional IDs
        "GEOID20": "12345"     // Geographic ID
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng, lat], [lng, lat], ...]]
      }
    }
    // ... thousands more features
  ]
}
```

## Performance Considerations

### File Size Limits

- **County Borders**: 3.2MB (loads quickly)
- **ZIP Boundaries**: Can be 200MB+ (may be slow)

### Optimization Options

1. **Simplify Geometry:**
   - Use mapshaper.org to reduce detail
   - Trade-off: less precise boundaries but faster loading

2. **State-by-State Loading:**
   - Create separate files per state
   - Load only when user searches specific states
   - Requires code modification

3. **Server-Side Filtering:**
   - Move boundary data to your API
   - Filter boundaries based on current map view
   - Only send visible boundaries to frontend

## Troubleshooting

### Common Issues

1. **"Failed to load ZIP boundaries" error:**
   - File doesn't exist or wrong path
   - Check: `/public/boundaries/us-zip-codes.geojson`

2. **Boundaries don't appear:**
   - Invalid GeoJSON format
   - Check browser console for parsing errors

3. **Application slow/crashes:**
   - File too large (>100MB)
   - Consider simplifying geometry or using subset

4. **Wrong boundary shapes:**
   - Coordinate system mismatch
   - Ensure GeoJSON uses WGS84 (longitude, latitude)

### Debug Commands

```bash
# Check file sizes
ls -lh /Users/edwinlovettiii/zip-search/public/boundaries/

# Validate GeoJSON format (if you have Node.js tools)
cd /Users/edwinlovettiii/zip-search/public/boundaries
node -e "console.log(JSON.parse(require('fs').readFileSync('us-zip-codes.geojson')).features.length + ' features loaded')"

# Check coordinate system
head -50 us-zip-codes.geojson | grep -A5 coordinates
```

## Alternative Sources

### Free Sources
- **US Census Bureau**: Most authoritative, largest files
- **Natural Earth Data**: Simplified boundaries, smaller files
- **OpenStreetMap Extracts**: Community-maintained, various formats

### Paid/Commercial Sources
- **Esri**: High-quality, optimized datasets
- **Mapbox**: Tiled vector boundaries, faster loading
- **Google**: Various geographic datasets

## Implementation Details

The boundary display system is already implemented in your application:

### Frontend Components (`GeoApplication.jsx`)
- Checkbox controls in bottom drawer
- GeoJSON layer components using react-leaflet
- Automatic loading when checkboxes are toggled
- Error handling for missing files

### Loading Functions
- `loadCountyBoundaries()`: Fetches `/boundaries/us-counties.geojson`
- `loadZipBoundaries()`: Fetches `/boundaries/us-zip-codes.geojson`

### Styling
- County borders: Blue lines with medium weight
- ZIP boundaries: Red lines with light weight
- Both support hover effects and click interactions

## Next Steps

1. **Choose your preferred option** from the ZIP boundaries setup above
2. **Download and place** the `us-zip-codes.geojson` file in the correct location
3. **Test the functionality** using the steps in the Testing section
4. **Optimize if needed** based on performance requirements

The county boundaries should work immediately, and ZIP boundaries will work as soon as you add the data file!
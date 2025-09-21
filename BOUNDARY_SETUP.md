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

### Option 1: API-Based Approach (Recommended - Optimized for Performance)

Since ZIP boundaries can be 200MB+, we recommend using an API approach that only loads visible boundaries. This integrates with your existing PostGIS setup.

#### Using Your Existing Supabase PostGIS

**Step 1: Add ZIP boundaries to Supabase**

```sql
-- Run this in Supabase SQL Editor after importing ZIP boundary data
CREATE TABLE IF NOT EXISTS zip_boundaries (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10) NOT NULL UNIQUE,
  geometry GEOGRAPHY(MULTIPOLYGON, 4326),
  simplified_geometry GEOGRAPHY(MULTIPOLYGON, 4326), -- Pre-simplified for performance
  state_code VARCHAR(2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create spatial index
CREATE INDEX idx_zip_boundaries_geometry ON zip_boundaries USING GIST(geometry);
CREATE INDEX idx_zip_boundaries_simplified ON zip_boundaries USING GIST(simplified_geometry);
CREATE INDEX idx_zip_boundaries_zipcode ON zip_boundaries(zipcode);

-- RPC function to get boundaries for visible area
CREATE OR REPLACE FUNCTION get_visible_zip_boundaries(
  min_lng FLOAT,
  max_lng FLOAT,
  min_lat FLOAT,
  max_lat FLOAT,
  simplification_tolerance FLOAT DEFAULT 0.001
)
RETURNS TABLE (
  zipcode VARCHAR,
  geojson JSON
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    ST_AsGeoJSON(
      CASE
        WHEN simplification_tolerance > 0 THEN
          ST_Simplify(geometry::geometry, simplification_tolerance)
        ELSE
          geometry::geometry
      END
    )::json as geojson
  FROM zip_boundaries
  WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  LIMIT 100; -- Limit to prevent overwhelming the client
$$;

-- RPC function to get single ZIP boundary
CREATE OR REPLACE FUNCTION get_zip_boundary(zip_code VARCHAR)
RETURNS TABLE (
  zipcode VARCHAR,
  geojson JSON,
  state_code VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    zipcode,
    ST_AsGeoJSON(ST_Simplify(geometry::geometry, 0.0005))::json as geojson,
    state_code
  FROM zip_boundaries
  WHERE zipcode = zip_code;
$$;
```

**Step 2: Create API Endpoint**

Create `/api/zip-boundaries.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600'); // Cache for 1 hour

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { zipcode, bounds, simplified } = req.query;

    // Single ZIP boundary request
    if (zipcode) {
      const { data, error } = await supabase
        .rpc('get_zip_boundary', { zip_code: zipcode });

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'ZIP code not found' });
      }

      const feature = {
        type: 'Feature',
        properties: {
          zipcode: data[0].zipcode,
          state: data[0].state_code
        },
        geometry: data[0].geojson
      };

      return res.status(200).json(feature);
    }

    // Boundaries for visible area
    if (bounds) {
      const [west, south, east, north] = bounds.split(',').map(Number);

      const { data, error } = await supabase
        .rpc('get_visible_zip_boundaries', {
          min_lng: west,
          max_lng: east,
          min_lat: south,
          max_lat: north,
          simplification_tolerance: simplified === 'true' ? 0.001 : 0.0005
        });

      if (error) throw error;

      const featureCollection = {
        type: 'FeatureCollection',
        features: (data || []).map(item => ({
          type: 'Feature',
          properties: { zipcode: item.zipcode },
          geometry: item.geojson
        }))
      };

      return res.status(200).json(featureCollection);
    }

    return res.status(400).json({
      error: 'Please provide either zipcode or bounds parameter'
    });

  } catch (error) {
    console.error('ZIP boundaries error:', error);
    res.status(500).json({
      error: 'Failed to fetch ZIP boundaries',
      details: error.message
    });
  }
}
```

**Step 3: Frontend Integration**

Update your `GeoApplication.jsx` to use the API:

```javascript
// Load boundaries for visible map area
const loadVisibleZipBoundaries = async () => {
  if (!showZipBoundaries) return;

  const bounds = mapRef.current.getBounds();
  const bbox = [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth()
  ].join(',');

  try {
    const response = await fetch(
      `/api/zip-boundaries?bounds=${bbox}&simplified=true`
    );
    const geojson = await response.json();

    // Update your ZIP boundaries layer
    setZipBoundariesData(geojson);
  } catch (error) {
    console.error('Failed to load ZIP boundaries:', error);
  }
};

// Load single ZIP boundary when searched
const loadZipBoundary = async (zipcode) => {
  try {
    const response = await fetch(`/api/zip-boundaries?zipcode=${zipcode}`);
    if (!response.ok) return;

    const feature = await response.json();
    // Add to map or highlight
    addZipBoundaryToMap(feature);
  } catch (error) {
    console.error('Failed to load ZIP boundary:', error);
  }
};

// Debounced update on map movement
useEffect(() => {
  if (!mapRef.current) return;

  const handleMoveEnd = debounce(loadVisibleZipBoundaries, 500);
  mapRef.current.on('moveend', handleMoveEnd);

  return () => {
    mapRef.current.off('moveend', handleMoveEnd);
  };
}, [showZipBoundaries]);
```

### Option 2: Static File Approach (Original Method)

For smaller deployments or if you prefer static files:

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

### Option 3: Simplified ZIP Boundaries (Smaller Static File)

**Source:** Simplified/reduced resolution boundaries

1. **Download simplified version:**
   ```bash
   cd /Users/edwinlovettiii/zip-search/public/boundaries
   curl -L "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/us_counties_20m.json" -o temp.json
   # Note: This is just an example - you may need to find a good simplified ZIP boundaries source
   ```

### Option 4: Create Your Own Subset

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

## Setting Up a Dedicated Droplet for ZIP Boundaries

If you prefer a separate service for boundary data:

### Droplet Setup (2-3 hours total)

```bash
# 1. Create Ubuntu droplet ($6-12/month, 1GB RAM sufficient)
ssh root@your-droplet-ip

# 2. Install PostgreSQL + PostGIS
sudo apt update
sudo apt install -y postgresql postgis postgresql-14-postgis-3

# 3. Create database and enable PostGIS
sudo -u postgres psql
CREATE DATABASE geodata;
\c geodata
CREATE EXTENSION postgis;
\q

# 4. Download and import ZIP boundaries
wget https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
unzip cb_2020_us_zcta520_500k.zip

# Import using shp2pgsql
sudo -u postgres shp2pgsql -s 4326 -I cb_2020_us_zcta520_500k.shp public.zip_boundaries | sudo -u postgres psql geodata

# 5. Create indexes for performance
sudo -u postgres psql geodata <<EOF
CREATE INDEX idx_zip_geom ON zip_boundaries USING GIST(geom);
CREATE INDEX idx_zip_code ON zip_boundaries(zcta5ce20);
ANALYZE zip_boundaries;
EOF

# 6. Set up Node.js API
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

mkdir /var/www/zip-api
cd /var/www/zip-api
npm init -y
npm install express pg cors compression helmet
```

### API Server Code

Create `/var/www/zip-api/server.js`:

```javascript
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(cors());
app.use(compression());

const pool = new Pool({
  host: 'localhost',
  database: 'geodata',
  user: 'postgres',
  password: 'your_password'
});

// Memory cache with TTL
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour

const getCacheKey = (req) => {
  return `${req.path}:${JSON.stringify(req.query)}`;
};

// Middleware for caching
app.use((req, res, next) => {
  const key = getCacheKey(req);
  const cached = cache.get(key);

  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    return res.json(cached.data);
  }

  next();
});

// Get single ZIP boundary
app.get('/api/zip/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        zcta5ce20 as zipcode,
        ST_AsGeoJSON(ST_Simplify(geom, 0.001)) as geometry,
        aland20 as land_area,
        awater20 as water_area
      FROM zip_boundaries
      WHERE zcta5ce20 = $1
    `, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ZIP not found' });
    }

    const feature = {
      type: 'Feature',
      properties: {
        zipcode: result.rows[0].zipcode,
        land_area: result.rows[0].land_area,
        water_area: result.rows[0].water_area
      },
      geometry: JSON.parse(result.rows[0].geometry)
    };

    // Cache the result
    const key = getCacheKey(req);
    cache.set(key, { data: feature, timestamp: Date.now() });

    res.json(feature);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get boundaries in viewport
app.get('/api/boundaries', async (req, res) => {
  const { north, south, east, west, limit = 50 } = req.query;

  if (!north || !south || !east || !west) {
    return res.status(400).json({
      error: 'Missing bounds parameters (north, south, east, west)'
    });
  }

  try {
    const result = await pool.query(`
      SELECT
        zcta5ce20 as zipcode,
        ST_AsGeoJSON(ST_Simplify(geom, 0.002)) as geometry
      FROM zip_boundaries
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      LIMIT $5
    `, [west, south, east, north, limit]);

    const featureCollection = {
      type: 'FeatureCollection',
      features: result.rows.map(row => ({
        type: 'Feature',
        properties: { zipcode: row.zipcode },
        geometry: JSON.parse(row.geometry)
      }))
    };

    // Cache the result
    const key = getCacheKey(req);
    cache.set(key, { data: featureCollection, timestamp: Date.now() });

    res.json(featureCollection);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', cache_size: cache.size });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ZIP Boundaries API running on port ${PORT}`);
});
```

### Systemd Service Setup

```bash
# Create service file
sudo nano /etc/systemd/system/zip-api.service
```

Add:
```ini
[Unit]
Description=ZIP Boundaries API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/zip-api
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Start service
sudo systemctl enable zip-api
sudo systemctl start zip-api
```

### Nginx Reverse Proxy

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/zip-api
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Cache responses
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 10m;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zip-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Example API Responses

### Single ZIP Boundary Request

**Request:**
```
GET /api/zip-boundaries?zipcode=10001
```

**Response:**
```json
{
  "type": "Feature",
  "properties": {
    "zipcode": "10001",
    "state": "NY"
  },
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [[[[-73.996, 40.750], [-73.993, 40.751], ...]]]
  }
}
```

### Viewport Boundaries Request

**Request:**
```
GET /api/zip-boundaries?bounds=-74.0,40.7,-73.9,40.8&simplified=true
```

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "zipcode": "10001" },
      "geometry": { "type": "MultiPolygon", "coordinates": [...] }
    },
    {
      "type": "Feature",
      "properties": { "zipcode": "10002" },
      "geometry": { "type": "MultiPolygon", "coordinates": [...] }
    }
  ]
}
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

## Next Steps After Droplet/API Setup

### 1. Import ZIP Boundary Data

**Option A: Using Supabase (Recommended)**
```bash
# Download Census ZCTA data
wget https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
unzip cb_2020_us_zcta520_500k.zip

# Convert to SQL and import to Supabase
ogr2ogr -f "PostgreSQL" PG:"host=your-supabase-host.supabase.co dbname=postgres user=postgres password=your-password" \
  cb_2020_us_zcta520_500k.shp -nln zip_boundaries -overwrite -progress \
  -lco GEOMETRY_NAME=geometry -lco FID=id -lco SPATIAL_INDEX=GIST
```

**Option B: Using Dedicated Droplet**
```bash
# SSH to your droplet
ssh root@your-droplet-ip

# Import data (as shown in droplet setup above)
sudo -u postgres shp2pgsql -s 4326 -I cb_2020_us_zcta520_500k.shp public.zip_boundaries | sudo -u postgres psql geodata
```

### 2. Update Frontend Code

Modify your `GeoApplication.jsx`:

```javascript
// Add state for ZIP boundaries
const [zipBoundariesData, setZipBoundariesData] = useState(null);
const [loadingZipBoundaries, setLoadingZipBoundaries] = useState(false);

// Function to load boundaries for current viewport
const loadVisibleZipBoundaries = useCallback(async () => {
  if (!showZipBoundaries || !mapRef.current) return;

  const bounds = mapRef.current.getBounds();
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

  setLoadingZipBoundaries(true);
  try {
    const response = await fetch(`/api/zip-boundaries?bounds=${bbox}&simplified=true`);
    if (response.ok) {
      const data = await response.json();
      setZipBoundariesData(data);
    }
  } catch (error) {
    console.error('Error loading ZIP boundaries:', error);
  } finally {
    setLoadingZipBoundaries(false);
  }
}, [showZipBoundaries]);

// Add map event listener
useEffect(() => {
  if (!mapRef.current) return;

  const debouncedLoad = debounce(loadVisibleZipBoundaries, 500);

  mapRef.current.on('moveend', debouncedLoad);
  mapRef.current.on('zoomend', debouncedLoad);

  // Initial load
  if (showZipBoundaries) {
    loadVisibleZipBoundaries();
  }

  return () => {
    mapRef.current.off('moveend', debouncedLoad);
    mapRef.current.off('zoomend', debouncedLoad);
  };
}, [showZipBoundaries, loadVisibleZipBoundaries]);

// Render ZIP boundaries layer
{showZipBoundaries && zipBoundariesData && (
  <GeoJSON
    data={zipBoundariesData}
    style={{
      color: '#ff0000',
      weight: 1,
      fillOpacity: 0.1
    }}
    onEachFeature={(feature, layer) => {
      layer.bindPopup(`ZIP: ${feature.properties.zipcode}`);
    }}
  />
)}
```

### 3. Performance Testing

```javascript
// Add performance monitoring
const measurePerformance = async () => {
  const testZips = ['10001', '90210', '60601', '33139', '94102'];

  for (const zip of testZips) {
    const start = performance.now();
    const response = await fetch(`/api/zip-boundaries?zipcode=${zip}`);
    const data = await response.json();
    const end = performance.now();

    console.log(`ZIP ${zip}: ${Math.round(end - start)}ms`);
  }
};
```

### 4. Verify Setup

**Test API endpoints:**
```bash
# Test single ZIP
curl http://localhost:5173/api/zip-boundaries?zipcode=10001

# Test viewport boundaries
curl "http://localhost:5173/api/zip-boundaries?bounds=-74.0,40.7,-73.9,40.8&simplified=true"

# Check data count in database
psql -h your-supabase-host.supabase.co -U postgres -d postgres -c "SELECT COUNT(*) FROM zip_boundaries;"
```

### 5. Monitor and Optimize

**Add monitoring to your API:**
```javascript
// Track response times
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

**Optimize if needed:**
- Increase simplification tolerance for large viewports
- Add Redis caching layer for frequently accessed ZIPs
- Use CDN for static boundary subsets
- Pre-generate simplified versions at multiple zoom levels

The county boundaries work with static files, and ZIP boundaries will work through the API as soon as your droplet/database is set up!
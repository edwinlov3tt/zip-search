# ZIP Boundaries API - Complete Droplet Setup Instructions

## Prerequisites
- Ubuntu 20.04+ droplet (1GB RAM minimum, 2GB recommended)
- Root or sudo access
- Domain name (optional, can use IP address)

## Copy-Paste Instructions for Claude Code on Droplet

### Step 1: System Setup and Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PostgreSQL 14 and PostGIS
sudo apt install -y postgresql-14 postgresql-14-postgis-3 postgis postgresql-client-14

# Install GDAL tools for shapefile conversion
sudo apt install -y gdal-bin

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install additional tools
sudo apt install -y wget unzip git nginx certbot python3-certbot-nginx

# Verify installations
psql --version
ogr2ogr --version
node --version
npm --version
```

### Step 2: PostgreSQL and PostGIS Setup

```bash
# Set PostgreSQL password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'ZipBoundaries2024!';"

# Create the geodata database
sudo -u postgres createdb geodata

# Enable PostGIS extension
sudo -u postgres psql geodata -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql geodata -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

# Verify PostGIS is enabled
sudo -u postgres psql geodata -c "SELECT PostGIS_Version();"
```

### Step 3: Download and Import ZIP Boundaries Data

```bash
# Create working directory
sudo mkdir -p /opt/zip-boundaries
cd /opt/zip-boundaries

# Download Census Bureau ZIP boundaries (simplified version for better performance)
sudo wget https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip

# Extract the shapefile
sudo unzip cb_2020_us_zcta520_500k.zip

# Import shapefile to PostgreSQL with PostGIS
sudo -u postgres shp2pgsql -s 4326 -I -W "latin1" cb_2020_us_zcta520_500k.shp public.zip_boundaries | sudo -u postgres psql geodata

# Create optimized indexes
sudo -u postgres psql geodata <<'EOF'
-- Add additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_zip_boundaries_zcta ON zip_boundaries(zcta5ce20);
CREATE INDEX IF NOT EXISTS idx_zip_boundaries_state ON zip_boundaries(statefp20);

-- Add simplified geometry column for faster queries
ALTER TABLE zip_boundaries ADD COLUMN IF NOT EXISTS geom_simplified geometry;
UPDATE zip_boundaries SET geom_simplified = ST_Simplify(geom, 0.001);
CREATE INDEX IF NOT EXISTS idx_zip_boundaries_geom_simplified ON zip_boundaries USING GIST(geom_simplified);

-- Analyze table for query optimization
ANALYZE zip_boundaries;

-- Verify import
SELECT COUNT(*) as total_zips FROM zip_boundaries;
EOF
```

### Step 4: Create Node.js API Application

```bash
# Create API directory
sudo mkdir -p /var/www/zip-api
cd /var/www/zip-api

# Initialize Node.js project
sudo npm init -y

# Install dependencies
sudo npm install express pg cors compression helmet morgan dotenv

# Create environment file
sudo tee .env > /dev/null <<'EOF'
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=geodata
DB_USER=postgres
DB_PASSWORD=ZipBoundaries2024!
CORS_ORIGIN=*
CACHE_TTL=3600000
EOF

# Set proper permissions
sudo chmod 600 .env
```

### Step 5: Create the API Server

```bash
# Create the main server file
sudo tee /var/www/zip-api/server.js > /dev/null <<'EOF'
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Security and optimization middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(morgan('combined'));

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// In-memory cache
const cache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 3600000;

// Cache middleware
function cacheMiddleware(req, res, next) {
  const key = `${req.method}:${req.originalUrl}`;
  const cached = cache.get(key);

  if (cached && cached.expires > Date.now()) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached.data);
  }

  res.setHeader('X-Cache', 'MISS');

  // Override res.json to cache successful responses
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.statusCode === 200) {
      cache.set(key, {
        data: data,
        expires: Date.now() + CACHE_TTL
      });

      // Clean old cache entries
      if (cache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
          if (v.expires < now) {
            cache.delete(k);
          }
        }
      }
    }
    return originalJson(data);
  };

  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    cache_size: cache.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Get single ZIP boundary
app.get('/api/zip/:code', cacheMiddleware, async (req, res) => {
  const { code } = req.params;
  const { simplified = 'true' } = req.query;

  try {
    const geomColumn = simplified === 'false' ? 'geom' : 'geom_simplified';

    const result = await pool.query(`
      SELECT
        zcta5ce20 as zipcode,
        ST_AsGeoJSON(${geomColumn}) as geometry,
        statefp20 as state_fips,
        aland20 as land_area,
        awater20 as water_area,
        intptlat20 as center_lat,
        intptlon20 as center_lon
      FROM zip_boundaries
      WHERE zcta5ce20 = $1
      LIMIT 1
    `, [code]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'ZIP code not found',
        zipcode: code
      });
    }

    const row = result.rows[0];
    const feature = {
      type: 'Feature',
      properties: {
        zipcode: row.zipcode,
        state_fips: row.state_fips,
        land_area: parseInt(row.land_area),
        water_area: parseInt(row.water_area),
        center: [parseFloat(row.center_lon), parseFloat(row.center_lat)]
      },
      geometry: JSON.parse(row.geometry)
    };

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(feature);

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get boundaries in viewport
app.get('/api/boundaries', cacheMiddleware, async (req, res) => {
  const { north, south, east, west, limit = '50', simplified = 'true' } = req.query;

  if (!north || !south || !east || !west) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['north', 'south', 'east', 'west'],
      example: '/api/boundaries?north=40.8&south=40.7&east=-73.9&west=-74.0'
    });
  }

  try {
    const geomColumn = simplified === 'false' ? 'geom' : 'geom_simplified';
    const maxLimit = Math.min(parseInt(limit), 200);

    const result = await pool.query(`
      SELECT
        zcta5ce20 as zipcode,
        ST_AsGeoJSON(${geomColumn}) as geometry,
        statefp20 as state_fips
      FROM zip_boundaries
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      LIMIT $5
    `, [
      parseFloat(west),
      parseFloat(south),
      parseFloat(east),
      parseFloat(north),
      maxLimit
    ]);

    const featureCollection = {
      type: 'FeatureCollection',
      features: result.rows.map(row => ({
        type: 'Feature',
        properties: {
          zipcode: row.zipcode,
          state_fips: row.state_fips
        },
        geometry: JSON.parse(row.geometry)
      })),
      properties: {
        count: result.rows.length,
        limit: maxLimit,
        bounds: {
          north: parseFloat(north),
          south: parseFloat(south),
          east: parseFloat(east),
          west: parseFloat(west)
        },
        simplified: simplified === 'true'
      }
    };

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(featureCollection);

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Search ZIPs by polygon
app.post('/api/boundaries/search', express.json(), async (req, res) => {
  const { polygon, limit = 100 } = req.body;

  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
    return res.status(400).json({
      error: 'Invalid polygon',
      message: 'Polygon must be an array of [lng, lat] coordinates with at least 3 points'
    });
  }

  try {
    // Close the polygon if not closed
    const coords = [...polygon];
    if (coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    const polygonWKT = `POLYGON((${coords.map(c => `${c[0]} ${c[1]}`).join(', ')}))`;

    const result = await pool.query(`
      SELECT
        zcta5ce20 as zipcode,
        ST_AsGeoJSON(geom_simplified) as geometry,
        statefp20 as state_fips
      FROM zip_boundaries
      WHERE ST_Intersects(geom, ST_GeomFromText($1, 4326))
      LIMIT $2
    `, [polygonWKT, Math.min(limit, 500)]);

    const features = result.rows.map(row => ({
      type: 'Feature',
      properties: {
        zipcode: row.zipcode,
        state_fips: row.state_fips
      },
      geometry: JSON.parse(row.geometry)
    }));

    res.json({
      type: 'FeatureCollection',
      features: features,
      properties: {
        count: features.length,
        search_polygon: polygon
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'ZIP Boundaries API',
    version: '1.0.0',
    endpoints: [
      {
        path: '/health',
        method: 'GET',
        description: 'Health check endpoint'
      },
      {
        path: '/api/zip/:code',
        method: 'GET',
        description: 'Get boundary for a single ZIP code',
        parameters: {
          code: 'ZIP code (required)',
          simplified: 'Use simplified geometry (true/false, default: true)'
        },
        example: '/api/zip/10001?simplified=true'
      },
      {
        path: '/api/boundaries',
        method: 'GET',
        description: 'Get boundaries within a bounding box',
        parameters: {
          north: 'Northern latitude (required)',
          south: 'Southern latitude (required)',
          east: 'Eastern longitude (required)',
          west: 'Western longitude (required)',
          limit: 'Maximum results (default: 50, max: 200)',
          simplified: 'Use simplified geometry (true/false, default: true)'
        },
        example: '/api/boundaries?north=40.8&south=40.7&east=-73.9&west=-74.0&limit=100'
      },
      {
        path: '/api/boundaries/search',
        method: 'POST',
        description: 'Search ZIP codes by polygon',
        body: {
          polygon: 'Array of [lng, lat] coordinates',
          limit: 'Maximum results (default: 100, max: 500)'
        },
        example: {
          polygon: [[-74.0, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.0, 40.8]],
          limit: 50
        }
      }
    ],
    cache: {
      enabled: true,
      ttl: CACHE_TTL,
      current_size: cache.size
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ZIP Boundaries API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Cache TTL: ${CACHE_TTL}ms`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  process.exit(0);
});
EOF

# Set ownership
sudo chown -R www-data:www-data /var/www/zip-api
```

### Step 6: Create Systemd Service

```bash
# Create systemd service file
sudo tee /etc/systemd/system/zip-api.service > /dev/null <<'EOF'
[Unit]
Description=ZIP Boundaries API Service
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/zip-api
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/zip-api/access.log
StandardError=append:/var/log/zip-api/error.log
Environment="NODE_ENV=production"

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/zip-api /var/log/zip-api

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
sudo mkdir -p /var/log/zip-api
sudo chown www-data:www-data /var/log/zip-api

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable zip-api
sudo systemctl start zip-api

# Check service status
sudo systemctl status zip-api
```

### Step 7: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/zip-api > /dev/null <<'EOF'
upstream zip_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;  # Replace with your domain if you have one

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API endpoints
    location /api {
        proxy_pass http://zip_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # CORS headers (if not handled by Node.js)
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;

        # Cache settings
        proxy_cache_valid 200 1h;
        proxy_cache_valid 404 10m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://zip_api/health;
        access_log off;
    }

    # Root endpoint
    location / {
        proxy_pass http://zip_api/api;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/x-js text/x-cross-domain-policy application/x-font-ttf application/x-font-opentype application/vnd.ms-fontobject image/x-icon;
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/zip-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8: Optional - Setup SSL with Let's Encrypt

```bash
# Only run this if you have a domain name pointing to your droplet
# Replace your-domain.com with your actual domain

# sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com
```

### Step 9: Test the API

```bash
# Test health endpoint
curl http://localhost/health

# Test single ZIP boundary
curl http://localhost/api/zip/10001

# Test viewport boundaries
curl "http://localhost/api/boundaries?north=40.8&south=40.7&east=-73.9&west=-74.0"

# Test from external machine (replace with your droplet IP)
# curl http://YOUR_DROPLET_IP/api/zip/10001
```

### Step 10: Performance Optimization

```bash
# Optimize PostgreSQL for spatial queries
sudo -u postgres psql geodata <<'EOF'
-- Vacuum and analyze for better performance
VACUUM ANALYZE zip_boundaries;

-- Create additional optimized views
CREATE MATERIALIZED VIEW IF NOT EXISTS zip_boundaries_simplified AS
SELECT
  zcta5ce20,
  ST_Simplify(geom, 0.002) as geom_ultra_simple,
  statefp20
FROM zip_boundaries;

CREATE INDEX ON zip_boundaries_simplified USING GIST(geom_ultra_simple);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW zip_boundaries_simplified;
EOF

# Add log rotation
sudo tee /etc/logrotate.d/zip-api > /dev/null <<'EOF'
/var/log/zip-api/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload zip-api > /dev/null 2>&1 || true
    endscript
}
EOF
```

### Step 11: Monitoring Setup

```bash
# Create monitoring script
sudo tee /usr/local/bin/monitor-zip-api.sh > /dev/null <<'EOF'
#!/bin/bash

# Check if service is running
if ! systemctl is-active --quiet zip-api; then
    echo "ZIP API service is down. Restarting..."
    systemctl restart zip-api
    echo "$(date): Service restarted" >> /var/log/zip-api/monitor.log
fi

# Check if API responds
if ! curl -f -s http://localhost/health > /dev/null; then
    echo "ZIP API not responding. Restarting..."
    systemctl restart zip-api
    systemctl restart nginx
    echo "$(date): API not responding, services restarted" >> /var/log/zip-api/monitor.log
fi
EOF

sudo chmod +x /usr/local/bin/monitor-zip-api.sh

# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-zip-api.sh") | crontab -
```

## Verification Checklist

Run these commands to verify everything is working:

```bash
# 1. Check PostgreSQL
sudo -u postgres psql geodata -c "SELECT COUNT(*) FROM zip_boundaries;"
# Should return ~33,000+ ZIP codes

# 2. Check Node.js service
sudo systemctl status zip-api
# Should show "active (running)"

# 3. Check Nginx
sudo systemctl status nginx
# Should show "active (running)"

# 4. Test API endpoints
curl -s http://localhost/health | jq .
# Should return JSON with status: "healthy"

curl -s http://localhost/api/zip/10001 | jq '.properties.zipcode'
# Should return "10001"

# 5. Check logs for errors
sudo tail -n 50 /var/log/zip-api/error.log
# Should be empty or show no critical errors

# 6. Check memory usage
free -h
# Should have available memory

# 7. Check disk space
df -h
# Should have sufficient space
```

## Troubleshooting

If anything fails:

```bash
# Check service logs
sudo journalctl -u zip-api -n 100

# Check Nginx error log
sudo tail -n 50 /var/log/nginx/error.log

# Restart services
sudo systemctl restart zip-api
sudo systemctl restart nginx
sudo systemctl restart postgresql

# Check PostgreSQL connection
sudo -u postgres psql geodata -c "\l"

# Test database query directly
sudo -u postgres psql geodata -c "SELECT zcta5ce20 FROM zip_boundaries LIMIT 5;"
```

## API is Ready!

Your ZIP boundaries API is now running on your droplet.

Access it at:
- `http://YOUR_DROPLET_IP/api/zip/10001` (single ZIP)
- `http://YOUR_DROPLET_IP/api/boundaries?north=40.8&south=40.7&east=-73.9&west=-74.0` (viewport)

The API includes:
- Automatic caching for performance
- Simplified geometries for fast loading
- Health monitoring
- Automatic restarts on failure
- Log rotation
- CORS support for browser access
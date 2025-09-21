const express = require('express');
const cors = require('cors');
const { sql } = require('@vercel/postgres');

const app = express();
const PORT = 3001;

// Enable CORS with Vercel support
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  /\.vercel\.app$/
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to check if point is inside polygon
function isPointInPolygon(point, polygon) {
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// API Routes

// Search zip codes by various criteria
app.get('/api/search', async (req, res) => {
  try {
    const {
      query,
      lat,
      lng,
      radius,
      state,
      county,
      city,
      polygon,
      limit = 100,
      offset = 0
    } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCounter = 1;

    // Text search
    if (query) {
      whereConditions.push(`(
        zipcode LIKE $${paramCounter} OR
        LOWER(city) LIKE LOWER($${paramCounter + 1}) OR
        LOWER(state) LIKE LOWER($${paramCounter + 2}) OR
        LOWER(county) LIKE LOWER($${paramCounter + 3})
      )`);
      const searchTerm = `%${query}%`;
      queryParams.push(query + '%', searchTerm, searchTerm, searchTerm);
      paramCounter += 4;
    }

    // State filtering
    if (state) {
      whereConditions.push(`(state_code = $${paramCounter} OR LOWER(state) = LOWER($${paramCounter + 1}))`);
      queryParams.push(state.toUpperCase(), state);
      paramCounter += 2;
    }

    // County filtering
    if (county) {
      whereConditions.push(`LOWER(county) LIKE LOWER($${paramCounter})`);
      queryParams.push(`%${county}%`);
      paramCounter++;
    }

    // City filtering
    if (city) {
      whereConditions.push(`LOWER(city) LIKE LOWER($${paramCounter})`);
      queryParams.push(`%${city}%`);
      paramCounter++;
    }

    // Build the WHERE clause
    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Build query with pagination
    let query = `
      SELECT
        zipcode,
        city,
        state,
        state_code as "stateCode",
        county,
        county_code as "countyCode",
        latitude,
        longitude
      FROM zipcodes
      ${whereClause}
      ORDER BY zipcode
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Execute query
    const { rows } = await sql.query(query, queryParams);

    // Apply client-side filtering for radius and polygon searches
    let results = rows;

    // Radius search (done client-side due to complexity)
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      const radiusMiles = parseFloat(radius);

      results = results.filter(zip => {
        const distance = calculateDistance(centerLat, centerLng, zip.latitude, zip.longitude);
        return distance <= radiusMiles;
      });
    }

    // Polygon search (done client-side)
    if (polygon) {
      try {
        const polygonPoints = JSON.parse(polygon);
        results = results.filter(zip =>
          isPointInPolygon({ latitude: zip.latitude, longitude: zip.longitude }, polygonPoints)
        );
      } catch (e) {
        return res.status(400).json({ error: 'Invalid polygon format' });
      }
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM zipcodes
      ${whereClause}
    `;
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const { rows: countRows } = await sql.query(countQuery, countParams);
    const total = parseInt(countRows[0].count);

    res.json({
      results,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit),
      hasMore: parseInt(offset) + results.length < total
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Get all states
app.get('/api/states', async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT DISTINCT
        state_code as code,
        state as name
      FROM zipcodes
      WHERE state_code IS NOT NULL
      ORDER BY state
    `;
    res.json(rows);
  } catch (error) {
    console.error('States query error:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

// Get counties by state
app.get('/api/counties', async (req, res) => {
  try {
    const { state } = req.query;

    let query;
    if (state) {
      query = sql`
        SELECT DISTINCT county as name
        FROM zipcodes
        WHERE (state_code = ${state.toUpperCase()} OR LOWER(state) = LOWER(${state}))
          AND county IS NOT NULL
        ORDER BY county
      `;
    } else {
      query = sql`
        SELECT DISTINCT
          county as name,
          state_code as state
        FROM zipcodes
        WHERE county IS NOT NULL
        ORDER BY county
      `;
    }

    const { rows } = await query;
    res.json(rows);
  } catch (error) {
    console.error('Counties query error:', error);
    res.status(500).json({ error: 'Failed to fetch counties' });
  }
});

// Get cities by state/county
app.get('/api/cities', async (req, res) => {
  try {
    const { state, county } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramCounter = 1;

    if (state) {
      whereConditions.push(`(state_code = $${paramCounter} OR LOWER(state) = LOWER($${paramCounter + 1}))`);
      queryParams.push(state.toUpperCase(), state);
      paramCounter += 2;
    }

    if (county) {
      whereConditions.push(`LOWER(county) = LOWER($${paramCounter})`);
      queryParams.push(county);
      paramCounter++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')} AND city IS NOT NULL`
      : 'WHERE city IS NOT NULL';

    const query = `
      SELECT DISTINCT city as name
      FROM zipcodes
      ${whereClause}
      ORDER BY city
    `;

    const { rows } = await sql.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    console.error('Cities query error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Get zip code details
app.get('/api/zipcode/:zip', async (req, res) => {
  try {
    const { zip } = req.params;
    const { rows } = await sql`
      SELECT
        zipcode,
        city,
        state,
        state_code as "stateCode",
        county,
        county_code as "countyCode",
        latitude,
        longitude
      FROM zipcodes
      WHERE zipcode = ${zip}
      LIMIT 1
    `;

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: 'Zip code not found' });
    }
  } catch (error) {
    console.error('Zipcode query error:', error);
    res.status(500).json({ error: 'Failed to fetch zip code' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { rows } = await sql`SELECT COUNT(*) as count FROM zipcodes`;

    res.json({
      status: 'OK',
      database: 'connected',
      totalZipCodes: parseInt(rows[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Zip Search API (Postgres) running on http://localhost:${PORT}`);
    console.log(`🔍 API endpoints:`);
    console.log(`   GET /api/search - Search zip codes`);
    console.log(`   GET /api/states - Get all states`);
    console.log(`   GET /api/counties - Get counties`);
    console.log(`   GET /api/cities - Get cities`);
    console.log(`   GET /api/zipcode/:zip - Get zip details`);
    console.log(`   GET /api/health - Health check`);
  });
}

// Export for Vercel
module.exports = app;
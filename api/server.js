const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { parse } = require('csv-parse');
const path = require('path');

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

// In-memory storage for zip code data
let zipCodes = [];
let states = [];
let counties = [];
let cities = [];

// Load CSV data on startup
async function loadZipCodeData() {
  console.log('Loading zip code data...');
  const csvPath = path.join(__dirname, '../US/zipcodes.us.csv');

  return new Promise((resolve, reject) => {
    const results = [];
    const stateSet = new Set();
    const countySet = new Set();
    const citySet = new Set();

    fs.createReadStream(csvPath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true
      }))
      .on('data', (data) => {
        const record = {
          zipcode: data.zipcode,
          city: data.place,
          state: data.state,
          stateCode: data.state_code,
          county: data.province,
          countyCode: data.province_code,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude)
        };

        results.push(record);
        stateSet.add(data.state);
        countySet.add(`${data.province}|${data.state_code}`);
        citySet.add(`${data.place}|${data.state_code}`);
      })
      .on('end', () => {
        zipCodes = results;
        states = Array.from(stateSet).sort();
        counties = Array.from(countySet).map(item => {
          const [county, state] = item.split('|');
          return { name: county, state };
        }).sort((a, b) => a.name.localeCompare(b.name));
        cities = Array.from(citySet).map(item => {
          const [city, state] = item.split('|');
          return { name: city, state };
        }).sort((a, b) => a.name.localeCompare(b.name));

        console.log(`Loaded ${zipCodes.length} zip codes`);
        console.log(`Found ${states.length} states`);
        console.log(`Found ${counties.length} counties`);
        console.log(`Found ${cities.length} cities`);
        resolve();
      })
      .on('error', reject);
  });
}

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
app.get('/api/search', (req, res) => {
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

  let results = [...zipCodes];

  // Text search
  if (query) {
    const searchTerm = query.toLowerCase();
    results = results.filter(zip =>
      zip.zipcode.includes(searchTerm) ||
      zip.city.toLowerCase().includes(searchTerm) ||
      zip.state.toLowerCase().includes(searchTerm) ||
      zip.county.toLowerCase().includes(searchTerm)
    );
  }

  // Radius search
  if (lat && lng && radius) {
    const centerLat = parseFloat(lat);
    const centerLng = parseFloat(lng);
    const radiusMiles = parseFloat(radius);

    results = results.filter(zip => {
      const distance = calculateDistance(centerLat, centerLng, zip.latitude, zip.longitude);
      return distance <= radiusMiles;
    });
  }

  // Polygon search
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

  // Hierarchical filtering
  if (state) {
    results = results.filter(zip =>
      zip.stateCode.toLowerCase() === state.toLowerCase() ||
      zip.state.toLowerCase() === state.toLowerCase()
    );
  }

  if (county) {
    results = results.filter(zip =>
      zip.county.toLowerCase().includes(county.toLowerCase())
    );
  }

  if (city) {
    results = results.filter(zip =>
      zip.city.toLowerCase().includes(city.toLowerCase())
    );
  }

  // Pagination
  const total = results.length;
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedResults = results.slice(startIndex, endIndex);

  res.json({
    results: paginatedResults,
    total,
    offset: startIndex,
    limit: parseInt(limit),
    hasMore: endIndex < total
  });
});

// Get all states
app.get('/api/states', (req, res) => {
  const stateMap = new Map();

  zipCodes.forEach(zip => {
    if (zip.stateCode && zip.state) {
      stateMap.set(zip.stateCode, {
        name: zip.state,
        code: zip.stateCode
      });
    }
  });

  const uniqueStates = Array.from(stateMap.values());
  res.json(uniqueStates.sort((a, b) => a.name.localeCompare(b.name)));
});

// Get counties by state
app.get('/api/counties', (req, res) => {
  const { state } = req.query;
  let filteredCounties = counties;

  if (state) {
    filteredCounties = counties.filter(county =>
      county.state.toLowerCase() === state.toLowerCase()
    );
  }

  res.json(filteredCounties);
});

// Get cities by state/county
app.get('/api/cities', (req, res) => {
  const { state, county } = req.query;
  let filteredCities = cities;

  if (state) {
    filteredCities = filteredCities.filter(city =>
      city.state.toLowerCase() === state.toLowerCase()
    );
  }

  if (county) {
    const relevantZips = zipCodes.filter(zip =>
      zip.county.toLowerCase().includes(county.toLowerCase())
    );
    const cityNames = new Set(relevantZips.map(zip => zip.city));
    filteredCities = filteredCities.filter(city => cityNames.has(city.name));
  }

  res.json(filteredCities);
});

// Get zip code details
app.get('/api/zipcode/:zip', (req, res) => {
  const { zip } = req.params;
  const zipCode = zipCodes.find(z => z.zipcode === zip);

  if (zipCode) {
    res.json(zipCode);
  } else {
    res.status(404).json({ error: 'Zip code not found' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    totalZipCodes: zipCodes.length,
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    await loadZipCodeData();
    app.listen(PORT, () => {
      console.log(`🚀 Zip Search API running on http://localhost:${PORT}`);
      console.log(`📊 Loaded ${zipCodes.length} zip codes`);
      console.log(`🔍 API endpoints:`);
      console.log(`   GET /api/search - Search zip codes`);
      console.log(`   GET /api/states - Get all states`);
      console.log(`   GET /api/counties - Get counties`);
      console.log(`   GET /api/cities - Get cities`);
      console.log(`   GET /api/zipcode/:zip - Get zip details`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
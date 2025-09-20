const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3001;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found in environment variables');
  console.log('Please set SUPABASE_URL and SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Start with base query
    let supabaseQuery = supabase
      .from('zipcodes')
      .select('*', { count: 'exact' });

    // Text search
    if (query) {
      const searchTerm = `%${query}%`;
      // Check if it's a zip code search
      if (/^\d/.test(query)) {
        supabaseQuery = supabaseQuery.ilike('zipcode', query + '%');
      } else {
        supabaseQuery = supabaseQuery.or(
          `city.ilike.${searchTerm},state.ilike.${searchTerm},county.ilike.${searchTerm}`
        );
      }
    }

    // State filtering
    if (state) {
      supabaseQuery = supabaseQuery.or(
        `state_code.eq.${state.toUpperCase()},state.ilike.${state}`
      );
    }

    // County filtering
    if (county) {
      supabaseQuery = supabaseQuery.ilike('county', `%${county}%`);
    }

    // City filtering
    if (city) {
      supabaseQuery = supabaseQuery.ilike('city', `%${city}%`);
    }

    // Order and pagination
    supabaseQuery = supabaseQuery
      .order('zipcode')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Execute query
    const { data, error, count } = await supabaseQuery;

    if (error) throw error;

    // Apply client-side filtering for radius and polygon searches
    let results = data || [];

    // Radius search (done client-side due to complexity)
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      const radiusMiles = parseFloat(radius);

      results = results.filter(zip => {
        const distance = calculateDistance(
          centerLat, centerLng,
          parseFloat(zip.latitude),
          parseFloat(zip.longitude)
        );
        return distance <= radiusMiles;
      });
    }

    // Polygon search (done client-side)
    if (polygon) {
      try {
        const polygonPoints = JSON.parse(polygon);
        results = results.filter(zip =>
          isPointInPolygon(
            { latitude: parseFloat(zip.latitude), longitude: parseFloat(zip.longitude) },
            polygonPoints
          )
        );
      } catch (e) {
        return res.status(400).json({ error: 'Invalid polygon format' });
      }
    }

    // Format response to match existing API
    const formattedResults = results.map(zip => ({
      zipcode: zip.zipcode,
      city: zip.city,
      state: zip.state,
      stateCode: zip.state_code,
      county: zip.county,
      countyCode: zip.county_code,
      latitude: parseFloat(zip.latitude),
      longitude: parseFloat(zip.longitude)
    }));

    res.json({
      results: formattedResults,
      total: count || results.length,
      offset: parseInt(offset),
      limit: parseInt(limit),
      hasMore: parseInt(offset) + results.length < (count || results.length)
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

// Get all states
app.get('/api/states', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('zipcodes')
      .select('state_code, state')
      .not('state_code', 'is', null)
      .order('state');

    if (error) throw error;

    // Remove duplicates
    const uniqueStates = Array.from(
      new Map(data.map(item => [item.state_code, {
        code: item.state_code,
        name: item.state
      }])).values()
    );

    res.json(uniqueStates);
  } catch (error) {
    console.error('States query error:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

// Get counties by state
app.get('/api/counties', async (req, res) => {
  try {
    const { state } = req.query;

    let query = supabase
      .from('zipcodes')
      .select('county')
      .not('county', 'is', null);

    if (state) {
      query = query.or(
        `state_code.eq.${state.toUpperCase()},state.ilike.${state}`
      );
    }

    const { data, error } = await query.order('county');

    if (error) throw error;

    // Remove duplicates
    const uniqueCounties = Array.from(
      new Set(data.map(item => item.county))
    ).map(name => ({ name }));

    res.json(uniqueCounties);
  } catch (error) {
    console.error('Counties query error:', error);
    res.status(500).json({ error: 'Failed to fetch counties' });
  }
});

// Get cities by state/county
app.get('/api/cities', async (req, res) => {
  try {
    const { state, county } = req.query;

    let query = supabase
      .from('zipcodes')
      .select('city')
      .not('city', 'is', null);

    if (state) {
      query = query.or(
        `state_code.eq.${state.toUpperCase()},state.ilike.${state}`
      );
    }

    if (county) {
      query = query.ilike('county', county);
    }

    const { data, error } = await query.order('city');

    if (error) throw error;

    // Remove duplicates
    const uniqueCities = Array.from(
      new Set(data.map(item => item.city))
    ).map(name => ({ name }));

    res.json(uniqueCities);
  } catch (error) {
    console.error('Cities query error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Get zip code details
app.get('/api/zipcode/:zip', async (req, res) => {
  try {
    const { zip } = req.params;

    const { data, error } = await supabase
      .from('zipcodes')
      .select('*')
      .eq('zipcode', zip)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Zip code not found' });
      }
      throw error;
    }

    // Format response to match existing API
    const formattedResult = {
      zipcode: data.zipcode,
      city: data.city,
      state: data.state,
      stateCode: data.state_code,
      county: data.county,
      countyCode: data.county_code,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude)
    };

    res.json(formattedResult);
  } catch (error) {
    console.error('Zipcode query error:', error);
    res.status(500).json({ error: 'Failed to fetch zip code' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { count, error } = await supabase
      .from('zipcodes')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json({
      status: 'OK',
      database: 'connected',
      provider: 'Supabase',
      totalZipCodes: count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      provider: 'Supabase',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Zip Search API (Supabase) running on http://localhost:${PORT}`);
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
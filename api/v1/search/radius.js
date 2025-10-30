import { createClient } from '@supabase/supabase-js';
import { normalizeResultSet } from './transform.js';

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { lat, lng, radius, limit = 500, offset = 0 } = req.query;

    if (!lat || !lng || !radius) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'lat, lng, and radius are required'
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const radiusMiles = Number(radius);

    if ([latitude, longitude, radiusMiles].some(v => Number.isNaN(v))) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: 'lat, lng, and radius must be valid numbers'
      });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        details: 'Database connection not configured'
      });
    }

    const client = createClient(supabaseUrl, supabaseKey);

    // Use bounding box pre-filter followed by distance calculation
    const latDelta = radiusMiles / 69;
    const lngDelta = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLng = longitude - lngDelta;
    const maxLng = longitude + lngDelta;

    // Query with bounding box filter
    let query = client
      .from('zipcodes')
      .select('*', { count: 'exact' })
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng);

    // Apply pagination
    query = query
      .range(Number(offset), Number(offset) + Number(limit) - 1)
      .limit(Number(limit));

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Database query error: ${error.message}`);
    }

    // Filter by exact distance (client-side)
    const filteredResults = (data || []).filter(zip => {
      const distance = calculateDistance(latitude, longitude, zip.latitude, zip.longitude);
      return distance <= radiusMiles;
    }).map(zip => ({
      ...zip,
      distance: calculateDistance(latitude, longitude, zip.latitude, zip.longitude)
    }));

    // Sort by distance
    filteredResults.sort((a, b) => a.distance - b.distance);

    const result = normalizeResultSet(filteredResults, filteredResults.length);
    return res.status(200).json(result);

  } catch (error) {
    console.error('Radius search error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Calculate distance using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
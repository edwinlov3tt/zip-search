import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const {
      query,
      lat,
      lng,
      radius,
      state,
      county,
      city,
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

    // Apply client-side filtering for radius search
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

    res.status(200).json({
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
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
      polygon,
      state,
      county,
      city,
      limit = 100,
      offset = 0
    } = req.query;

    console.log('PostGIS Search params:', { query, lat, lng, radius, polygon, state, county, city, limit, offset });

    let results = [];
    let total = 0;

    // RADIUS SEARCH - Using PostGIS native function
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      const radiusMiles = parseFloat(radius);

      console.log(`Radius search: ${radiusMiles} miles from (${centerLat}, ${centerLng})`);

      // Call the PostGIS function directly
      const { data, error } = await supabase.rpc('search_by_radius', {
        center_lng: centerLng,
        center_lat: centerLat,
        radius_miles: radiusMiles,
        max_results: parseInt(limit) + parseInt(offset)
      });

      if (error) throw error;

      // Apply offset manually since RPC doesn't support it directly
      results = (data || []).slice(parseInt(offset));
      total = data ? data.length : 0;

      console.log(`PostGIS radius search returned ${results.length} results`);
    }

    // POLYGON SEARCH - Using PostGIS native function
    else if (polygon) {
      try {
        const polygonPoints = JSON.parse(polygon);
        console.log(`Polygon search with ${polygonPoints.length} points`);

        const { data, error } = await supabase.rpc('search_by_polygon', {
          polygon_coords: polygonPoints,
          max_results: parseInt(limit) + parseInt(offset)
        });

        if (error) throw error;

        results = (data || []).slice(parseInt(offset));
        total = data ? data.length : 0;

        console.log(`PostGIS polygon search returned ${results.length} results`);
      } catch (e) {
        console.error('Polygon parse error:', e);
        return res.status(400).json({ error: 'Invalid polygon format' });
      }
    }

    // STANDARD SEARCH - Using regular table queries
    else {
      // Use the spatial table for consistency
      let supabaseQuery = supabase
        .from('zipcodes_spatial')
        .select('*', { count: 'exact' });

      // Text search
      if (query) {
        const searchTerm = `%${query}%`;
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

      // Apply pagination
      supabaseQuery = supabaseQuery
        .order('zipcode')
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data, error, count } = await supabaseQuery;

      if (error) throw error;

      results = data || [];
      total = count || 0;
    }

    // Format response to match existing API structure
    const formattedResults = results.map(zip => ({
      zipcode: zip.zipcode,
      city: zip.city,
      state: zip.state,
      stateCode: zip.state_code,
      county: zip.county,
      countyCode: zip.county_code,
      latitude: parseFloat(zip.latitude),
      longitude: parseFloat(zip.longitude),
      // Include distance if available from spatial query
      distance: zip.distance_miles
    }));

    res.status(200).json({
      results: formattedResults,
      total: total,
      offset: parseInt(offset),
      limit: parseInt(limit),
      hasMore: parseInt(offset) + results.length < total
    });

  } catch (error) {
    console.error('PostGIS Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message,
      hint: 'Ensure PostGIS is enabled and functions are created'
    });
  }
}
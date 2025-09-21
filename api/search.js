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

// Calculate bounding box for radius search
function getBoundingBox(lat, lng, radiusMiles) {
  const latRadian = lat * Math.PI / 180;
  const degLatKm = 110.574; // km per degree latitude
  const degLonKm = 111.320 * Math.cos(latRadian); // km per degree longitude at this latitude
  const radiusKm = radiusMiles * 1.60934; // convert miles to km

  const deltaLat = radiusKm / degLatKm;
  const deltaLon = radiusKm / degLonKm;

  return {
    minLat: lat - deltaLat,
    maxLat: lat + deltaLat,
    minLng: lng - deltaLon,
    maxLng: lng + deltaLon
  };
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
      polygon,
      state,
      county,
      city,
      limit = 100,
      offset = 0
    } = req.query;

    console.log('Search params:', { query, lat, lng, radius, polygon, state, county, city, limit, offset });

    // Start with base query
    let supabaseQuery = supabase
      .from('zipcodes')
      .select('*');

    // For radius search, get bounding box to limit initial query
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      const radiusMiles = parseFloat(radius);
      const bbox = getBoundingBox(centerLat, centerLng, radiusMiles * 1.5); // 1.5x for safety margin

      supabaseQuery = supabaseQuery
        .gte('latitude', bbox.minLat)
        .lte('latitude', bbox.maxLat)
        .gte('longitude', bbox.minLng)
        .lte('longitude', bbox.maxLng);
    }

    // For polygon search, get bounding box of polygon
    else if (polygon) {
      try {
        const polygonPoints = JSON.parse(polygon);
        if (polygonPoints && polygonPoints.length > 0) {
          const lats = polygonPoints.map(p => p.lat);
          const lngs = polygonPoints.map(p => p.lng);

          supabaseQuery = supabaseQuery
            .gte('latitude', Math.min(...lats))
            .lte('latitude', Math.max(...lats))
            .gte('longitude', Math.min(...lngs))
            .lte('longitude', Math.max(...lngs));
        }
      } catch (e) {
        console.error('Invalid polygon format:', e);
      }
    }

    // Text search
    else if (query) {
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
    if (state && !radius && !polygon) {
      supabaseQuery = supabaseQuery.or(
        `state_code.eq.${state.toUpperCase()},state.ilike.${state}`
      );
    }

    // County filtering
    if (county && !radius && !polygon) {
      supabaseQuery = supabaseQuery.ilike('county', `%${county}%`);
    }

    // City filtering
    if (city && !radius && !polygon) {
      supabaseQuery = supabaseQuery.ilike('city', `%${city}%`);
    }

    // For spatial queries, get more records
    const fetchLimit = (radius || polygon) ? 5000 : parseInt(limit);

    // Order by zipcode
    supabaseQuery = supabaseQuery.order('zipcode');

    // Execute query - get all matching records for spatial filtering
    const { data, error } = await supabaseQuery;

    if (error) throw error;

    let results = data || [];
    console.log(`Initial query returned ${results.length} records`);

    // Apply radius filtering
    if (lat && lng && radius) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      const radiusMiles = parseFloat(radius);

      results = results.filter(zip => {
        if (!zip.latitude || !zip.longitude) return false;
        const distance = calculateDistance(
          centerLat, centerLng,
          parseFloat(zip.latitude),
          parseFloat(zip.longitude)
        );
        return distance <= radiusMiles;
      });

      console.log(`After radius filter: ${results.length} records`);
    }

    // Apply polygon filtering
    if (polygon) {
      try {
        const polygonPoints = JSON.parse(polygon);
        results = results.filter(zip => {
          if (!zip.latitude || !zip.longitude) return false;
          return isPointInPolygon(
            { latitude: parseFloat(zip.latitude), longitude: parseFloat(zip.longitude) },
            polygonPoints
          );
        });
        console.log(`After polygon filter: ${results.length} records`);
      } catch (e) {
        console.error('Polygon filter error:', e);
      }
    }

    // Apply pagination to filtered results
    const total = results.length;
    const startIndex = parseInt(offset);
    const endIndex = Math.min(startIndex + parseInt(limit), total);
    const paginatedResults = results.slice(startIndex, endIndex);

    // Format response
    const formattedResults = paginatedResults.map(zip => ({
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
      total: total,
      offset: startIndex,
      limit: parseInt(limit),
      hasMore: endIndex < total
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
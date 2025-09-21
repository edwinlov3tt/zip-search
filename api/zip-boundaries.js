import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { zipcode, bounds, simplified = 'false' } = req.query;

    // Single ZIP boundary request
    if (zipcode) {
      console.log(`Fetching boundary for ZIP: ${zipcode}`);

      // First, check if we have the RPC function
      const { data, error } = await supabase
        .rpc('get_zip_boundary', { zip_code: zipcode });

      if (!error && data && data.length > 0) {
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

      // Fallback: Try direct table query if RPC doesn't exist
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('zip_boundaries')
        .select('zipcode, geometry, state_code')
        .eq('zipcode', zipcode)
        .single();

      if (fallbackError || !fallbackData) {
        return res.status(404).json({
          error: 'ZIP boundary not found',
          details: 'This ZIP code boundary data is not available yet'
        });
      }

      // Convert geometry to GeoJSON if needed
      const feature = {
        type: 'Feature',
        properties: {
          zipcode: fallbackData.zipcode,
          state: fallbackData.state_code
        },
        geometry: fallbackData.geometry
      };

      return res.status(200).json(feature);
    }

    // Boundaries for visible area
    if (bounds) {
      const [west, south, east, north] = bounds.split(',').map(Number);

      if (isNaN(west) || isNaN(south) || isNaN(east) || isNaN(north)) {
        return res.status(400).json({
          error: 'Invalid bounds format',
          expected: 'bounds=west,south,east,north (e.g., -74.0,40.7,-73.9,40.8)'
        });
      }

      console.log(`Fetching boundaries for viewport: ${west},${south},${east},${north}`);

      // Calculate area to determine simplification level
      const area = Math.abs((east - west) * (north - south));
      const simplificationTolerance = area > 1 ? 0.002 :
                                      area > 0.1 ? 0.001 :
                                      0.0005;

      // Try RPC function first
      const { data, error } = await supabase
        .rpc('get_visible_zip_boundaries', {
          min_lng: west,
          max_lng: east,
          min_lat: south,
          max_lat: north,
          simplification_tolerance: simplified === 'true' ? simplificationTolerance : 0
        });

      if (!error && data) {
        const featureCollection = {
          type: 'FeatureCollection',
          features: data.map(item => ({
            type: 'Feature',
            properties: {
              zipcode: item.zipcode
            },
            geometry: item.geojson
          })),
          properties: {
            count: data.length,
            bounds: [west, south, east, north],
            simplified: simplified === 'true'
          }
        };

        console.log(`Returning ${data.length} ZIP boundaries for viewport`);
        return res.status(200).json(featureCollection);
      }

      // If RPC doesn't exist or fails, return empty collection with info
      console.log('ZIP boundaries table not yet configured');
      return res.status(200).json({
        type: 'FeatureCollection',
        features: [],
        properties: {
          message: 'ZIP boundary data not yet available',
          setup_required: true,
          bounds: [west, south, east, north]
        }
      });
    }

    // Return API documentation if no parameters provided
    return res.status(200).json({
      api: 'ZIP Boundaries API',
      version: '1.0',
      endpoints: {
        single_zip: {
          description: 'Get boundary for a single ZIP code',
          example: '/api/zip-boundaries?zipcode=10001',
          response: {
            type: 'Feature',
            properties: { zipcode: '10001', state: 'NY' },
            geometry: { type: 'MultiPolygon', coordinates: '...' }
          }
        },
        viewport: {
          description: 'Get boundaries visible in a bounding box',
          example: '/api/zip-boundaries?bounds=-74.0,40.7,-73.9,40.8&simplified=true',
          parameters: {
            bounds: 'west,south,east,north coordinates',
            simplified: 'true/false - simplify geometry for performance'
          },
          response: {
            type: 'FeatureCollection',
            features: '[Array of Feature objects]',
            properties: { count: 'number', bounds: '[w,s,e,n]', simplified: 'boolean' }
          }
        }
      },
      status: 'ready',
      note: 'ZIP boundary data must be imported to Supabase first'
    });

  } catch (error) {
    console.error('ZIP boundaries API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
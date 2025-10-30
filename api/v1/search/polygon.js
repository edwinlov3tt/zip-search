import { normalizeResultSet } from './transform.js';

function normalizePolygonInput(polygon) {
  if (!polygon) return null;
  if (typeof polygon === 'string') {
    try {
      return JSON.parse(polygon);
    } catch (error) {
      throw new Error('Polygon parameter must be valid JSON');
    }
  }
  return polygon;
}

export async function searchWithinPolygon(client, { polygon, limit, offset }) {
  const coordinates = normalizePolygonInput(polygon);
  if (!coordinates) {
    throw new Error('Polygon parameter is required for polygon search');
  }

  const { data, error } = await client.rpc('search_zipcodes_within_polygon', {
    polygon_geojson: coordinates,
    result_limit: limit,
    result_offset: offset
  });

  if (error) {
    throw new Error(`Supabase polygon RPC error: ${error.message}`);
  }

  const rows = Array.isArray(data?.rows) ? data.rows : data;
  const total = typeof data?.total_count === 'number' ? data.total_count : data?.[0]?.total_count;

  return normalizeResultSet(rows, total);
}

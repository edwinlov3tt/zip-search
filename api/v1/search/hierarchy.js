import { normalizeResultSet } from './transform.js';

export async function searchByHierarchy(client, { query, state, county, city, limit, offset }) {
  // Build query using regular Supabase filters instead of RPC
  let queryBuilder = client
    .from('zipcodes')
    .select('*', { count: 'exact' });

  // Apply filters
  if (query) {
    // Search for ZIP, city, or county matching the query
    queryBuilder = queryBuilder.or(`zipcode.ilike.%${query}%,city.ilike.%${query}%,county.ilike.%${query}%`);
  }

  if (state) {
    queryBuilder = queryBuilder.eq('state_code', state);
  }

  if (county) {
    queryBuilder = queryBuilder.eq('county', county);
  }

  if (city) {
    queryBuilder = queryBuilder.eq('city', city);
  }

  // Apply pagination
  queryBuilder = queryBuilder
    .range(offset, offset + limit - 1)
    .limit(limit);

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  return normalizeResultSet(data || [], count || 0);
}

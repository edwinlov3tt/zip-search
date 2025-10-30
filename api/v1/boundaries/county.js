import { optionsResponse, methodNotAllowed, jsonResponse, badRequest, internalError } from '../../_lib/response.js';
import { assertSupabaseClient } from '../../_lib/supabase.js';
import { getCachedJSON, setCachedJSON } from '../../_lib/cache.js';
import { enforceRateLimit } from '../../_lib/rate-limit.js';

export const config = {
  runtime: 'edge'
};

function parseMaybeJSON(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function extractParams(request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county') || searchParams.get('name');
  const state = searchParams.get('state') || searchParams.get('stateCode');

  return {
    county,
    state
  };
}

function buildCacheKey(state, county) {
  return `zip-search:v1:boundary:county:${String(state).toUpperCase()}::${String(county).toLowerCase()}`;
}

function transform(record) {
  if (!record) return null;
  const geometry = parseMaybeJSON(record.geometry_geojson || record.geometry);
  const centroid = parseMaybeJSON(record.centroid_geojson || record.centroid);
  const bbox = parseMaybeJSON(record.bounding_box || record.bbox);

  return {
    identifier: `county:${record.state_code || record.state}:${record.county_name || record.county}`,
    county: record.county_name || record.county,
    state: record.state_name || record.state,
    stateCode: record.state_code || record.stateCode,
    countyCode: record.county_fips || record.countyCode,
    population: record.population ?? null,
    areaSqMi: record.area_sq_mi ?? record.areaSqMi ?? null,
    geometryType: record.geometry_type || 'MultiPolygon',
    geometry,
    centroid,
    bbox,
    meta: { cache: 'miss' }
  };
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (request.method !== 'GET') {
    return methodNotAllowed(request.method);
  }

  const { county, state } = extractParams(request);

  if (!county || !state) {
    return badRequest('county and state parameters are required');
  }

  const cacheKey = buildCacheKey(state, county);

  try {
    const limitState = await enforceRateLimit(`boundary-county:${state}:${county}`);
    if (limitState?.blocked) {
      return limitState.response;
    }

    const cached = await getCachedJSON(cacheKey);
    if (cached) {
      const meta = cached.meta || {};
      return jsonResponse({ ...cached, meta: { ...meta, cache: 'hit' } });
    }

    const supabase = assertSupabaseClient();
    const { data, error } = await supabase.rpc('get_county_boundary', {
      state_filter: state,
      county_filter: county
    });

    if (error) {
      throw new Error(`Supabase get_county_boundary error: ${error.message}`);
    }

    const record = Array.isArray(data) ? data[0] : data;

    if (!record) {
      return jsonResponse({ error: 'County boundary not found', state, county }, { status: 404 });
    }

    const formatted = transform(record);

    if (!formatted) {
      return internalError('County boundary could not be normalized');
    }

    await setCachedJSON(cacheKey, formatted, 30 * 60);

    return jsonResponse(formatted);
  } catch (error) {
    console.error(`Edge county boundary failure for ${county}, ${state}`, error);

    if (error.message && error.message.includes('Supabase service role credentials')) {
      return internalError('Supabase credentials are not configured for the Edge runtime');
    }

    return internalError('Failed to resolve county boundary', error.message);
  }
}

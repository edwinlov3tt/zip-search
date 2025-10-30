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

function resolveStateFromRequest(request) {
  const { searchParams, pathname } = new URL(request.url);
  const param = searchParams.get('state') || searchParams.get('code') || searchParams.get('stateCode');
  if (param) return param;

  const segments = pathname.split('/').filter(Boolean);
  const stateIndex = segments.findIndex(segment => segment === 'state');
  if (stateIndex >= 0 && segments[stateIndex + 1]) {
    return segments[stateIndex + 1];
  }

  return null;
}

function cacheKey(stateCode) {
  return `zip-search:v1:boundary:state:${stateCode.toUpperCase()}`;
}

function transform(record) {
  if (!record) return null;
  const geometry = parseMaybeJSON(record.geometry_geojson || record.geometry);
  const centroid = parseMaybeJSON(record.centroid_geojson || record.centroid);
  const bbox = parseMaybeJSON(record.bounding_box || record.bbox);

  return {
    identifier: `state:${record.state_code || record.state}`,
    state: record.state_name || record.state,
    stateCode: (record.state_code || record.state || '').toUpperCase(),
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

  const stateParam = resolveStateFromRequest(request);
  if (!stateParam) {
    return badRequest('state parameter is required');
  }

  const stateCode = stateParam.toUpperCase();
  const key = cacheKey(stateCode);

  try {
    const limitState = await enforceRateLimit(`boundary-state:${stateCode}`);
    if (limitState?.blocked) {
      return limitState.response;
    }

    const cached = await getCachedJSON(key);
    if (cached) {
      const meta = cached.meta || {};
      return jsonResponse({ ...cached, meta: { ...meta, cache: 'hit' } });
    }

    const supabase = assertSupabaseClient();
    const { data, error } = await supabase.rpc('get_state_boundary', {
      state_filter: stateCode
    });

    if (error) {
      throw new Error(`Supabase get_state_boundary error: ${error.message}`);
    }

    const record = Array.isArray(data) ? data[0] : data;

    if (!record) {
      return jsonResponse({ error: 'State boundary not found', stateCode }, { status: 404 });
    }

    const formatted = transform(record);
    if (!formatted) {
      return internalError('State boundary could not be normalized');
    }

    await setCachedJSON(key, formatted, 30 * 60);

    return jsonResponse(formatted);
  } catch (error) {
    console.error(`Edge state boundary failure for ${stateCode}`, error);

    if (error.message && error.message.includes('Supabase service role credentials')) {
      return internalError('Supabase credentials are not configured for the Edge runtime');
    }

    return internalError('Failed to resolve state boundary', error.message);
  }
}

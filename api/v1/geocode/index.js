import { optionsResponse, methodNotAllowed, jsonResponse, badRequest, internalError } from '../../_lib/response.js';
import { assertSupabaseClient } from '../../_lib/supabase.js';
import { getCachedJSON, setCachedJSON } from '../../_lib/cache.js';
import { enforceRateLimit } from '../../_lib/rate-limit.js';
import { searchByHierarchy } from '../search/hierarchy.js';

export const config = {
  runtime: 'edge'
};

function extractQuery(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || url.searchParams.get('q');
  const state = url.searchParams.get('state') || url.searchParams.get('stateCode');
  const county = url.searchParams.get('county');
  const city = url.searchParams.get('city');
  const limitParam = Number(url.searchParams.get('limit') ?? '5');

  return {
    query,
    state,
    county,
    city,
    limit: Number.isNaN(limitParam) ? 5 : Math.min(Math.max(limitParam, 1), 25)
  };
}

function cacheKey({ query, state, county, city, limit }) {
  return `zip-search:v1:geocode:${query || ''}:${state || ''}:${county || ''}:${city || ''}:${limit}`;
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (request.method !== 'GET') {
    return methodNotAllowed(request.method);
  }

  const { query, state, county, city, limit } = extractQuery(request);

  if (!query) {
    return badRequest('query parameter is required');
  }

  const cacheToken = cacheKey({ query, state, county, city, limit });

  try {
    const rate = await enforceRateLimit(`geocode:${query}:${state}:${county}:${city}`);
    if (rate?.blocked) {
      return rate.response;
    }

    const cached = await getCachedJSON(cacheToken);
    if (cached) {
      const meta = cached.meta || {};
      return jsonResponse({ ...cached, meta: { ...meta, cache: 'hit' } });
    }

    const supabase = assertSupabaseClient();

    const resultSet = await searchByHierarchy(supabase, {
      query,
      state,
      county,
      city,
      limit,
      offset: 0
    });

    if (!resultSet || !Array.isArray(resultSet.results)) {
      return internalError('Unexpected geocode result shape from Supabase');
    }

    const payload = {
      ...resultSet,
      limit,
      offset: 0,
      meta: {
        cache: 'miss',
        strategy: 'geocode'
      }
    };

    await setCachedJSON(cacheToken, payload, 5 * 60);

    return jsonResponse(payload);
  } catch (error) {
    console.error(`Edge geocode failure for ${query}`, error);

    if (error.message && error.message.includes('Supabase service role credentials')) {
      return internalError('Supabase credentials are not configured for the Edge runtime');
    }

    return internalError('Failed to resolve geocode query', error.message);
  }
}

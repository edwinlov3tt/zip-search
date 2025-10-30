import { optionsResponse, methodNotAllowed, jsonResponse, badRequest, internalError } from '../../_lib/response.js';
import { assertSupabaseClient } from '../../_lib/supabase.js';
import { getCachedJSON, setCachedJSON } from '../../_lib/cache.js';
import { enforceRateLimit } from '../../_lib/rate-limit.js';
import { searchWithinRadius } from './radius.js';
import { searchWithinPolygon } from './polygon.js';
import { searchByHierarchy } from './hierarchy.js';

export const config = {
  runtime: 'edge'
};

function buildLimitParams(searchParams) {
  const limitParam = Number(searchParams.get('limit') ?? '200');
  const offsetParam = Number(searchParams.get('offset') ?? '0');

  const limit = Number.isNaN(limitParam) ? 200 : Math.min(Math.max(limitParam, 1), 500);
  const offset = Number.isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0);

  return { limit, offset };
}

function buildCacheKey(searchParams) {
  const entries = Array.from(searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  const serialized = new URLSearchParams(entries).toString();
  return `zip-search:v1:${serialized}`;
}

function extractClientIdentifier(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'anonymous';
}

function decorateWithRateHeaders(headers, rateState) {
  if (!rateState) return headers;
  if (typeof rateState.limit === 'number') {
    headers['x-ratelimit-limit'] = String(rateState.limit);
  }
  if (typeof rateState.remaining === 'number') {
    headers['x-ratelimit-remaining'] = String(rateState.remaining);
  }
  if (typeof rateState.reset === 'number') {
    headers['x-ratelimit-reset'] = String(rateState.reset);
  }
  return headers;
}

async function enforceLimits(request) {
  const identifier = extractClientIdentifier(request);
  const rateResult = await enforceRateLimit(identifier);

  if (rateResult?.success === false) {
    const nowSeconds = Date.now() / 1000;
    const retryAfter = rateResult.reset ? Math.max(0, Math.round(rateResult.reset - nowSeconds)) : 60;
    return {
      blocked: true,
      response: jsonResponse(
        {
          error: 'Too many requests',
          retryAfterSeconds: retryAfter
        },
        {
          status: 429,
          headers: {
            'retry-after': String(retryAfter)
          }
        }
      )
    };
  }

  return {
    blocked: false,
    state: rateResult
  };
}

function buildRateMeta(rateState) {
  if (!rateState) return undefined;
  const { limit, remaining, reset } = rateState;
  return {
    limit: typeof limit === 'number' ? limit : null,
    remaining: typeof remaining === 'number' ? remaining : null,
    reset: typeof reset === 'number' ? reset : null
  };
}

function buildMeta({ cacheStatus, strategy, tookMs, rateState }) {
  return {
    cache: cacheStatus,
    strategy,
    tookMs,
    rateLimit: buildRateMeta(rateState)
  };
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (request.method !== 'GET') {
    return methodNotAllowed(request.method);
  }

  const { searchParams } = new URL(request.url);
  const { limit, offset } = buildLimitParams(searchParams);
  const cacheKey = buildCacheKey(searchParams);
  const strategy = searchParams.get('polygon')
    ? 'polygon'
    : searchParams.has('lat') && searchParams.has('lng') && searchParams.has('radius')
      ? 'radius'
      : 'hierarchy';

  const metricsStart = Date.now();

  try {
    const supabase = assertSupabaseClient();

    const limitCheck = await enforceLimits(request);
    if (limitCheck.blocked) {
      return limitCheck.response;
    }

    const rateState = limitCheck.state;

    const cachedPayload = await getCachedJSON(cacheKey);
    if (cachedPayload) {
      const headers = decorateWithRateHeaders({}, rateState);
      return jsonResponse(
        {
          ...cachedPayload,
          meta: buildMeta({
            cacheStatus: 'hit',
            strategy,
            tookMs: Date.now() - metricsStart,
            rateState
          })
        },
        { headers }
      );
    }

    let result;

    if (strategy === 'polygon') {
      result = await searchWithinPolygon(supabase, {
        polygon: searchParams.get('polygon'),
        limit,
        offset
      });
    } else if (strategy === 'radius') {
      result = await searchWithinRadius(supabase, {
        lat: searchParams.get('lat'),
        lng: searchParams.get('lng'),
        radius: searchParams.get('radius'),
        limit,
        offset
      });
    } else {
      result = await searchByHierarchy(supabase, {
        query: searchParams.get('query'),
        state: searchParams.get('state'),
        county: searchParams.get('county'),
        city: searchParams.get('city'),
        limit,
        offset
      });
    }

    if (!result || !Array.isArray(result.results)) {
      return internalError('Unexpected search result shape from Supabase');
    }

    const payload = {
      ...result,
      limit,
      offset,
      meta: buildMeta({
        cacheStatus: 'miss',
        strategy,
        tookMs: Date.now() - metricsStart,
        rateState
      })
    };

    await setCachedJSON(cacheKey, payload);

    const headers = decorateWithRateHeaders({}, rateState);
    return jsonResponse(payload, { headers });
  } catch (error) {
    console.error('Edge search handler failure', error);

    if (error.message && error.message.includes('Supabase service role credentials')) {
      return internalError('Supabase credentials are not configured for the Edge runtime');
    }

    if (error.message && error.message.includes('Invalid radius search parameters')) {
      return badRequest('Latitude, longitude, and radius are required for radius search');
    }

    if (error.message && error.message.includes('Polygon parameter')) {
      return badRequest(error.message);
    }

    return internalError('Uncaught error executing search', error.message);
  }
}

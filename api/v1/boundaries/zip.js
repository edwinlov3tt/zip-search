import { optionsResponse, methodNotAllowed, jsonResponse, badRequest, internalError } from '../../_lib/response.js';
import { assertSupabaseClient } from '../../_lib/supabase.js';
import { getCachedJSON, setCachedJSON } from '../../_lib/cache.js';
import { enforceRateLimit } from '../../_lib/rate-limit.js';
import { normalizeZipRecord } from '../search/transform.js';

export const config = {
  runtime: 'edge'
};

function resolveZipFromRequest(request) {
  const { searchParams, pathname } = new URL(request.url);
  const paramZip =
    searchParams.get('zip') ||
    searchParams.get('code') ||
    searchParams.get('zipcode') ||
    searchParams.get('postal');

  if (paramZip) return paramZip;

  const segments = pathname.split('/').filter(Boolean);
  const zipIndex = segments.findIndex(segment => segment === 'zip');
  if (zipIndex >= 0 && segments[zipIndex + 1]) {
    return segments[zipIndex + 1];
  }

  return null;
}

function buildCacheKey(zipCode) {
  return `zip-search:v1:boundary:zip:${zipCode}`;
}

function decorateResult(record) {
  if (!record) return null;
  const normalized = normalizeZipRecord(record);

  if (!normalized?.zipCode) return null;

  return {
    identifier: `zip:${normalized.zipCode}`,
    ...normalized,
    areaSqMi: record.area_sq_mi ?? record.areaSqMi ?? null,
    geometryType: record.geometry_type || record.geometryType || 'MultiPolygon'
  };
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  if (request.method !== 'GET') {
    return methodNotAllowed(request.method);
  }

  const zipCode = resolveZipFromRequest(request);
  if (!zipCode) {
    return badRequest('zip parameter is required');
  }

  const cacheKey = buildCacheKey(zipCode);

  try {
    const limitState = await enforceRateLimit(`boundary-zip:${zipCode}`);
    if (limitState?.blocked) {
      return limitState.response;
    }

    const cached = await getCachedJSON(cacheKey);
    if (cached) {
      const meta = cached.meta || {};
      return jsonResponse({ ...cached, meta: { ...meta, cache: 'hit' } });
    }

    const supabase = assertSupabaseClient();
    const { data, error } = await supabase.rpc('get_zip_boundary', {
      zip_code: zipCode
    });

    if (error) {
      throw new Error(`Supabase get_zip_boundary error: ${error.message}`);
    }

    const boundaryRecord = Array.isArray(data) ? data[0] : data?.boundary ?? null;

    if (!boundaryRecord) {
      return jsonResponse({ error: 'Boundary not found', zipCode }, { status: 404 });
    }

    const formatted = decorateResult(boundaryRecord);
    if (!formatted) {
      return internalError('Boundary record could not be normalized');
    }

    formatted.meta = { cache: 'miss' };

    await setCachedJSON(cacheKey, formatted, 10 * 60);

    return jsonResponse(formatted);
  } catch (error) {
    console.error(`Edge zip boundary failure for ${zipCode}`, error);

    if (error.message && error.message.includes('Supabase service role credentials')) {
      return internalError('Supabase credentials are not configured for the Edge runtime');
    }

    return internalError('Failed to resolve ZIP boundary', error.message);
  }
}

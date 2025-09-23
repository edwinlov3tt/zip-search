import { OptimizedStaticService } from './optimizedStaticService';
import supabaseService from './supabaseService';

// Single backend base URL (no localhost default in production)
const API_BASE_URL = import.meta.env.VITE_API_URL;

function requireApiBase() {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_URL. Configure your backend API base URL.');
  }
}

function isLocalhostHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

async function fetchWithLocalhostFallback(path, fetchInit) {
  // If explicit base provided via env, use it only
  if (API_BASE_URL) {
    return fetch(`${API_BASE_URL}${path}`, fetchInit);
  }

  // Allow convenient localhost testing across common ports without env config
  if (typeof window !== 'undefined' && isLocalhostHost(window.location.hostname)) {
    const origin = window.location.origin; // e.g., http://localhost:5173
    const commonPorts = [5173, 3001, 8000, 8001, 8080, 5000, 7000];
    const bases = [
      `${origin}/api`,
      ...commonPorts.map(p => `http://localhost:${p}/api`),
      ...commonPorts.map(p => `http://127.0.0.1:${p}/api`),
    ];

    // Try candidates sequentially with short timeouts
    for (const base of bases) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(`${base}${path}`, { ...(fetchInit || {}), signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) return res;
        // On HTTP error, continue to next candidate
      } catch (_) {
        // Network error/timeout; try next candidate
      }
    }
  }

  // Non-localhost or all candidates failed: behave as fail-fast
  requireApiBase();
  return fetch(`${API_BASE_URL}${path}`, fetchInit);
}
const USE_SUPABASE = true; // Use Supabase as primary source
const USE_STATIC_DATA = false; // Keep explicit flag; we still fall back dynamically

// API service functions for zip code data
export class ZipCodeService {
  static async search(params) {
    // Prefer Supabase, with graceful fallback to static data
    if (USE_SUPABASE) {
      try {
        const supabaseResult = await supabaseService.search(params);
        if (supabaseResult && Array.isArray(supabaseResult.results) && supabaseResult.results.length > 0) {
          return supabaseResult;
        }
        // If Supabase returns no results (empty DB/RLS), try static fallback for supported queries
        return await OptimizedStaticService.search(params);
      } catch (e) {
        // On error, try static as a safety net
        return await OptimizedStaticService.search(params);
      }
    }

    // Use static data if explicitly enabled
    if (USE_STATIC_DATA) {
      return OptimizedStaticService.search(params);
    }

    const queryParams = new URLSearchParams();

    if (params.query) queryParams.append('query', params.query);
    if (params.lat && params.lng) {
      queryParams.append('lat', params.lat);
      queryParams.append('lng', params.lng);
    }
    if (params.radius) queryParams.append('radius', params.radius);
    if (params.state) queryParams.append('state', params.state);
    if (params.county) queryParams.append('county', params.county);
    if (params.city) queryParams.append('city', params.city);
    if (params.polygon) queryParams.append('polygon', JSON.stringify(params.polygon));
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);

    try {
      const response = await fetchWithLocalhostFallback(`/search?${queryParams}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      const apiResult = await response.json();
      if (!apiResult || !apiResult.results || apiResult.results.length === 0) {
        // As a last resort, use static
        return await OptimizedStaticService.search(params);
      }
      return apiResult;
    } catch (error) {
      console.warn('API failed, falling back to static data:', error);
      return OptimizedStaticService.search(params);
    }
  }

  static async getStates() {
    if (USE_SUPABASE) {
      try {
        const states = await supabaseService.getStates();
        // Only fall back if Supabase returns 0
        if (Array.isArray(states) && states.length > 0) {
          return states;
        }
        console.warn(`Supabase returned ${Array.isArray(states) ? states.length : 0} states; using static fallback.`);
      } catch (e) {
        console.warn('Supabase getStates failed; using static fallback.', e);
      }
      const result = await OptimizedStaticService.getStates();
      return result.states || [];
    }

    if (USE_STATIC_DATA) {
      const result = await OptimizedStaticService.getStates();
      return result.states || [];
    }

    try {
      const response = await fetchWithLocalhostFallback(`/states`);
      if (!response.ok) {
        throw new Error(`Failed to fetch states: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn('API failed, falling back to static data:', error);
      const result = await OptimizedStaticService.getStates();
      return result.states || [];
    }
  }

  static async getCounties(state) {
    if (USE_SUPABASE) {
      try {
        const counties = await supabaseService.getCounties(state);
        if (Array.isArray(counties) && counties.length > 0) return counties;
      } catch (e) {
        console.warn('Supabase getCounties failed; using static fallback.', e);
      }
      const result = await OptimizedStaticService.getCounties({ state });
      return result.counties || [];
    }

    if (USE_STATIC_DATA) {
      const result = await OptimizedStaticService.getCounties({ state });
      return result.counties || [];
    }

    const queryParams = new URLSearchParams();
    if (state) queryParams.append('state', state);

    try {
      const response = await fetchWithLocalhostFallback(`/counties?${queryParams}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch counties: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn('API failed, falling back to static data:', error);
      const result = await OptimizedStaticService.getCounties({ state });
      return result.counties || [];
    }
  }

  static async getCities(state, county) {
    if (USE_SUPABASE) {
      try {
        const cities = await supabaseService.getCities(state, county);
        if (Array.isArray(cities) && cities.length > 0) return cities;
      } catch (e) {
        console.warn('Supabase getCities failed; using static fallback.', e);
      }
      const result = await OptimizedStaticService.getCities({ state, county });
      return result.cities || [];
    }

    if (USE_STATIC_DATA) {
      const result = await OptimizedStaticService.getCities({ state, county });
      return result.cities || [];
    }

    const queryParams = new URLSearchParams();
    if (state) queryParams.append('state', state);
    if (county) queryParams.append('county', county);

    try {
      const response = await fetchWithLocalhostFallback(`/cities?${queryParams}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cities: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn('API failed, falling back to static data:', error);
      const result = await OptimizedStaticService.getCities({ state, county });
      return result.cities || [];
    }
  }

  static async getZipCode(zipCode) {
    if (USE_STATIC_DATA) {
      return OptimizedStaticService.getZipCode({ zip: zipCode });
    }

    try {
      const response = await fetchWithLocalhostFallback(`/zipcode/${zipCode}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch zip code: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn('API failed, falling back to static data:', error);
      return OptimizedStaticService.getZipCode({ zip: zipCode });
    }
  }

  static async health() {
    // For static data, always return healthy
    if (USE_STATIC_DATA) {
      return { status: 'OK', mode: 'static' };
    }

    try {
      const response = await fetchWithLocalhostFallback(`/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        return { status: 'unavailable', mode: 'no-api-json' };
      }
      return await response.json();
    } catch (error) {
      // If API is down, we're still healthy with static data
      return { status: 'OK', mode: 'static-fallback' };
    }
  }

  // Helper function to geocode a location (simple text search)
  static async geocodeLocation(location) {
    const result = await this.search({ query: location, limit: 1 });
    if (result.results && result.results.length > 0) {
      const firstResult = result.results[0];
      return {
        lat: firstResult.latitude,
        lng: firstResult.longitude,
        location: `${firstResult.city}, ${firstResult.stateCode || firstResult.state}`
      };
    }
    throw new Error('Location not found');
  }
}

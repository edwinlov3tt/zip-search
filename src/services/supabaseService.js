/**
 * Supabase Service for ZIP Code Data
 * Connects to Supabase PostgreSQL for ZIP code searches
 */

import { createClient } from '@supabase/supabase-js';
import { getStateName } from '../utils/stateNames.js';

// Initialize Supabase client (env-only; no hardcoded defaults)
// Using global singleton to avoid "Multiple GoTrueClient instances" warning
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = hasSupabase
  ? (globalThis.__supabaseClient ||= createClient(supabaseUrl, supabaseAnonKey))
  : null;

// One-time init log (non-sensitive)
try {
  const urlHost = supabaseUrl ? new URL(supabaseUrl).host : 'n/a';
  console.info('[Supabase] init', { enabled: hasSupabase, urlHost });
} catch (_) {
  console.info('[Supabase] init', { enabled: hasSupabase });
}

class SupabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Search ZIP codes with various parameters
   */
  async search(params = {}) {
    if (!hasSupabase) {
      console.warn('Supabase disabled: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
      return { results: [], total: 0, offset: params.offset || 0, limit: params.limit || 0, hasMore: false };
    }
    const t0 = performance && performance.now ? performance.now() : Date.now();
    const {
      query,
      lat,
      lng,
      radius,
      state,
      county,
      city,
      polygon,
      limit = 500,  // Increased default for initial load
      offset = 0
    } = params;

    try {
      // If no search parameters provided, return empty results instead of loading everything
      if (!query && !lat && !lng && !state && !county && !city && !polygon) {
        return {
          results: [],
          total: 0,
          offset,
          limit,
          hasMore: false
        };
      }

      // Skip RPC functions for now as they don't exist in the database
      // Will use client-side filtering below instead

      let queryBuilder = supabase
        .from('zipcodes')
        .select('*');

      // Parse query for city, state combinations (e.g., "Lincoln, NE")
      let parsedCity = city;
      let parsedState = state;
      let parsedCounty = county;
      let parsedQuery = query;

      if (query && !city && !state) {
        // Check if query contains city, state format
        const cityStateMatch = query.match(/^([^,]+),\s*([A-Z]{2})$/);
        if (cityStateMatch) {
          parsedCity = cityStateMatch[1].trim();
          parsedState = cityStateMatch[2].trim();
          parsedQuery = null; // Don't use raw query
        } else {
          // Check if query contains county, state format
          const countyStateMatch = query.match(/^([^,]+)\s+County,\s*([A-Z]{2})$/i);
          if (countyStateMatch) {
            parsedCounty = countyStateMatch[1].trim();
            parsedState = countyStateMatch[2].trim();
            parsedQuery = null; // Don't use raw query
          }
        }
      }

      // Text search (ZIP, city, county) - only if not parsed as city/state
      if (parsedQuery) {
        queryBuilder = queryBuilder.or(`zipcode.ilike.%${parsedQuery}%,city.ilike.%${parsedQuery}%,county.ilike.%${parsedQuery}%`);
      }

      // State filter
      if (parsedState) {
        queryBuilder = queryBuilder.eq('state_code', parsedState);
      }

      // County filter
      if (parsedCounty) {
        queryBuilder = queryBuilder.eq('county', parsedCounty);
      }

      // City filter
      if (parsedCity) {
        queryBuilder = queryBuilder.eq('city', parsedCity);
      }

      // Spatial pre-filter (bounding box) to reduce transfer for radius/polygon)
      if (lat != null && lng != null && radius != null) {
        const miles = Number(radius);
        const latDelta = miles / 69; // approx
        const lngDelta = miles / (69 * Math.cos((Number(lat) || 0) * Math.PI / 180) || 1);
        const minLat = Number(lat) - latDelta;
        const maxLat = Number(lat) + latDelta;
        const minLng = Number(lng) - lngDelta;
        const maxLng = Number(lng) + lngDelta;
        queryBuilder = queryBuilder
          .gte('latitude', minLat)
          .lte('latitude', maxLat)
          .gte('longitude', minLng)
          .lte('longitude', maxLng);
      } else if (polygon && Array.isArray(polygon) && polygon.length >= 3) {
        const lats = polygon.map(p => p.lat);
        const lngs = polygon.map(p => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        queryBuilder = queryBuilder
          .gte('latitude', minLat)
          .lte('latitude', maxLat)
          .gte('longitude', minLng)
          .lte('longitude', maxLng);
      }

      // Pagination - need to request count separately for total
      queryBuilder = queryBuilder
        .range(offset, offset + limit - 1)
        .limit(limit);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      // Transform to expected format
      const results = (data || []).map(row => ({
        zipcode: row.zipcode,
        city: row.city,
        state: row.state_code,
        stateCode: row.state_code,
        county: row.county,
        latitude: row.latitude,
        longitude: row.longitude,
        lat: row.latitude,
        lng: row.longitude
      }));

      // Client-side filters where applicable
      let filteredResults = results;
      if (lat && lng && radius) {
        filteredResults = results.filter(zip => {
          const distance = this.calculateDistance(lat, lng, zip.latitude, zip.longitude);
          return distance <= radius;
        });
      }

      // Polygon filter (client-side)
      if (polygon && Array.isArray(polygon) && polygon.length >= 3) {
        filteredResults = filteredResults.filter((zip) => {
          return this.pointInPolygon({ lat: zip.latitude, lng: zip.longitude }, polygon);
        });
      }

      const out = {
        results: filteredResults,
        total: filteredResults.length,
        offset,
        limit,
        hasMore: false  // Can't determine without count
      };

      // Dev log to clarify filtering behavior
      try {
        const bboxApplied = (lat != null && lng != null && radius != null) || (polygon && Array.isArray(polygon) && polygon.length >= 3);
        console.info('[Supabase] results', {
          raw: (data || []).length,
          filtered: filteredResults.length,
          bboxApplied,
          usedParams: { hasQuery: !!query, hasLatLng: !!(lat && lng), hasPolygon: !!polygon }
        });
      } catch (_) {}

      return out;

    } catch (error) {
      console.error('Supabase search error:', error);
      throw error;
    } finally {
      const t1 = performance && performance.now ? performance.now() : Date.now();
      console.info('[Supabase] search', {
        params: { hasQuery: !!params.query, hasLatLng: !!(params.lat && params.lng), hasPolygon: !!params.polygon },
        ms: Math.round(t1 - t0)
      });
    }
  }

  _polygonToGeoJSON(polygon) {
    const coords = polygon.map(p => [Number(p.lng), Number(p.lat)]);
    if (coords.length > 0) {
      const [fx, fy] = coords[0];
      const [lx, ly] = coords[coords.length - 1];
      if (fx !== lx || fy !== ly) coords.push([fx, fy]);
    }
    return { type: 'Polygon', coordinates: [coords] };
  }

  /**
   * Get all states
   */
  async getStates() {
    if (!hasSupabase) {
      console.warn('Supabase disabled: missing env');
      return [];
    }
    try {
      // Prefer RPC for distinct states if available
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('distinct_states');
        if (!rpcError && Array.isArray(rpcData)) {
          const states = rpcData
            .map(r => (r && typeof r.code === 'string' ? r.code.trim().toUpperCase() : null))
            .filter(code => typeof code === 'string' && /^[A-Z]{2}$/.test(code))
            .map(code => ({ code, name: getStateName(code) }));
          console.info('[Supabase] states via RPC', { count: states.length });
          return states;
        }
      } catch (e) {
        console.warn('[Supabase] distinct_states RPC unavailable; falling back.', e);
      }

      // Fallback: fetch codes and de-duplicate client-side
      const { data, error } = await supabase
        .from('zipcodes')
        .select('state_code')
        .not('state_code', 'is', null)
        .order('state_code');

      if (error) throw error;

      const uniqueStates = [...new Set(
        (data || [])
          .map(row => (row && typeof row.state_code === 'string' ? row.state_code.trim().toUpperCase() : null))
          .filter(code => typeof code === 'string' && /^[A-Z]{2}$/.test(code))
      )];
      const states = uniqueStates.map(code => ({ code, name: getStateName(code) }));
      console.info('[Supabase] states via select', { count: states.length });
      return states;

    } catch (error) {
      console.error('Supabase getStates error:', error);
      throw error;
    }
  }

  /**
   * Get counties for a state
   */
  async getCounties(state) {
    if (!hasSupabase) {
      console.warn('Supabase disabled: missing env');
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('zipcodes')
        .select('county')
        .eq('state_code', state)
        .order('county');

      if (error) throw error;

      // Get unique counties
      const uniqueCounties = [...new Set(data.map(row => row.county).filter(Boolean))];

      return uniqueCounties.map(name => ({ name }));

    } catch (error) {
      console.error('Supabase getCounties error:', error);
      throw error;
    }
  }

  /**
   * Get cities for a state/county
   */
  async getCities(state, county) {
    if (!hasSupabase) {
      console.warn('Supabase disabled: missing env');
      return [];
    }
    try {
      let queryBuilder = supabase
        .from('zipcodes')
        .select('city');

      if (state) {
        queryBuilder = queryBuilder.eq('state_code', state);
      }

      if (county) {
        queryBuilder = queryBuilder.eq('county', county);
      }

      queryBuilder = queryBuilder.order('city');

      const { data, error } = await queryBuilder;

      if (error) throw error;

      // Get unique cities
      const uniqueCities = [...new Set(data.map(row => row.city).filter(Boolean))];

      return uniqueCities.map(name => ({ name }));

    } catch (error) {
      console.error('Supabase getCities error:', error);
      throw error;
    }
  }

  /**
   * Get single ZIP code details
   */
  async getZipCode(zipCode) {
    if (!hasSupabase) {
      console.warn('Supabase disabled: missing env');
      return { error: 'Supabase disabled', zipcode: null };
    }
    try {
      const { data, error } = await supabase
        .from('zipcodes')
        .select('*')
        .eq('zipcode', zipCode)
        .single();

      if (error) throw error;

      if (!data) {
        return { error: 'Zip code not found', zipcode: null };
      }

      return {
        zipcode: {
          zipcode: data.zipcode,
          city: data.city,
          state: data.state_code,
          county: data.county,
          latitude: data.latitude,
          longitude: data.longitude
        }
      };

    } catch (error) {
      console.error('Supabase getZipCode error:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ/2) * Math.sin(Δλ/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Simple ray-casting point-in-polygon check
  pointInPolygon(point, polygon) {
    const x = point.lng, y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Check if Supabase is connected and working
   */
  async checkHealth() {
    if (!hasSupabase) return false;
    try {
      const { data, error } = await supabase
        .from('zipcodes')
        .select('zipcode')
        .limit(1);
      const ok = !error && data && data.length > 0;
      console.info('[Supabase] health', { ok });
      return ok;
    } catch {
      console.info('[Supabase] health', { ok: false });
      return false;
    }
  }
}

// Export singleton instance
export default new SupabaseService();

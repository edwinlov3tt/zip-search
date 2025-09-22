/**
 * Supabase Service for ZIP Code Data
 * Connects to Supabase PostgreSQL for ZIP code searches
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xpdvxliqbrctzyxmijmm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZHZ4bGlxYnJjdHp5eG1pam1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0MDk4MTAsImV4cCI6MjA3Mzk4NTgxMH0.yRon9tuR3QHfsAcVXqfGsD4NIUGLUmz-SPSC0VvKrqY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

class SupabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Search ZIP codes with various parameters
   */
  async search(params) {
    const {
      query,
      lat,
      lng,
      radius,
      state,
      county,
      city,
      polygon,
      limit = 100,
      offset = 0
    } = params;

    try {
      let queryBuilder = supabase
        .from('zip_codes')
        .select('*');

      // Text search (ZIP, city, county)
      if (query) {
        queryBuilder = queryBuilder.or(`zipcode.ilike.%${query}%,city.ilike.%${query}%,county.ilike.%${query}%`);
      }

      // State filter
      if (state) {
        queryBuilder = queryBuilder.eq('state_code', state);
      }

      // County filter
      if (county) {
        queryBuilder = queryBuilder.eq('county', county);
      }

      // City filter
      if (city) {
        queryBuilder = queryBuilder.eq('city', city);
      }

      // Pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1);

      const { data, error, count } = await queryBuilder;

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

      // Filter by radius if coordinates provided
      let filteredResults = results;
      if (lat && lng && radius) {
        filteredResults = results.filter(zip => {
          const distance = this.calculateDistance(lat, lng, zip.latitude, zip.longitude);
          return distance <= radius;
        });
      }

      return {
        results: filteredResults,
        total: count || filteredResults.length,
        offset,
        limit,
        hasMore: (offset + limit) < (count || filteredResults.length)
      };

    } catch (error) {
      console.error('Supabase search error:', error);

      // Fallback to static data if Supabase fails
      try {
        const { OptimizedStaticService } = await import('./optimizedStaticService');
        return OptimizedStaticService.search(params);
      } catch (fallbackError) {
        console.error('Fallback to static data also failed:', fallbackError);
        return { results: [], total: 0, offset, limit, hasMore: false };
      }
    }
  }

  /**
   * Get all states
   */
  async getStates() {
    try {
      const { data, error } = await supabase
        .from('zip_codes')
        .select('state_code')
        .order('state_code');

      if (error) throw error;

      // Get unique states
      const uniqueStates = [...new Set(data.map(row => row.state_code))];

      return uniqueStates.map(code => ({
        code,
        name: code // You could map to full names if needed
      }));

    } catch (error) {
      console.error('Supabase getStates error:', error);

      // Fallback to static data
      try {
        const { OptimizedStaticService } = await import('./optimizedStaticService');
        const result = await OptimizedStaticService.getStates();
        return result.states || [];
      } catch (fallbackError) {
        return [];
      }
    }
  }

  /**
   * Get counties for a state
   */
  async getCounties(state) {
    try {
      const { data, error } = await supabase
        .from('zip_codes')
        .select('county')
        .eq('state_code', state)
        .order('county');

      if (error) throw error;

      // Get unique counties
      const uniqueCounties = [...new Set(data.map(row => row.county).filter(Boolean))];

      return uniqueCounties.map(name => ({ name }));

    } catch (error) {
      console.error('Supabase getCounties error:', error);

      // Fallback to static data
      try {
        const { OptimizedStaticService } = await import('./optimizedStaticService');
        const result = await OptimizedStaticService.getCounties({ state });
        return result.counties || [];
      } catch (fallbackError) {
        return [];
      }
    }
  }

  /**
   * Get cities for a state/county
   */
  async getCities(state, county) {
    try {
      let queryBuilder = supabase
        .from('zip_codes')
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

      // Fallback to static data
      try {
        const { OptimizedStaticService } = await import('./optimizedStaticService');
        const result = await OptimizedStaticService.getCities({ state, county });
        return result.cities || [];
      } catch (fallbackError) {
        return [];
      }
    }
  }

  /**
   * Get single ZIP code details
   */
  async getZipCode(zipCode) {
    try {
      const { data, error } = await supabase
        .from('zip_codes')
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

      // Fallback to static data
      try {
        const { OptimizedStaticService } = await import('./optimizedStaticService');
        return OptimizedStaticService.getZipCode({ zip: zipCode });
      } catch (fallbackError) {
        return { error: 'Zip code not found', zipcode: null };
      }
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

  /**
   * Check if Supabase is connected and working
   */
  async checkHealth() {
    try {
      const { data, error } = await supabase
        .from('zip_codes')
        .select('zipcode')
        .limit(1);

      return !error && data && data.length > 0;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export default new SupabaseService();
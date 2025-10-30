import apiClient from './apiClient';
import { OptimizedStaticService } from './optimizedStaticService';
import supabaseService from './supabaseService';

const USE_SUPABASE = true; // Use Supabase as primary source
const USE_STATIC_DATA = false; // Keep explicit flag for static fallback

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
        // If Supabase returns no results, try static fallback for supported queries
        return await OptimizedStaticService.search(params);
      } catch (e) {
        console.warn('Supabase search failed, trying static fallback:', e);
        return await OptimizedStaticService.search(params);
      }
    }

    // Use static data if explicitly enabled
    if (USE_STATIC_DATA) {
      return OptimizedStaticService.search(params);
    }

    // Use the centralized API client
    try {
      const queryParams = {};

      if (params.query) queryParams.query = params.query;
      if (params.lat && params.lng) {
        queryParams.lat = params.lat;
        queryParams.lng = params.lng;
      }
      if (params.radius) queryParams.radius = params.radius;
      if (params.state) queryParams.state = params.state;
      if (params.county) queryParams.county = params.county;
      if (params.city) queryParams.city = params.city;
      if (params.polygon) queryParams.polygon = JSON.stringify(params.polygon);
      if (params.limit) queryParams.limit = params.limit;
      if (params.offset) queryParams.offset = params.offset;

      const apiResult = await apiClient.get('search', queryParams);

      if (!apiResult || !apiResult.results || apiResult.results.length === 0) {
        // As a last resort, use static
        return await OptimizedStaticService.search(params);
      }
      return apiResult;
    } catch (error) {
      console.warn('API search failed, falling back to static data:', error);
      return OptimizedStaticService.search(params);
    }
  }

  static async getStates() {
    if (USE_SUPABASE) {
      try {
        const states = await supabaseService.getStates();
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
      const states = await apiClient.get('states');
      if (Array.isArray(states) && states.length > 0) {
        return states;
      }
      // Fall back to static if API returns empty
      const result = await OptimizedStaticService.getStates();
      return result.states || [];
    } catch (error) {
      console.warn('API getStates failed, falling back to static data:', error);
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

    try {
      const counties = await apiClient.get('counties', state ? { state } : {});
      if (Array.isArray(counties) && counties.length > 0) {
        return counties;
      }
      // Fall back to static if API returns empty
      const result = await OptimizedStaticService.getCounties({ state });
      return result.counties || [];
    } catch (error) {
      console.warn('API getCounties failed, falling back to static data:', error);
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

    try {
      const params = {};
      if (state) params.state = state;
      if (county) params.county = county;

      const cities = await apiClient.get('cities', params);
      if (Array.isArray(cities) && cities.length > 0) {
        return cities;
      }
      // Fall back to static if API returns empty
      const result = await OptimizedStaticService.getCities({ state, county });
      return result.cities || [];
    } catch (error) {
      console.warn('API getCities failed, falling back to static data:', error);
      const result = await OptimizedStaticService.getCities({ state, county });
      return result.cities || [];
    }
  }

  static async getZipCode(zipCode) {
    if (USE_STATIC_DATA) {
      return OptimizedStaticService.getZipCode({ zip: zipCode });
    }

    try {
      const result = await apiClient.get(`zipcode/${zipCode}`);
      if (result) {
        return result;
      }
      // Fall back to static if API returns empty
      return OptimizedStaticService.getZipCode({ zip: zipCode });
    } catch (error) {
      console.warn('API getZipCode failed, falling back to static data:', error);
      return OptimizedStaticService.getZipCode({ zip: zipCode });
    }
  }

  static async health() {
    // For static data, always return healthy
    if (USE_STATIC_DATA) {
      return { status: 'OK', mode: 'static' };
    }

    try {
      const health = await apiClient.healthCheck();
      return health;
    } catch (error) {
      // If API is down, we're still healthy with static data
      return { status: 'OK', mode: 'static-fallback', error: error.message };
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
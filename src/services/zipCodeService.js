import { OptimizedStaticService } from './optimizedStaticService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const USE_STATIC_DATA = true; // Use static data since API endpoints were removed

// API service functions for zip code data
export class ZipCodeService {
  static async search(params) {
    // Use static data if enabled
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
      const response = await fetch(`${API_BASE_URL}/search?${queryParams}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.warn('API failed, falling back to static data:', error);
      return OptimizedStaticService.search(params);
    }
  }

  static async getStates() {
    if (USE_STATIC_DATA) {
      const result = await OptimizedStaticService.getStates();
      return result.states || [];
    }

    try {
      const response = await fetch(`${API_BASE_URL}/states`);
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
    if (USE_STATIC_DATA) {
      const result = await OptimizedStaticService.getCounties({ state });
      return result.counties || [];
    }

    const queryParams = new URLSearchParams();
    if (state) queryParams.append('state', state);

    try {
      const response = await fetch(`${API_BASE_URL}/counties?${queryParams}`);
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
    if (USE_STATIC_DATA) {
      const result = await OptimizedStaticService.getCities({ state, county });
      return result.cities || [];
    }

    const queryParams = new URLSearchParams();
    if (state) queryParams.append('state', state);
    if (county) queryParams.append('county', county);

    try {
      const response = await fetch(`${API_BASE_URL}/cities?${queryParams}`);
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
      const response = await fetch(`${API_BASE_URL}/zipcode/${zipCode}`);
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
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      return response.json();
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
const API_BASE_URL = 'http://localhost:3001/api';

// API service functions for zip code data
export class ZipCodeService {
  static async search(params) {
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

    const response = await fetch(`${API_BASE_URL}/search?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }
    return response.json();
  }

  static async getStates() {
    const response = await fetch(`${API_BASE_URL}/states`);
    if (!response.ok) {
      throw new Error(`Failed to fetch states: ${response.statusText}`);
    }
    return response.json();
  }

  static async getCounties(state) {
    const queryParams = new URLSearchParams();
    if (state) queryParams.append('state', state);

    const response = await fetch(`${API_BASE_URL}/counties?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch counties: ${response.statusText}`);
    }
    return response.json();
  }

  static async getCities(state, county) {
    const queryParams = new URLSearchParams();
    if (state) queryParams.append('state', state);
    if (county) queryParams.append('county', county);

    const response = await fetch(`${API_BASE_URL}/cities?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch cities: ${response.statusText}`);
    }
    return response.json();
  }

  static async getZipCode(zipCode) {
    const response = await fetch(`${API_BASE_URL}/zipcode/${zipCode}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch zip code: ${response.statusText}`);
    }
    return response.json();
  }

  static async health() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  // Helper function to geocode a location (simple text search)
  static async geocodeLocation(location) {
    const result = await this.search({ query: location, limit: 1 });
    if (result.results && result.results.length > 0) {
      const firstResult = result.results[0];
      return {
        lat: firstResult.latitude,
        lng: firstResult.longitude,
        location: `${firstResult.city}, ${firstResult.stateCode}`
      };
    }
    throw new Error('Location not found');
  }
}
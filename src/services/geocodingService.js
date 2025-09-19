// Free geocoding service using Nominatim (OpenStreetMap)
// Enhanced rate limiting with request deduplication for multiple instances

class GeocodingService {
  constructor() {
    this.baseUrl = 'https://nominatim.openstreetmap.org';
    this.lastRequestTime = 0;
    this.minInterval = 1500; // 1.5 seconds between requests for safety margin
    this.pendingRequests = new Map(); // Cache pending requests to avoid duplicates
  }

  // Enhanced rate limiting with request deduplication
  async makeRequest(url) {
    // Check if this exact request is already pending
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url);
    }

    const requestPromise = this._executeRequest(url);
    this.pendingRequests.set(url, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up the pending request after completion
      setTimeout(() => {
        this.pendingRequests.delete(url);
      }, 500);
    }
  }

  async _executeRequest(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // More conservative rate limiting for multiple instances
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ZipSearchApp/1.0' // Required by Nominatim
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    return response.json();
  }

  // Search for places with autocomplete
  async searchPlaces(query, limit = 8) {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: limit.toString(),
        countrycodes: 'us', // Limit to US only
        addressdetails: '1',
        extratags: '1',
        namedetails: '1'
      });

      const url = `${this.baseUrl}/search?${params}`;
      const results = await this.makeRequest(url);

      return results.map(result => ({
        id: result.place_id,
        displayName: result.display_name,
        name: result.name,
        type: this.categorizeResult(result),
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        address: result.address || {},
        importance: result.importance || 0,
        raw: result
      })).sort((a, b) => b.importance - a.importance); // Sort by importance

    } catch (error) {
      console.error('Geocoding search failed:', error);
      return [];
    }
  }

  // Categorize search results
  categorizeResult(result) {
    const type = result.type;
    const osm_type = result.osm_type;
    const address = result.address || {};

    // ZIP code
    if (address.postcode || /^\d{5}(-\d{4})?$/.test(result.name)) {
      return 'zipcode';
    }

    // State
    if (type === 'administrative' && address.state && !address.city && !address.county) {
      return 'state';
    }

    // County
    if (type === 'administrative' && (address.county || result.display_name.includes('County'))) {
      return 'county';
    }

    // City/Town
    if (['city', 'town', 'village', 'hamlet'].includes(type) ||
        address.city || address.town || address.village) {
      return 'city';
    }

    // Address/Business
    if (address.house_number || type === 'house' || osm_type === 'node') {
      return 'address';
    }

    // Default
    return 'place';
  }

  // Format display name for dropdown
  formatDisplayName(result) {
    const { address, type, name, displayName } = result;

    switch (type) {
      case 'zipcode':
        return `${address.postcode || name} - ${address.city || address.town}, ${address.state}`;

      case 'city':
        return `${address.city || address.town || name}, ${address.state}`;

      case 'county':
        return `${address.county || name}, ${address.state}`;

      case 'state':
        return `${address.state || name}`;

      case 'address':
        const parts = [];
        if (address.house_number) parts.push(address.house_number);
        if (address.road) parts.push(address.road);
        if (address.city || address.town) parts.push(address.city || address.town);
        if (address.state) parts.push(address.state);
        return parts.join(', ');

      default:
        // Simplify long display names
        const displayParts = displayName.split(', ');
        return displayParts.slice(0, 3).join(', ');
    }
  }

  // Get icon for result type
  getResultIcon(type) {
    switch (type) {
      case 'zipcode': return '📮';
      case 'city': return '🏙️';
      case 'county': return '🏛️';
      case 'state': return '🗺️';
      case 'address': return '📍';
      default: return '📍';
    }
  }

  // Reverse geocode coordinates to get address
  async reverseGeocode(lat, lng) {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1'
      });

      const url = `${this.baseUrl}/reverse?${params}`;
      const result = await this.makeRequest(url);

      if (result && result.address) {
        return {
          displayName: result.display_name,
          address: result.address,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        };
      }

      return null;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }
}

export const geocodingService = new GeocodingService();
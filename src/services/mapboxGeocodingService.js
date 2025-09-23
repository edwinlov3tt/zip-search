// MapBox Geocoding Service - Much more accurate than Nominatim
// Free tier: 100,000 requests/month
// You'll need to sign up at https://www.mapbox.com/ and get an API key

class MapBoxGeocodingService {
  constructor() {
    // Load Mapbox key from env (supports TOKEN or ACCESS_TOKEN)
    this.apiKey =
      import.meta.env.VITE_MAPBOX_TOKEN ||
      import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
      'YOUR_MAPBOX_API_KEY_HERE';
    this.baseUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
    this.lastRequestTime = 0;
    this.minInterval = 100; // MapBox allows much higher rate limits
    this.pendingRequests = new Map();

    // Debug logging - remove in production
    // console.log('MapBox API Key loaded:', this.apiKey ? 'YES' : 'NO');
    // console.log('MapBox API Key starts with pk.:', this.apiKey.startsWith('pk.'));
  }

  // Enhanced rate limiting with request deduplication
  async makeRequest(url) {
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url);
    }

    const requestPromise = this._executeRequest(url);
    this.pendingRequests.set(url, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      setTimeout(() => {
        this.pendingRequests.delete(url);
      }, 500);
    }
  }

  async _executeRequest(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`MapBox geocoding request failed: ${response.status}`);
    }

    return response.json();
  }

  // Search for places with autocomplete
  async searchPlaces(query, limit = 8) {
    if (!query || query.length < 2) {
      return [];
    }

    if (this.apiKey === 'YOUR_MAPBOX_API_KEY_HERE') {
      console.warn('Mapbox API key not configured. Set VITE_MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN.');
      return [];
    }

    try {
      const params = new URLSearchParams({
        access_token: this.apiKey,
        limit: limit.toString(),
        country: 'US', // Limit to US only
        types: 'country,region,postcode,district,place,locality,neighborhood,address,poi',
        autocomplete: 'true'
      });

      const url = `${this.baseUrl}/${encodeURIComponent(query)}.json?${params}`;
      const result = await this.makeRequest(url);

      if (!result.features) {
        return [];
      }

      return result.features.map(feature => ({
        id: feature.id,
        displayName: feature.place_name,
        name: feature.text,
        type: this.categorizeResult(feature),
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        address: this.parseAddress(feature),
        importance: this.calculateImportance(feature),
        raw: feature
      })).sort((a, b) => b.importance - a.importance);

    } catch (error) {
      console.error('MapBox geocoding search failed:', error);
      return [];
    }
  }

  // Parse MapBox address components
  parseAddress(feature) {
    const context = feature.context || [];
    const address = {};

    // Extract address components from context
    context.forEach(item => {
      if (item.id.startsWith('postcode')) {
        address.postcode = item.text;
      } else if (item.id.startsWith('place')) {
        address.city = item.text;
      } else if (item.id.startsWith('district')) {
        address.county = item.text;
      } else if (item.id.startsWith('region')) {
        address.state = item.text;
      }
    });

    // Handle address number and street
    if (feature.properties && feature.properties.address) {
      address.house_number = feature.properties.address;
    }

    // Street name is usually in the main text for addresses
    if (feature.place_type && feature.place_type.includes('address')) {
      address.road = feature.text;
    }

    return address;
  }

  // Categorize search results based on MapBox place types
  categorizeResult(feature) {
    const placeTypes = feature.place_type || [];
    const address = this.parseAddress(feature);

    // ZIP code (postcode)
    if (placeTypes.includes('postcode') || address.postcode) {
      return 'zipcode';
    }

    // State/Region
    if (placeTypes.includes('region')) {
      return 'state';
    }

    // County/District
    if (placeTypes.includes('district')) {
      return 'county';
    }

    // City/Place/Locality
    if (placeTypes.includes('place') || placeTypes.includes('locality')) {
      return 'city';
    }

    // Address
    if (placeTypes.includes('address')) {
      return 'address';
    }

    // Neighborhood
    if (placeTypes.includes('neighborhood')) {
      return 'neighborhood';
    }

    // Default
    return 'place';
  }

  // Calculate importance score for sorting
  calculateImportance(feature) {
    const placeTypes = feature.place_type || [];
    let score = feature.relevance || 0;

    // Boost certain place types
    if (placeTypes.includes('postcode')) score += 0.3;
    if (placeTypes.includes('place')) score += 0.2;
    if (placeTypes.includes('address')) score += 0.1;

    return score;
  }

  // Format display name for dropdown
  formatDisplayName(result) {
    const { address, type, name, displayName } = result;

    switch (type) {
      case 'zipcode':
        return `${address.postcode || name} - ${address.city || 'Unknown City'}, ${address.state || 'Unknown State'}`;

      case 'city':
        return `${address.city || name}, ${address.state || 'Unknown State'}`;

      case 'county':
        return `${address.county || name}, ${address.state || 'Unknown State'}`;

      case 'state':
        return `${address.state || name}`;

      case 'address':
        const parts = [];
        if (address.house_number) parts.push(address.house_number);
        if (address.road) parts.push(address.road);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        return parts.join(', ') || displayName;

      default:
        return displayName;
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
      case 'neighborhood': return '🏘️';
      default: return '📍';
    }
  }

  // Reverse geocode coordinates to get address
  async reverseGeocode(lat, lng) {
    if (this.apiKey === 'YOUR_MAPBOX_API_KEY_HERE') {
      console.warn('Mapbox API key not configured. Set VITE_MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN.');
      return null;
    }

    try {
      const params = new URLSearchParams({
        access_token: this.apiKey,
        types: 'address'
      });

      const url = `${this.baseUrl}/${lng},${lat}.json?${params}`;
      const result = await this.makeRequest(url);

      if (result.features && result.features.length > 0) {
        const feature = result.features[0];
        return {
          displayName: feature.place_name,
          address: this.parseAddress(feature),
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0]
        };
      }

      return null;
    } catch (error) {
      console.error('MapBox reverse geocoding failed:', error);
      return null;
    }
  }
}

export const mapboxGeocodingService = new MapBoxGeocodingService();

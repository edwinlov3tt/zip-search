import apiClient from './apiClient';

class GeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache for geocoding
    this.mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

    // Rate limiting for direct Nominatim calls (fallback)
    this.lastRequestTime = 0;
    this.minInterval = 1500; // 1.5 seconds between requests for safety margin
    this.pendingRequests = new Map(); // Cache pending requests to avoid duplicates
  }

  getCacheKey(query, provider = 'default') {
    return `${provider}-${query}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Main geocoding method - tries API first, then fallbacks
  async searchPlaces(query, limit = 8) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = this.getCacheKey(query, 'places');
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // Try API first
      const result = await apiClient.get('geocoding/places', {
        q: query,
        limit,
        countrycodes: 'us'
      });

      if (result && Array.isArray(result)) {
        const formatted = result.map(item => this.formatApiResult(item));
        this.setCache(cacheKey, formatted);
        return formatted;
      }
    } catch (error) {
      console.warn('API geocoding failed, trying fallback:', error);
    }

    // Fallback to Nominatim directly
    return await this.searchPlacesNominatim(query, limit);
  }

  // Direct Nominatim search (fallback)
  async searchPlacesNominatim(query, limit = 8) {
    const cacheKey = this.getCacheKey(query, 'nominatim');
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // Detect if query is numeric (likely ZIP code search)
      const isNumericQuery = /^\d+$/.test(query.trim());

      // Request more results to allow for better filtering
      const requestLimit = isNumericQuery ? 20 : 12;

      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: requestLimit.toString(),
        countrycodes: 'us',
        addressdetails: '1',
        extratags: '1',
        namedetails: '1'
      });

      const url = `https://nominatim.openstreetmap.org/search?${params}`;
      const results = await this.makeRateLimitedRequest(url);

      let formatted = results.map(result => {
        const type = this.categorizeResult(result);
        const postcode = result.address?.postcode || '';

        return {
          id: result.place_id,
          displayName: result.display_name,
          name: result.name,
          type: type,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.address || {},
          importance: result.importance || 0,
          postcode: postcode,
          raw: result
        };
      });

      // Apply smart filtering and sorting
      formatted = this.smartSortResults(formatted, query, isNumericQuery);

      // Limit to requested amount after filtering
      formatted = formatted.slice(0, limit);

      this.setCache(cacheKey, formatted);
      return formatted;

    } catch (error) {
      console.error('Nominatim search failed:', error);
      return [];
    }
  }

  // Smart sorting that prioritizes relevant results
  smartSortResults(results, query, isNumericQuery) {
    const queryLower = query.toLowerCase().trim();

    return results
      // Filter out counties when better options exist if query is not explicitly for a county
      .filter(result => {
        if (result.type === 'county' && !queryLower.includes('county')) {
          // Keep county only if it's highly relevant
          return result.importance > 0.6;
        }
        return true;
      })
      // Calculate relevance score
      .map(result => {
        let relevanceScore = result.importance;

        // For numeric queries, heavily prioritize ZIP codes
        if (isNumericQuery) {
          if (result.type === 'zipcode' || result.postcode) {
            const postcode = result.postcode || result.name;
            // Exact match or prefix match
            if (postcode.startsWith(query)) {
              relevanceScore += 10; // Huge boost for ZIP prefix match
            } else if (postcode.includes(query)) {
              relevanceScore += 5;
            } else {
              relevanceScore += 2; // Still boost ZIPs for numeric queries
            }
          } else {
            // Penalize non-ZIP results for numeric queries
            relevanceScore *= 0.3;
          }
        } else {
          // For text queries, prioritize by type
          const typeBoosts = {
            'city': 3,
            'zipcode': 2.5,
            'town': 2.5,
            'village': 2,
            'state': 1.5,
            'county': 0.5, // Heavily deprioritize counties
            'address': 1
          };
          relevanceScore *= (typeBoosts[result.type] || 1);

          // Boost exact name matches
          const nameLower = (result.name || '').toLowerCase();
          if (nameLower === queryLower) {
            relevanceScore += 5;
          } else if (nameLower.startsWith(queryLower)) {
            relevanceScore += 3;
          } else if (nameLower.includes(queryLower)) {
            relevanceScore += 1;
          }
        }

        return { ...result, relevanceScore };
      })
      // Sort by relevance score
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Rate limited request for Nominatim
  async makeRateLimitedRequest(url) {
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

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ZipSearchApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding request failed: ${response.status}`);
    }

    return response.json();
  }

  // Reverse geocode coordinates to get address
  async reverseGeocode(lat, lng) {
    const cacheKey = this.getCacheKey(`${lat},${lng}`, 'reverse');
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      // Try API first
      const result = await apiClient.get('geocoding/reverse', {
        lat,
        lng
      });

      if (result) {
        this.setCache(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn('API reverse geocoding failed, trying fallback:', error);
    }

    // Fallback to Nominatim
    return await this.reverseGeocodeNominatim(lat, lng);
  }

  // Direct Nominatim reverse geocoding (fallback)
  async reverseGeocodeNominatim(lat, lng) {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1'
      });

      const url = `https://nominatim.openstreetmap.org/reverse?${params}`;
      const result = await this.makeRateLimitedRequest(url);

      if (result && result.address) {
        const formatted = {
          displayName: result.display_name,
          address: result.address,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon)
        };
        return formatted;
      }

      return null;
    } catch (error) {
      console.error('Nominatim reverse geocoding failed:', error);
      return null;
    }
  }

  // Format API result to match our interface
  formatApiResult(result) {
    return {
      id: result.id || result.place_id,
      displayName: result.display_name || result.name,
      name: result.name,
      type: result.type || this.categorizeResult(result),
      lat: result.lat || result.latitude,
      lng: result.lng || result.lon || result.longitude,
      address: result.address || {},
      importance: result.importance || result.relevance || 0,
      raw: result
    };
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
    if (type === 'administrative' && (address.county || result.display_name?.includes('County'))) {
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

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    return {
      total: entries.length,
      expired: entries.filter(([_, value]) => now - value.timestamp >= this.cacheTimeout).length,
      valid: entries.filter(([_, value]) => now - value.timestamp < this.cacheTimeout).length
    };
  }

  // ============== BATCH GEOCODING METHODS ==============

  /**
   * Submit a batch of addresses for geocoding
   * @param {string[]} addresses - Array of address strings to geocode
   * @returns {Promise<{job_id: string, total_addresses: number, status_url: string, stream_url: string}>}
   */
  async submitBatchGeocodeJob(addresses) {
    // Use Vite proxy for development, Vercel proxy for production
    const BATCH_GEOCODE_URL = import.meta.env.DEV
      ? '/geocoder/geocode-api.php/api/batch'
      : '/api/geocode-proxy';

    try {
      const response = await fetch(BATCH_GEOCODE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: addresses
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', response.status, errorText);
        throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 API Response:', data);

      // Check if API returned results immediately (synchronous mode)
      if (data.results && Array.isArray(data.results)) {
        console.log('✅ API returned results synchronously');
        return {
          synchronous: true,
          results: data.results,
          total: data.total || data.geocoded || data.results.length
        };
      }

      // Otherwise, expect job_id for polling (asynchronous mode)
      if (!data.job_id) {
        console.error('❌ Missing job_id and no results in response. Full response:', JSON.stringify(data, null, 2));
        throw new Error('No job_id or results returned from geocoding API');
      }

      console.log('⏳ API returned job_id for polling');
      return {
        synchronous: false,
        job_id: data.job_id,
        total_addresses: data.total_addresses,
        status_url: data.status_url,
        stream_url: data.stream_url
      };
    } catch (error) {
      console.error('Error submitting batch geocode job:', error);
      throw error;
    }
  }

  /**
   * Check the status of a geocoding job
   * @param {string} jobId - The job ID to check
   * @returns {Promise<{completed: boolean, percentage: number, processed: number, total_addresses: number, error?: string}>}
   */
  async pollJobStatus(jobId) {
    // Note: Currently not used as API returns results synchronously
    // Keeping for potential future async support
    const BATCH_GEOCODE_BASE_URL = import.meta.env.DEV
      ? '/geocoder/geocode-api.php'
      : 'https://ignite.edwinlovett.com/geocoder/geocode-api.php';

    try {
      const response = await fetch(`${BATCH_GEOCODE_BASE_URL}/api/job/status?job_id=${jobId}`);

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error polling job status:', error);
      throw error;
    }
  }

  /**
   * Retrieve the results of a completed geocoding job
   * @param {string} jobId - The job ID to retrieve results for
   * @param {string} format - Format of results ('json' or 'csv')
   * @returns {Promise<{results: Array}>}
   */
  async getJobResults(jobId, format = 'json') {
    // Note: Currently not used as API returns results synchronously
    // Keeping for potential future async support
    const BATCH_GEOCODE_BASE_URL = import.meta.env.DEV
      ? '/geocoder/geocode-api.php'
      : 'https://ignite.edwinlovett.com/geocoder/geocode-api.php';

    try {
      const response = await fetch(`${BATCH_GEOCODE_BASE_URL}/api/job/results?job_id=${jobId}&format=${format}`);

      if (!response.ok) {
        throw new Error(`Failed to retrieve results: ${response.status} ${response.statusText}`);
      }

      if (format === 'csv') {
        const csvData = await response.text();
        return csvData;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error retrieving job results:', error);
      throw error;
    }
  }

  /**
   * Poll for job completion and return results when ready
   * @param {string} jobId - The job ID to poll
   * @param {Function} onProgress - Callback for progress updates (optional)
   * @param {number} pollInterval - Polling interval in milliseconds (default: 2000)
   * @returns {Promise<{results: Array}>}
   */
  async pollUntilComplete(jobId, onProgress = null, pollInterval = 2000) {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.pollJobStatus(jobId);

          // Call progress callback if provided
          if (onProgress && typeof onProgress === 'function') {
            onProgress(status);
          }

          if (status.completed) {
            // Job completed, get results
            const results = await this.getJobResults(jobId);
            resolve(results);
          } else if (status.error) {
            // Job failed
            reject(new Error(status.error));
          } else {
            // Continue polling
            setTimeout(checkStatus, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  }

  /**
   * Parse address components and combine into a full address string
   * @param {Object} components - Address components
   * @returns {string} Combined address string
   */
  combineAddressComponents(components) {
    const { businessName, street, city, state, zip, county } = components;

    const parts = [];

    // Add business name if provided (some geocoders use this)
    if (businessName && businessName.trim()) {
      parts.push(businessName.trim());
    }

    // Add street address
    if (street && street.trim()) {
      parts.push(street.trim());
    }

    // Add city
    if (city && city.trim()) {
      parts.push(city.trim());
    }

    // Add state
    if (state && state.trim()) {
      parts.push(state.trim());
    }

    // Add ZIP
    if (zip && zip.trim()) {
      parts.push(zip.trim());
    }

    return parts.join(', ');
  }

  /**
   * Prepare addresses from CSV data for geocoding
   * @param {Array} csvData - Array of CSV row objects
   * @param {Object} columnMapping - Mapping of CSV columns to address fields
   * @returns {Array<{originalData: Object, addressString: string, businessName: string}>}
   */
  prepareAddressesForGeocoding(csvData, columnMapping) {
    const preparedAddresses = [];

    csvData.forEach((row, index) => {
      const addressComponents = {};
      let hasAddress = false;

      // Extract mapped fields from the row
      Object.entries(columnMapping).forEach(([csvColumn, fieldType]) => {
        if (fieldType !== 'ignore' && row[csvColumn]) {
          addressComponents[fieldType] = row[csvColumn];
          if (fieldType === 'fullAddress' || fieldType === 'street') {
            hasAddress = true;
          }
        }
      });

      // Skip rows without address data
      if (!hasAddress) {
        return;
      }

      let addressString;

      // Use full address if provided, otherwise combine components
      if (addressComponents.fullAddress) {
        addressString = addressComponents.fullAddress;
      } else {
        addressString = this.combineAddressComponents(addressComponents);
      }

      preparedAddresses.push({
        id: `addr-${index}`,
        originalData: row,
        addressString: addressString,
        businessName: addressComponents.businessName || '',
        components: addressComponents
      });
    });

    return preparedAddresses;
  }
}

// Create singleton instance
export const geocodingService = new GeocodingService();
export default geocodingService;
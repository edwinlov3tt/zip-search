/**
 * ZIP Boundaries API Service
 * Connects to the droplet-hosted ZIP boundaries API
 */

const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'http://45.55.36.108:8002'  // Production API
  : 'http://45.55.36.108:8002'; // Using production API for now since it's ready

class ZipBoundariesService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get boundary for a single ZIP code
   * @param {string} zipCode - The ZIP code to get boundary for
   * @param {boolean} simplified - Whether to use simplified geometry
   * @returns {Promise<Object>} GeoJSON Feature
   */
  async getZipBoundary(zipCode, simplified = true) {
    const cacheKey = `zip:${zipCode}:${simplified}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      console.log(`Cache hit for ZIP ${zipCode}`);
      return cached.data;
    }

    try {
      const url = `${API_BASE_URL}/zip/${zipCode}${simplified ? '?simplified=true' : ''}`;
      console.log(`Fetching ZIP boundary from: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`ZIP code ${zipCode} not found`);
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTimeout
      });

      console.log(`Successfully fetched boundary for ZIP ${zipCode}`);
      return data;
    } catch (error) {
      console.error(`Error fetching ZIP boundary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get boundaries for current viewport
   * @param {Object} bounds - Map bounds {north, south, east, west}
   * @param {number} limit - Maximum number of boundaries to return
   * @param {boolean} simplified - Whether to use simplified geometry
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async getViewportBoundaries(bounds, limit = 50, simplified = true) {
    const { north, south, east, west } = bounds;

    // Don't cache viewport queries as they change frequently
    try {
      const params = new URLSearchParams({
        north: north.toString(),
        south: south.toString(),
        east: east.toString(),
        west: west.toString(),
        limit: limit.toString(),
        simplified: simplified.toString()
      });

      const url = `${API_BASE_URL}/zip/boundaries/viewport?${params}`;
      console.log(`Fetching viewport boundaries from: ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      console.log(`Fetched ${data.features.length} ZIP boundaries for viewport`);
      return data;
    } catch (error) {
      console.error(`Error fetching viewport boundaries: ${error.message}`);
      // Return empty collection on error
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
  }

  /**
   * Get ZIP database statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    const cacheKey = 'stats';

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/zip-stats`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache for longer since stats don't change often
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + 60 * 60 * 1000 // 1 hour
      });

      return data;
    } catch (error) {
      console.error(`Error fetching stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if the API is healthy
   * @returns {Promise<boolean>} True if API is healthy
   */
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (!response.ok) return false;

      const data = await response.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    console.log('ZIP boundaries cache cleared');
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`Cleaned ${removed} expired cache entries`);
    }
  }
}

// Export singleton instance
export default new ZipBoundariesService();
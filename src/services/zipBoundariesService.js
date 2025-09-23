/**
 * ZIP Boundaries API Service
 * Connects to PostGIS database via geo.edwinlovett.com API
 */

import boundaryCache from './boundaryCache';
import postgisService from './postgisService';

// HTTPS API base for boundaries (env-driven)
const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_GEO_API_BASE;
  if (!raw) return 'https://geo.edwinlovett.com';
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
})();

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
      return cached.data;
    }

    try {
      const url = `${API_BASE_URL}/zip/${zipCode}${simplified ? '?simplified=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          // Silently return null for missing boundaries
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTimeout
      });

      return data;
    } catch (error) {
      // Don't log individual failures
      return null;
    }
  }

  /**
   * Get boundaries for multiple specific ZIP codes
   * @param {Array<string>} zipCodes - Array of ZIP codes
   * @param {boolean} simplified - Whether to use simplified geometry
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async getMultipleZipBoundaries(zipCodes, simplified = true) {
    if (!zipCodes || zipCodes.length === 0) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    const features = [];
    const errors = [];

    // Fetch boundaries in parallel (max 10 at a time to avoid overwhelming the API)
    const batchSize = 10;
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);

      const batchPromises = batch.map(async (zipCode) => {
        const boundary = await this.getZipBoundary(zipCode, simplified);
        if (boundary) {
          return boundary;
        } else {
          errors.push(zipCode);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Add successful results to features array
      batchResults.forEach(result => {
        if (result) {
          features.push(result);
        }
      });
    }

    // Only log summary if there were failures
    if (errors.length > 0) {
      console.log(`Loaded ${features.length}/${zipCodes.length} boundaries (${errors.length} unavailable)`);
    }

    return {
      type: 'FeatureCollection',
      features: features,
      properties: {
        requested: zipCodes.length,
        loaded: features.length,
        failed: errors
      }
    };
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

    // Check localStorage cache first
    const cached = boundaryCache.getViewportBoundaries(bounds);
    if (cached) {
      return cached;
    }

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

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Store in localStorage cache
      if (data.features && data.features.length > 0) {
        boundaryCache.storeViewportBoundaries(bounds, data);
      }

      return data;
    } catch (error) {
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
  }

  /**
   * Get all cached boundaries from localStorage
   * @returns {Object|null} GeoJSON FeatureCollection or null
   */
  getAllCachedBoundaries() {
    return boundaryCache.getAllCachedBoundaries();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return boundaryCache.getStats();
  }

  /**
   * Clear localStorage cache
   */
  clearPersistentCache() {
    boundaryCache.clearCache();
  }

  /**
   * Export cache for backup
   * @returns {string} JSON string of cache
   */
  exportCache() {
    return boundaryCache.exportCache();
  }

  /**
   * Import cache from backup
   * @param {string} data - JSON string of cache
   * @returns {boolean} Success status
   */
  importCache(data) {
    return boundaryCache.importCache(data);
  }
}

// Export singleton instance
export default new ZipBoundariesService();

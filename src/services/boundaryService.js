import apiClient from './apiClient';

class BoundaryService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  getCacheKey(type, identifier) {
    return `${type}-${identifier}`;
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

  async getZipBoundary(zipCode) {
    const cacheKey = this.getCacheKey('zip', zipCode);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const boundary = await apiClient.get(`boundaries/zip/${zipCode}`);

      if (boundary && boundary.geometry) {
        this.setCache(cacheKey, boundary);
        return boundary;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch ZIP boundary for ${zipCode}:`, error);
      return null;
    }
  }

  async getCityBoundary(city, state) {
    const identifier = `${city}-${state}`;
    const cacheKey = this.getCacheKey('city', identifier);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const boundary = await apiClient.get('boundaries/city', { city, state });

      if (boundary && boundary.geometry) {
        this.setCache(cacheKey, boundary);
        return boundary;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch city boundary for ${city}, ${state}:`, error);
      return null;
    }
  }

  async getCountyBoundary(county, state) {
    const identifier = `${county}-${state}`;
    const cacheKey = this.getCacheKey('county', identifier);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const boundary = await apiClient.get('boundaries/county', { county, state });

      if (boundary && boundary.geometry) {
        this.setCache(cacheKey, boundary);
        return boundary;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch county boundary for ${county}, ${state}:`, error);
      return null;
    }
  }

  async getStateBoundary(state) {
    const cacheKey = this.getCacheKey('state', state);
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const boundary = await apiClient.get(`boundaries/state/${state}`);

      if (boundary && boundary.geometry) {
        this.setCache(cacheKey, boundary);
        return boundary;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch state boundary for ${state}:`, error);
      return null;
    }
  }

  async getBatchBoundaries(items, type) {
    // Batch request for multiple boundaries
    try {
      const boundaries = await apiClient.post('boundaries/batch', {
        items,
        type
      });

      if (Array.isArray(boundaries)) {
        // Cache individual boundaries
        boundaries.forEach(boundary => {
          if (boundary && boundary.geometry) {
            const key = this.getCacheKey(type, boundary.identifier);
            this.setCache(key, boundary);
          }
        });

        return boundaries;
      }

      return [];
    } catch (error) {
      console.error(`Failed to fetch batch boundaries:`, error);
      return [];
    }
  }

  async searchBoundariesInRadius(center, radius, types = ['zip', 'city', 'county']) {
    try {
      const boundaries = await apiClient.get('boundaries/search', {
        lat: center.lat,
        lng: center.lng,
        radius,
        types: types.join(',')
      });

      return boundaries || [];
    } catch (error) {
      console.error('Failed to search boundaries in radius:', error);
      return [];
    }
  }

  async searchBoundariesInPolygon(polygon, types = ['zip', 'city', 'county']) {
    try {
      const boundaries = await apiClient.post('boundaries/search/polygon', {
        polygon,
        types
      });

      return boundaries || [];
    } catch (error) {
      console.error('Failed to search boundaries in polygon:', error);
      return [];
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
}

// Create singleton instance
const boundaryService = new BoundaryService();

export default boundaryService;
export { BoundaryService };
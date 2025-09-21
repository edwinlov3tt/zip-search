/**
 * Persistent boundary caching service using localStorage
 * Stores ZIP boundaries locally for faster loading
 */

const CACHE_KEY = 'zip_boundaries_cache';
const CACHE_VERSION = 'v1';
const MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB limit
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

class BoundaryCache {
  constructor() {
    this.storageAvailable = this.checkStorageAvailable();
    this.cache = this.loadCache();
  }

  /**
   * Check if localStorage is available
   */
  checkStorageAvailable() {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('localStorage not available:', e);
      return false;
    }
  }

  /**
   * Load cache from localStorage
   */
  loadCache() {
    if (!this.storageAvailable) return null;

    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return this.initializeCache();

      const cache = JSON.parse(stored);

      // Check version
      if (cache.version !== CACHE_VERSION) {
        console.log('Cache version mismatch, clearing cache');
        return this.initializeCache();
      }

      // Check expiry
      if (cache.expires < Date.now()) {
        console.log('Cache expired, clearing');
        return this.initializeCache();
      }

      console.log(`Loaded ${Object.keys(cache.boundaries).length} cached ZIP boundaries`);
      return cache;
    } catch (e) {
      console.error('Failed to load cache:', e);
      return this.initializeCache();
    }
  }

  /**
   * Initialize empty cache
   */
  initializeCache() {
    const cache = {
      version: CACHE_VERSION,
      boundaries: {},
      expires: Date.now() + CACHE_EXPIRY,
      size: 0
    };
    this.saveCache(cache);
    return cache;
  }

  /**
   * Save cache to localStorage
   */
  saveCache(cache) {
    if (!this.storageAvailable) return;

    try {
      const data = JSON.stringify(cache);
      const size = new Blob([data]).size;

      // Check size limit
      if (size > MAX_CACHE_SIZE) {
        console.warn('Cache size exceeds limit, clearing old entries');
        this.pruneCache(cache);
      }

      localStorage.setItem(CACHE_KEY, data);
      cache.size = size;
    } catch (e) {
      console.error('Failed to save cache:', e);

      // If quota exceeded, clear and retry
      if (e.name === 'QuotaExceededError') {
        this.clearCache();
      }
    }
  }

  /**
   * Prune oldest entries from cache
   */
  pruneCache(cache) {
    const entries = Object.entries(cache.boundaries);
    // Sort by last accessed time
    entries.sort((a, b) => a[1].accessed - b[1].accessed);

    // Remove oldest 25%
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      delete cache.boundaries[entries[i][0]];
    }
  }

  /**
   * Get boundaries for a viewport
   */
  getViewportBoundaries(viewport) {
    if (!this.cache) return null;

    const key = this.getViewportKey(viewport);
    const cached = this.cache.boundaries[key];

    if (cached) {
      cached.accessed = Date.now();
      console.log(`Cache hit for viewport: ${key}`);
      return cached.data;
    }

    return null;
  }

  /**
   * Store boundaries for a viewport
   */
  storeViewportBoundaries(viewport, data) {
    if (!this.cache || !data) return;

    const key = this.getViewportKey(viewport);

    // Store with metadata
    this.cache.boundaries[key] = {
      data: data,
      stored: Date.now(),
      accessed: Date.now(),
      viewport: viewport
    };

    this.saveCache(this.cache);
    console.log(`Cached boundaries for viewport: ${key}`);
  }

  /**
   * Get all cached boundaries as a single FeatureCollection
   */
  getAllCachedBoundaries() {
    if (!this.cache) return null;

    const allFeatures = [];
    const seenZips = new Set();

    // Collect all unique features
    Object.values(this.cache.boundaries).forEach(entry => {
      if (entry.data && entry.data.features) {
        entry.data.features.forEach(feature => {
          const zip = feature.properties?.zipcode;
          if (zip && !seenZips.has(zip)) {
            seenZips.add(zip);
            allFeatures.push(feature);
          }
        });
      }
    });

    if (allFeatures.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features: allFeatures
    };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (!this.cache) return { available: false };

    const viewports = Object.keys(this.cache.boundaries).length;
    const allZips = new Set();

    Object.values(this.cache.boundaries).forEach(entry => {
      if (entry.data && entry.data.features) {
        entry.data.features.forEach(f => {
          if (f.properties?.zipcode) {
            allZips.add(f.properties.zipcode);
          }
        });
      }
    });

    return {
      available: true,
      viewports: viewports,
      totalZips: allZips.size,
      sizeKB: Math.round((this.cache.size || 0) / 1024),
      expires: new Date(this.cache.expires)
    };
  }

  /**
   * Clear the entire cache
   */
  clearCache() {
    if (!this.storageAvailable) return;

    localStorage.removeItem(CACHE_KEY);
    this.cache = this.initializeCache();
    console.log('Cache cleared');
  }

  /**
   * Generate viewport key for caching
   */
  getViewportKey(viewport) {
    // Round to 3 decimal places to group similar viewports
    const round = (n) => Math.round(n * 1000) / 1000;
    return `${round(viewport.north)},${round(viewport.south)},${round(viewport.east)},${round(viewport.west)}`;
  }

  /**
   * Export cache for backup
   */
  exportCache() {
    if (!this.cache) return null;
    return JSON.stringify(this.cache, null, 2);
  }

  /**
   * Import cache from backup
   */
  importCache(data) {
    if (!this.storageAvailable) return false;

    try {
      const cache = JSON.parse(data);
      if (cache.version === CACHE_VERSION) {
        this.cache = cache;
        this.saveCache(cache);
        return true;
      }
    } catch (e) {
      console.error('Failed to import cache:', e);
    }
    return false;
  }
}

// Export singleton instance
export default new BoundaryCache();
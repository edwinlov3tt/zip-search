/**
 * ZIP Boundaries API Service
 * Fetches ZIP Code Tabulation Area (ZCTA) boundaries from Census TIGER API
 */

import boundaryCache from './boundaryCache';

// Census TIGER API endpoint for ZCTA boundaries
const TIGER_API_BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer';
const ZCTA_LAYER = 2; // 2020 Census ZIP Code Tabulation Areas

class ZipBoundariesService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Normalize TIGER API feature to match expected format
   * Maps ZCTA5 -> zipcode, etc.
   */
  normalizeFeature(feature) {
    if (!feature) return null;

    return {
      ...feature,
      properties: {
        ...feature.properties,
        // Map TIGER fields to expected fields
        zipcode: feature.properties.ZCTA5 || feature.properties.zipcode,
        name: feature.properties.NAME || feature.properties.name,
        state_code: feature.properties.STATE || feature.properties.state_code,
        land_area: feature.properties.AREALAND || feature.properties.land_area,
        water_area: feature.properties.AREAWATER || feature.properties.water_area
      }
    };
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
      // Build TIGER API query URL
      const params = new URLSearchParams({
        where: `ZCTA5='${zipCode}'`,
        outFields: 'ZCTA5,GEOID,NAME,AREALAND,AREAWATER,CENTLAT,CENTLON',
        returnGeometry: 'true',
        f: 'geojson',
        geometryPrecision: simplified ? '4' : '6'
      });

      const url = `${TIGER_API_BASE}/${ZCTA_LAYER}/query?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`TIGER API error: ${response.status}`);
      }

      const data = await response.json();

      // TIGER returns a FeatureCollection, extract the first feature
      if (data && data.features && data.features.length > 0) {
        const feature = this.normalizeFeature(data.features[0]);

        // Cache the result
        this.cache.set(cacheKey, {
          data: feature,
          expires: Date.now() + this.cacheTimeout
        });

        return feature;
      }

      // No boundary found
      return null;
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

    // TIGER API supports batch queries with IN clause (max ~50 at a time)
    const batchSize = 50;

    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);

      try {
        // Build SQL IN clause for batch query
        const zipList = batch.map(zip => `'${zip}'`).join(',');

        const params = new URLSearchParams({
          where: `ZCTA5 IN (${zipList})`,
          outFields: 'ZCTA5,GEOID,NAME,AREALAND,AREAWATER,CENTLAT,CENTLON',
          returnGeometry: 'true',
          f: 'geojson',
          geometryPrecision: simplified ? '4' : '6'
        });

        const url = `${TIGER_API_BASE}/${ZCTA_LAYER}/query?${params}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`TIGER API error: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.features) {
          // Normalize and cache each feature individually
          data.features.forEach(feature => {
            const normalizedFeature = this.normalizeFeature(feature);
            const zipCode = normalizedFeature.properties?.zipcode;

            if (zipCode) {
              const cacheKey = `zip:${zipCode}:${simplified}`;
              this.cache.set(cacheKey, {
                data: normalizedFeature,
                expires: Date.now() + this.cacheTimeout
              });
            }
            features.push(normalizedFeature);
          });

          // Track missing ZIPs
          const returnedZips = new Set(data.features.map(f => f.properties?.ZCTA5));
          batch.forEach(zip => {
            if (!returnedZips.has(zip)) {
              errors.push(zip);
            }
          });
        } else {
          // All ZIPs in this batch failed
          errors.push(...batch);
        }
      } catch (error) {
        console.error(`Batch query failed for ${batch.length} ZIPs:`, error);
        errors.push(...batch);
      }
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
   * NOTE: TIGER API doesn't support viewport-based spatial queries directly.
   * This method is kept for backwards compatibility but returns cached data only.
   * The app primarily uses getMultipleZipBoundaries() based on search results.
   *
   * @param {Object} bounds - Map bounds {north, south, east, west}
   * @param {number} limit - Maximum number of boundaries to return
   * @param {boolean} simplified - Whether to use simplified geometry
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async getViewportBoundaries(bounds, limit = 50, simplified = true) {
    // Check localStorage cache first
    const cached = boundaryCache.getViewportBoundaries(bounds);
    if (cached) {
      return cached;
    }

    // TIGER API doesn't support direct spatial bbox queries for ZCTA
    // Return empty collection - app should use result-based loading instead
    console.log('Viewport-based boundary loading not supported with TIGER API. Use result-based loading.');

    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  /**
   * Get ZIP database statistics
   * NOTE: TIGER API doesn't provide statistics endpoint
   * @returns {Promise<Object>} Statistics object (empty)
   */
  async getStats() {
    return {
      message: 'Statistics not available from TIGER API',
      source: 'Census TIGER/Line 2020'
    };
  }

  /**
   * Check if the API is healthy
   * Tests TIGER API with a simple query
   * @returns {Promise<boolean>} True if API is healthy
   */
  async checkHealth() {
    try {
      // Test with a known ZIP code
      const params = new URLSearchParams({
        where: "ZCTA5='10001'",
        returnCountOnly: 'true',
        f: 'json'
      });

      const url = `${TIGER_API_BASE}/${ZCTA_LAYER}/query?${params}`;
      const response = await fetch(url);

      if (!response.ok) return false;

      const data = await response.json();
      return data.count !== undefined;
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

  /**
   * Find neighboring ZIPs that touch the boundaries of given ZIPs
   * Uses Census TIGER API spatial query with esriSpatialRelTouches
   * @param {Array<Object>} zipBoundaries - GeoJSON features of ZIPs to find neighbors for
   * @param {Array<string>} existingZips - ZIP codes already in results (to exclude)
   * @returns {Promise<Object>} GeoJSON FeatureCollection of neighboring ZIPs
   */
  async findNeighboringZips(zipBoundaries, existingZips = []) {
    if (!zipBoundaries || zipBoundaries.length === 0) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    const allNeighbors = new Map(); // Use Map to dedupe by zipcode
    const existingSet = new Set(existingZips.map(z => String(z)));

    // Process each ZIP boundary to find its neighbors
    // Limit to first 10 ZIPs to avoid excessive API calls
    const zipsToProcess = zipBoundaries.slice(0, 10);

    for (const feature of zipsToProcess) {
      if (!feature.geometry) continue;

      try {
        // Convert GeoJSON geometry to Esri JSON format for the API
        const esriGeometry = this.geoJsonToEsri(feature.geometry);
        if (!esriGeometry) continue;

        const params = new URLSearchParams({
          geometry: JSON.stringify(esriGeometry),
          geometryType: 'esriGeometryPolygon',
          spatialRel: 'esriSpatialRelTouches', // Find ZIPs that touch this boundary
          outFields: 'ZCTA5,GEOID,NAME,AREALAND,AREAWATER,CENTLAT,CENTLON',
          returnGeometry: 'true',
          f: 'geojson',
          geometryPrecision: '4'
        });

        const url = `${TIGER_API_BASE}/${ZCTA_LAYER}/query?${params}`;
        const response = await fetch(url);

        if (!response.ok) {
          console.warn(`Neighbor query failed for ZIP: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data && data.features) {
          data.features.forEach(neighborFeature => {
            const normalizedFeature = this.normalizeFeature(neighborFeature);
            const zipCode = normalizedFeature.properties?.zipcode;

            // Only add if not already in results and not already found
            if (zipCode && !existingSet.has(zipCode) && !allNeighbors.has(zipCode)) {
              allNeighbors.set(zipCode, {
                ...normalizedFeature,
                properties: {
                  ...normalizedFeature.properties,
                  isNeighbor: true // Mark as neighboring ZIP
                }
              });
            }
          });
        }
      } catch (error) {
        console.warn('Error finding neighbors:', error);
      }
    }

    return {
      type: 'FeatureCollection',
      features: Array.from(allNeighbors.values()),
      properties: {
        sourceZips: zipsToProcess.length,
        neighborsFound: allNeighbors.size
      }
    };
  }

  /**
   * Convert GeoJSON geometry to Esri JSON format
   * @param {Object} geoJsonGeometry - GeoJSON geometry object
   * @returns {Object|null} Esri JSON geometry or null
   */
  geoJsonToEsri(geoJsonGeometry) {
    if (!geoJsonGeometry || !geoJsonGeometry.type) return null;

    try {
      if (geoJsonGeometry.type === 'Polygon') {
        return {
          rings: geoJsonGeometry.coordinates,
          spatialReference: { wkid: 4326 }
        };
      } else if (geoJsonGeometry.type === 'MultiPolygon') {
        // Flatten MultiPolygon to single polygon (use first ring)
        const rings = geoJsonGeometry.coordinates.flat(1);
        return {
          rings: rings,
          spatialReference: { wkid: 4326 }
        };
      }
    } catch (error) {
      console.warn('Failed to convert GeoJSON to Esri:', error);
    }

    return null;
  }
}

// Export singleton instance
export default new ZipBoundariesService();

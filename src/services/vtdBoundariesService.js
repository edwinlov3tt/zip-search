/**
 * VTD (Voting Tabulation District) Boundaries Service
 * Fetches voting district polygons from Supabase PostGIS database
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State code to FIPS code mapping (kept for backward compatibility)
const STATE_TO_FIPS = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20',
  'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36',
  'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
  'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56', 'DC': '11', 'PR': '72'
};

class VtdBoundariesService {
  constructor() {
    this.cache = new Map();
    this.viewportCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Convert Supabase PostGIS record to GeoJSON feature
   */
  convertToFeature(record) {
    if (!record) return null;

    // Parse GeoJSON geometry from database
    const geometry = typeof record.geometry_geojson === 'string'
      ? JSON.parse(record.geometry_geojson)
      : record.geometry_geojson;

    return {
      type: 'Feature',
      geometry,
      properties: {
        vtd_code: record.vtd_code,
        name: record.name,
        state_fips: record.state_fips,
        county_fips: record.county_fips,
        full_county_fips: record.full_county_fips,
        geoid: record.geoid,
        land_area: record.land_area,
        water_area: record.water_area,
        // Backward compatibility fields
        state_code: record.state_fips,
        county_code: record.county_fips
      }
    };
  }

  /**
   * Get cache entry if not expired
   */
  getCache(map, key) {
    const cached = map.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    if (cached) {
      map.delete(key);
    }
    return null;
  }

  /**
   * Set cache entry with expiration
   */
  setCache(map, key, data) {
    map.set(key, {
      data,
      expires: Date.now() + this.cacheTimeout
    });
  }

  /**
   * Get VTD boundaries for specific counties from Supabase
   * @param {Array<string>} countyFipsList - Array of 5-digit FIPS codes (e.g., ['48303', '48201'])
   * @param {boolean} simplified - Whether to use simplified geometry (not used with Supabase, kept for compatibility)
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async getVtdBoundariesForCounties(countyFipsList, simplified = true) {
    if (!countyFipsList || countyFipsList.length === 0) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    console.log(`[VTD Service] Loading VTDs for ${countyFipsList.length} counties from Supabase:`, countyFipsList);

    // Check cache for all counties
    const allFeatures = [];
    const uncachedCounties = [];

    for (const fips of countyFipsList) {
      const cacheKey = `county:${fips}`;
      const cached = this.getCache(this.cache, cacheKey);
      if (cached) {
        allFeatures.push(...cached.features);
      } else {
        uncachedCounties.push(fips);
      }
    }

    if (uncachedCounties.length === 0) {
      console.log(`[VTD Service] All counties cached (${allFeatures.length} VTDs)`);
      return {
        type: 'FeatureCollection',
        features: allFeatures
      };
    }

    console.log(`[VTD Service] Fetching ${uncachedCounties.length} uncached counties from Supabase`);

    try {
      // Call Supabase RPC function to get VTDs by county FIPS codes
      const { data, error } = await supabase.rpc('get_vtds_by_counties', {
        county_fips_list: uncachedCounties
      });

      if (error) {
        console.error('[VTD Service] Supabase RPC error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('[VTD Service] No VTDs returned from Supabase for counties:', uncachedCounties);
        return {
          type: 'FeatureCollection',
          features: allFeatures
        };
      }

      console.log(`[VTD Service] Received ${data.length} VTDs from Supabase`);

      // Convert Supabase records to GeoJSON features
      const features = data.map(record => this.convertToFeature(record)).filter(Boolean);

      // Cache by county
      const featuresByCounty = {};
      features.forEach(feature => {
        const fips = feature.properties.full_county_fips;
        if (!featuresByCounty[fips]) {
          featuresByCounty[fips] = [];
        }
        featuresByCounty[fips].push(feature);
      });

      // Cache each county separately
      Object.entries(featuresByCounty).forEach(([fips, countyFeatures]) => {
        const cacheKey = `county:${fips}`;
        this.setCache(this.cache, cacheKey, {
          type: 'FeatureCollection',
          features: countyFeatures
        });
      });

      allFeatures.push(...features);

      console.log(`[VTD Service] Total: ${allFeatures.length} VTD features loaded`);

      return {
        type: 'FeatureCollection',
        features: allFeatures,
        properties: {
          requested: countyFipsList.length,
          loaded: countyFipsList.length,
          source: 'supabase'
        }
      };
    } catch (error) {
      console.error('[VTD Service] Error fetching VTDs from Supabase:', error);

      return {
        type: 'FeatureCollection',
        features: allFeatures,
        properties: {
          requested: countyFipsList.length,
          loaded: 0,
          error: error.message
        }
      };
    }
  }

  /**
   * Get VTD boundaries for specific states (DEPRECATED - use getVtdBoundariesForCounties instead)
   * @param {Array<string>} stateCodes - Array of 2-letter state codes (e.g., ['NY', 'CA'])
   * @param {boolean} simplified - Whether to use simplified geometry
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async getVtdBoundariesForStates(stateCodes, simplified = true) {
    if (!stateCodes || stateCodes.length === 0) {
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    const allFeatures = [];
    const errors = [];

    // Process each state individually (VTDs can be numerous)
    for (const stateCode of stateCodes) {
      const cacheKey = `state:${stateCode}:${simplified}`;
      const cached = this.getCache(this.cache, cacheKey);

      if (cached) {
        allFeatures.push(...cached.features);
        continue;
      }

      try {
        const fipsCode = STATE_TO_FIPS[stateCode.toUpperCase()];

        if (!fipsCode) {
          console.warn(`Unknown state code: ${stateCode}`);
          errors.push(stateCode);
          continue;
        }

        const params = new URLSearchParams({
          where: `STATE='${fipsCode}'`,
          outFields: 'VTDST,NAME,STATE,COUNTY,GEOID,AREALAND,AREAWATER,CENTLAT,CENTLON',
          returnGeometry: 'true',
          f: 'geojson',
          geometryPrecision: simplified ? '3' : '5'
        });

        const url = `${TIGER_API_BASE}/${VTD_LAYER}/query?${params}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`TIGER API error: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.features) {
          // Normalize features
          const normalizedFeatures = data.features.map(f => this.normalizeFeature(f));

          // Cache the result
          this.setCache(this.cache, cacheKey, {
            type: 'FeatureCollection',
            features: normalizedFeatures
          });

          allFeatures.push(...normalizedFeatures);
        }
      } catch (error) {
        console.error(`Failed to load VTDs for state ${stateCode}:`, error);
        errors.push(stateCode);
      }
    }

    if (errors.length > 0) {
      console.log(`Loaded VTDs for ${stateCodes.length - errors.length}/${stateCodes.length} states`);
    }

    return {
      type: 'FeatureCollection',
      features: allFeatures,
      properties: {
        requested: stateCodes.length,
        loaded: stateCodes.length - errors.length,
        failed: errors
      }
    };
  }

  /**
   * Get VTD boundaries within a viewport/bounds from Supabase
   * @param {Object} bounds - Map bounds {north, south, east, west}
   * @param {number} limit - Maximum number of boundaries to return
   * @param {boolean} simplified - Whether to use simplified geometry (not used with Supabase, kept for compatibility)
   * @returns {Promise<Object>} GeoJSON FeatureCollection
   */
  async getViewportBoundaries(bounds, limit = 100, simplified = true) {
    const { north, south, east, west } = bounds || {};

    // Simple rounded cache key to avoid cache flapping
    const round = (n) => Math.round(n * 1000) / 1000;
    const cacheKey = `viewport:${round(north)}:${round(south)}:${round(east)}:${round(west)}:${limit}`;

    const cached = this.getCache(this.viewportCache, cacheKey);
    if (cached) return cached;

    try {
      // Call Supabase RPC function for bounding box query
      const { data, error } = await supabase.rpc('get_vtds_by_bbox', {
        min_lng: west,
        min_lat: south,
        max_lng: east,
        max_lat: north,
        result_limit: limit
      });

      if (error) {
        console.error('[VTD Service] Supabase bbox query error:', error);
        throw error;
      }

      // Convert Supabase records to GeoJSON features
      const features = (data || []).map(record => this.convertToFeature(record)).filter(Boolean);

      const result = {
        type: 'FeatureCollection',
        features
      };

      this.setCache(this.viewportCache, cacheKey, result);
      return result;
    } catch (error) {
      console.error('[VTD Service] Viewport query failed:', error);
      const empty = { type: 'FeatureCollection', features: [] };
      this.setCache(this.viewportCache, cacheKey, empty);
      return empty;
    }
  }

  /**
   * Get VTD boundary by VTD code and state
   * @param {string} vtdCode - VTD code (alphanumeric, 1-6 characters)
   * @param {string} stateCode - 2-letter state code (e.g., 'NY')
   * @param {boolean} simplified - Whether to use simplified geometry
   * @returns {Promise<Object>} GeoJSON Feature or null
   */
  async getVtdBoundary(vtdCode, stateCode, simplified = true) {
    if (!vtdCode || !stateCode) return null;

    const cacheKey = `vtd:${vtdCode}:${stateCode}:${simplified}`;
    const cached = this.getCache(this.cache, cacheKey);
    if (cached) return cached;

    try {
      const fipsCode = STATE_TO_FIPS[stateCode.toUpperCase()];

      if (!fipsCode) {
        console.warn(`Unknown state code: ${stateCode}`);
        return null;
      }

      const params = new URLSearchParams({
        where: `VTDST='${vtdCode}' AND STATE='${fipsCode}'`,
        outFields: 'VTDST,NAME,STATE,COUNTY,GEOID,AREALAND,AREAWATER,CENTLAT,CENTLON',
        returnGeometry: 'true',
        f: 'geojson',
        geometryPrecision: simplified ? '3' : '5'
      });

      const url = `${TIGER_API_BASE}/${VTD_LAYER}/query?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // TIGER returns a FeatureCollection, extract the first feature
      if (data && data.features && data.features.length > 0) {
        const feature = this.normalizeFeature(data.features[0]);
        this.setCache(this.cache, cacheKey, feature);
        return feature;
      }

      return null;
    } catch (error) {
      console.error(`VTD boundary query failed for ${vtdCode} in ${stateCode}:`, error);
      return null;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.viewportCache.clear();
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    let removed = 0;

    for (const map of [this.cache, this.viewportCache]) {
      for (const [key, value] of map.entries()) {
        if (value.expires < now) {
          map.delete(key);
          removed++;
        }
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      viewportCacheSize: this.viewportCache.size,
      totalSize: this.cache.size + this.viewportCache.size
    };
  }

  /**
   * Check if Supabase connection is healthy
   * Tests Supabase with a simple query
   * @returns {Promise<boolean>} True if Supabase is healthy
   */
  async checkHealth() {
    try {
      // Test with a simple count query
      const { count, error } = await supabase
        .from('vtds')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('[VTD Service] Health check error:', error);
        return false;
      }

      return count !== null && count > 0;
    } catch (error) {
      console.error('[VTD Service] Health check exception:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new VtdBoundariesService();

/**
 * PostGIS Service (HTTPS only)
 * Client-side code MUST NOT embed database credentials. This service only
 * calls the public HTTPS API that fronts PostGIS.
 */

// Public API base (no credentials). Configure via env when needed.
const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_GEO_API_BASE;
  if (!raw) return 'https://geo.edwinlovett.com';
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
})();

class PostGISService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Execute a PostGIS query via HTTP API
   * Since we can't connect directly from browser, we'll use the geo.edwinlovett.com API
   */
  async executeQuery(query, params = []) {
    try {
      // For now, use the existing API endpoints
      // In production, you'd want to create specific API endpoints that query PostGIS
      console.log('PostGIS query executed via API placeholder:', query, params);
      // Intentionally not connecting directly from the client.
      return null;
    } catch (error) {
      console.error('PostGIS query error:', error);
      throw error;
    }
  }

  /**
   * Get ZIP boundary from PostGIS database
   * This will query the database directly for the most accurate boundaries
   */
  async getZipBoundary(zipCode, simplified = true) {
    const cacheKey = `postgis:${zipCode}:${simplified}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      // Use the existing geo.edwinlovett.com endpoint which connects to PostGIS
      const url = `${this.baseUrl}/zip/${zipCode}${simplified ? '?simplified=true' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`PostGIS API error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTimeout
      });

      return data;
    } catch (error) {
      console.error(`Error fetching from PostGIS: ${error.message}`);
      return null;
    }
  }

  /**
   * Search ZIPs within radius using PostGIS spatial functions
   * This would use ST_DWithin for efficient spatial queries
   */
  async searchRadius(lat, lng, radiusMiles) {
    const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters

    // This is what the PostGIS query would look like:
    const query = `
      SELECT
        zipcode, city, state_code, county,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude,
        ST_Distance(
          location,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        ) / 1609.34 as distance_miles
      FROM zip_codes
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
      ORDER BY distance_miles
      LIMIT 1000;
    `;

    // For now, fallback to the static service
    // In production, you'd create an API endpoint that executes this query
    return null;
  }

  /**
   * Search ZIPs within polygon using PostGIS spatial functions
   */
  async searchPolygon(coordinates) {
    // Convert coordinates to WKT format
    const wkt = this.coordinatesToWKT(coordinates);

    // This is what the PostGIS query would look like:
    const query = `
      SELECT
        zipcode, city, state_code, county,
        ST_Y(location::geometry) as latitude,
        ST_X(location::geometry) as longitude
      FROM zip_codes
      WHERE ST_Within(
        location::geometry,
        ST_GeomFromText($1, 4326)
      )
      LIMIT 1000;
    `;

    // For now, fallback to the static service
    return null;
  }

  /**
   * Get boundaries for viewport using PostGIS spatial index
   */
  async getViewportBoundaries(bounds, limit = 50, simplified = true) {
    const { north, south, east, west } = bounds;

    // This would use PostGIS's spatial index for fast viewport queries
    const query = `
      SELECT
        zip_boundary
      FROM zip_boundaries
      WHERE boundary && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      LIMIT $5;
    `;

    try {
      // Use the existing API endpoint
      const params = new URLSearchParams({
        north: north.toString(),
        south: south.toString(),
        east: east.toString(),
        west: west.toString(),
        limit: limit.toString(),
        simplified: simplified.toString()
      });

      const url = `${this.baseUrl}/zip/boundaries/viewport?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching viewport boundaries:', error);
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
  }

  /**
   * Convert coordinate array to WKT polygon format
   */
  coordinatesToWKT(coordinates) {
    const points = coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(',');
    return `POLYGON((${points}))`;
  }

  /**
   * Get statistics from PostGIS database
   */
  async getStats() {
    try {
      const response = await fetch(`${this.baseUrl}/zip-stats`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
export default new PostGISService();

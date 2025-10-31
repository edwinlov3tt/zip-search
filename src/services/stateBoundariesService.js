/**
 * State Boundaries Service
 * Fetches state polygons from Census TIGER API
 */

// Census TIGER API endpoint for State boundaries
const TIGER_API_BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer';
const STATE_LAYER = 0; // States layer

class StateBoundariesService {
  constructor() {
    this.singleCache = new Map(); // key: code -> { data, expires }
    this.viewportCache = new Map(); // key: rounded bbox -> { data, expires }
    this.ttlMs = 5 * 60 * 1000;
  }

  /**
   * Normalize TIGER API feature to match expected format
   * Maps NAME -> name, STUSAB -> code, etc.
   */
  normalizeFeature(feature) {
    if (!feature) return null;

    return {
      ...feature,
      properties: {
        ...feature.properties,
        // Map TIGER fields to expected fields
        name: feature.properties.NAME || feature.properties.name,
        code: feature.properties.STUSAB || feature.properties.code, // 2-letter state code
        state_code: feature.properties.STUSAB || feature.properties.state_code,
        fips: feature.properties.STATE || feature.properties.fips // 2-digit FIPS code
      }
    };
  }

  getCache(map, key) {
    const v = map.get(key);
    if (v && v.expires > Date.now()) return v.data;
    if (v) map.delete(key);
    return null;
  }

  setCache(map, key, data) {
    map.set(key, { data, expires: Date.now() + this.ttlMs });
  }

  async getViewportBoundaries(bounds, limit = 25, simplified = true, tolerance = 0.01) {
    const { north, south, east, west } = bounds || {}

    // Simple rounded cache key to avoid flapping
    const round = (n) => Math.round(n * 1000) / 1000;
    const vKey = `${round(north)}:${round(south)}:${round(east)}:${round(west)}:${limit}:${simplified}:${tolerance}`;
    const cached = this.getCache(this.viewportCache, vKey);
    if (cached) return cached;

    try {
      // TIGER API spatial query with envelope
      const params = new URLSearchParams({
        geometry: JSON.stringify({
          xmin: west,
          ymin: south,
          xmax: east,
          ymax: north,
          spatialReference: { wkid: 4326 }
        }),
        geometryType: 'esriGeometryEnvelope',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'STATE,STUSAB,NAME,GEOID,AREALAND,CENTLAT,CENTLON',
        returnGeometry: 'true',
        f: 'geojson',
        geometryPrecision: simplified ? '3' : '5',
        resultRecordCount: limit
      });

      const url = `${TIGER_API_BASE}/${STATE_LAYER}/query?${params}`;
      const res = await fetch(url);

      if (res.ok) {
        const json = await res.json();
        // Normalize features
        if (json && json.features) {
          json.features = json.features.map(f => this.normalizeFeature(f));
        }
        this.setCache(this.viewportCache, vKey, json);
        return json;
      }
    } catch (err) {
      console.error('State viewport query failed:', err);
    }

    const empty = { type: 'FeatureCollection', features: [] };
    this.setCache(this.viewportCache, vKey, empty);
    return empty;
  }

  async getStateBoundary(code, simplified = true, tolerance = 0.01) {
    if (!code) return null;
    const key = `${String(code).toUpperCase()}:${simplified}:${tolerance}`;
    const cached = this.getCache(this.singleCache, key);
    if (cached) return cached;

    try {
      const codeUpper = String(code).toUpperCase();

      // Determine query type: 2-letter code (STUSAB), 2-digit FIPS (STATE), or full name
      let whereClause;
      if (codeUpper.length === 2 && /^[A-Z]{2}$/.test(codeUpper)) {
        whereClause = `STUSAB='${codeUpper}'`;
      } else if (/^\d{1,2}$/.test(codeUpper)) {
        whereClause = `STATE='${codeUpper.padStart(2, '0')}'`;
      } else {
        whereClause = `NAME='${codeUpper}'`;
      }

      const params = new URLSearchParams({
        where: whereClause,
        outFields: 'STATE,STUSAB,NAME,GEOID,AREALAND,CENTLAT,CENTLON',
        returnGeometry: 'true',
        f: 'geojson',
        geometryPrecision: simplified ? '3' : '5'
      });

      const url = `${TIGER_API_BASE}/${STATE_LAYER}/query?${params}`;
      const res = await fetch(url);

      if (res.ok) {
        const json = await res.json();
        // Extract and normalize first feature if exists
        if (json && json.features && json.features.length > 0) {
          const feature = this.normalizeFeature(json.features[0]);
          this.setCache(this.singleCache, key, feature);
          return feature;
        }
      }
    } catch (err) {
      console.error('State boundary query failed:', err);
    }

    return null;
  }
}

export default new StateBoundariesService()

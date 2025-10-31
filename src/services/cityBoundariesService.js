/**
 * City (Place) Boundaries Service
 * Fetches city/place polygons from Census TIGER API
 */

// Census TIGER API endpoint for Place boundaries (Incorporated Places)
const TIGER_API_BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer';
const PLACE_LAYER = 28; // Incorporated Places layer

// State code to FIPS code mapping
const STATE_TO_FIPS = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20',
  'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36',
  'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
  'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56', 'DC': '11', 'PR': '72'
};

class CityBoundariesService {
  constructor() {
    this.singleCache = new Map();
    this.viewportCache = new Map();
    this.ttlMs = 5 * 60 * 1000;
  }

  /**
   * Normalize TIGER API feature to match expected format
   * Maps NAME -> name, STATE -> state_code, etc.
   */
  normalizeFeature(feature) {
    if (!feature) return null;

    return {
      ...feature,
      properties: {
        ...feature.properties,
        // Map TIGER fields to expected fields
        name: feature.properties.NAME || feature.properties.name,
        state_code: feature.properties.STATE || feature.properties.state_code
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

  async getViewportBoundaries(bounds, limit = 100, simplified = true, tolerance = 0.001) {
    const { north, south, east, west } = bounds || {}

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
        outFields: 'NAME,STATE,BASENAME,GEOID,AREALAND,CENTLAT,CENTLON',
        returnGeometry: 'true',
        f: 'geojson',
        geometryPrecision: simplified ? '3' : '5',
        resultRecordCount: limit
      });

      const url = `${TIGER_API_BASE}/${PLACE_LAYER}/query?${params}`;
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
      console.error('City viewport query failed:', err);
    }

    const empty = { type: 'FeatureCollection', features: [] };
    this.setCache(this.viewportCache, vKey, empty);
    return empty;
  }

  async getCityBoundary(name, state, simplified = true, tolerance = 0.001) {
    if (!name) return null;
    const key = `${String(name).toLowerCase()}:${(state || '').toUpperCase()}:${simplified}:${tolerance}`;
    const cached = this.getCache(this.singleCache, key);
    if (cached) return cached;

    try {
      // Build WHERE clause for city name using BASENAME (excludes place type suffix like "city", "village")
      // NAME includes suffix like "New York city", BASENAME is just "New York"
      let whereClause = `BASENAME='${String(name)}'`;

      // Add state filter if provided (STATE is 2-digit FIPS code in TIGER)
      if (state) {
        const stateStr = String(state).toUpperCase();
        let fipsCode;

        // STATE field expects 2-digit FIPS code (e.g., "36" for NY)
        if (/^\d{1,2}$/.test(stateStr)) {
          // Already a FIPS code
          fipsCode = stateStr.padStart(2, '0');
        } else if (/^[A-Z]{2}$/.test(stateStr)) {
          // Convert 2-letter state code to FIPS
          fipsCode = STATE_TO_FIPS[stateStr];
        }

        if (fipsCode) {
          whereClause += ` AND STATE='${fipsCode}'`;
        }
      }

      const params = new URLSearchParams({
        where: whereClause,
        outFields: 'NAME,STATE,BASENAME,GEOID,PLACE,AREALAND,CENTLAT,CENTLON',
        returnGeometry: 'true',
        f: 'geojson',
        geometryPrecision: simplified ? '3' : '5'
      });

      const url = `${TIGER_API_BASE}/${PLACE_LAYER}/query?${params}`;
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
      console.error('City boundary query failed:', err);
    }

    return null;
  }
}

export default new CityBoundariesService()

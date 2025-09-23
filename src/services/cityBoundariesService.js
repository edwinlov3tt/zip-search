/**
 * City (Place) Boundaries Service
 * Fetches city/place polygons via HTTPS API.
 */

const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_GEO_API_BASE
  if (!raw) return null
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
})()


class CityBoundariesService {
  constructor() {
    this.singleCache = new Map();
    this.viewportCache = new Map();
    this.ttlMs = 5 * 60 * 1000;
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

    // HTTPS API
    if (API_BASE_URL) {
      try {
        const params = new URLSearchParams({
          north: String(north), south: String(south), east: String(east), west: String(west),
          limit: String(limit), simplified: String(!!simplified)
        })
        if (simplified && tolerance != null) params.set('tolerance', String(tolerance))
        const res = await fetch(`${API_BASE_URL}/cities/viewport?${params}`)
        if (res.ok) {
          const json = await res.json();
          this.setCache(this.viewportCache, vKey, json);
          return json;
        }
      } catch (_) {}
    }

    const empty = { type: 'FeatureCollection', features: [] };
    this.setCache(this.viewportCache, vKey, empty);
    return empty
  }

  async getCityBoundary(name, state, simplified = true, tolerance = 0.001) {
    if (!name) return null
    const key = `${String(name).toLowerCase()}:${(state || '').toUpperCase()}:${simplified}:${tolerance}`;
    const cached = this.getCache(this.singleCache, key);
    if (cached) return cached;
    if (API_BASE_URL) {
      try {
        const params = new URLSearchParams({ name: name })
        if (state) params.set('state', state)
        if (simplified) {
          params.set('simplified', 'true')
          params.set('tolerance', String(tolerance))
        }
        const res = await fetch(`${API_BASE_URL}/city?${params}`)
        if (res.ok) {
          const json = await res.json();
          this.setCache(this.singleCache, key, json);
          return json;
        }
      } catch (_) {}
    }

    return null
  }
}

export default new CityBoundariesService()

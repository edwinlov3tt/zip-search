/**
 * State Boundaries Service
 * Fetches state polygons via HTTPS API.
 */

const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_GEO_API_BASE
  if (!raw) return null
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
})()


class StateBoundariesService {
  constructor() {
    this.singleCache = new Map(); // key: code -> { data, expires }
    this.viewportCache = new Map(); // key: rounded bbox -> { data, expires }
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

  async getViewportBoundaries(bounds, limit = 25, simplified = true, tolerance = 0.01) {
    const { north, south, east, west } = bounds || {}

    // Simple rounded cache key to avoid flapping
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
        const res = await fetch(`${API_BASE_URL}/states/viewport?${params}`)
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

  async getStateBoundary(code, simplified = true, tolerance = 0.01) {
    if (!code) return null
    const key = `${String(code).toUpperCase()}:${simplified}:${tolerance}`;
    const cached = this.getCache(this.singleCache, key);
    if (cached) return cached;
    // Prefer API endpoint for single state
    if (API_BASE_URL) {
      try {
        const params = new URLSearchParams()
        if (simplified) {
          params.set('simplified', 'true')
          params.set('tolerance', String(tolerance))
        }
        const url = `${API_BASE_URL}/state/${encodeURIComponent(code)}${params.toString() ? `?${params}` : ''}`
        const res = await fetch(url)
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

export default new StateBoundariesService()

// Optimized static ZIP code service with lazy loading and chunking

let zipDataCache = null;
let searchIndex = null;
let loadPromise = null;

// Lazy load only when needed
async function ensureDataLoaded() {
  if (zipDataCache) return zipDataCache;

  if (!loadPromise) {
    loadPromise = loadData();
  }

  return loadPromise;
}

async function loadData() {
  try {
    const response = await fetch('/zipdata.json');
    const data = await response.json();

    // Build search index
    searchIndex = {
      byZip: new Map(),
      byCity: new Map(),
      byState: new Map()
    };

    data.forEach(item => {
      // Store by zip
      searchIndex.byZip.set(item.z, item);

      // Index by city (lowercase for case-insensitive search)
      const cityKey = item.c.toLowerCase();
      if (!searchIndex.byCity.has(cityKey)) {
        searchIndex.byCity.set(cityKey, []);
      }
      searchIndex.byCity.get(cityKey).push(item);

      // Index by state
      if (!searchIndex.byState.has(item.s)) {
        searchIndex.byState.set(item.s, []);
      }
      searchIndex.byState.get(item.s).push(item);
    });

    zipDataCache = data;
    return data;
  } catch (error) {
    console.error('Failed to load zip data:', error);
    throw error;
  }
}

import { getStateName } from '../utils/stateNames.js';

export class OptimizedStaticService {
  static haversine(lat1, lon1, lat2, lon2) {
    const R = 3959; // miles
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static pointInPolygon(point, polygon) {
    // Ray-casting algorithm for point-in-polygon
    const x = point.lng, y = point.lat;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static async search(params) {
    const {
      query,
      lat,
      lng,
      radius,
      polygon,
      state,
      county,
      city,
      limit = 100,
      offset = 0,
    } = params;

    await ensureDataLoaded();

    let results = [];

    // Radius search
    if (lat != null && lng != null && radius != null) {
      for (const item of zipDataCache) {
        const d = this.haversine(lat, lng, item.lat, item.lng);
        if (d <= radius) {
          results.push({
            zipcode: item.z,
            city: item.c,
            state: item.s,
            stateCode: item.s,
            county: item.co,
            latitude: item.lat,
            longitude: item.lng,
          });
        }
      }
    }
    // Polygon search
    else if (polygon && Array.isArray(polygon) && polygon.length >= 3) {
      for (const item of zipDataCache) {
        if (this.pointInPolygon({ lat: item.lat, lng: item.lng }, polygon)) {
          results.push({
            zipcode: item.z,
            city: item.c,
            state: item.s,
            stateCode: item.s,
            county: item.co,
            latitude: item.lat,
            longitude: item.lng,
          });
        }
      }
    }
    // Text search
    else if (query && query.length >= 2) {
      const searchTerm = query.toLowerCase();

      if (/^\d{3,5}/.test(query)) {
        for (const [zip, data] of searchIndex.byZip) {
          if (zip.startsWith(query)) {
            results.push({
              zipcode: data.z,
              city: data.c,
              state: data.s,
              stateCode: data.s,
              county: data.co,
              latitude: data.lat,
              longitude: data.lng,
            });
            if (results.length >= offset + limit) break;
          }
        }
      } else {
        for (const [cityKey, items] of searchIndex.byCity) {
          if (cityKey.includes(searchTerm)) {
            items.forEach((data) => {
              results.push({
                zipcode: data.z,
                city: data.c,
                state: data.s,
                stateCode: data.s,
                county: data.co,
                latitude: data.lat,
                longitude: data.lng,
              });
            });
            if (results.length >= offset + limit * 2) break;
          }
        }
      }
    } else {
      // No valid search parameters
      return { results: [], total: 0, offset, limit, hasMore: false };
    }

    // Optional hierarchical filters
    if (state) results = results.filter((r) => r.state === state);
    if (county) results = results.filter((r) => r.county === county);
    if (city) results = results.filter((r) => r.city === city);

    const total = results.length;
    const paged = results.slice(offset, offset + limit);
    return { results: paged, total, offset, limit, hasMore: offset + limit < total };
  }

  static async getStates() {
    await ensureDataLoaded();

    const states = Array.from(searchIndex.byState.keys()).sort();
    return {
      states: states.map(code => ({ code, name: getStateName(code) }))
    };
  }

  static async getCounties(params) {
    const { state } = params;
    await ensureDataLoaded();

    if (!state || !searchIndex.byState.has(state)) {
      return { counties: [] };
    }

    const counties = new Set();
    searchIndex.byState.get(state).forEach(item => {
      if (item.co) counties.add(item.co);
    });

    return {
      counties: Array.from(counties).sort().map(name => ({ name }))
    };
  }

  static async getCities(params) {
    const { state } = params;
    await ensureDataLoaded();

    if (!state || !searchIndex.byState.has(state)) {
      return { cities: [] };
    }

    const cities = new Set();
    searchIndex.byState.get(state).forEach(item => {
      if (item.c) cities.add(item.c);
    });

    return {
      cities: Array.from(cities).sort().map(name => ({ name }))
    };
  }

  static async getZipCode(params) {
    const { zip } = params;
    await ensureDataLoaded();

    const data = searchIndex.byZip.get(zip);
    if (!data) {
      return { error: 'Zip code not found', zipcode: null };
    }

    return {
      zipcode: {
        zipcode: data.z,
        city: data.c,
        state: data.s,
        county: data.co,
        latitude: data.lat,
        longitude: data.lng
      }
    };
  }
}

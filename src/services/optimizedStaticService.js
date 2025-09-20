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

export class OptimizedStaticService {
  static async search(params) {
    const { query, limit = 100, offset = 0 } = params;

    if (!query || query.length < 2) {
      return { results: [], total: 0, offset, limit, hasMore: false };
    }

    await ensureDataLoaded();

    const searchTerm = query.toLowerCase();
    let results = [];

    // ZIP code search (most common)
    if (/^\d{3,5}/.test(query)) {
      // Use Map for O(1) lookup
      for (const [zip, data] of searchIndex.byZip) {
        if (zip.startsWith(query)) {
          results.push({
            zipcode: data.z,
            city: data.c,
            state: data.s,
            county: data.co,
            latitude: data.lat,
            longitude: data.lng
          });

          // Early exit if we have enough results
          if (results.length >= offset + limit) break;
        }
      }
    } else {
      // City search - use indexed data
      for (const [city, items] of searchIndex.byCity) {
        if (city.includes(searchTerm)) {
          items.forEach(data => {
            results.push({
              zipcode: data.z,
              city: data.c,
              state: data.s,
              county: data.co,
              latitude: data.lat,
              longitude: data.lng
            });
          });

          // Early exit if we have enough results
          if (results.length >= offset + limit * 2) break;
        }
      }
    }

    // Apply pagination
    const total = results.length;
    results = results.slice(offset, offset + limit);

    return {
      results,
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  static async getStates() {
    await ensureDataLoaded();

    const states = Array.from(searchIndex.byState.keys()).sort();
    return {
      states: states.map(code => ({ code, name: code }))
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
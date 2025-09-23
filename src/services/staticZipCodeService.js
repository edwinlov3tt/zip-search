// Static ZIP code service that loads data from public JSON file
// This avoids the need for a backend API

let zipData = null;
let dataPromise = null;

async function loadZipData() {
  if (zipData) return zipData;

  if (!dataPromise) {
    dataPromise = fetch('/zipdata.json')
      .then(res => res.json())
      .then(data => {
        // Create lookup structures
        const byZip = {};
        const byCity = {};
        const byState = {};

        data.forEach(item => {
          // Expand abbreviated keys
          const record = {
            zipcode: item.z,
            city: item.c,
            state: item.s,
            stateCode: item.s,
            county: item.co,
            latitude: item.lat,
            longitude: item.lng
          };

          // Index by zipcode
          byZip[item.z] = record;

          // Index by city
          const cityKey = `${item.c.toLowerCase()}_${item.s}`;
          if (!byCity[cityKey]) {
            byCity[cityKey] = [];
          }
          byCity[cityKey].push(record);

          // Index by state
          if (!byState[item.s]) {
            byState[item.s] = [];
          }
          byState[item.s].push(record);
        });

        zipData = { raw: data, byZip, byCity, byState };
        return zipData;
      });
  }

  return dataPromise;
}

export class StaticZipCodeService {
  static async search(params) {
    const { query, limit = 100, offset = 0 } = params;
    const data = await loadZipData();

    if (!query) {
      return { results: [], total: 0, offset: 0, limit, hasMore: false };
    }

    const searchTerm = query.toLowerCase();
    let results = [];

    // Check if it's a ZIP code
    if (/^\d{3,5}/.test(query)) {
      // ZIP code search
      Object.keys(data.byZip).forEach(zip => {
        if (zip.startsWith(query)) {
          results.push(data.byZip[zip]);
        }
      });
    } else {
      // City/State search
      Object.keys(data.byCity).forEach(cityKey => {
        if (cityKey.includes(searchTerm)) {
          results = results.concat(data.byCity[cityKey]);
        }
      });
    }

    // Remove duplicates
    const seen = new Set();
    results = results.filter(r => {
      const key = r.zipcode;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

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
    const data = await loadZipData();
    const states = Object.keys(data.byState).map(code => ({
      code,
      name: code // You could add full state names here
    }));
    return { states };
  }

  static async getCounties(params) {
    const { state } = params;
    const data = await loadZipData();

    if (!state || !data.byState[state]) {
      return { counties: [] };
    }

    const counties = new Set();
    data.byState[state].forEach(record => {
      if (record.county) {
        counties.add(record.county);
      }
    });

    return {
      counties: Array.from(counties).sort().map(name => ({ name }))
    };
  }

  static async getCities(params) {
    const { state } = params;
    const data = await loadZipData();

    if (!state || !data.byState[state]) {
      return { cities: [] };
    }

    const cities = new Set();
    data.byState[state].forEach(record => {
      if (record.city) {
        cities.add(record.city);
      }
    });

    return {
      cities: Array.from(cities).sort().map(name => ({ name }))
    };
  }

  static async getZipCode(params) {
    const { zip } = params;
    const data = await loadZipData();

    if (!data.byZip[zip]) {
      return { error: 'Zip code not found', zipcode: null };
    }

    return { zipcode: data.byZip[zip] };
  }
}

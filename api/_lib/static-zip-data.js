import { readFile } from 'node:fs/promises';
import path from 'node:path';

const STATE_NAME_BY_CODE = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

let cachedData = null;

async function loadZipJson() {
  if (cachedData) {
    return cachedData;
  }

  const filePath = path.join(process.cwd(), 'public', 'zipdata.json');
  const contents = await readFile(filePath, 'utf8');
  const raw = JSON.parse(contents);

  const states = new Map();
  const countiesByState = new Map();
  const citiesByStateCounty = new Map();

  raw.forEach((entry) => {
    const state = entry.s;
    if (!state) return;

    if (!states.has(state)) {
      states.set(state, {
        code: state,
        name: STATE_NAME_BY_CODE[state] || state
      });
    }

    if (!countiesByState.has(state)) {
      countiesByState.set(state, new Set());
    }

    if (entry.co) {
      countiesByState.get(state).add(entry.co);
    }

    if (!citiesByStateCounty.has(state)) {
      citiesByStateCounty.set(state, new Map());
    }

    const countyKey = entry.co || '__no_county__';
    if (!citiesByStateCounty.get(state).has(countyKey)) {
      citiesByStateCounty.get(state).set(countyKey, new Set());
    }

    if (entry.c) {
      citiesByStateCounty.get(state).get(countyKey).add(entry.c);
    }
  });

  cachedData = {
    states,
    countiesByState,
    citiesByStateCounty
  };

  return cachedData;
}

export async function getStaticStates() {
  const data = await loadZipJson();
  return Array.from(data.states.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStaticCounties(state) {
  if (!state) return [];
  const data = await loadZipJson();
  const counties = data.countiesByState.get(state);
  if (!counties) return [];
  return Array.from(counties).sort().map((name) => ({ name }));
}

export async function getStaticCities(state, county) {
  if (!state) return [];
  const data = await loadZipJson();
  const countyMap = data.citiesByStateCounty.get(state);
  if (!countyMap) return [];

  if (county) {
    const cities = countyMap.get(county) || new Set();
    return Array.from(cities).sort().map((name) => ({ name }));
  }

  const combined = new Set();
  countyMap.forEach((cities) => {
    cities.forEach((name) => combined.add(name));
  });
  return Array.from(combined).sort().map((name) => ({ name }));
}

export async function isStaticZipDataAvailable() {
  try {
    await loadZipJson();
    return true;
  } catch (error) {
    console.error('[api] Failed to load public/zipdata.json fallback', error);
    return false;
  }
}

import { Address, Coordinate } from '../types';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const TIMEOUT_MS = 60000; // 60 seconds

/**
 * Convert miles to meters
 */
export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

/**
 * Calculate bounding box from coordinates
 */
export function getBoundingBox(coordinates: Coordinate[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs)
  };
}

/**
 * Calculate approximate area of polygon in square miles
 */
export function calculatePolygonArea(coordinates: Coordinate[]): number {
  if (coordinates.length < 3) return 0;

  // Shoelace formula for polygon area
  let area = 0;
  const n = coordinates.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Convert to approximate miles (rough estimate)
    const lat1 = coordinates[i].lat;
    const lng1 = coordinates[i].lng;
    const lat2 = coordinates[j].lat;
    const lng2 = coordinates[j].lng;

    area += lat1 * lng2;
    area -= lat2 * lng1;
  }

  area = Math.abs(area) / 2;

  // Convert degrees squared to square miles (very rough approximation)
  // 1 degree latitude ≈ 69 miles, 1 degree longitude varies by latitude
  const avgLat = coordinates.reduce((sum, c) => sum + c.lat, 0) / n;
  const lngMiles = 69 * Math.cos(avgLat * Math.PI / 180);
  const latMiles = 69;

  return area * latMiles * lngMiles;
}

/**
 * Convert coordinates to Overpass poly format
 */
export function coordsToPolyString(coordinates: Coordinate[]): string {
  return coordinates.map(c => `${c.lat} ${c.lng}`).join(' ');
}

/**
 * Parse Overpass API response into Address objects
 */
export function parseOverpassResponse(data: any): Address[] {
  if (!data || !data.elements) {
    return [];
  }

  return data.elements
    .map((element: any) => {
      const tags = element.tags || {};

      // Get coordinates
      let lat: number;
      let lng: number;

      if (element.type === 'way' && element.center) {
        lat = element.center.lat;
        lng = element.center.lon;
      } else {
        lat = element.lat;
        lng = element.lon;
      }

      // Skip if missing required fields
      if (!tags['addr:housenumber'] || lat == null || lng == null) {
        return null;
      }

      return {
        id: element.id,
        type: element.type,
        housenumber: tags['addr:housenumber'],
        street: tags['addr:street'] || '',
        unit: tags['addr:unit'] || tags['addr:flats'] || undefined,
        city: tags['addr:city'] || undefined,
        state: tags['addr:state'] || undefined,
        postcode: tags['addr:postcode'] || undefined,
        lat,
        lng,
        building: tags.building || undefined,
        name: tags.name || undefined
      } as Address;
    })
    .filter((addr: Address | null): addr is Address => addr !== null);
}

/**
 * Search addresses by radius
 */
export async function searchByRadius(
  center: Coordinate,
  radiusMiles: number,
  signal?: AbortSignal
): Promise<Address[]> {
  const radiusMeters = milesToMeters(radiusMiles);

  const query = `
[out:json][timeout:60];
(
  node["addr:housenumber"](around:${radiusMeters},${center.lat},${center.lng});
  way["addr:housenumber"](around:${radiusMeters},${center.lat},${center.lng});
);
out center;
`.trim();

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal
  });

  if (!response.ok) {
    if (response.status === 504) {
      throw new Error('TIMEOUT: Request timed out. Try a smaller radius.');
    } else if (response.status === 429) {
      throw new Error('RATE_LIMIT: Too many requests. Please wait.');
    }
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  return parseOverpassResponse(data);
}

/**
 * Search addresses by polygon
 */
export async function searchByPolygon(
  coordinates: Coordinate[],
  signal?: AbortSignal
): Promise<Address[]> {
  const polyString = coordsToPolyString(coordinates);

  const query = `
[out:json][timeout:60];
(
  node["addr:housenumber"](poly:"${polyString}");
  way["addr:housenumber"](poly:"${polyString}");
);
out center;
`.trim();

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal
  });

  if (!response.ok) {
    if (response.status === 504) {
      throw new Error('TIMEOUT: Request timed out. Try a smaller area.');
    } else if (response.status === 429) {
      throw new Error('RATE_LIMIT: Too many requests. Please wait.');
    }
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  return parseOverpassResponse(data);
}

/**
 * Search addresses by bounding box (for chunking large areas)
 */
export async function searchByBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  signal?: AbortSignal
): Promise<Address[]> {
  const query = `
[out:json][timeout:60];
(
  node["addr:housenumber"](${minLat},${minLng},${maxLat},${maxLng});
  way["addr:housenumber"](${minLat},${minLng},${maxLat},${maxLng});
);
out center;
`.trim();

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal
  });

  if (!response.ok) {
    if (response.status === 504) {
      throw new Error('TIMEOUT: Request timed out. Try a smaller area.');
    } else if (response.status === 429) {
      throw new Error('RATE_LIMIT: Too many requests. Please wait.');
    }
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  return parseOverpassResponse(data);
}

/**
 * Search addresses by ZIP codes
 * Note: This queries by postal code tag in the bounding area
 */
export async function searchByZips(
  zips: string[],
  signal?: AbortSignal
): Promise<Address[]> {
  // Query addresses with matching postcodes
  const zipFilter = zips.map(z => `["addr:postcode"="${z}"]`).join('');

  const query = `
[out:json][timeout:90];
(
  node["addr:housenumber"]${zipFilter};
  way["addr:housenumber"]${zipFilter};
);
out center;
`.trim();

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal
  });

  if (!response.ok) {
    if (response.status === 504) {
      throw new Error('TIMEOUT: Request timed out. Try fewer ZIP codes.');
    } else if (response.status === 429) {
      throw new Error('RATE_LIMIT: Too many requests. Please wait.');
    }
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  return parseOverpassResponse(data);
}

/**
 * Chunk a large polygon into grid cells for parallel querying
 */
export function chunkPolygon(
  coordinates: Coordinate[],
  maxAreaSqMi: number = 20
): { minLat: number; minLng: number; maxLat: number; maxLng: number }[] {
  const bbox = getBoundingBox(coordinates);
  const totalArea = calculatePolygonArea(coordinates);

  if (totalArea <= maxAreaSqMi) {
    return [bbox];
  }

  // Calculate grid dimensions
  const numChunks = Math.ceil(totalArea / maxAreaSqMi);
  const gridSize = Math.ceil(Math.sqrt(numChunks));

  const latStep = (bbox.maxLat - bbox.minLat) / gridSize;
  const lngStep = (bbox.maxLng - bbox.minLng) / gridSize;

  const chunks: { minLat: number; minLng: number; maxLat: number; maxLng: number }[] = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      chunks.push({
        minLat: bbox.minLat + i * latStep,
        maxLat: bbox.minLat + (i + 1) * latStep,
        minLng: bbox.minLng + j * lngStep,
        maxLng: bbox.minLng + (j + 1) * lngStep
      });
    }
  }

  return chunks;
}

/**
 * Deduplicate addresses by ID
 */
export function deduplicateAddresses(addresses: Address[]): Address[] {
  const seen = new Set<number>();
  return addresses.filter(addr => {
    if (seen.has(addr.id)) {
      return false;
    }
    seen.add(addr.id);
    return true;
  });
}

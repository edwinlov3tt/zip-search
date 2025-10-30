function parseMaybeJSON(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function toFloat(value) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeZipRecord(record) {
  if (!record) return null;

  const zipCode = record.zip_code || record.zipcode || record.zipCode || null;
  const stateCode = record.state_code || record.stateCode || record.state;
  const stateName = record.state_name || record.state || null;
  const countyName = record.county_name || record.county || null;
  const countyCode = record.county_fips || record.countyCode || null;

  const centroidGeoJSON = record.centroid_geojson || record.centroidGeoJSON || record.centroid;
  const geometryGeoJSON = record.geometry_geojson || record.geometryGeoJSON || record.geometry;
  const bbox = record.bounding_box || record.bbox || null;

  return {
    zipCode,
    zipcode: zipCode,
    city: record.primary_city || record.city || null,
    county: countyName,
    countyCode,
    state: stateName,
    stateCode,
    latitude: toFloat(record.centroid_lat || record.latitude),
    longitude: toFloat(record.centroid_lng || record.longitude),
    population: record.population ?? null,
    landAreaSqMi: toFloat(record.land_area_sq_mi || record.landAreaSqMi),
    waterAreaSqMi: toFloat(record.water_area_sq_mi || record.waterAreaSqMi),
    households: record.households ?? null,
    geometry: parseMaybeJSON(geometryGeoJSON),
    centroid: parseMaybeJSON(centroidGeoJSON),
    bbox: parseMaybeJSON(bbox),
    distanceMiles: toFloat(record.distance_miles || record.distanceMiles),
    rank: record.rank ?? null
  };
}

export function normalizeResultSet(rows, total) {
  const normalized = Array.isArray(rows) ? rows.map(normalizeZipRecord).filter(Boolean) : [];
  return {
    results: normalized,
    total: typeof total === 'number' ? total : normalized.length
  };
}

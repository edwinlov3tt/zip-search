/**
 * Polygon Helpers
 *
 * Utilities for working with polygons including area calculation
 */

import * as turf from '@turf/turf';

/**
 * Calculate the area of a polygon in square miles
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] pairs
 * @returns {number} Area in square miles
 */
export function calculatePolygonArea(coordinates) {
  if (!coordinates || coordinates.length < 3) {
    return 0;
  }

  try {
    // Ensure polygon is closed (first and last points are the same)
    const coords = [...coordinates];
    if (coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }

    // Convert to GeoJSON format [lng, lat] (Turf.js uses lng first)
    const geoJsonCoords = coords.map(([lat, lng]) => [lng, lat]);

    // Create polygon
    const polygon = turf.polygon([geoJsonCoords]);

    // Calculate area in square meters
    const areaSquareMeters = turf.area(polygon);

    // Convert to square miles (1 square mile = 2,589,988.11 square meters)
    const areaSquareMiles = areaSquareMeters / 2589988.11;

    return areaSquareMiles;
  } catch (error) {
    console.error('Error calculating polygon area:', error);
    return 0;
  }
}

/**
 * Calculate the area of a Leaflet polygon in square miles
 * @param {Object} layer - Leaflet polygon layer
 * @returns {number} Area in square miles
 */
export function calculateLeafletPolygonArea(layer) {
  if (!layer || !layer.getLatLngs) {
    return 0;
  }

  try {
    const latLngs = layer.getLatLngs()[0]; // Get first ring
    const coordinates = latLngs.map(latLng => [latLng.lat, latLng.lng]);
    return calculatePolygonArea(coordinates);
  } catch (error) {
    console.error('Error calculating Leaflet polygon area:', error);
    return 0;
  }
}

/**
 * Convert radius in miles to meters
 * @param {number} miles - Radius in miles
 * @returns {number} Radius in meters
 */
export function milesToMeters(miles) {
  return miles * 1609.34;
}

/**
 * Convert meters to miles
 * @param {number} meters - Distance in meters
 * @returns {number} Distance in miles
 */
export function metersToMiles(meters) {
  return meters / 1609.34;
}

/**
 * Validate polygon size against maximum allowed area
 * @param {Array<[number, number]>} coordinates - Array of [lat, lng] pairs
 * @param {number} maxSquareMiles - Maximum allowed area in square miles
 * @returns {Object} { valid: boolean, area: number, overage: number }
 */
export function validatePolygonSize(coordinates, maxSquareMiles = 70) {
  const area = calculatePolygonArea(coordinates);
  const valid = area <= maxSquareMiles;
  const overage = Math.max(0, area - maxSquareMiles);

  return {
    valid,
    area,
    overage,
    maxAllowed: maxSquareMiles
  };
}

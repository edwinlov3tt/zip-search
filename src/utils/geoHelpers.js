/**
 * Generate a unique removal key for an item
 * @param {string} type - The type of item
 * @param {Object} item - The item to generate a key for
 * @returns {string} - Unique key for the item
 */
export const getRemovalKey = (type, item) => {
  switch (type) {
    case 'zip':
      return `zip-${item.zipCode}`;
    case 'city':
      return `city-${item.name}-${item.state}`;
    case 'county':
      return `county-${item.name}-${item.state}`;
    case 'state':
      return `state-${item.state || item.name}`;
    default:
      return `${type}-${item.id}`;
  }
};

/**
 * Get tile layer URL based on map type
 * @param {string} mapType - The map type (street, satellite, terrain)
 * @returns {string} - Tile layer URL
 */
export const getTileLayer = (mapType) => {
  switch (mapType) {
    case 'satellite':
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    case 'terrain':
      return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    default: // street
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
};

/**
 * Calculate distance between two coordinates in miles
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} - Distance in miles
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if a point is within a polygon
 * @param {Array} point - [lat, lng]
 * @param {Array} polygon - Array of [lat, lng] points
 * @returns {boolean} - True if point is inside polygon
 */
export const isPointInPolygon = (point, polygon) => {
  const x = point[0], y = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Check if a point is within a circle
 * @param {Array} point - [lat, lng]
 * @param {Array} center - [lat, lng]
 * @param {number} radiusMiles - Radius in miles
 * @returns {boolean} - True if point is inside circle
 */
export const isPointInCircle = (point, center, radiusMiles) => {
  const distance = calculateDistance(point[0], point[1], center[0], center[1]);
  return distance <= radiusMiles;
};

/**
 * Get bounds for a set of coordinates
 * @param {Array} coordinates - Array of [lat, lng] points
 * @returns {Object} - { north, south, east, west }
 */
export const getBounds = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  let north = coordinates[0][0];
  let south = coordinates[0][0];
  let east = coordinates[0][1];
  let west = coordinates[0][1];

  coordinates.forEach(coord => {
    north = Math.max(north, coord[0]);
    south = Math.min(south, coord[0]);
    east = Math.max(east, coord[1]);
    west = Math.min(west, coord[1]);
  });

  return { north, south, east, west };
};

/**
 * Format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} precision - Decimal precision
 * @returns {string} - Formatted coordinates
 */
export const formatCoordinates = (lat, lng, precision = 4) => {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
};

/**
 * Validate ZIP code format
 * @param {string} zip - ZIP code
 * @returns {boolean} - True if valid
 */
export const isValidZipCode = (zip) => {
  return /^\d{5}(-\d{4})?$/.test(zip);
};

/**
 * Normalize ZIP code to 5 digits
 * @param {string} zip - ZIP code
 * @returns {string} - Normalized ZIP code
 */
export const normalizeZipCode = (zip) => {
  if (!zip) return '';
  const cleaned = zip.replace(/\D/g, '');
  return cleaned.substring(0, 5);
};
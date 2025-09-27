/**
 * Sort data by a specific key
 * @param {Array} data - Data to sort
 * @param {string} key - Sort key
 * @param {string} direction - Sort direction (asc/desc)
 * @returns {Array} - Sorted data
 */
export const sortData = (data, key, direction = 'asc') => {
  return [...data].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];

    // Handle null/undefined values
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    // Handle numeric vs string comparison
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // String comparison
    const comparison = String(aVal).localeCompare(String(bVal));
    return direction === 'asc' ? comparison : -comparison;
  });
};

/**
 * Filter data based on search term
 * @param {Array} data - Data to filter
 * @param {string} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @returns {Array} - Filtered data
 */
export const filterData = (data, searchTerm, searchFields) => {
  if (!searchTerm) return data;

  const term = searchTerm.toLowerCase();
  return data.filter(item => {
    return searchFields.some(field => {
      const value = item[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(term);
    });
  });
};

/**
 * Group data by a specific key
 * @param {Array} data - Data to group
 * @param {string} key - Group key
 * @returns {Object} - Grouped data
 */
export const groupBy = (data, key) => {
  return data.reduce((groups, item) => {
    const groupKey = item[key] || 'Unknown';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {});
};

/**
 * Paginate data
 * @param {Array} data - Data to paginate
 * @param {number} page - Current page (0-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} - { data, totalPages, hasMore }
 */
export const paginate = (data, page, pageSize) => {
  const start = page * pageSize;
  const end = start + pageSize;
  const paginatedData = data.slice(start, end);

  return {
    data: paginatedData,
    totalPages: Math.ceil(data.length / pageSize),
    hasMore: end < data.length,
    total: data.length
  };
};

/**
 * Aggregate results by geographic level
 * @param {Array} zipResults - ZIP code results
 * @returns {Object} - Aggregated results by city, county, state
 */
export const aggregateResults = (zipResults) => {
  const cities = new Map();
  const counties = new Map();
  const states = new Map();

  zipResults.forEach(zip => {
    // Aggregate by city
    const cityKey = `${zip.city}|${zip.state}`;
    if (!cities.has(cityKey) && zip.city) {
      cities.set(cityKey, {
        id: cityKey,
        name: zip.city,
        state: zip.state,
        county: zip.county,
        lat: zip.lat || zip.latitude,
        lng: zip.lng || zip.longitude,
        zipCount: 0
      });
    }
    if (cities.has(cityKey)) {
      cities.get(cityKey).zipCount++;
    }

    // Aggregate by county
    const countyKey = `${zip.county}|${zip.state}`;
    if (!counties.has(countyKey) && zip.county) {
      counties.set(countyKey, {
        id: countyKey,
        name: zip.county,
        state: zip.state,
        lat: zip.lat || zip.latitude,
        lng: zip.lng || zip.longitude,
        zipCount: 0
      });
    }
    if (counties.has(countyKey)) {
      counties.get(countyKey).zipCount++;
    }

    // Aggregate by state
    if (!states.has(zip.state) && zip.state) {
      states.set(zip.state, {
        id: zip.state,
        name: zip.state,
        state: zip.state,
        lat: zip.lat || zip.latitude,
        lng: zip.lng || zip.longitude,
        zipCount: 0
      });
    }
    if (states.has(zip.state)) {
      states.get(zip.state).zipCount++;
    }
  });

  return {
    cities: Array.from(cities.values()),
    counties: Array.from(counties.values()),
    states: Array.from(states.values())
  };
};

/**
 * Calculate statistics for numeric data
 * @param {Array} data - Array of numbers
 * @returns {Object} - { min, max, avg, median, sum }
 */
export const calculateStats = (data) => {
  if (!data || data.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, sum: 0 };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const sum = data.reduce((acc, val) => acc + val, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / data.length,
    median: sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)],
    sum
  };
};

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add when truncated
 * @returns {string} - Truncated text
 */
export const truncateText = (text, maxLength, suffix = '...') => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};
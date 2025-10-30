/**
 * Export data as CSV with minimal columns
 * @param {Array} data - The data to export
 * @param {string} activeTab - Current active tab type
 * @returns {void}
 */
export const exportSimpleCsv = (data, activeTab) => {
  let csv = '';
  let processedData = data;

  // For geocode tab, use the data as-is (no deduping needed as each result is unique)
  // For other tabs, dedupe and sort
  if (activeTab !== 'geocode') {
    processedData = dedupeAndSort(data, activeTab);
  }

  // Create CSV based on tab type - simple exports don't include headers
  if (activeTab === 'geocode') {
    // Include header for geocode results
    const headers = ['Business Name', 'Address', 'City', 'State', 'ZIP', 'County', 'Latitude', 'Longitude', 'Accuracy'];
    csv = headers.join(',') + '\n';

    csv += processedData.map(item => {
      const row = [
        escapeCSVValue(item.businessName || ''),
        escapeCSVValue(item.address || ''),
        escapeCSVValue(item.city || ''),
        escapeCSVValue(item.state || ''),
        escapeCSVValue(item.zip || ''),
        escapeCSVValue(item.county || ''),
        item.lat || '',
        item.lng || '',
        item.accuracy != null ? (item.accuracy * 100).toFixed(2) + '%' : ''
      ];
      return row.join(',');
    }).join('\n');
  } else if (activeTab === 'zips') {
    csv = processedData.map(item => item.zipCode).join('\n');
  } else if (activeTab === 'cities') {
    csv = processedData.map(item => `${item.name}, ${item.state}`).join('\n');
  } else if (activeTab === 'counties') {
    csv = processedData.map(item => `${item.name} County, ${item.state}`).join('\n');
  } else if (activeTab === 'states') {
    csv = processedData.map(item => `${item.name}, ${item.state}`).join('\n');
  } else if (activeTab === 'streets') {
    // Format addresses as full address strings
    csv = processedData.map(item => {
      const parts = [];
      if (item.housenumber) parts.push(item.housenumber);
      if (item.street) parts.push(item.street);
      if (item.unit) parts.push(`Unit ${item.unit}`);

      const streetAddress = parts.join(' ');
      const cityStateZip = [
        item.city || '',
        item.state || '',
        item.postcode || ''
      ].filter(Boolean).join(' ');

      return `${streetAddress}, ${cityStateZip}`;
    }).join('\n');
  }

  // Generate filename with pattern
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `${activeTab}_${processedData.length}rows_${timestamp}.csv`;

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Copy data to clipboard
 * @param {Array} data - The data to copy
 * @param {string} activeTab - Current active tab type
 * @returns {Promise<void>}
 */
export const copyToClipboard = async (data, activeTab) => {
  let text = '';

  if (activeTab === 'zips') {
    // Copy only ZIP codes
    text = data.map(item => item.zipCode).join('\n');
  } else if (activeTab === 'cities') {
    // Copy cities with state code (e.g., "Dallas, TX")
    text = data.map(item => `${item.name}, ${item.state}`).join('\n');
  } else if (activeTab === 'counties') {
    // Copy counties with state code (e.g., "Dallas County, TX")
    text = data.map(item => `${item.name} County, ${item.state}`).join('\n');
  } else if (activeTab === 'states') {
    // Copy state names with state code (e.g., "Texas, TX")
    text = data.map(item => `${item.name}, ${item.state}`).join('\n');
  } else if (activeTab === 'streets') {
    // Copy addresses formatted as full addresses
    text = data.map(item => {
      const parts = [];
      if (item.housenumber) parts.push(item.housenumber);
      if (item.street) parts.push(item.street);
      if (item.unit) parts.push(`Unit ${item.unit}`);

      const streetAddress = parts.join(' ');
      const cityStateZip = [
        item.city || '',
        item.state || '',
        item.postcode || ''
      ].filter(Boolean).join(' ');

      return `${streetAddress}, ${cityStateZip}`;
    }).join('\n');
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

/**
 * Deduplicate and sort data
 * @param {Array} data - The data to process
 * @param {string} tab - Current active tab type
 * @returns {Array} - Deduplicated and sorted data
 */
export const dedupeAndSort = (data, tab) => {
  const seen = new Set();
  const unique = [];

  for (const item of data) {
    let key;
    switch (tab) {
      case 'zips':
        key = item.zipCode;
        break;
      case 'cities':
        key = `${item.name}|${item.state}`;
        break;
      case 'counties':
        key = `${item.name}|${item.state}`;
        break;
      case 'states':
        key = item.state;
        break;
      case 'streets':
        // Create unique key from housenumber, street, unit, city, state, and postcode
        key = `${item.housenumber || ''}|${item.street || ''}|${item.unit || ''}|${item.city || ''}|${item.state || ''}|${item.postcode || ''}`;
        break;
      default:
        key = item.id;
    }

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  // Sort by primary field
  return unique.sort((a, b) => {
    let aVal, bVal;
    switch (tab) {
      case 'zips':
        aVal = a.zipCode;
        bVal = b.zipCode;
        break;
      case 'cities':
      case 'counties':
      case 'states':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'streets':
        // Sort addresses by street name, then by house number
        aVal = `${a.street || ''}|${a.housenumber || ''}`;
        bVal = `${b.street || ''}|${b.housenumber || ''}`;
        break;
      default:
        return 0;
    }
    return String(aVal).localeCompare(String(bVal));
  });
};

/**
 * Generate CSV content from data and columns
 * @param {Array} data - The data to export
 * @param {Array} columns - Column definitions
 * @param {boolean} includeHeader - Whether to include header row
 * @param {string} delimiter - CSV delimiter
 * @param {Object} headerMap - Optional column header mapping
 * @returns {string} - CSV content
 */
export const generateCSV = (data, columns, includeHeader = true, delimiter = ',', headerMap = null) => {
  const lines = [];

  // Default header mappings for CSV exports
  const defaultHeaderMap = {
    zipCode: 'zipcode',
    lat: 'latitude',
    lng: 'longitude'
  };

  const finalHeaderMap = headerMap || defaultHeaderMap;

  if (includeHeader) {
    const headers = columns.map(col => {
      const colName = col.label || col;
      return finalHeaderMap[colName] || colName;
    });
    lines.push(headers.join(delimiter));
  }

  for (const item of data) {
    const row = columns.map(col => {
      const key = col.key || col;
      let value = item[key] || '';

      // Quote values that contain delimiter or quotes
      if (String(value).includes(delimiter) || String(value).includes('"')) {
        value = `"${String(value).replace(/"/g, '""')}"`;
      }
      return value;
    }).join(delimiter);
    lines.push(row);
  }

  return lines.join('\n');
};

/**
 * Export geocoded results as detailed CSV
 * @param {Array} geocodeResults - Geocoded address results
 * @returns {void}
 */
export const exportGeocodeResultsCSV = (geocodeResults) => {
  const headers = [
    'Business Name',
    'Full Address',
    'Street',
    'City',
    'State',
    'ZIP',
    'County',
    'Latitude',
    'Longitude',
    'Accuracy'
  ];

  const rows = [headers.join(',')];

  geocodeResults.forEach(result => {
    const row = [
      escapeCSVValue(result.businessName || ''),
      escapeCSVValue(result.fullAddress || ''),
      escapeCSVValue(result.street || ''),
      escapeCSVValue(result.city || ''),
      escapeCSVValue(result.state || ''),
      escapeCSVValue(result.zip || ''),
      escapeCSVValue(result.county || ''),
      result.lat || '',
      result.lng || '',
      result.accuracy != null ? (result.accuracy * 100).toFixed(2) + '%' : ''
    ];
    rows.push(row.join(','));
  });

  const csv = rows.join('\n');

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const filename = `geocoded_addresses_${geocodeResults.length}rows_${timestamp}.csv`;

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Copy geocoded results to clipboard
 * @param {Array} geocodeResults - Geocoded address results
 * @returns {Promise<boolean>}
 */
export const copyGeocodeResultsToClipboard = async (geocodeResults) => {
  const lines = [];

  geocodeResults.forEach(result => {
    const parts = [];
    if (result.businessName) parts.push(result.businessName);
    parts.push(result.fullAddress || `${result.street || ''}, ${result.city || ''}, ${result.state || ''} ${result.zip || ''}`);
    if (result.lat && result.lng) parts.push(`(${result.lat.toFixed(6)}, ${result.lng.toFixed(6)})`);
    lines.push(parts.join(' - '));
  });

  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

/**
 * Escape CSV value (handle commas, quotes, newlines)
 * @param {string} value - Value to escape
 * @returns {string} - Escaped value
 */
function escapeCSVValue(value) {
  if (value == null) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
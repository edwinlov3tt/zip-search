/**
 * Parse CSV content into array of objects
 * @param {string} csvContent - Raw CSV content
 * @param {Object} options - Parsing options
 * @returns {Object} - { headers, data }
 */
export const parseCSV = (csvContent, options = {}) => {
  const { delimiter = ',', skipEmpty = true } = options;
  const lines = csvContent.split(/\r?\n/);

  if (lines.length === 0) {
    return { headers: [], data: [] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0], delimiter);

  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (skipEmpty && !lines[i].trim()) continue;

    const values = parseCSVLine(lines[i], delimiter);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return { headers, data };
};

/**
 * Parse a single CSV line handling quoted values
 * @param {string} line - CSV line
 * @param {string} delimiter - Delimiter character
 * @returns {Array} - Array of values
 */
export const parseCSVLine = (line, delimiter = ',') => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

/**
 * Detect column types from sample data
 * @param {Array} data - Sample data rows
 * @param {Array} headers - Column headers
 * @param {boolean} isGeocodeMode - Whether detecting for geocoding (vs location search)
 * @returns {Object} - Mapping of headers to detected types
 */
export const detectColumnTypes = (data, headers, isGeocodeMode = false) => {
  const mapping = {};

  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();

    if (isGeocodeMode) {
      // Geocode mode: Detect address-related fields
      if (lowerHeader.includes('business') || lowerHeader.includes('name') || lowerHeader.includes('company')) {
        mapping[header] = 'businessName';
      } else if (lowerHeader.includes('address') && !lowerHeader.includes('street')) {
        // Full address field (not specifically street)
        mapping[header] = 'fullAddress';
      } else if (lowerHeader.includes('street') || lowerHeader.includes('address')) {
        mapping[header] = 'street';
      } else if (lowerHeader.includes('city') || lowerHeader.includes('town')) {
        mapping[header] = 'city';
      } else if (lowerHeader.includes('state') || lowerHeader.includes('province')) {
        mapping[header] = 'state';
      } else if (lowerHeader.includes('zip') || lowerHeader.includes('postal')) {
        mapping[header] = 'zip';
      } else if (lowerHeader.includes('county')) {
        mapping[header] = 'county';
      } else {
        // Try to detect from data
        const sampleValues = data.slice(0, 5).map(row => row[header]).filter(Boolean);

        if (sampleValues.some(val => /^\d{5}(-\d{4})?$/.test(val))) {
          mapping[header] = 'zip';
        } else if (sampleValues.some(val => /^[A-Z]{2}$/.test(val))) {
          mapping[header] = 'state';
        } else {
          mapping[header] = 'ignore';
        }
      }
    } else {
      // Location search mode: Original detection logic
      if (lowerHeader.includes('zip') || lowerHeader.includes('postal')) {
        mapping[header] = 'zipcode';
      } else if (lowerHeader.includes('city') || lowerHeader.includes('town')) {
        mapping[header] = 'city';
      } else if (lowerHeader.includes('county')) {
        mapping[header] = 'county';
      } else if (lowerHeader.includes('state') || lowerHeader.includes('province')) {
        mapping[header] = 'state';
      } else {
        // Try to detect from data
        const sampleValues = data.slice(0, 5).map(row => row[header]).filter(Boolean);

        if (sampleValues.some(val => /^\d{5}(-\d{4})?$/.test(val))) {
          mapping[header] = 'zipcode';
        } else if (sampleValues.some(val => /^[A-Z]{2}$/.test(val))) {
          mapping[header] = 'state';
        } else {
          mapping[header] = 'ignore';
        }
      }
    }
  });

  return mapping;
};

/**
 * Validate CSV data for required fields
 * @param {Array} data - CSV data
 * @param {Object} columnMapping - Column mapping
 * @returns {Object} - { isValid, errors }
 */
export const validateCSVData = (data, columnMapping) => {
  const errors = [];
  let isValid = true;

  // Check if at least one column is mapped
  const mappedColumns = Object.values(columnMapping).filter(v => v !== 'ignore');
  if (mappedColumns.length === 0) {
    errors.push('No columns mapped to data fields');
    isValid = false;
  }

  // Check for required combinations
  const hasZip = Object.values(columnMapping).includes('zipcode');
  const hasCity = Object.values(columnMapping).includes('city');
  const hasState = Object.values(columnMapping).includes('state');

  if (!hasZip && !(hasCity && hasState)) {
    errors.push('Must have either ZIP codes or City + State combinations');
    isValid = false;
  }

  // Validate data rows
  if (data.length === 0) {
    errors.push('No data rows found');
    isValid = false;
  } else if (data.length > 10000) {
    errors.push('Too many rows (maximum 10,000)');
    isValid = false;
  }

  return { isValid, errors };
};

/**
 * Convert CSV data to search format
 * @param {Array} data - CSV data
 * @param {Object} columnMapping - Column mapping
 * @returns {Array} - Array of search locations
 */
export const csvToSearchFormat = (data, columnMapping) => {
  const locations = [];

  // Create reverse mapping (value -> header)
  const reverseMapping = {};
  Object.entries(columnMapping).forEach(([header, type]) => {
    if (type !== 'ignore') {
      reverseMapping[type] = header;
    }
  });

  data.forEach((row, index) => {
    const location = { id: index };

    if (reverseMapping.zipcode) {
      location.zipCode = row[reverseMapping.zipcode];
    }
    if (reverseMapping.city) {
      location.city = row[reverseMapping.city];
    }
    if (reverseMapping.state) {
      location.state = row[reverseMapping.state];
    }
    if (reverseMapping.county) {
      location.county = row[reverseMapping.county];
    }

    // Only add if has valid data
    if (location.zipCode || (location.city && location.state)) {
      locations.push(location);
    }
  });

  return locations;
};

/**
 * Generate sample CSV content
 * @param {string} type - Type of sample (zips, cities, etc.)
 * @returns {string} - Sample CSV content
 */
export const generateSampleCSV = (type) => {
  const samples = {
    zips: 'ZIP Code\n10001\n10002\n10003\n10004\n10005',
    cities: 'City,State\nNew York,NY\nLos Angeles,CA\nChicago,IL\nHouston,TX\nPhoenix,AZ',
    mixed: 'Location,Type\n10001,ZIP\nNew York NY,City\nCook County IL,County'
  };

  return samples[type] || samples.zips;
};
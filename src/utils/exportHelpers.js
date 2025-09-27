/**
 * Export data as CSV with minimal columns
 * @param {Array} data - The data to export
 * @param {string} activeTab - Current active tab type
 * @returns {void}
 */
export const exportSimpleCsv = (data, activeTab) => {
  const deduped = dedupeAndSort(data, activeTab);

  let csv = '';

  // Create CSV based on tab type
  if (activeTab === 'zips') {
    csv = deduped.map(item => item.zipCode).join('\n');
  } else if (activeTab === 'cities') {
    csv = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
  } else if (activeTab === 'counties') {
    csv = deduped.map(item => `${item.name} County, ${item.state}`).join('\n');
  } else if (activeTab === 'states') {
    csv = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
  }

  // Create and download the file
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${activeTab}-export.csv`;
  link.click();
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
 * @param {string} activeTab - Current active tab type
 * @returns {Array} - Deduplicated and sorted data
 */
export const dedupeAndSort = (data, activeTab) => {
  const seen = new Set();
  const deduped = data.filter(item => {
    let key;
    if (activeTab === 'zips') {
      key = item.zipCode;
    } else if (activeTab === 'cities') {
      key = `${item.name}|${item.state}`;
    } else if (activeTab === 'counties') {
      key = `${item.name}|${item.state}`;
    } else if (activeTab === 'states') {
      key = item.state || item.name;
    } else {
      key = item.id;
    }

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort alphabetically based on primary field
  return deduped.sort((a, b) => {
    let aVal, bVal;
    if (activeTab === 'zips') {
      aVal = a.zipCode;
      bVal = b.zipCode;
    } else {
      aVal = a.name;
      bVal = b.name;
    }
    return String(aVal || '').localeCompare(String(bVal || ''));
  });
};

/**
 * Generate CSV content from data and columns
 * @param {Array} data - The data to export
 * @param {Array} columns - Column definitions
 * @param {boolean} includeHeader - Whether to include header row
 * @param {string} delimiter - CSV delimiter
 * @returns {string} - CSV content
 */
export const generateCSV = (data, columns, includeHeader = true, delimiter = ',') => {
  const lines = [];

  if (includeHeader) {
    lines.push(columns.map(col => col.label || col).join(delimiter));
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
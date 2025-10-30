import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useMap } from '../../contexts/MapContext';

const CustomExportModal = ({ isOpen, onClose, data, activeTab, isDarkMode, allData }) => {
  const [preset, setPreset] = useState('minimal');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [sortBy, setSortBy] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [filename, setFilename] = useState('');
  const [selectedSearches, setSelectedSearches] = useState('all');

  // Import hooks to access search history and settings
  const { radiusSearches, activeRadiusSearchId } = useSearch() || {};
  const { showCombinedResults } = useMap() || {};

  // All available columns for export - varies by tab type
  const allAvailableColumns = activeTab === 'streets'
    ? ['fullAddress', 'housenumber', 'street', 'unit', 'city', 'state', 'postcode', 'lat', 'lng', 'searchName']
    : ['zipCode', 'city', 'county', 'state', 'lat', 'lng', 'area', 'overlap', 'searchName'];

  // Column headers mapping for CSV export
  const columnHeaderMap = {
    zipCode: 'zipcode',
    city: 'city',
    county: 'county',
    state: 'state',
    lat: 'latitude',
    lng: 'longitude',
    area: 'area',
    overlap: 'overlap',
    searchName: 'Search Name',
    fullAddress: 'Full Address',
    housenumber: 'House Number',
    street: 'Street',
    unit: 'Unit',
    postcode: 'ZIP'
  };

  // Initialize selected searches based on combined results setting
  useEffect(() => {
    if (showCombinedResults) {
      setSelectedSearches('all');
    } else if (activeRadiusSearchId) {
      setSelectedSearches(activeRadiusSearchId);
    }
  }, [showCombinedResults, activeRadiusSearchId]);

  // Get the combined data to export - merge all data types
  const getExportData = () => {
    // If we have allData, combine all results into a unified dataset
    if (allData) {
      const combined = [];

      // Handle streets (addresses) differently from zips
      if (activeTab === 'streets') {
        let dataToExport = allData.addresses || data || [];

        // Filter by selected searches if applicable
        if (selectedSearches !== 'all' && dataToExport.length > 0) {
          dataToExport = dataToExport.filter(item => {
            if (item.searchIds && item.searchIds.includes(selectedSearches)) {
              return true;
            }
            return false;
          });
        }

        // Add address data with computed fullAddress field
        dataToExport.forEach(item => {
          // Build full address string
          const addressParts = [];
          if (item.housenumber) addressParts.push(item.housenumber);
          if (item.street) addressParts.push(item.street);
          if (item.unit) addressParts.push(`Unit ${item.unit}`);

          const streetAddress = addressParts.join(' ');
          const cityStateZip = [
            item.city || '',
            item.state || '',
            item.postcode || ''
          ].filter(Boolean).join(' ');

          const fullAddress = `${streetAddress}, ${cityStateZip}`;

          // Find the search name
          let searchName = '';
          if (item.searchIds && item.searchIds.length > 0) {
            const search = radiusSearches?.find(s => s.id === item.searchIds[0]);
            if (search) {
              searchName = search.display || search.location || `Search ${search.sequence}`;
            }
          }

          combined.push({
            fullAddress,
            housenumber: item.housenumber || '',
            street: item.street || '',
            unit: item.unit || '',
            city: item.city || '',
            state: item.state || '',
            postcode: item.postcode || '',
            lat: item.lat || '',
            lng: item.lng || '',
            searchName
          });
        });
      } else {
        // Handle ZIP data
        let dataToExport = allData.zips || [];

        // If we have search metadata and specific searches selected
        if (selectedSearches !== 'all' && dataToExport.length > 0) {
          dataToExport = dataToExport.filter(item => {
            // Check if item belongs to selected search
            if (item.searchIds && item.searchIds.includes(selectedSearches)) {
              return true;
            }
            // If no searchIds, include it only if 'all' is selected
            return false;
          });
        }

        // Add ZIP data with all fields
        dataToExport.forEach(item => {
          // Find the search name for this item
          let searchName = '';
          if (item.searchIds && item.searchIds.length > 0 && radiusSearches) {
            const search = radiusSearches.find(s => s.id === item.searchIds[0]);
            if (search) {
              searchName = search.display || search.location || `Search ${search.sequence}`;
            }
          }

          combined.push({
            zipCode: item.zipCode,
            city: item.city,
            county: item.county,
            state: item.state,
            lat: item.lat,
            lng: item.lng,
            area: item.area || '',
            overlap: item.overlap || '',
            searchName: searchName
          });
        });
      }

      return combined;
    }
    // Fallback to current data if allData not available
    // For streets, compute fullAddress for the data if not present
    if (activeTab === 'streets' && data) {
      return data.map(item => {
        // Build full address if not already present
        if (!item.fullAddress) {
          const addressParts = [];
          if (item.housenumber) addressParts.push(item.housenumber);
          if (item.street) addressParts.push(item.street);
          if (item.unit) addressParts.push(`Unit ${item.unit}`);

          const streetAddress = addressParts.join(' ');
          const cityStateZip = [
            item.city || '',
            item.state || '',
            item.postcode || ''
          ].filter(Boolean).join(' ');

          item.fullAddress = `${streetAddress}, ${cityStateZip}`;
        }
        return item;
      });
    }
    return data;
  };

  const minimalColumns = {
    zips: ['zipCode'],
    cities: ['city', 'state'],
    counties: ['county', 'state'],
    states: ['state'],
    streets: ['fullAddress']
  };

  const presets = {
    minimal: { name: 'Minimal (recommended)', description: 'Essential fields only' },
    all: { name: 'All fields', description: 'Include all available data' },
    meta: { name: 'Meta Ads', description: 'City + State, no header' },
    google: { name: 'Google Ads', description: 'ZIP, City, State format' },
    last: { name: 'Last used', description: 'Your previous selection' }
  };

  // Initialize columns based on preset and activeTab
  useEffect(() => {
    let cols = [];
    switch (preset) {
      case 'minimal':
        cols = minimalColumns[activeTab] || [];
        setIncludeHeader(true);
        break;
      case 'all':
        cols = allAvailableColumns;
        setIncludeHeader(true);
        break;
      case 'meta':
        // Meta Ads preset: City + State, no header
        cols = ['city', 'state'];
        setIncludeHeader(false);
        break;
      case 'google':
        // Google Ads preset: ZIP, City, State format
        cols = ['zipCode', 'city', 'state'];
        setIncludeHeader(true);
        break;
      case 'last':
        const saved = localStorage.getItem(`exportColumns_${activeTab}`);
        cols = saved ? JSON.parse(saved) : minimalColumns[activeTab];
        break;
      default:
        cols = minimalColumns[activeTab] || [];
    }
    setSelectedColumns(cols);
    setSortBy(cols[0] || '');
  }, [preset, activeTab]);

  // Generate filename
  useEffect(() => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const exportData = getExportData();
    const count = exportData.length;
    setFilename(`${activeTab}_${count}rows_${timestamp}.csv`);
  }, [activeTab, data, allData]);

  const handleColumnToggle = (column) => {
    setSelectedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(allAvailableColumns);
  };

  const handleSelectNone = () => {
    setSelectedColumns([]);
  };

  const processData = (data, sortField, dedupe) => {
    let processed = [...data];

    // Deduplicate based on appropriate field for the tab type
    if (dedupe) {
      const seen = new Set();
      processed = processed.filter(item => {
        let key;
        if (activeTab === 'streets') {
          // For addresses, create composite key from all address fields
          key = `${item.housenumber || ''}|${item.street || ''}|${item.unit || ''}|${item.city || ''}|${item.state || ''}|${item.postcode || ''}`;
        } else {
          // For other tabs, use zipCode
          key = item.zipCode;
        }
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Sort
    if (sortField) {
      processed.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        return String(aVal || '').localeCompare(String(bVal || ''));
      });
    }

    return processed;
  };

  const generateCSV = (data, columns, includeHeader, delimiter) => {
    const lines = [];

    if (includeHeader) {
      // Use mapped headers for CSV export
      const headers = columns.map(col => columnHeaderMap[col] || col);
      lines.push(headers.join(delimiter));
    }

    for (const item of data) {
      const row = columns.map(col => {
        let value = item[col] || '';
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

  const handleDownload = () => {
    const exportData = getExportData();
    const processed = processData(exportData, sortBy, deduplicate);
    const csv = generateCSV(processed, selectedColumns, includeHeader, delimiter);

    // Save user preferences
    localStorage.setItem(`exportColumns_${activeTab}`, JSON.stringify(selectedColumns));
    localStorage.setItem('exportSettings', JSON.stringify({
      includeHeader,
      delimiter,
      deduplicate
    }));

    // Download main file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Removed alsoExportAll functionality - now handled by data source selection

    onClose();
  };

  if (!isOpen) return null;

  const exportData = getExportData();
  const processed = processData(exportData, sortBy, deduplicate);
  const previewData = processed.slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Custom Export</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Current tab: {activeTab} · {getExportData().length} rows available
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Search Selection - Only show if multiple searches exist */}
          {radiusSearches && radiusSearches.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2">Searches to Include</label>
              <select
                value={selectedSearches}
                onChange={(e) => setSelectedSearches(e.target.value)}
                className={`w-full p-2 border rounded ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300'
                }`}
              >
                <option value="all">Combine All Searches</option>
                {radiusSearches.map(search => (
                  <option key={search.id} value={search.id}>
                    {search.display || search.location || `Search ${search.sequence}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Presets */}
          <div>
            <label className="block text-sm font-medium mb-2">Export Preset</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className={`w-full p-2 border rounded ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300'
              }`}
            >
              {Object.entries(presets).map(([key, { name, description }]) => (
                <option key={key} value={key}>{name} - {description}</option>
              ))}
            </select>
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Columns</label>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {allAvailableColumns.map(column => (
                <label key={column} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleColumnToggle(column)}
                    className="rounded"
                  />
                  <span className="text-sm">{column}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Options */}
          <details className={`border rounded p-4 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <summary className="cursor-pointer font-medium">Advanced Options</summary>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Delimiter</label>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value=",">Comma</option>
                  <option value="\t">Tab</option>
                  <option value=";">Semicolon</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="">No sorting</option>
                  {selectedColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Include header row</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={(e) => setDeduplicate(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Remove duplicates</span>
              </label>
            </div>
          </details>

          {/* Filename */}
          <div>
            <label className="block text-sm font-medium mb-2">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className={`w-full p-2 border rounded ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300'
              }`}
            />
          </div>

          {/* Preview */}
          {selectedColumns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Preview (first 10 rows)</h3>
              <div className="overflow-x-auto border rounded">
                <table className={`w-full text-xs ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  {includeHeader && (
                    <thead>
                      <tr>
                        {selectedColumns.map(col => (
                          <th key={col} className="px-2 py-1 text-left border-b">{col}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {previewData.map((item, idx) => (
                      <tr key={idx}>
                        {selectedColumns.map(col => (
                          <td key={col} className="px-2 py-1 border-b">
                            {item[col] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} flex justify-end space-x-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded ${
              isDarkMode
                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedColumns.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomExportModal;
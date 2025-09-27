import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CustomExportModal = ({ isOpen, onClose, data, activeTab, isDarkMode }) => {
  const [preset, setPreset] = useState('minimal');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [sortBy, setSortBy] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [filename, setFilename] = useState('');
  const [alsoExportAll, setAlsoExportAll] = useState(false);

  // Define all available columns for each tab
  const schemaByTab = {
    zips: ['zipCode', 'city', 'county', 'state', 'lat', 'lng', 'area', 'overlap'],
    cities: ['name', 'state', 'county', 'lat', 'lng'],
    counties: ['name', 'state', 'lat', 'lng'],
    states: ['name', 'state', 'lat', 'lng']
  };

  const minimalColumns = {
    zips: ['zipCode'],
    cities: ['name', 'state'],
    counties: ['name', 'state'],
    states: ['name', 'state']
  };

  const presets = {
    minimal: { name: 'Minimal (recommended)', description: 'Essential fields only' },
    all: { name: 'All fields', description: 'Include all available data' },
    meta: { name: 'Meta Ads', description: 'ZIP codes only, no header' },
    google: { name: 'Google Ads', description: 'City + State format' },
    last: { name: 'Last used', description: 'Your previous selection' }
  };

  // Initialize columns based on preset
  useEffect(() => {
    let cols = [];
    switch (preset) {
      case 'minimal':
        cols = minimalColumns[activeTab] || [];
        setIncludeHeader(true);
        break;
      case 'all':
        cols = schemaByTab[activeTab] || [];
        setIncludeHeader(true);
        break;
      case 'meta':
        cols = activeTab === 'zips' ? ['zipCode'] : minimalColumns[activeTab];
        setIncludeHeader(false);
        break;
      case 'google':
        cols = activeTab === 'cities' ? ['name', 'state'] : minimalColumns[activeTab];
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
    const count = data.length;
    setFilename(`${activeTab}_${count}rows_${timestamp}.csv`);
  }, [activeTab, data]);

  const handleColumnToggle = (column) => {
    setSelectedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(schemaByTab[activeTab] || []);
  };

  const handleSelectNone = () => {
    setSelectedColumns([]);
  };

  const processData = (data, sortField, dedupe) => {
    let processed = [...data];

    // Deduplicate
    if (dedupe) {
      const seen = new Set();
      processed = processed.filter(item => {
        let key;
        switch (activeTab) {
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
          default:
            key = item.id;
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
      lines.push(columns.join(delimiter));
    }

    for (const item of data) {
      const row = columns.map(col => {
        let value = item[col] || '';
        // Special formatting for some columns
        if (col === 'name' && activeTab === 'counties' && !value.toLowerCase().includes('county')) {
          value = `${value} County`;
        }
        if (col === 'state' && (activeTab === 'cities' || activeTab === 'counties') && columns.includes('name')) {
          return value; // Just state code for name,state combinations
        }
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
    const processed = processData(data, sortBy, deduplicate);
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

    // Download all fields file if requested
    if (alsoExportAll) {
      const allColumns = schemaByTab[activeTab] || [];
      const allCsv = generateCSV(processed, allColumns, includeHeader, delimiter);
      const allBlob = new Blob([allCsv], { type: 'text/csv' });
      const allUrl = URL.createObjectURL(allBlob);
      const allA = document.createElement('a');
      allA.href = allUrl;
      allA.download = filename.replace('.csv', '_all.csv');
      allA.click();
      URL.revokeObjectURL(allUrl);
    }

    onClose();
  };

  if (!isOpen) return null;

  const processed = processData(data, sortBy, deduplicate);
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
            Selection: {activeTab} · {data.length} rows
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
              {(schemaByTab[activeTab] || []).map(column => (
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
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={alsoExportAll}
                onChange={(e) => setAlsoExportAll(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Also download full dataset</span>
            </label>
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
            Download {alsoExportAll ? '(2 files)' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomExportModal;
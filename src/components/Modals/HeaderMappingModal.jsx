import React from 'react';
import { Upload } from 'lucide-react';

const HeaderMappingModal = ({
  isOpen,
  onClose,
  headers,
  previewData,
  columnMapping,
  setColumnMapping,
  onConfirm,
  isDarkMode,
  processingProgress,
  isGeocodeMode = false
}) => {

  if (!isOpen) return null;

  const handleMappingChange = (header, value) => {
    setColumnMapping(prev => ({ ...prev, [header]: value }));
  };

  // Check if at least one column is mapped to something other than 'ignore'
  const hasValidMapping = Object.values(columnMapping).some(value => value !== 'ignore');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className={`p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto shadow-2xl ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2" />
          Map CSV Columns to Data Types
        </h3>

        <p className={`mb-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Please map each column from your CSV to the appropriate data type. We've pre-selected options based on column names where possible.
        </p>

        {/* Column Mapping */}
        <div className="space-y-3 mb-6">
          <div className={`grid grid-cols-3 gap-4 pb-3 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <div className="font-medium">Column Name</div>
            <div className="font-medium">Sample Data</div>
            <div className="font-medium">Map To</div>
          </div>

          {headers.map((header, index) => (
            <div key={header} className={`grid grid-cols-3 gap-4 items-center py-2 ${index % 2 === 1 ? (isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50') : ''}`}>
              <div className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                {header}
              </div>

              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                {previewData[0] && previewData[0][header] ? (
                  <span title={previewData[0][header]}>{previewData[0][header]}</span>
                ) : (
                  <span className="italic">Empty</span>
                )}
              </div>

              <select
                value={columnMapping[header] || 'ignore'}
                onChange={(e) => handleMappingChange(header, e.target.value)}
                className={`px-3 py-2 rounded border ${
                  columnMapping[header] !== 'ignore'
                    ? 'border-red-500 font-medium'
                    : ''
                } ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="ignore">Do Not Include</option>
                {isGeocodeMode ? (
                  <>
                    <option value="businessName">Business Name</option>
                    <option value="fullAddress">Full Address</option>
                    <option value="street">Street Address</option>
                    <option value="city">City</option>
                    <option value="state">State</option>
                    <option value="zip">ZIP Code</option>
                    <option value="county">County</option>
                  </>
                ) : (
                  <>
                    <option value="zip">ZIP Code</option>
                    <option value="city">City</option>
                    <option value="state">State</option>
                    <option value="county">County</option>
                    <option value="general">General Search</option>
                  </>
                )}
              </select>
            </div>
          ))}
        </div>

        {/* Data Preview */}
        {previewData.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Preview of First 5 Rows</h4>
            <div className={`overflow-x-auto border rounded ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <table className={`w-full text-xs ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <thead>
                  <tr className={isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}>
                    {headers.filter(h => columnMapping[h] !== 'ignore').map(header => (
                      <th key={header} className="px-2 py-1 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? (isDarkMode ? 'bg-gray-800' : 'bg-white') : ''}>
                      {headers.filter(h => columnMapping[h] !== 'ignore').map(header => (
                        <td key={header} className="px-2 py-1">{row[header] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {processingProgress?.total > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Processing...</span>
              <span>{processingProgress.current} / {processingProgress.total}</span>
            </div>
            <div className={`w-full h-2 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
              <div
                className="h-2 bg-red-600 rounded transition-all duration-300"
                style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {previewData.length} rows detected
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded transition-colors ${
                isDarkMode
                  ? 'bg-gray-600 hover:bg-gray-700 text-white'
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!hasValidMapping}
              className={`px-4 py-2 rounded transition-colors ${
                hasValidMapping
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
            >
              Process File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderMappingModal;
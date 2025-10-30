import React from 'react';
import { ArrowUpDown, X } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useResults } from '../../contexts/ResultsContext';

const GeocodeResultsTable = ({
  data,
  handleSort,
  handleResultSelect,
  handleResultDoubleClick,
  isResultSelected
}) => {
  const { isDarkMode } = useUI();
  const { removeGeocodeResult } = useResults();

  const columns = [
    { key: 'businessName', label: 'Business Name' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'zip', label: 'ZIP' },
    { key: 'county', label: 'County' },
    { key: 'lat', label: 'Latitude' },
    { key: 'lng', label: 'Longitude' },
    { key: 'accuracy', label: 'Accuracy' }
  ];

  const renderCellValue = (result, key) => {
    // Handle special cases
    if (key === 'lat' || key === 'latitude') {
      return result.lat ? result.lat.toFixed(6) : 'N/A';
    }
    if (key === 'lng' || key === 'longitude') {
      return result.lng ? result.lng.toFixed(6) : 'N/A';
    }
    if (key === 'accuracy') {
      if (result.accuracy != null) {
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            result.accuracy >= 0.9
              ? isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
              : result.accuracy >= 0.7
              ? isDarkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-700'
              : isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-700'
          }`}>
            {(result.accuracy * 100).toFixed(0)}%
          </span>
        );
      }
      return '-';
    }

    // Return value or empty string
    const value = result[key];
    return value != null && value !== '' ? value : '-';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <tr>
            <th className="px-2 py-2 w-8"></th>
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-2 text-left font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  isDarkMode
                    ? 'text-gray-300 hover:bg-gray-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center space-x-1">
                  <span>{col.label}</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-8 text-center">
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No geocoded addresses yet. Upload a CSV file to get started.
                </span>
              </td>
            </tr>
          ) : (
            data.map(result => (
              <tr
                key={result.id}
                data-result-id={`geocode-${result.id}`}
                onClick={() => handleResultSelect?.('geocode', result)}
                onDoubleClick={() => handleResultDoubleClick?.('geocode', result)}
                className={`transition-colors cursor-pointer ${
                  isResultSelected?.('geocode', result.id)
                    ? isDarkMode
                      ? 'bg-red-800/40 border-y border-red-400'
                      : 'bg-red-100 border-y border-red-300'
                    : isDarkMode
                      ? 'border-b border-gray-600 hover:bg-gray-700'
                      : 'border-b border-gray-100 hover:bg-gray-50'
                }`}
              >
                <td className="px-2 py-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent row click when removing
                      removeGeocodeResult(result);
                    }}
                    className={`p-1 transition-colors ${
                      isDarkMode
                        ? 'text-red-400 hover:text-red-300'
                        : 'text-red-500 hover:text-red-700'
                    }`}
                    title="Remove geocoded address"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </td>
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    {renderCellValue(result, col.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GeocodeResultsTable;

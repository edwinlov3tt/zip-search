import React from 'react';
import { ArrowUpDown, X } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useResults } from '../../contexts/ResultsContext';
import { useSearch } from '../../contexts/SearchContext';

const StreetsTable = ({
  data,
  handleSort,
  handleResultSelect,
  handleResultDoubleClick,
  isResultSelected
}) => {
  const { isDarkMode } = useUI();
  const { removeItem } = useResults();
  const { activeAddressSearchId, setActiveAddressSearchId, addressSearches } = useSearch();

  // Define columns for addresses table
  const columns = [
    { key: 'housenumber', label: 'House #' },
    { key: 'street', label: 'Street' },
    { key: 'unit', label: 'Unit' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'postcode', label: 'ZIP' },
    { key: 'lat', label: 'Latitude' },
    { key: 'lng', label: 'Longitude' },
    { key: 'searchSequences', label: 'Search' }
  ];

  const renderCellValue = (result, key) => {
    if (key === 'searchSequences') {
      const sequences = result.searchSequences || [];
      const searchIds = result.searchIds || [];
      if (sequences.length === 0) {
        return <span className="text-xs text-gray-400">-</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {sequences.map((seq, index) => {
            // Get the corresponding search ID for this sequence
            const searchId = searchIds[index];
            const isActive = searchId === activeAddressSearchId;

            return (
              <span
                key={seq}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row selection
                  if (searchId && setActiveAddressSearchId) {
                    setActiveAddressSearchId(searchId);
                  }
                }}
                className={`inline-flex items-center justify-center min-w-[1.5rem] px-1 py-0.5 rounded border text-[11px] font-semibold cursor-pointer transition-all ${
                  isActive
                    ? isDarkMode
                      ? 'border-red-400 bg-red-900/40 text-red-200'
                      : 'border-red-500 bg-red-50 text-red-600'
                    : isDarkMode
                      ? 'border-gray-500 bg-gray-700/40 text-gray-400 hover:border-gray-400 hover:text-gray-300'
                      : 'border-gray-400 bg-gray-100 text-gray-500 hover:border-gray-500 hover:text-gray-600'
                }`}
                title={`Search ${seq}${isActive ? ' (active)' : ' (click to activate)'}`}
              >
                {seq}
              </span>
            );
          })}
        </div>
      );
    }

    // Handle unit field - show dash if empty
    if (key === 'unit') {
      return result[key] || '-';
    }

    // Handle lat/lng with proper formatting
    if (key === 'lat' || key === 'lng') {
      const value = result[key];
      if (value == null) return '-';
      return typeof value === 'number' ? value.toFixed(6) : value;
    }

    return result[key] || '';
  };

  return (
    <table className="w-full text-sm">
      <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <tr>
          <th className="px-2 py-2 w-8"></th>
          {columns.map(col => (
            <th
              key={col.key}
              className={`px-4 py-2 text-left font-medium cursor-pointer transition-colors ${
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
        {data.map(result => (
          <tr
            key={result.id}
            data-result-id={`address-${result.id}`}
            onClick={() => handleResultSelect('address', result)}
            onDoubleClick={() => handleResultDoubleClick('address', result)}
            className={`transition-colors cursor-pointer ${
              isResultSelected('address', result.id)
                ? isDarkMode
                  ? 'bg-red-800/40 border-y border-red-400'
                  : 'bg-red-100 border-y border-red-300'
                : isDarkMode
                  ? 'border-b border-gray-600 hover:bg-gray-700'
                  : 'border-b border-gray-100 hover:bg-gray-50'
            }`}>
            <td className="px-2 py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row click when removing
                  removeItem('address', result);
                }}
                className="text-red-500 hover:text-red-700 p-1"
                title="Remove Address"
              >
                <X className="h-3 w-3" />
              </button>
            </td>
            {columns.map(col => (
              <td
                key={col.key}
                className={`px-4 py-2 ${
                  col.key === 'housenumber'
                    ? `font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`
                    : `${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`
                }`}
              >
                {renderCellValue(result, col.key)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default StreetsTable;

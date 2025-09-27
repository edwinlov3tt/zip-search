import React from 'react';
import { ArrowUpDown, X } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useResults } from '../../contexts/ResultsContext';

const ResultsTable = ({
  activeTab,
  data,
  handleSort,
  handleResultSelect,
  handleResultDoubleClick,
  isResultSelected
}) => {
  const { isDarkMode } = useUI();
  const { removeItem } = useResults();

  // Define columns for each tab type
  const getColumns = () => {
    switch (activeTab) {
      case 'zips':
        return [
          { key: 'zipCode', label: 'ZIP Code' },
          { key: 'city', label: 'City' },
          { key: 'county', label: 'County' },
          { key: 'state', label: 'State' },
          { key: 'lat', label: 'Latitude' },
          { key: 'lng', label: 'Longitude' },
          { key: 'area', label: 'Area (sq mi)' },
          { key: 'overlap', label: 'Overlap %' }
        ];
      case 'cities':
        return [
          { key: 'name', label: 'City Name' },
          { key: 'state', label: 'State' },
          { key: 'county', label: 'County' },
          { key: 'lat', label: 'Latitude' },
          { key: 'lng', label: 'Longitude' }
        ];
      case 'counties':
        return [
          { key: 'name', label: 'County Name' },
          { key: 'state', label: 'State' },
          { key: 'lat', label: 'Latitude' },
          { key: 'lng', label: 'Longitude' }
        ];
      case 'states':
        return [
          { key: 'name', label: 'State Name' },
          { key: 'state', label: 'Code' },
          { key: 'lat', label: 'Latitude' },
          { key: 'lng', label: 'Longitude' }
        ];
      default:
        return [];
    }
  };

  const columns = getColumns();

  const getRemoveTooltip = () => {
    switch (activeTab) {
      case 'states':
        return 'Remove State (and all counties, cities, ZIPs in state)';
      case 'counties':
        return 'Remove County (and all cities, ZIPs in county)';
      case 'cities':
        return 'Remove City (and all ZIPs in city)';
      case 'zips':
        return 'Remove ZIP';
      default:
        return 'Remove';
    }
  };

  const renderCellValue = (result, key) => {
    // Handle special cases
    if (key === 'lat' || key === 'latitude') {
      return result.latitude ? result.latitude.toFixed(4) : (result.lat ? result.lat.toFixed(4) : 'N/A');
    }
    if (key === 'lng' || key === 'longitude') {
      return result.longitude ? result.longitude.toFixed(4) : (result.lng ? result.lng.toFixed(4) : 'N/A');
    }
    if (key === 'overlap') {
      return `${result[key] || 0}%`;
    }

    // For state code in states tab
    if (activeTab === 'states' && key === 'state') {
      return result.state || result.code || '';
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
            data-result-id={`${activeTab.slice(0, -1)}-${result.id}`}
            onClick={() => handleResultSelect(activeTab.slice(0, -1), result)}
            onDoubleClick={() => handleResultDoubleClick(activeTab.slice(0, -1), result)}
            className={`transition-colors cursor-pointer ${
              isResultSelected(activeTab.slice(0, -1), result.id)
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
                  removeItem(activeTab.slice(0, -1), result);
                }}
                className="text-red-500 hover:text-red-700 p-1"
                title={getRemoveTooltip()}
              >
                <X className="h-3 w-3" />
              </button>
            </td>
            {columns.map(col => (
              <td
                key={col.key}
                className={`px-4 py-2 ${
                  col.key === columns[0].key
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

export default ResultsTable;
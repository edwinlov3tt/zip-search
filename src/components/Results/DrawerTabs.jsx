import React from 'react';
import { Search, MapPin } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useSearch } from '../../contexts/SearchContext';

const DrawerTabs = ({
  filteredAddressResults,
  filteredGeocodeResults,
  filteredZipResults,
  filteredCityResults,
  filteredCountyResults,
  filteredStateResults,
  getTotalExcludedCount
}) => {
  const { activeTab, setActiveTab, isDarkMode } = useUI();
  const { radiusSearches, addressSearches, searchMode } = useSearch();

  const totalSearches = radiusSearches.length + addressSearches.length;

  // Different tab sets based on search mode
  const isGeocodeMode = searchMode === 'geocode';
  const isAddressMode = searchMode === 'address';

  const tabs = isGeocodeMode ? [
    ...(filteredGeocodeResults && filteredGeocodeResults.length > 0 ? [{ key: 'geocode', label: `Geocode Results (${filteredGeocodeResults.length})` }] : []),
    ...(getTotalExcludedCount() > 0 ? [{ key: 'excluded', label: `Excluded (${getTotalExcludedCount()})` }] : [])
  ] : isAddressMode ? [
    { key: 'streets', label: `Addresses (${filteredAddressResults.length})`, icon: MapPin, highlight: filteredAddressResults.length > 0 },
    { key: 'searches', label: `Searches (${addressSearches.length})`, icon: Search, highlight: addressSearches.length > 0 }
  ] : [
    { key: 'zips', label: `ZIPs (${filteredZipResults.length})`, highlight: filteredZipResults.length > 0 },
    { key: 'cities', label: `Cities (${filteredCityResults.length})` },
    { key: 'counties', label: `Counties (${filteredCountyResults.length})` },
    { key: 'states', label: `States (${filteredStateResults.length})` },
    { key: 'searches', label: `Searches (${totalSearches})`, icon: Search, highlight: totalSearches > 0 },
    ...(getTotalExcludedCount() > 0 ? [{ key: 'excluded', label: `Excluded (${getTotalExcludedCount()})` }] : [])
  ];

  return (
    <div className="flex space-x-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-3 py-1 text-sm rounded transition-colors flex items-center space-x-1 ${
            activeTab === tab.key
              ? 'bg-red-600 text-white'
              : isDarkMode
                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                : 'bg-white hover:bg-gray-100'
          }`}
        >
          {tab.icon && <tab.icon className="h-3 w-3" />}
          <span>{tab.key === 'searches' && tab.icon ? `(${totalSearches})` : tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DrawerTabs;
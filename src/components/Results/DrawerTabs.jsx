import React from 'react';
import { useUI } from '../../contexts/UIContext';

const DrawerTabs = ({
  filteredZipResults,
  filteredCityResults,
  filteredCountyResults,
  filteredStateResults,
  getTotalExcludedCount
}) => {
  const { activeTab, setActiveTab, isDarkMode } = useUI();

  const tabs = [
    { key: 'zips', label: `ZIPs (${filteredZipResults.length})` },
    { key: 'cities', label: `Cities (${filteredCityResults.length})` },
    { key: 'counties', label: `Counties (${filteredCountyResults.length})` },
    { key: 'states', label: `States (${filteredStateResults.length})` },
    ...(getTotalExcludedCount() > 0 ? [{ key: 'excluded', label: `Excluded (${getTotalExcludedCount()})` }] : [])
  ];

  return (
    <div className="flex space-x-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            activeTab === tab.key
              ? 'bg-red-600 text-white'
              : isDarkMode
                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                : 'bg-white hover:bg-gray-100'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default DrawerTabs;
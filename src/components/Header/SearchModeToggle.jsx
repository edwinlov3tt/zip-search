import React from 'react';

const SearchModeToggle = ({ searchMode, handleSearchModeChange, isDarkMode }) => {
  const modes = [
    { id: 'radius', label: 'Radius Search', shortLabel: 'Radius' },
    { id: 'polygon', label: 'Polygon Search', shortLabel: 'Polygon' },
    { id: 'address', label: 'Address Search', shortLabel: 'Address' },
    { id: 'hierarchy', label: 'Hierarchy Search', shortLabel: 'Hierarchy' },
    { id: 'upload', label: 'Upload Search', shortLabel: 'Upload' },
    { id: 'geocode', label: 'Geocode', shortLabel: 'Geocode' }
  ];

  return (
    <div className="lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2 w-full lg:w-auto">
      <div className={`flex ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-0.5 lg:p-1`}>
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => handleSearchModeChange(mode.id)}
            className={`flex-1 lg:flex-initial px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm rounded transition-colors ${
              searchMode === mode.id
                ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
                : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
            }`}
          >
            {/* Show full label on screens >= 1536px (2xl), short label below */}
            <span className="hidden 2xl:inline">{mode.label}</span>
            <span className="2xl:hidden">{mode.shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchModeToggle;
import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';

const RadiusSearch = ({
  handleSearch,
  handleSearchInputChange,
  handleAutocompleteBlur,
  handleAutocompleteSelect,
  handleResetSearch
}) => {
  const {
    searchTerm,
    radius,
    setRadius,
    isSearchMode,
    isLoading,
    isSearching
  } = useSearch();

  const {
    isDarkMode,
    autocompleteResults,
    showAutocomplete,
    setShowAutocomplete
  } = useUI();

  return (
    <>
      <div className="flex flex-row items-center gap-2 sm:gap-3">
        {/* Search Input - flexible width */}
        <div className="relative flex-1 sm:flex-initial">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search addresses, cities, ZIP codes..."
            value={searchTerm}
            onChange={handleSearchInputChange}
            onBlur={handleAutocompleteBlur}
            onFocus={() => searchTerm.length >= 2 && autocompleteResults.length > 0 && setShowAutocomplete(true)}
            disabled={!isSearchMode}
            className={`w-full sm:w-[320px] md:w-[380px] pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
              !isSearchMode
                ? 'bg-gray-100 text-gray-500 border-gray-300'
                : isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400'
                  : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
            }`}
            onKeyDown={(e) => e.key === 'Enter' && isSearchMode && handleSearch()}
          />

          {/* Loading indicator */}
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg shadow-lg border z-50 ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600'
                : 'bg-white border-gray-200'
            }`}>
              {autocompleteResults.map((result) => (
                <div
                  key={result.id}
                  className={`px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                    isDarkMode
                      ? 'hover:bg-gray-600 border-gray-600 text-white'
                      : 'hover:bg-gray-50 border-gray-100 text-gray-900'
                  }`}
                  onClick={() => handleAutocompleteSelect(result)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">📍</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {result.display_name || result.name}
                      </p>
                      <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {result.type ? result.type.charAt(0).toUpperCase() + result.type.slice(1) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Integrated Radius Input with embedded "miles" */}
        <div className={`relative ${isSearchMode ? 'animate-pulse' : ''}`}>
          <input
            type="number"
            min="1"
            max="100"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            disabled={!isSearchMode}
            className={`w-full sm:w-28 pl-3 pr-12 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center font-medium ${
              !isSearchMode
                ? 'bg-gray-100 text-gray-500 border-gray-300'
                : isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-white text-gray-900 border-gray-300'
            }`}
            style={{ paddingRight: '3rem' }}
          />
          <span className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-sm pointer-events-none ${
            !isSearchMode
              ? 'text-gray-400'
              : isDarkMode
                ? 'text-gray-400'
                : 'text-gray-500'
          }`}>
            miles
          </span>
        </div>

        {/* Search/Reset Button - on same row */}
        <button
          onClick={isSearchMode ? handleSearch : handleResetSearch}
          disabled={isLoading}
          className={`py-2 px-4 sm:px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors whitespace-nowrap ${
            isSearchMode
              ? 'bg-red-600 text-white hover:bg-red-700'
              : isDarkMode
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : isSearchMode ? (
            <Search className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{isLoading ? 'Searching...' : isSearchMode ? 'Search' : 'Reset'}</span>
        </button>
      </div>

      {/* Instructions in separate row below */}
      {isSearchMode && (
        <div className="w-full">
          <div className={`text-xs text-center px-3 py-2 rounded ${
            isDarkMode
              ? 'text-gray-400 bg-gray-700/50 border border-gray-600'
              : 'text-gray-600 bg-gray-50 border border-gray-200'
          }`}>
            Set your search radius in miles, then click on the map to place the center point or use the search bar above
          </div>
        </div>
      )}
    </>
  );
};

export default RadiusSearch;
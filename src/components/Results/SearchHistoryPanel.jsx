import React, { useState } from 'react';
import { MapPin, Eye, EyeOff, Trash2, Target, Map, Grid3X3, Maximize, Copy, FileDown, ChevronDown } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';
import { useMap } from '../../contexts/MapContext';
import { useResults } from '../../contexts/ResultsContext';

const SearchHistoryPanel = () => {
  const {
    radiusSearches,
    activeRadiusSearchId,
    removeRadiusSearch,
    updateRadiusSearchSettings,
    executeRadiusSearchFromHistory,
    addressSearches,
    activeAddressSearchId,
    removeAddressSearch,
    updateAddressSearchSettings,
    executeAddressSearchFromHistory,
    searchMode,
    isSearchExcluded,
    toggleSearchExclusion
  } = useSearch();

  const { isDarkMode, showToast } = useUI();
  const { setMapCenter, setMapZoom, setShowZipBoundaries } = useMap();
  const { zipResults, cityResults, countyResults, stateResults, addressResults } = useResults();

  // State for managing dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownType, setDropdownType] = useState(null); // 'copy' or 'export'

  const handleFocusSearch = async (search) => {
    // Execute the search and center map on it
    const result = await executeRadiusSearchFromHistory(search.id);
    if (result?.entry?.center) {
      setMapCenter(result.entry.center);
      // Calculate appropriate zoom based on radius
      const zoomLevel = search.radius <= 5 ? 12 : search.radius <= 10 ? 11 : search.radius <= 20 ? 10 : 9;
      setMapZoom(zoomLevel);
    }
  };

  const handleFocusAddressSearch = async (search) => {
    // Execute the address search and center map on it
    const result = await executeAddressSearchFromHistory(search.id);
    if (result?.entry?.center) {
      setMapCenter(result.entry.center);
      // Calculate appropriate zoom based on radius
      const zoomLevel = search.radius <= 5 ? 13 : search.radius <= 10 ? 12 : 11;
      setMapZoom(zoomLevel);
    }
  };

  const handleToggleSetting = (search, setting) => {
    updateRadiusSearchSettings(search.id, (prevSettings) => ({
      ...prevSettings,
      [setting]: !prevSettings[setting]
    }));

    // If toggling zip borders for active search, update map immediately
    if (search.id === activeRadiusSearchId && setting === 'showZipBorders') {
      setShowZipBoundaries(!search.settings?.showZipBorders);
    }
  };

  const handleFitAllSearches = () => {
    if (includedSearches.length === 0) return;

    // Calculate bounds that include all search centers
    const bounds = includedSearches.reduce((acc, search) => {
      if (!search.center) return acc;

      const [lat, lng] = search.center;
      const radiusInDegrees = search.radius / 69; // Rough conversion

      if (!acc) {
        return {
          minLat: lat - radiusInDegrees,
          maxLat: lat + radiusInDegrees,
          minLng: lng - radiusInDegrees,
          maxLng: lng + radiusInDegrees
        };
      }

      return {
        minLat: Math.min(acc.minLat, lat - radiusInDegrees),
        maxLat: Math.max(acc.maxLat, lat + radiusInDegrees),
        minLng: Math.min(acc.minLng, lng - radiusInDegrees),
        maxLng: Math.max(acc.maxLng, lng + radiusInDegrees)
      };
    }, null);

    if (bounds) {
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;
      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      setMapCenter([centerLat, centerLng]);

      // Calculate appropriate zoom to fit all searches
      const latDiff = bounds.maxLat - bounds.minLat;
      const lngDiff = bounds.maxLng - bounds.minLng;
      const maxDiff = Math.max(latDiff, lngDiff);

      let zoom = 4;
      if (maxDiff < 0.1) zoom = 11;
      else if (maxDiff < 0.5) zoom = 9;
      else if (maxDiff < 1) zoom = 8;
      else if (maxDiff < 2) zoom = 7;
      else if (maxDiff < 5) zoom = 6;
      else if (maxDiff < 10) zoom = 5;

      setMapZoom(zoom);
    }
  };

  const includedSearches = radiusSearches.filter(search => !isSearchExcluded(search.id));
  const isAddressMode = searchMode === 'address';

  // Get data for a specific search
  const getSearchData = (searchId, dataType) => {
    let allData = [];

    switch (dataType) {
      case 'zips':
        allData = zipResults || [];
        break;
      case 'cities':
        allData = cityResults || [];
        break;
      case 'counties':
        allData = countyResults || [];
        break;
      case 'states':
        allData = stateResults || [];
        break;
    }

    // Filter data by searchId
    return allData.filter(item => {
      if (item.searchIds && item.searchIds.includes(searchId)) {
        return true;
      }
      return false;
    });
  };

  // Handle copy to clipboard
  const handleCopyData = async (searchId, dataType) => {
    const data = getSearchData(searchId, dataType);

    let text = '';
    if (dataType === 'zips') {
      text = data.map(item => item.zipCode).join('\n');
    } else if (dataType === 'cities') {
      text = data.map(item => `${item.name}, ${item.state}`).join('\n');
    } else if (dataType === 'counties') {
      text = data.map(item => `${item.name} County, ${item.state}`).join('\n');
    } else if (dataType === 'states') {
      text = data.map(item => `${item.name}, ${item.state}`).join('\n');
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${data.length} ${dataType} to clipboard`, 'success');
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('Failed to copy to clipboard', 'error');
    }

    // Close dropdown
    setActiveDropdown(null);
    setDropdownType(null);
  };

  // Handle export to CSV
  const handleExportCSV = (searchId, dataType) => {
    const data = getSearchData(searchId, dataType);
    const search = radiusSearches.find(s => s.id === searchId);

    let csv = '';
    if (dataType === 'zips') {
      csv = data.map(item => item.zipCode).join('\n');
    } else if (dataType === 'cities') {
      csv = data.map(item => `${item.name}, ${item.state}`).join('\n');
    } else if (dataType === 'counties') {
      csv = data.map(item => `${item.name} County, ${item.state}`).join('\n');
    } else if (dataType === 'states') {
      csv = data.map(item => `${item.name}, ${item.state}`).join('\n');
    }

    // Generate filename
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const searchName = search?.label || `search_${searchId.substring(0, 8)}`;
    const filename = `${searchName}_${dataType}_${data.length}rows_${timestamp}.csv`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${data.length} ${dataType} to CSV`, 'success');

    // Close dropdown
    setActiveDropdown(null);
    setDropdownType(null);
  };

  // Check if there are any searches based on mode
  const hasSearches = isAddressMode ? addressSearches.length > 0 : radiusSearches.length > 0;

  if (!hasSearches) {
    return (
      <div className={`flex items-center justify-center h-full p-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        <div className="text-center">
          <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-2">No search history</p>
          <p className="text-sm">{isAddressMode ? 'Your address searches will appear here' : 'Your radius searches will appear here'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Header with fit all button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Search History
        </h3>
        {includedSearches.length > 1 && (
          <button
            onClick={handleFitAllSearches}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Maximize className="h-4 w-4" />
            Fit All Searches
          </button>
        )}
      </div>

      {/* Search cards */}
      <div
        className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
        style={{ gridAutoRows: '1fr' }}
      >
        {(isAddressMode ? addressSearches : radiusSearches).map((search, index) => {
          const isActive = isAddressMode ? search.id === activeAddressSearchId : search.id === activeRadiusSearchId;
          const settings = search.settings || {};
          const isExcluded = isSearchExcluded(search.id);
          const searchNumber = search.sequence ?? index + 1;

          return (
            <div
              key={search.id}
              className={`p-3 rounded-lg border transition-all flex flex-col h-full cursor-pointer ${
                isExcluded
                  ? isDarkMode
                    ? 'bg-gray-800 border-gray-600 opacity-60'
                    : 'bg-gray-100 border-gray-300 opacity-70'
                  : isActive
                    ? isDarkMode
                      ? 'bg-red-900/20 border-red-600'
                      : 'bg-red-50 border-red-400'
                    : isDarkMode
                      ? 'bg-gray-700 border-gray-600'
                      : 'bg-gray-50 border-gray-200'
              }`}
              onClick={() => isAddressMode ? handleFocusAddressSearch(search) : handleFocusSearch(search)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  isAddressMode ? handleFocusAddressSearch(search) : handleFocusSearch(search);
                }
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-start gap-3 flex-1">
                  <span
                    className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md text-xs font-semibold ${
                      isExcluded
                        ? 'bg-gray-500 text-white'
                        : isActive
                          ? 'bg-red-600 text-white'
                          : isDarkMode
                            ? 'bg-gray-600 text-gray-100'
                            : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {searchNumber}
                  </span>
                  <div className="flex-1">
                    <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {search.label}
                    </h4>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(search.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                {/* Copy, Export, and Trash buttons */}
                <div className="flex items-center gap-1">
                  {/* Copy button with dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeDropdown === search.id && dropdownType === 'copy') {
                          setActiveDropdown(null);
                          setDropdownType(null);
                        } else {
                          setActiveDropdown(search.id);
                          setDropdownType('copy');
                        }
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        isDarkMode
                          ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200'
                          : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                      }`}
                      title="Copy data"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>

                    {/* Copy dropdown menu */}
                    {activeDropdown === search.id && dropdownType === 'copy' && (
                      <div
                        className={`absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-md shadow-lg ${
                          isDarkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => handleCopyData(search.id, 'zips')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            ZIP Codes
                          </button>
                          <button
                            onClick={() => handleCopyData(search.id, 'cities')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            Cities
                          </button>
                          <button
                            onClick={() => handleCopyData(search.id, 'counties')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            Counties
                          </button>
                          <button
                            onClick={() => handleCopyData(search.id, 'states')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            States
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CSV Export button with dropdown */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeDropdown === search.id && dropdownType === 'export') {
                          setActiveDropdown(null);
                          setDropdownType(null);
                        } else {
                          setActiveDropdown(search.id);
                          setDropdownType('export');
                        }
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        isDarkMode
                          ? 'hover:bg-gray-600 text-gray-400 hover:text-gray-200'
                          : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                      }`}
                      title="Export CSV"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </button>

                    {/* Export dropdown menu */}
                    {activeDropdown === search.id && dropdownType === 'export' && (
                      <div
                        className={`absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-md shadow-lg ${
                          isDarkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => handleExportCSV(search.id, 'zips')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            ZIP Codes
                          </button>
                          <button
                            onClick={() => handleExportCSV(search.id, 'cities')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            Cities
                          </button>
                          <button
                            onClick={() => handleExportCSV(search.id, 'counties')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            Counties
                          </button>
                          <button
                            onClick={() => handleExportCSV(search.id, 'states')}
                            className={`w-full px-3 py-1.5 text-left text-sm transition-colors ${
                              isDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                            }`}
                          >
                            States
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={`h-4 w-px ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />

                  {/* Trash button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      isAddressMode ? removeAddressSearch(search.id) : removeRadiusSearch(search.id);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      isDarkMode
                        ? 'hover:bg-gray-600 text-gray-400 hover:text-red-400'
                        : 'hover:bg-gray-200 text-gray-500 hover:text-red-600'
                    }`}
                    title="Remove search"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mt-auto pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFocusSearch(search);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                    isActive
                      ? 'bg-red-600 text-white hover:bg-red-500'
                      : isDarkMode
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Target className="h-3.5 w-3.5" />
                  Focus
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSearchExclusion(search.id);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                    isExcluded
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : isDarkMode
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {isExcluded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {isExcluded ? 'Excluded' : 'Exclude'}
                </button>

                <button
                  onClick={() => handleToggleSetting(search, 'showRadius')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                    settings.showRadius
                      ? isDarkMode
                        ? 'bg-blue-600 text-white hover:bg-blue-500'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      : isDarkMode
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Map className="h-3.5 w-3.5" />
                  Radius
                </button>

                <button
                  onClick={() => handleToggleSetting(search, 'showMarkers')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                    settings.showMarkers
                      ? isDarkMode
                        ? 'bg-green-600 text-white hover:bg-green-500'
                        : 'bg-green-500 text-white hover:bg-green-600'
                      : isDarkMode
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Markers
                </button>

                <button
                  onClick={() => handleToggleSetting(search, 'showZipBorders')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                    settings.showZipBorders
                      ? isDarkMode
                        ? 'bg-purple-600 text-white hover:bg-purple-500'
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                      : isDarkMode
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  ZIP Borders
                </button>
              </div>

              {/* Search info */}
              {search.center && (
                <div className={`mt-2 pt-2 border-t text-xs ${
                  isDarkMode ? 'border-gray-600 text-gray-400' : 'border-gray-200 text-gray-500'
                }`}>
                  <div className="flex items-center gap-4">
                    <span>Radius: {search.radius} miles</span>
                    <span>Center: {search.center[0].toFixed(4)}, {search.center[1].toFixed(4)}</span>
                    {isActive && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'
                      }`}>
                        Active
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SearchHistoryPanel;

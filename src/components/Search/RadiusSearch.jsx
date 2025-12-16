import React, { useEffect, useRef, useState } from 'react';
import { Search, RotateCcw, X, ChevronDown, Check } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';
import { useMap } from '../../contexts/MapContext';
import { geocodingService } from '../../services/geocodingService';

const getZoomForRadius = (value) => {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return 11;
  if (radius <= 3) return 12;
  if (radius <= 8) return 11;
  if (radius <= 20) return 10;
  if (radius <= 40) return 9;
  return 8;
};

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
    isSearching,
    radiusSearches,
    activeRadiusSearchId,
    setActiveRadiusSearchId,
    radiusDisplaySettings,
    removeRadiusSearch,
    updateRadiusSearchSettings,
    executeRadiusSearchFromHistory
  } = useSearch();

  const uiContext = useUI();
  const {
    isDarkMode,
    autocompleteResults,
    showAutocomplete,
    setShowAutocomplete,
    setAutocompleteResults,
    setIsSearching
  } = uiContext;

  const { setMapCenter, setMapZoom, setShowZipBoundaries } = useMap();

  const [openMenuId, setOpenMenuId] = useState(null);
  const chipsContainerRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const handleClickOutside = (event) => {
      if (chipsContainerRef.current && !chipsContainerRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const focusZone = (chip) => {
    // Just focus on the chip without re-executing the search
    setActiveRadiusSearchId(chip.id);

    if (chip.center) {
      setMapCenter(chip.center);
      setMapZoom(chip.zoom || getZoomForRadius(chip.radius));
    }

    setShowZipBoundaries(chip.settings?.showZipBorders ?? false);
    setOpenMenuId(chip.id);
  };

  const handleRemoveChip = (chip, event) => {
    event.stopPropagation();
    removeRadiusSearch(chip.id);
    if (openMenuId === chip.id) {
      setOpenMenuId(null);
    }
    if (activeRadiusSearchId === chip.id) {
      setShowZipBoundaries(false);
    }
  };

  const toggleSetting = (chip, key, event) => {
    event.stopPropagation();
    const currentValue = chip.settings?.[key] ?? radiusDisplaySettings[key];
    const nextValue = !currentValue;

    updateRadiusSearchSettings(chip.id, (settings) => ({
      ...settings,
      [key]: nextValue
    }));

    if (chip.id === activeRadiusSearchId && key === 'showZipBorders') {
      setShowZipBoundaries(nextValue);
    }
  };

  const menuLabel = (key, isEnabled) => {
    switch (key) {
      case 'showRadius':
        return isEnabled ? 'Disable radius overlay' : 'Enable radius overlay';
      case 'showMarkers':
        return isEnabled ? 'Remove markers' : 'Show markers';
      case 'showZipBorders':
        return isEnabled ? 'Hide ZIP borders' : 'Show ZIP borders';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-row items-center gap-3 w-full">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search location..."
            value={searchTerm}
            onChange={(e) => handleSearchInputChange(e, uiContext)}
            onBlur={() => handleAutocompleteBlur(uiContext)}
            onFocus={() => searchTerm.length >= 2 && autocompleteResults.length > 0 && setShowAutocomplete(true)}
            disabled={!isSearchMode}
            className={`w-full h-9 pl-9 pr-3 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
              !isSearchMode
                ? 'bg-gray-100 text-gray-500 border-gray-300'
                : isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400'
                  : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
            }`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isSearchMode) {
                e.preventDefault();
                handleSearch({ uiContext });
              }
            }}
          />

          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
            </div>
          )}

          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg shadow-lg border z-[9999] ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600'
                : 'bg-white border-gray-200'
            }`}>
              {autocompleteResults.map((result) => (
                <div
                  key={result.id || Math.random()}
                  className={`px-3 py-2 cursor-pointer transition-colors border-b last:border-b-0 ${
                    isDarkMode
                      ? 'hover:bg-gray-600 border-gray-600 text-white'
                      : 'hover:bg-gray-50 border-gray-100 text-gray-900'
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleAutocompleteSelect(result, uiContext)}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{geocodingService.getResultIcon(result.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {geocodingService.formatDisplayName(result)}
                      </p>
                      <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {result.type ? result.type.charAt(0).toUpperCase() + result.type.slice(1) : 'Location'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Radius Input */}
        <div className={`relative flex-shrink-0 ${isSearchMode ? 'animate-pulse' : ''}`}>
          <input
            type="number"
            min="1"
            max="100"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
            disabled={!isSearchMode}
            className={`w-20 h-9 pl-2 pr-9 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center font-medium ${
              !isSearchMode
                ? 'bg-gray-100 text-gray-500 border-gray-300'
                : isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-white text-gray-900 border-gray-300'
            }`}
          />
          <span className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 text-xs pointer-events-none ${
            !isSearchMode
              ? 'text-gray-400'
              : isDarkMode
                ? 'text-gray-400'
                : 'text-gray-500'
          }`}>
            mi
          </span>
        </div>

        {/* Search/Reset */}
        <button
          onClick={isSearchMode ? (() => handleSearch({ uiContext })) : handleResetSearch}
          disabled={isLoading}
          className={`h-9 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors flex-shrink-0 ${
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
            <>
              <Search className="h-4 w-4" />
              <span className="text-sm">Search</span>
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4" />
              <span className="text-sm">Reset</span>
            </>
          )}
        </button>
      </div>

      {/* Radius search chips */}
      <div className="w-full" ref={chipsContainerRef}>
        <div className={`min-h-[44px] text-xs px-3 py-2 rounded border ${
          isDarkMode
            ? 'text-gray-200 bg-gray-700/50 border-gray-600'
            : 'text-gray-600 bg-gray-50 border-gray-200'
        }`}>
          {radiusSearches.length === 0 ? (
            <p className="text-center">
              Set your search radius in miles, then click on the map to place the center point or use the search bar above
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {radiusSearches.map((chip) => {
                const isActive = chip.id === activeRadiusSearchId;
                const chipClasses = [
                  'flex items-center gap-2 pl-3 pr-7 py-1.5 rounded-full border text-xs font-medium transition-colors shadow-sm',
                  isActive
                    ? (isDarkMode ? 'bg-red-500/20 border-red-400 text-red-100' : 'bg-red-50 border-red-500 text-red-700')
                    : (isDarkMode ? 'bg-gray-800/70 border-gray-600 text-gray-200 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300')
                ].join(' ');

                return (
                  <div key={chip.id} className="relative">
                    <button
                      type="button"
                      onClick={() => focusZone(chip)}
                      className={chipClasses}
                    >
                      <span className="max-w-[160px] truncate">{chip.label}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleRemoveChip(chip, event)}
                      className={`absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove {chip.label}</span>
                    </button>

                    {openMenuId === chip.id && (
                      <div
                        className={`absolute left-0 top-full mt-2 w-56 rounded-lg border shadow-lg z-50 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-600'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="py-1">
                          {(['showRadius', 'showMarkers', 'showZipBorders']).map((key) => {
                            const isEnabled = chip.settings?.[key] ?? radiusDisplaySettings[key];
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={(event) => toggleSetting(chip, key, event)}
                                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                                  isDarkMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                <span>{menuLabel(key, isEnabled)}</span>
                                {isEnabled && <Check className="h-3.5 w-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RadiusSearch;

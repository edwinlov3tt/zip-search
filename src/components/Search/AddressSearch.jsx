import React, { useState, useEffect, useRef } from 'react';
import { Search, RotateCcw, X, ChevronDown, Check, MapPin } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';
import { milesToMeters } from '../../utils/polygonHelpers';
import { geocodingService } from '../../services/geocodingService';

const AddressSearch = ({
  handleSearch,
  handleSearchInputChange,
  handleAutocompleteBlur,
  handleAutocompleteSelect,
  handleResetSearch
}) => {
  const {
    searchTerm,
    searchMode,
    searchPerformed,
    isLoading,
    isSearching,
    addressSearches,
    activeAddressSearchId,
    addressSubMode,
    setAddressSubMode,
    addressDisplaySettings,
    removeAddressSearch,
    updateAddressSearchSettings,
    executeAddressSearchFromHistory,
    checkOverpassCooldown,
    overpassCooldownRemaining,
    setOverpassCooldownRemaining,
    addressRadius,
    setAddressRadius
  } = useSearch();

  const {
    isDarkMode,
    autocompleteResults,
    showAutocomplete,
    setShowAutocomplete
  } = useUI();
  const [openMenuId, setOpenMenuId] = useState(null);
  const chipsContainerRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  // Start cooldown timer when search starts
  useEffect(() => {
    const remaining = checkOverpassCooldown();
    if (remaining > 0) {
      setOverpassCooldownRemaining(remaining);

      // Update every 100ms for smooth progress bar
      cooldownIntervalRef.current = setInterval(() => {
        const newRemaining = checkOverpassCooldown();
        setOverpassCooldownRemaining(newRemaining);

        if (newRemaining === 0) {
          clearInterval(cooldownIntervalRef.current);
        }
      }, 100);
    }

    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, [checkOverpassCooldown, setOverpassCooldownRemaining]);

  // Close menu when clicking outside
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

  const handleAddressSearch = () => {
    // Validation happens in the main handleSearch function
    // Just pass the mode and parameters
    const uiContext = { isDarkMode, autocompleteResults, showAutocomplete, setShowAutocomplete };
    handleSearch({
      addressSubMode,
      radius: addressRadius,
      uiContext
    });
  };

  const focusSearch = async (chip) => {
    const result = await executeAddressSearchFromHistory(chip.id);
    setOpenMenuId(chip.id);
  };

  const handleRemoveChip = (chip, event) => {
    event.stopPropagation();
    removeAddressSearch(chip.id);
    if (openMenuId === chip.id) {
      setOpenMenuId(null);
    }
  };

  const toggleSetting = (chip, key, event) => {
    event.stopPropagation();
    const currentValue = chip.settings?.[key] ?? addressDisplaySettings[key];
    const nextValue = !currentValue;

    updateAddressSearchSettings(chip.id, (settings) => ({
      ...settings,
      [key]: nextValue
    }));
  };

  const menuLabel = (key, isEnabled) => {
    switch (key) {
      case 'showMarkers':
        return isEnabled ? 'Hide markers' : 'Show markers';
      case 'showRadius':
        return isEnabled ? 'Hide radius' : 'Show radius';
      case 'showResults':
        return isEnabled ? 'Hide results' : 'Show results';
      case 'showZipBorders':
        return isEnabled ? 'Hide ZIP borders' : 'Show ZIP borders';
      default:
        return '';
    }
  };

  const cooldownActive = overpassCooldownRemaining > 0;
  const progressPercent = cooldownActive ? ((5 - overpassCooldownRemaining) / 5) * 100 : 100;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Mode Toggle (Tab-style) */}
      <div className={`flex rounded-lg p-1 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
        <button
          onClick={() => setAddressSubMode('radius')}
          className={`flex-1 px-4 py-2 text-sm rounded transition-colors ${
            addressSubMode === 'radius'
              ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
              : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
          }`}
        >
          Radius
        </button>
        <button
          onClick={() => setAddressSubMode('polygon')}
          className={`flex-1 px-4 py-2 text-sm rounded transition-colors ${
            addressSubMode === 'polygon'
              ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
              : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
          }`}
        >
          Polygon
        </button>
      </div>

      {/* Radius Mode UI */}
      {addressSubMode === 'radius' && (
        <>
          {/* Search Input Row - Search bar + Radius + Button */}
          <div className="flex flex-row items-center gap-3 w-full">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
              <input
                type="text"
                placeholder="Search location..."
                value={searchTerm}
                onChange={(e) => handleSearchInputChange(e, { isDarkMode, autocompleteResults, showAutocomplete, setShowAutocomplete })}
                onBlur={() => handleAutocompleteBlur({ isDarkMode, autocompleteResults, showAutocomplete, setShowAutocomplete })}
                onFocus={() => searchTerm.length >= 2 && autocompleteResults.length > 0 && setShowAutocomplete(true)}
                disabled={cooldownActive}
                className={`w-full h-9 pl-9 pr-3 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                  cooldownActive
                    ? 'bg-gray-100 text-gray-500 border-gray-300'
                    : isDarkMode
                      ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400'
                      : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !cooldownActive && searchTerm) {
                    e.preventDefault();
                    handleAddressSearch();
                  }
                }}
              />

              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                </div>
              )}

              {showAutocomplete && autocompleteResults.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg shadow-lg border z-50 ${
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
                      onClick={() => handleAutocompleteSelect(result, { isDarkMode, autocompleteResults, showAutocomplete, setShowAutocomplete })}
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
            <div className="relative flex-shrink-0">
              <input
                type="number"
                min="1"
                max="10"
                value={addressRadius}
                onChange={(e) => setAddressRadius(parseInt(e.target.value) || 1)}
                disabled={cooldownActive}
                className={`w-20 h-9 pl-2 pr-9 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center font-medium ${
                  cooldownActive
                    ? 'bg-gray-100 text-gray-500 border-gray-300'
                    : isDarkMode
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-white text-gray-900 border-gray-300'
                }`}
              />
              <span className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 text-xs pointer-events-none ${
                cooldownActive
                  ? 'text-gray-400'
                  : isDarkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}>
                mi
              </span>
            </div>

            {/* Search/Reset Button */}
            <button
              onClick={cooldownActive ? undefined : (searchPerformed ? handleResetSearch : handleAddressSearch)}
              disabled={isLoading || cooldownActive || (!searchPerformed && !searchTerm)}
              className={`h-9 px-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors flex-shrink-0 ${
                !cooldownActive && !searchPerformed
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : isDarkMode
                    ? 'bg-gray-600 text-white hover:bg-gray-500'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : !searchPerformed ? (
                <>
                  <Search className="h-4 w-4" />
                  <span className="text-sm">
                    Search{addressSearches.length > 0 ? ` (${addressSearches.length + 1})` : ''}
                  </span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-sm">Reset</span>
                </>
              )}
            </button>
          </div>

          {/* Helper text box with cooldown, chips, or helper text */}
          <div className="w-full" ref={chipsContainerRef}>
            <div className={`min-h-[44px] text-xs px-3 py-2 rounded border ${
              isDarkMode
                ? 'text-gray-200 bg-gray-700/50 border-gray-600'
                : 'text-gray-600 bg-gray-50 border-gray-200'
            }`}>
              {cooldownActive ? (
                <div className="space-y-2">
                  <div className={`text-sm text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Please wait {overpassCooldownRemaining} second{overpassCooldownRemaining !== 1 ? 's' : ''}...
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className="h-full bg-red-500 transition-all duration-100"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              ) : addressSearches.length === 0 ? (
                <p className="text-center">
                  Set your search radius in miles, then click on the map to place the center point or use the search bar above
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {addressSearches.map((chip) => {
                    const isActive = chip.id === activeAddressSearchId;
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
                          onClick={() => focusSearch(chip)}
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
                              {(['showMarkers', 'showRadius', 'showResults', 'showZipBorders']).map((key) => {
                                const isEnabled = chip.settings?.[key] ?? addressDisplaySettings[key];
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
        </>
      )}

      {/* Polygon Mode UI */}
      {addressSubMode === 'polygon' && (
        <div className="w-full" ref={chipsContainerRef}>
          <div className={`min-h-[44px] text-xs px-3 py-2 rounded border ${
            isDarkMode
              ? 'text-gray-200 bg-gray-700/50 border-gray-600'
              : 'text-gray-600 bg-gray-50 border-gray-200'
          }`}>
            {addressSearches.length === 0 ? (
              <p className="text-center">
                Draw shapes on the map to search within them
                <br />
                <span className={`text-[11px] mt-1 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Use the drawing tools on the map to create shapes. Each shape will search for addresses within it.
                </span>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {addressSearches.map((chip) => {
                  const isActive = chip.id === activeAddressSearchId;
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
                        onClick={() => focusSearch(chip)}
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
                            {(['showMarkers', 'showResults', 'showZipBorders']).map((key) => {
                              const isEnabled = chip.settings?.[key] ?? addressDisplaySettings[key];
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
      )}
    </div>
  );
};

export default AddressSearch;

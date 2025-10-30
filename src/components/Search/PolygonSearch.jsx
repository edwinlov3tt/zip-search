import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, ChevronDown, Check } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';

const PolygonSearch = ({ handleResetSearch }) => {
  const {
    searchPerformed,
    isLoading,
    polygonSearches = [],
    activePolygonSearchId,
    polygonDisplaySettings = { showShape: true, showMarkers: true, showZipBorders: false },
    removePolygonSearch,
    updatePolygonSearchSettings,
    executePolygonSearchFromHistory
  } = useSearch();

  const { drawnShapes, mapRef, setShowZipBoundaries } = useMap();
  const { isDarkMode } = useUI();

  const [openMenuId, setOpenMenuId] = useState(null);
  const chipsContainerRef = useRef(null);

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

  const focusShape = async (chip) => {
    const result = await executePolygonSearchFromHistory(chip.id);
    const resolvedEntry = result?.entry || chip;

    if (resolvedEntry.bounds && mapRef.current) {
      const { minLat, maxLat, minLng, maxLng } = resolvedEntry.bounds;
      const bounds = [[minLat, minLng], [maxLat, maxLng]];
      mapRef.current.fitBounds(bounds, { animate: true, padding: [50, 50] });
    }

    setShowZipBoundaries(resolvedEntry.settings?.showZipBorders ?? false);
    setOpenMenuId(chip.id);
  };

  const handleRemoveChip = (chip, event) => {
    event.stopPropagation();
    removePolygonSearch(chip.id);
    if (openMenuId === chip.id) {
      setOpenMenuId(null);
    }
    if (activePolygonSearchId === chip.id) {
      setShowZipBoundaries(false);
    }
  };

  const toggleSetting = (chip, key, event) => {
    event.stopPropagation();
    const currentValue = chip.settings?.[key] ?? polygonDisplaySettings[key];
    const nextValue = !currentValue;

    updatePolygonSearchSettings(chip.id, (settings) => ({
      ...settings,
      [key]: nextValue
    }));

    if (chip.id === activePolygonSearchId && key === 'showZipBorders') {
      setShowZipBoundaries(nextValue);
    }
  };

  const menuLabel = (key, isEnabled) => {
    switch (key) {
      case 'showShape':
        return isEnabled ? 'Hide shape overlay' : 'Show shape overlay';
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
      {/* Main controls row */}
      <div className="flex flex-row items-center gap-3 w-full">
        <div className={`flex-1 flex items-center justify-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Draw shapes on the map to search within them
        </div>
        {searchPerformed && (
          <button
            onClick={handleResetSearch}
            disabled={isLoading}
            className={`h-9 px-3 sm:px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              isDarkMode
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* Shape history chips */}
      <div className="w-full" ref={chipsContainerRef}>
        <div className={`min-h-[44px] text-xs px-3 py-2 rounded border ${
          isDarkMode
            ? 'text-gray-200 bg-gray-700/50 border-gray-600'
            : 'text-gray-600 bg-gray-50 border-gray-200'
        }`}>
          {polygonSearches.length === 0 ? (
            <p className="text-center">
              Use the drawing tools on the map to create shapes. Each shape will search for ZIP codes within it.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {polygonSearches.map((chip) => {
                const isActive = chip.id === activePolygonSearchId;
                const chipClasses = [
                  'flex items-center gap-2 pl-3 pr-7 py-1.5 rounded-full border text-xs font-medium transition-colors shadow-sm cursor-pointer',
                  isActive
                    ? (isDarkMode ? 'bg-red-500/20 border-red-400 text-red-100' : 'bg-red-50 border-red-500 text-red-700')
                    : (isDarkMode ? 'bg-gray-800/70 border-gray-600 text-gray-200 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300')
                ].join(' ');

                return (
                  <div key={chip.id} className="relative">
                    <button
                      type="button"
                      onClick={() => focusShape(chip)}
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
                          {(['showShape', 'showMarkers', 'showZipBorders']).map((key) => {
                            const isEnabled = chip.settings?.[key] ?? polygonDisplaySettings[key];
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

export default PolygonSearch;
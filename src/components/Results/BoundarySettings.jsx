import React, { useState, useRef, useEffect } from 'react';
import { Settings, ChevronDown, MapPin } from 'lucide-react';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';
import { useSearch } from '../../contexts/SearchContext';
import zipBoundariesService from '../../services/zipBoundariesService';

const BoundarySettings = () => {
  const {
    showCountyBorders,
    setShowCountyBorders,
    showStateBoundaries,
    setShowStateBoundaries,
    stateBoundariesData,
    setStateBoundariesData,
    loadingStateBoundaries,
    showCityBoundaries,
    setShowCityBoundaries,
    cityBoundariesData,
    setCityBoundariesData,
    loadingCityBoundaries,
    showZipBoundaries,
    setShowZipBoundaries,
    zipBoundariesData,
    setZipBoundariesData,
    loadingZipBoundaries,
    showMarkers,
    setShowMarkers
  } = useMap();

  const { isDarkMode, drawerState, drawerHeight } = useUI();
  const { combineSearchResults, setCombineSearchResults } = useSearch();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleClearZipBoundaries = () => {
    setZipBoundariesData(null);
    zipBoundariesService.clearPersistentCache();
  };

  const getCacheStats = () => {
    const stats = zipBoundariesService.getCacheStats();
    if (stats.available && stats.totalZips > 0) {
      return {
        totalZips: stats.totalZips,
        sizeKB: stats.sizeKB,
        viewports: stats.viewports,
        expires: stats.expires
      };
    }
    return null;
  };

  const cacheStats = getCacheStats();

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseDown={(e) => e.stopPropagation()}
        className={`p-1 rounded transition-colors flex items-center space-x-1 ${
          isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
        }`}
        title="Map Settings"
      >
        <Settings className="h-4 w-4" />
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        (() => {
          const isDrawerCollapsed = drawerState === 'collapsed';
          const isSmallHalf = drawerState === 'half' && Number(drawerHeight) < 40;
          const shouldOpenUpwards = isDrawerCollapsed || isSmallHalf;
          const positionClass = shouldOpenUpwards ? 'bottom-full mb-2' : 'top-full mt-2';
          return (
            <div
              className={`absolute right-0 ${positionClass} w-64 rounded-lg shadow-lg border ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-600'
                  : 'bg-white border-gray-200'
              } z-50`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
          <div className={`p-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className="text-sm font-semibold">Map Settings</h3>
          </div>

          <div className="p-3 space-y-3">
            <label className={`flex items-center justify-between text-xs cursor-pointer p-2 rounded transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <span>Combine Searches</span>
              <input
                type="checkbox"
                checked={combineSearchResults}
                onChange={(e) => setCombineSearchResults(e.target.checked)}
                className="rounded"
              />
            </label>

            {/* Show Markers Toggle */}
            <label className={`flex items-center justify-between text-xs cursor-pointer p-2 rounded transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}>
              <span className="flex items-center space-x-2">
                <MapPin className="h-3 w-3" />
                <span>Show Markers</span>
              </span>
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
                className="rounded"
              />
            </label>

            <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />

            {/* Boundary Controls */}
            <div className="space-y-2">
              <div className="text-xs font-medium opacity-70 px-2">Boundaries</div>

              {/* County Borders - WORKING */}
              <label className={`flex items-center justify-between text-xs cursor-pointer p-2 rounded transition-colors ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}>
                <span>County Borders</span>
                <input
                  type="checkbox"
                  checked={showCountyBorders}
                  onChange={(e) => setShowCountyBorders(e.target.checked)}
                  className="rounded"
                />
              </label>

              {/* State Boundaries - NOW WORKING */}
              <label className={`flex items-center justify-between text-xs cursor-pointer p-2 rounded transition-colors ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}>
                <span className="flex items-center space-x-1">
                  <span>State Boundaries</span>
                  {loadingStateBoundaries && <span className="inline-block animate-spin">⟳</span>}
                </span>
                <input
                  type="checkbox"
                  checked={showStateBoundaries}
                  onChange={(e) => {
                    setShowStateBoundaries(e.target.checked);
                    if (!e.target.checked) setStateBoundariesData(null);
                  }}
                  disabled={loadingStateBoundaries}
                  className="rounded"
                />
              </label>

              {/* City Boundaries - NOW WORKING */}
              <label className={`flex items-center justify-between text-xs cursor-pointer p-2 rounded transition-colors ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}>
                <span className="flex items-center space-x-1">
                  <span>City Boundaries</span>
                  {loadingCityBoundaries && <span className="inline-block animate-spin">⟳</span>}
                </span>
                <input
                  type="checkbox"
                  checked={showCityBoundaries}
                  onChange={(e) => {
                    setShowCityBoundaries(e.target.checked);
                    if (!e.target.checked) setCityBoundariesData(null);
                  }}
                  disabled={loadingCityBoundaries}
                  className="rounded"
                />
              </label>

              {/* ZIP Boundaries - NOW WORKING */}
              <label className={`flex items-center justify-between text-xs cursor-pointer p-2 rounded transition-colors ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}>
                <span className="flex items-center space-x-1">
                  <span>ZIP Boundaries</span>
                  {loadingZipBoundaries && <span className="inline-block animate-spin">⟳</span>}
                  {zipBoundariesData && zipBoundariesData.features && (
                    <span className="text-[10px] opacity-70">
                      ({zipBoundariesData.features.length})
                    </span>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={showZipBoundaries}
                  onChange={(e) => {
                    setShowZipBoundaries(e.target.checked);
                    if (!e.target.checked) setZipBoundariesData(null);
                  }}
                  disabled={loadingZipBoundaries}
                  className="rounded"
                />
              </label>

              {/* Clear ZIP boundaries cache button */}
              {showZipBoundaries && zipBoundariesData && zipBoundariesData.features && zipBoundariesData.features.length > 0 && (
                <button
                  onClick={handleClearZipBoundaries}
                  className={`w-full text-[10px] px-2 py-1 rounded ${
                    isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                  title="Clear all cached ZIP boundaries (memory + localStorage)"
                >
                  Clear ZIP Cache {cacheStats && `(${cacheStats.totalZips} cached)`}
                </button>
              )}
            </div>
          </div>
            </div>
          );
        })()
      )}
    </div>
  );
};

export default BoundarySettings;

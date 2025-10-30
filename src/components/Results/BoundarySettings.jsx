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

              {/* State Boundaries - COMING SOON */}
              {/* TODO: Remove "Coming Soon" tooltip and enable when State Boundaries are ready */}
              <label
                className={`flex items-center justify-between text-xs p-2 rounded opacity-40 cursor-not-allowed ${
                  isDarkMode ? 'bg-gray-700/30' : 'bg-gray-100/30'
                }`}
                title="Coming Soon"
              >
                <span className="flex items-center space-x-1">
                  <span>State Boundaries</span>
                </span>
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded cursor-not-allowed"
                />
              </label>

              {/* City Boundaries - COMING SOON */}
              {/* TODO: Remove "Coming Soon" tooltip and enable when City Boundaries are ready */}
              <label
                className={`flex items-center justify-between text-xs p-2 rounded opacity-40 cursor-not-allowed ${
                  isDarkMode ? 'bg-gray-700/30' : 'bg-gray-100/30'
                }`}
                title="Coming Soon"
              >
                <span className="flex items-center space-x-1">
                  <span>City Boundaries</span>
                </span>
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded cursor-not-allowed"
                />
              </label>

              {/* ZIP Boundaries - COMING SOON */}
              {/* TODO: Remove "Coming Soon" tooltip and enable when ZIP Boundaries are ready */}
              <label
                className={`flex items-center justify-between text-xs p-2 rounded opacity-40 cursor-not-allowed ${
                  isDarkMode ? 'bg-gray-700/30' : 'bg-gray-100/30'
                }`}
                title="Coming Soon"
              >
                <span className="flex items-center space-x-1">
                  <span>ZIP Boundaries</span>
                </span>
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="rounded cursor-not-allowed"
                />
              </label>
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

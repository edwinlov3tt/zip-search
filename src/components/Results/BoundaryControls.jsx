import React from 'react';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';

const BoundaryControls = ({ zipBoundariesService }) => {
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
    showVtdBoundaries,
    setShowVtdBoundaries,
    vtdBoundariesData,
    setVtdBoundariesData,
    loadingVtdBoundaries
  } = useMap();

  const { isDarkMode } = useUI();

  const handleClearZipBoundaries = () => {
    setZipBoundariesData(null);
    if (zipBoundariesService) {
      zipBoundariesService.clearPersistentCache();
    }
  };

  const getCacheStats = () => {
    if (!zipBoundariesService) return null;
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
    <div className={`flex items-center space-x-4 border-r pr-4 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'}`}>
      <label className="flex items-center space-x-1 text-xs">
        <input
          type="checkbox"
          checked={showCountyBorders}
          onChange={(e) => setShowCountyBorders(e.target.checked)}
          className="rounded"
        />
        <span>County Borders</span>
      </label>

      <label className="flex items-center space-x-1 text-xs">
        <input
          type="checkbox"
          checked={showStateBoundaries}
          onChange={(e) => {
            setShowStateBoundaries(e.target.checked);
            if (!e.target.checked) setStateBoundariesData(null);
          }}
          className="rounded"
          disabled={loadingStateBoundaries}
        />
        <span className="flex items-center space-x-1">
          State Boundaries {loadingStateBoundaries && <span className="inline-block animate-spin">⟳</span>}
        </span>
      </label>

      <label className="flex items-center space-x-1 text-xs">
        <input
          type="checkbox"
          checked={showCityBoundaries}
          onChange={(e) => {
            setShowCityBoundaries(e.target.checked);
            if (!e.target.checked) setCityBoundariesData(null);
          }}
          className="rounded"
          disabled={loadingCityBoundaries}
        />
        <span className="flex items-center space-x-1">
          City Boundaries {loadingCityBoundaries && <span className="inline-block animate-spin">⟳</span>}
        </span>
      </label>

      <label className="flex items-center space-x-1 text-xs">
        <input
          type="checkbox"
          checked={showVtdBoundaries}
          onChange={(e) => {
            setShowVtdBoundaries(e.target.checked);
            if (!e.target.checked) setVtdBoundariesData(null);
          }}
          className="rounded"
          disabled={loadingVtdBoundaries}
        />
        <span className="flex items-center space-x-1">
          Voting District Boundaries {loadingVtdBoundaries && <span className="inline-block animate-spin">⟳</span>}
          {vtdBoundariesData && vtdBoundariesData.features && (
            <span className="text-[10px] opacity-70">
              ({vtdBoundariesData.features.length})
            </span>
          )}
        </span>
      </label>

      <label className="flex items-center space-x-1 text-xs">
        <input
          type="checkbox"
          checked={showZipBoundaries}
          onChange={(e) => {
            setShowZipBoundaries(e.target.checked);
            // Clear cached boundaries when toggled off
            if (!e.target.checked) {
              setZipBoundariesData(null);
            }
          }}
          className="rounded"
          disabled={loadingZipBoundaries}
        />
        <span className="flex items-center space-x-1">
          ZIP Boundaries
          {loadingZipBoundaries && (
            <span className="inline-block animate-spin">⟳</span>
          )}
          {zipBoundariesData && zipBoundariesData.features && (
            <span className="text-[10px] opacity-70">
              ({zipBoundariesData.features.length})
            </span>
          )}
          {cacheStats && (
            <span
              className="text-[10px] opacity-50"
              title={`Cache: ${cacheStats.sizeKB}KB, ${cacheStats.viewports} viewports, expires ${cacheStats.expires.toLocaleDateString()}`}
            >
              [💾 {cacheStats.totalZips}]
            </span>
          )}
        </span>
      </label>

      {showZipBoundaries && zipBoundariesData && zipBoundariesData.features && zipBoundariesData.features.length > 0 && (
        <button
          onClick={handleClearZipBoundaries}
          className={`text-[10px] px-2 py-0.5 rounded ${
            isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
          }`}
          title="Clear all cached ZIP boundaries (memory + localStorage)"
        >
          Clear All
        </button>
      )}
    </div>
  );
};

export default BoundaryControls;
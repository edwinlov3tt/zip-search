import React from 'react';
import { ChevronUp, ChevronDown, Maximize2, Minimize2, Search, Copy, FileDown, Download, Check } from 'lucide-react';
import DrawerTabs from './DrawerTabs';
import BoundarySettings from './BoundarySettings';
import { useUI } from '../../contexts/UIContext';
import { useMap } from '../../contexts/MapContext';

const DrawerHeader = ({
  handleMouseDown,
  cycleDrawerState,
  copyToClipboard,
  exportSimpleCsv,
  getCurrentData,
  getTotalExcludedCount,
  filteredAddressResults,
  filteredGeocodeResults,
  filteredZipResults,
  filteredCityResults,
  filteredCountyResults,
  filteredStateResults
}) => {
  const {
    isDarkMode,
    drawerState,
    drawerHeight,
    isResizing,
    activeTab,
    setActiveTab,
    drawerSearchTerm,
    setDrawerSearchTerm,
    copySuccess,
    setShowCustomExport,
    setDrawerState
  } = useUI();

  // Determine if buttons should be disabled based on active tab
  const isSearchHistoryTab = activeTab === 'searches';
  const isExcludedTab = activeTab === 'excluded';
  const shouldDisableCopyAndSimpleExport = isSearchHistoryTab || isExcludedTab;
  const shouldDisableCustomExport = isExcludedTab;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 border-b ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'} ${
        isDarkMode ? 'cursor-ns-resize hover:bg-gray-600' : 'cursor-ns-resize hover:bg-gray-100'
      }`}
      onMouseDown={handleMouseDown}
      style={{ userSelect: isResizing ? 'none' : 'auto' }}
    >
      <div className="flex items-center space-x-4">
        {/* Drawer State Controls */}
        <div className="flex items-center space-x-1">
          {/* Left button - varies by state */}
          {drawerState === 'collapsed' ? (
            <button
              onClick={() => setDrawerState('half')}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-200'}`}
              title="Expand to Half"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          ) : drawerState === 'half' ? (
            <button
              onClick={() => setDrawerState('collapsed')}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-200'}`}
              title="Minimize"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setDrawerState('half')}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-200'}`}
              title="Half View"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* Right button - varies by state */}
          {drawerState === 'collapsed' ? (
            <button
              onClick={() => setDrawerState('full')}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-200'}`}
              title="Expand to Full"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : drawerState === 'half' ? (
            <button
              onClick={() => setDrawerState('full')}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-200'}`}
              title="Expand to Full"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => setDrawerState('collapsed')}
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-white hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-200'}`}
              title="Minimize to Bottom"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          )}

          <div className={`text-xs px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {drawerState === 'full' ? 'Full' : drawerState === 'half' ? `Half (${Math.round(drawerHeight)}%)` : 'Min'}
          </div>
        </div>

        {/* Tabs */}
        <DrawerTabs
          filteredAddressResults={filteredAddressResults}
          filteredGeocodeResults={filteredGeocodeResults}
          filteredZipResults={filteredZipResults}
          filteredCityResults={filteredCityResults}
          filteredCountyResults={filteredCountyResults}
          filteredStateResults={filteredStateResults}
          getTotalExcludedCount={getTotalExcludedCount}
        />

        {/* Search Bar for Drawer */}
        {drawerState !== 'collapsed' && (
          <div
            className="relative z-50"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Search
              className={`absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`}
              style={{ zIndex: 10000 }}
            />
            <input
              type="text"
              placeholder="Search"
              value={drawerSearchTerm}
              onChange={(e) => {
                setDrawerSearchTerm(e.target.value);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className={`w-48 pl-7 pr-3 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-red-500 relative z-50 ${
                isDarkMode
                  ? 'bg-gray-600 text-white border-gray-500 placeholder-gray-400'
                  : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
              }`}
              style={{ position: 'relative', zIndex: 9999 }}
            />
          </div>
        )}
      </div>

      {/* Actions and Boundary Controls */}
      <div className="flex items-center space-x-2">
        <BoundarySettings />

        <div className="flex items-center space-x-2">
          <button
            onClick={() => !shouldDisableCopyAndSimpleExport && copyToClipboard(getCurrentData(activeTab))}
            disabled={shouldDisableCopyAndSimpleExport}
            className={`p-1 rounded transition-all duration-200 ${
              shouldDisableCopyAndSimpleExport
                ? isDarkMode
                  ? 'opacity-30 cursor-not-allowed text-gray-500'
                  : 'opacity-30 cursor-not-allowed text-gray-400'
                : copySuccess
                  ? 'bg-green-100 text-green-600'
                  : isDarkMode
                    ? 'text-white hover:bg-gray-600'
                    : 'text-gray-700 hover:bg-gray-200'
            }`}
            title={shouldDisableCopyAndSimpleExport ? "Not available on this tab" : copySuccess ? "Copied!" : "Copy to clipboard"}
          >
            {copySuccess ? (
              <Check className="h-4 w-4 animate-pulse" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => !shouldDisableCopyAndSimpleExport && exportSimpleCsv(getCurrentData(activeTab))}
            disabled={shouldDisableCopyAndSimpleExport}
            className={`p-1 rounded transition-colors ${
              shouldDisableCopyAndSimpleExport
                ? isDarkMode
                  ? 'opacity-30 cursor-not-allowed text-gray-500'
                  : 'opacity-30 cursor-not-allowed text-gray-400'
                : isDarkMode
                  ? 'text-white hover:bg-gray-600'
                  : 'text-gray-700 hover:bg-gray-200'
            }`}
            title={shouldDisableCopyAndSimpleExport ? "Not available on this tab" : `Export ${activeTab} (minimal)`}
          >
            <FileDown className="h-4 w-4" />
          </button>

          <button
            onClick={() => !shouldDisableCustomExport && setShowCustomExport(true)}
            disabled={shouldDisableCustomExport}
            className={`p-1 rounded transition-colors ${
              shouldDisableCustomExport
                ? isDarkMode
                  ? 'opacity-30 cursor-not-allowed text-gray-500'
                  : 'opacity-30 cursor-not-allowed text-gray-400'
                : isDarkMode
                  ? 'text-white hover:bg-gray-600'
                  : 'text-gray-700 hover:bg-gray-200'
            }`}
            title={shouldDisableCustomExport ? "Not available on Excluded tab" : "Custom export options"}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawerHeader;

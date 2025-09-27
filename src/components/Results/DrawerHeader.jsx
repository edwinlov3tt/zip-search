import React from 'react';
import { ChevronUp, Maximize2, Minus, Search, Copy, FileDown, Download, Check } from 'lucide-react';
import DrawerTabs from './DrawerTabs';
import BoundaryControls from './BoundaryControls';
import { useUI } from '../../contexts/UIContext';
import { useMap } from '../../contexts/MapContext';

const DrawerHeader = ({
  handleMouseDown,
  cycleDrawerState,
  copyToClipboard,
  exportSimpleCsv,
  getCurrentData,
  getTotalExcludedCount,
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
    setShowCustomExport
  } = useUI();

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 border-b ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'} ${
        drawerState === 'half' ? isDarkMode ? 'cursor-ns-resize hover:bg-gray-600' : 'cursor-ns-resize hover:bg-gray-100' : ''
      }`}
      onMouseDown={handleMouseDown}
      style={{ userSelect: isResizing ? 'none' : 'auto' }}
    >
      <div className="flex items-center space-x-4">
        {/* Drawer State Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={cycleDrawerState}
            className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
            title={drawerState === 'collapsed' ? 'Expand to Half' : drawerState === 'half' ? 'Expand to Full' : 'Collapse'}
          >
            {drawerState === 'collapsed' ? (
              <ChevronUp className="h-4 w-4" />
            ) : drawerState === 'half' ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
          </button>
          <div className={`text-xs px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {drawerState === 'full' ? 'Full' : drawerState === 'half' ? `Half (${Math.round(drawerHeight)}%)` : 'Min'}
          </div>
        </div>

        {/* Tabs */}
        <DrawerTabs
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
            <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 z-50 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
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
      <div className="flex items-center space-x-4">
        <BoundaryControls />

        <div className="flex items-center space-x-2">
          <button
            onClick={() => copyToClipboard(getCurrentData())}
            className={`p-1 rounded transition-all duration-200 ${
              copySuccess
                ? 'bg-green-100 text-green-600'
                : isDarkMode
                  ? 'hover:bg-gray-600'
                  : 'hover:bg-gray-200'
            }`}
            title={copySuccess ? "Copied!" : "Copy to clipboard"}
          >
            {copySuccess ? (
              <Check className="h-4 w-4 animate-pulse" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => exportSimpleCsv(getCurrentData())}
            className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
            title={`Export ${activeTab} (minimal)`}
          >
            <FileDown className="h-4 w-4" />
          </button>

          <button
            onClick={() => setShowCustomExport(true)}
            className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
            title="Custom export options"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawerHeader;
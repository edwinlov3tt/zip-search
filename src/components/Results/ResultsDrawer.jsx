import React from 'react';
import DrawerHeader from './DrawerHeader';
import DrawerContent from './DrawerContent';
import { useUI } from '../../contexts/UIContext';
import { useResults } from '../../contexts/ResultsContext';
import { useSearch } from '../../contexts/SearchContext';

const ResultsDrawer = ({
  handleMouseDown,
  cycleDrawerState,
  handleSort,
  getCurrentData,
  handleResultSelect,
  handleResultDoubleClick,
  isResultSelected,
  copyToClipboard,
  exportSimpleCsv,
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
    getDrawerHeight,
    tableContainerRef
  } = useUI();

  const { searchPerformed } = useSearch();

  // Don't show drawer if no search performed or no results
  if (!searchPerformed || (
    filteredAddressResults.length === 0 &&
    filteredGeocodeResults.length === 0 &&
    filteredZipResults.length === 0 &&
    filteredCityResults.length === 0 &&
    filteredCountyResults.length === 0 &&
    filteredStateResults.length === 0
  )) {
    return null;
  }

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border-t shadow-lg flex flex-col`}
      style={{
        height: getDrawerHeight(),
        zIndex: drawerState === 'full' ? 1001 : 1000,
        transition: isResizing ? 'none' : 'height 300ms ease-in-out'
      }}
    >
      <DrawerHeader
        handleMouseDown={handleMouseDown}
        cycleDrawerState={cycleDrawerState}
        copyToClipboard={copyToClipboard}
        exportSimpleCsv={exportSimpleCsv}
        getCurrentData={getCurrentData}
        getTotalExcludedCount={getTotalExcludedCount}
        filteredAddressResults={filteredAddressResults}
        filteredGeocodeResults={filteredGeocodeResults}
        filteredZipResults={filteredZipResults}
        filteredCityResults={filteredCityResults}
        filteredCountyResults={filteredCountyResults}
        filteredStateResults={filteredStateResults}
      />

      {drawerState !== 'collapsed' && (
        <DrawerContent
          tableContainerRef={tableContainerRef}
          getCurrentData={getCurrentData}
          handleSort={handleSort}
          handleResultSelect={handleResultSelect}
          handleResultDoubleClick={handleResultDoubleClick}
          isResultSelected={isResultSelected}
        />
      )}
    </div>
  );
};

export default ResultsDrawer;
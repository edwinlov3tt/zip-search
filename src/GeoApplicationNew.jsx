import React from 'react';
import { MapProvider } from './contexts/MapContext';
import { SearchProvider } from './contexts/SearchContext';
import { ResultsProvider } from './contexts/ResultsContext';
import { UIProvider } from './contexts/UIContext';

import Header from './components/Header/Header';
import SearchControls from './components/Search/SearchControls';
import MapContainer from './components/Map/MapContainer';
import MapLayerSelector from './components/Map/MapLayerSelector';
import ResultsDrawer from './components/Results/ResultsDrawer';
import ToastNotification from './components/Common/ToastNotification';
import CustomExportModal from './components/Modals/CustomExportModal';
import HeaderMappingModal from './components/Modals/HeaderMappingModal';

import { useSearch } from './contexts/SearchContext';
import { useMap } from './contexts/MapContext';
import { useResults } from './contexts/ResultsContext';
import { useUI } from './contexts/UIContext';

/**
 * Main GeoApplication component that composes all features
 * This is a thin wrapper that brings together all the extracted components
 */
const GeoApplicationContent = () => {
  const {
    searchMode,
    searchTerm,
    radius,
    isSearchMode,
    isLoading,
    searchPerformed,
    handleSearch,
    handleSearchModeChange,
    handleSearchInputChange,
    handleAutocompleteBlur,
    handleAutocompleteSelect,
    handleCSVUpload,
    handleRemoveFile,
    handleResetSearch,
    setSelectedState,
    setSelectedCounty,
    setSelectedCity,
    hierarchyLocations,
    selectedLocation,
    radiusCenter
  } = useSearch();

  const {
    mapCenter,
    mapZoom,
    mapRef,
    featureGroupRef,
    drawnShapes,
    handleMapClick,
    handleViewportChange,
    onCreated,
    onDeleted
  } = useMap();

  const {
    zipResults,
    cityResults,
    countyResults,
    stateResults,
    filteredZipResults,
    filteredCityResults,
    filteredCountyResults,
    filteredStateResults,
    removeItem,
    getTotalExcludedCount,
    handleSort,
    getCurrentData,
    handleResultSelect,
    handleResultDoubleClick,
    isResultSelected
  } = useResults();

  const {
    isDarkMode,
    drawerState,
    isResizing,
    showCustomExport,
    setShowCustomExport,
    showToast,
    handleMouseDown,
    cycleDrawerState,
    copyToClipboard,
    exportSimpleCsv
  } = useUI();

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header with search mode toggle */}
      <Header
        searchMode={searchMode}
        handleSearchModeChange={handleSearchModeChange}
      />

      {/* Toast Notifications */}
      <ToastNotification />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Floating Search Controls */}
        <SearchControls
          handleSearch={handleSearch}
          handleSearchInputChange={handleSearchInputChange}
          handleAutocompleteBlur={handleAutocompleteBlur}
          handleAutocompleteSelect={handleAutocompleteSelect}
          handleCSVUpload={handleCSVUpload}
          handleRemoveFile={handleRemoveFile}
          handleResetSearch={handleResetSearch}
          setSelectedState={setSelectedState}
          setSelectedCounty={setSelectedCounty}
          setSelectedCity={setSelectedCity}
          hierarchyLocations={hierarchyLocations}
        />

        {/* Map Container */}
        <div className="flex-1 relative">
          <MapLayerSelector />

          <MapContainer
            searchMode={searchMode}
            isSearchMode={isSearchMode}
            handleMapClick={handleMapClick}
            handleViewportChange={handleViewportChange}
            onCreated={onCreated}
            onDeleted={onDeleted}
            selectedLocation={selectedLocation}
            radius={radius}
            radiusCenter={radiusCenter}
            handleResultSelect={handleResultSelect}
            geocodingService={{
              formatDisplayName: (location) => {
                if (location.display_name) return location.display_name;
                if (location.name) return location.name;
                return `${location.lat}, ${location.lng}`;
              }
            }}
          />
        </div>

        {/* Results Drawer */}
        <ResultsDrawer
          handleMouseDown={handleMouseDown}
          cycleDrawerState={cycleDrawerState}
          handleSort={handleSort}
          getCurrentData={getCurrentData}
          handleResultSelect={handleResultSelect}
          handleResultDoubleClick={handleResultDoubleClick}
          isResultSelected={isResultSelected}
          copyToClipboard={copyToClipboard}
          exportSimpleCsv={exportSimpleCsv}
          getTotalExcludedCount={getTotalExcludedCount}
          filteredZipResults={filteredZipResults}
          filteredCityResults={filteredCityResults}
          filteredCountyResults={filteredCountyResults}
          filteredStateResults={filteredStateResults}
        />
      </div>

      {/* Modals */}
      {showCustomExport && (
        <CustomExportModal
          isOpen={showCustomExport}
          onClose={() => setShowCustomExport(false)}
          data={getCurrentData()}
          activeTab={activeTab}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Add HeaderMappingModal if needed */}
    </div>
  );
};

/**
 * GeoApplication with all context providers
 * This wraps the main component with all necessary providers
 */
const GeoApplicationNew = () => {
  return (
    <UIProvider>
      <SearchProvider>
        <MapProvider>
          <ResultsProvider>
            <GeoApplicationContent />
          </ResultsProvider>
        </MapProvider>
      </SearchProvider>
    </UIProvider>
  );
};

export default GeoApplicationNew;
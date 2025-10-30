import React, { useEffect } from 'react';
import { MapProvider } from './contexts/MapContext';
import { SearchProvider } from './contexts/SearchContext';
import { ResultsProvider } from './contexts/ResultsContext';
import { UIProvider } from './contexts/UIContext';

import Header from './components/Header/Header';
import SearchControls from './components/Search/SearchControls';
import MapContainer from './components/Map/MapContainer';
import MapLayerSelector from './components/Map/MapLayerSelector';
import ResultsDrawer from './components/Results/ResultsDrawer';
import ToastNotification from './components/common/ToastNotification';
import CustomExportModal from './components/Modals/CustomExportModal';
import HeaderMappingModal from './components/Modals/HeaderMappingModal';
import ModeSwitchModal from './components/Modals/ModeSwitchModal';

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
    handleGeocodeCSVUpload,
    handleRemoveGeocodeFile,
    processGeocodeCSV,
    handleResetSearch,
    handleMapClickSearch,
    setSelectedState,
    setSelectedCounty,
    setSelectedCity,
    hierarchyLocations,
    selectedLocation,
    radiusCenter,
    radiusDisplaySettings,
    radiusSearches,
    activeRadiusSearchId,
    placingRadius,
    performSingleShapeSearch,
    removePolygonSearchByShapeId,
    addressSubMode,
    performSingleShapeSearchAddress,
    removeAddressSearchByShapeId,
    // CSV mapping modal state
    showHeaderMappingModal,
    setShowHeaderMappingModal,
    csvHeaders,
    csvPreviewData,
    columnMapping,
    setColumnMapping,
    processCSVWithMapping,
    processingProgress,
    geocodeProgress,
    // Mode switch modal
    showModeSwitchModal,
    pendingMode,
    handleClearAndSwitch,
    handleDownloadAndSwitch,
    handleCancelModeSwitch
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
    onDeleted,
    setMapClickCallback,
    setOnShapeCreatedCallback,
    setOnShapeDeletedCallback
  } = useMap();

  const {
    zipResults,
    cityResults,
    countyResults,
    stateResults,
    filteredAddressResults,
    filteredGeocodeResults,
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
    exportSimpleCsv,
    activeTab
  } = useUI();

  // Wire up map click handler for radius search
  useEffect(() => {
    if (setMapClickCallback) {
      setMapClickCallback(() => handleMapClickSearch);
    }
    return () => {
      if (setMapClickCallback) {
        setMapClickCallback(null);
      }
    };
  }, [setMapClickCallback, handleMapClickSearch]);

  // Wire up polygon search callbacks
  useEffect(() => {
    const isPolygonMode = searchMode === 'polygon';
    const isAddressPolygonMode = searchMode === 'address' && addressSubMode === 'polygon';

    if ((isPolygonMode || isAddressPolygonMode) && setOnShapeCreatedCallback && setOnShapeDeletedCallback) {
      // Set callback for when shapes are created
      setOnShapeCreatedCallback(() => (shape) => {
        if (isAddressPolygonMode && performSingleShapeSearchAddress) {
          performSingleShapeSearchAddress(shape, true); // appendResults = true for address polygon searches
        } else if (isPolygonMode) {
          performSingleShapeSearch(shape, true); // appendResults = true for polygon searches
        }
      });

      // Set callback for when shapes are deleted
      setOnShapeDeletedCallback(() => (deletedShapes) => {
        deletedShapes.forEach(shape => {
          if (isAddressPolygonMode && removeAddressSearchByShapeId) {
            removeAddressSearchByShapeId(shape.id);
          } else if (isPolygonMode) {
            removePolygonSearchByShapeId(shape.id);
          }
        });
      });
    } else if (setOnShapeCreatedCallback && setOnShapeDeletedCallback) {
      // Clear callbacks when not in polygon mode
      setOnShapeCreatedCallback(null);
      setOnShapeDeletedCallback(null);
    }

    return () => {
      if (setOnShapeCreatedCallback && setOnShapeDeletedCallback) {
        setOnShapeCreatedCallback(null);
        setOnShapeDeletedCallback(null);
      }
    };
  }, [searchMode, addressSubMode, setOnShapeCreatedCallback, setOnShapeDeletedCallback, performSingleShapeSearch, removePolygonSearchByShapeId, performSingleShapeSearchAddress, removeAddressSearchByShapeId]);

  // Wire up map interaction for result selection with zoom logic
  const { setMapInteractionCallback, markersRef } = useResults();
  const { handleResultMapInteraction } = useMap();

  useEffect(() => {
    if (setMapInteractionCallback && handleResultMapInteraction) {
      // Wrap in a function to avoid React treating it as a function updater
      setMapInteractionCallback(() => handleResultMapInteraction);
    }
  }, [setMapInteractionCallback, handleResultMapInteraction]);

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
          handleGeocodeCSVUpload={handleGeocodeCSVUpload}
          handleRemoveGeocodeFile={handleRemoveGeocodeFile}
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
            addressSubMode={addressSubMode}
            isSearchMode={isSearchMode}
            handleMapClick={handleMapClick}
            handleViewportChange={handleViewportChange}
            onCreated={onCreated}
            onDeleted={onDeleted}
            selectedLocation={selectedLocation}
            radius={radius}
            radiusCenter={radiusCenter}
            radiusDisplaySettings={radiusDisplaySettings}
            handleResultSelect={handleResultSelect}
            geocodingService={{
              formatDisplayName: (location) => {
                if (location.display_name) return location.display_name;
                if (location.name) return location.name;
                return `${location.lat}, ${location.lng}`;
              }
            }}
            radiusSearches={radiusSearches}
            activeRadiusSearchId={activeRadiusSearchId}
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
          filteredAddressResults={filteredAddressResults}
          filteredGeocodeResults={filteredGeocodeResults}
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
          data={getCurrentData(activeTab)}
          activeTab={activeTab}
          isDarkMode={isDarkMode}
          allData={{
            zips: zipResults,
            cities: cityResults,
            counties: countyResults,
            states: stateResults
          }}
        />
      )}

      {/* Header Mapping Modal for CSV uploads */}
      {showHeaderMappingModal && (
        <HeaderMappingModal
          isOpen={showHeaderMappingModal}
          onClose={() => setShowHeaderMappingModal(false)}
          headers={csvHeaders}
          previewData={csvPreviewData}
          columnMapping={columnMapping}
          setColumnMapping={setColumnMapping}
          onConfirm={searchMode === 'geocode' ? processGeocodeCSV : processCSVWithMapping}
          isDarkMode={isDarkMode}
          processingProgress={searchMode === 'geocode' ? geocodeProgress : processingProgress}
          isGeocodeMode={searchMode === 'geocode'}
        />
      )}

      {/* Mode Switch Modal */}
      <ModeSwitchModal
        isOpen={showModeSwitchModal}
        onClose={handleCancelModeSwitch}
        onClearAndSwitch={handleClearAndSwitch}
        onDownloadAndSwitch={handleDownloadAndSwitch}
        fromMode={searchMode}
        toMode={pendingMode}
        isDarkMode={isDarkMode}
      />
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
      <ResultsProvider>
        <MapProvider>
          <SearchProvider>
            <GeoApplicationContent />
          </SearchProvider>
        </MapProvider>
      </ResultsProvider>
    </UIProvider>
  );
};

export default GeoApplicationNew;

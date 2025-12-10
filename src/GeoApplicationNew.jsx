import React, { useEffect, useRef, useCallback } from 'react';
import { MapProvider } from './contexts/MapContext';
import { SearchProvider } from './contexts/SearchContext';
import { ResultsProvider } from './contexts/ResultsContext';
import { UIProvider } from './contexts/UIContext';
import { ShareProvider } from './contexts/ShareContext';

import Header from './components/Header/Header';
import SearchControls from './components/Search/SearchControls';
import MapContainer from './components/Map/MapContainer';
import MapLayerSelector from './components/Map/MapLayerSelector';
import BoundaryManager from './components/Map/BoundaryManager';
import ResultsDrawer from './components/Results/ResultsDrawer';
import ToastNotification from './components/common/ToastNotification';
import CustomExportModal from './components/Modals/CustomExportModal';
import HeaderMappingModal from './components/Modals/HeaderMappingModal';
import ModeSwitchModal from './components/Modals/ModeSwitchModal';
import ShareModal from './components/Modals/ShareModal';

import { useSearch } from './contexts/SearchContext';
import { useMap } from './contexts/MapContext';
import { useResults } from './contexts/ResultsContext';
import { useUI } from './contexts/UIContext';
import { useShare } from './contexts/ShareContext';

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
    handleCancelModeSwitch,
    restoreFromShareState
  } = useSearch();

  // Get share state
  const { sharedState, isSharedView } = useShare();

  const {
    mapCenter,
    mapZoom,
    mapRef,
    featureGroupRef,
    drawnShapes,
    setDrawnShapes,
    handleMapClick,
    handleViewportChange,
    onCreated,
    onDeleted,
    setMapClickCallback,
    setOnShapeCreatedCallback,
    setOnShapeDeletedCallback,
    setShowZipBoundaries,
    setShowStateBoundaries,
    setShowCityBoundaries,
    setShowVtdBoundaries
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

  // Ref to prevent multiple restorations
  const hasRestoredRef = useRef(false);

  // Helper function to create polygon shapes on the map from share data
  const createPolygonShapesFromShare = useCallback((polygonSearches) => {
    // Check if Leaflet and featureGroup are ready
    if (!window.L) {
      console.warn('[Share] Leaflet not ready, retrying in 500ms...');
      setTimeout(() => createPolygonShapesFromShare(polygonSearches), 500);
      return;
    }

    if (!featureGroupRef.current) {
      console.warn('[Share] featureGroupRef not ready, retrying in 500ms...');
      setTimeout(() => createPolygonShapesFromShare(polygonSearches), 500);
      return;
    }

    if (!polygonSearches || polygonSearches.length === 0) return;

    console.log('[Share] Creating polygon shapes on map:', polygonSearches.length);
    console.log('[Share] First polygon data:', JSON.stringify(polygonSearches[0], null, 2));

    const newShapes = [];

    polygonSearches.forEach((search, index) => {
      if (!search.coordinates || search.coordinates.length === 0) {
        console.warn('[Share] No coordinates for polygon:', search.id);
        return;
      }

      try {
        let layer;
        const overlayColor = search.overlayColor || search.settings?.overlayColor || '#dc2626';
        console.log('[Share] Creating shape with color:', overlayColor, 'coordinates count:', search.coordinates.length);

        if (search.shapeType === 'circle' && search.circleCenter && search.circleRadius) {
          // Create circle
          console.log('[Share] Creating circle at:', search.circleCenter, 'radius:', search.circleRadius);
          layer = window.L.circle(
            [search.circleCenter[0], search.circleCenter[1]],
            {
              radius: search.circleRadius,
              color: overlayColor,
              fillColor: overlayColor,
              fillOpacity: 0.15,
              weight: 2
            }
          );
        } else if (search.shapeType === 'rectangle' && search.bounds) {
          // Create rectangle
          console.log('[Share] Creating rectangle with bounds:', search.bounds);
          layer = window.L.rectangle(
            [
              [search.bounds.minLat, search.bounds.minLng],
              [search.bounds.maxLat, search.bounds.maxLng]
            ],
            {
              color: overlayColor,
              fillColor: overlayColor,
              fillOpacity: 0.15,
              weight: 2
            }
          );
        } else {
          // Create polygon from coordinates
          const latLngs = search.coordinates.map(coord => [coord.lat, coord.lng]);
          console.log('[Share] Creating polygon with latLngs:', latLngs.slice(0, 3), '...');
          layer = window.L.polygon(latLngs, {
            color: overlayColor,
            fillColor: overlayColor,
            fillOpacity: 0.15,
            weight: 2
          });
        }

        if (layer) {
          // Add to feature group
          featureGroupRef.current.addLayer(layer);
          console.log('[Share] Layer added to featureGroup');

          // Create shape object
          const shapeObj = {
            id: search.id || Date.now().toString() + index,
            layer,
            layerType: search.shapeType || 'polygon',
            coordinates: search.coordinates
          };

          newShapes.push(shapeObj);
        }
      } catch (error) {
        console.error('[Share] Error creating polygon shape:', error);
      }
    });

    if (newShapes.length > 0) {
      console.log('[Share] Setting', newShapes.length, 'shapes to drawnShapes');
      setDrawnShapes(prev => [...prev, ...newShapes]);
    }
  }, [featureGroupRef, setDrawnShapes]);

  // Restore searches from share URL on mount
  useEffect(() => {
    const restoreShare = async () => {
      if (sharedState && isSharedView && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        console.log('[Share] Detected shared state, restoring searches...');

        // Restore searches and get boundary settings back
        const boundarySettings = await restoreFromShareState(sharedState);

        // Apply boundary visibility settings
        if (boundarySettings) {
          if (boundarySettings.showZipBoundaries) setShowZipBoundaries(true);
          if (boundarySettings.showStateBoundaries) setShowStateBoundaries(true);
          if (boundarySettings.showCityBoundaries) setShowCityBoundaries(true);
          if (boundarySettings.showVtdBoundaries) setShowVtdBoundaries(true);
        }

        // Create polygon shapes on the map after a short delay to ensure map is ready
        if (sharedState.polygonSearches && sharedState.polygonSearches.length > 0) {
          setTimeout(() => {
            createPolygonShapesFromShare(sharedState.polygonSearches);
          }, 500);
        }

        // Auto-zoom to fit the search results after a delay
        setTimeout(() => {
          zoomToShareResults(sharedState);
        }, 800);
      }
    };

    restoreShare();
  }, [sharedState, isSharedView, restoreFromShareState, setShowZipBoundaries, setShowStateBoundaries, setShowCityBoundaries, setShowVtdBoundaries, createPolygonShapesFromShare]);

  // Helper function to zoom map to fit shared search results
  const zoomToShareResults = useCallback((sharedState) => {
    if (!mapRef.current || !sharedState) return;

    let bounds = null;

    // Calculate bounds from polygon searches
    if (sharedState.polygonSearches && sharedState.polygonSearches.length > 0) {
      const allBounds = sharedState.polygonSearches
        .filter(s => s.bounds)
        .map(s => s.bounds);

      if (allBounds.length > 0) {
        bounds = window.L.latLngBounds(
          [Math.min(...allBounds.map(b => b.minLat)), Math.min(...allBounds.map(b => b.minLng))],
          [Math.max(...allBounds.map(b => b.maxLat)), Math.max(...allBounds.map(b => b.maxLng))]
        );
      }
    }

    // Calculate bounds from radius searches
    if (sharedState.radiusSearches && sharedState.radiusSearches.length > 0) {
      const radiusBounds = sharedState.radiusSearches.map(s => {
        if (!s.center) return null;
        // Convert miles to degrees (rough approximation)
        const radiusDeg = (s.radius || 10) / 69; // ~69 miles per degree
        return {
          minLat: s.center[0] - radiusDeg,
          maxLat: s.center[0] + radiusDeg,
          minLng: s.center[1] - radiusDeg,
          maxLng: s.center[1] + radiusDeg
        };
      }).filter(Boolean);

      if (radiusBounds.length > 0) {
        const newBounds = window.L.latLngBounds(
          [Math.min(...radiusBounds.map(b => b.minLat)), Math.min(...radiusBounds.map(b => b.minLng))],
          [Math.max(...radiusBounds.map(b => b.maxLat)), Math.max(...radiusBounds.map(b => b.maxLng))]
        );
        bounds = bounds ? bounds.extend(newBounds) : newBounds;
      }
    }

    // Fit bounds with padding
    if (bounds && bounds.isValid()) {
      console.log('[Share] Zooming to fit bounds:', bounds);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [mapRef]);

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
  // IMPORTANT: There are TWO separate polygon features:
  // 1. POLYGON SEARCH MODE - Searches for ZIP codes/cities/counties within drawn polygons
  // 2. ADDRESS SEARCH POLYGON - Searches for street addresses within drawn polygons (via Overpass API)
  useEffect(() => {
    const isPolygonMode = searchMode === 'polygon';  // Regular Polygon Search mode
    const isAddressPolygonMode = searchMode === 'address' && addressSubMode === 'polygon';  // Address Search with polygon tool

    if ((isPolygonMode || isAddressPolygonMode) && setOnShapeCreatedCallback && setOnShapeDeletedCallback) {
      // Set callback for when shapes are created
      setOnShapeCreatedCallback(() => (shape) => {
        if (isAddressPolygonMode && performSingleShapeSearchAddress) {
          // ADDRESS SEARCH - Polygon tool: Search for street addresses via Overpass API
          performSingleShapeSearchAddress(shape, true); // appendResults = true for address polygon searches
        } else if (isPolygonMode) {
          // POLYGON SEARCH MODE: Search for ZIP codes/cities/counties
          performSingleShapeSearch(shape, true); // appendResults = true for polygon searches
        }
      });

      // Set callback for when shapes are deleted
      setOnShapeDeletedCallback(() => (deletedShapes) => {
        deletedShapes.forEach(shape => {
          if (isAddressPolygonMode && removeAddressSearchByShapeId) {
            // Remove Address Search polygon result
            removeAddressSearchByShapeId(shape.id);
          } else if (isPolygonMode) {
            // Remove Polygon Search mode result
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

      {/* Boundary Manager - handles loading boundary data based on toggles */}
      <BoundaryManager />

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

      {/* Share Modal */}
      <ShareModal />
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
            <ShareProvider>
              <GeoApplicationContent />
            </ShareProvider>
          </SearchProvider>
        </MapProvider>
      </ResultsProvider>
    </UIProvider>
  );
};

export default GeoApplicationNew;

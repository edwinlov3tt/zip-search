import React, { useEffect } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer } from 'react-leaflet';
import MapController from './MapController';
import DrawingControls from './DrawingControls';
import MapMarkers from './MapMarkers';
import BoundaryLayers from './BoundaryLayers';
import { useMap } from '../../contexts/MapContext';
import { useResults } from '../../contexts/ResultsContext';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';

const MapContainer = ({
  searchMode,
  addressSubMode,
  isSearchMode,
  handleMapClick,
  handleViewportChange,
  onCreated,
  onDeleted,
  selectedLocation,
  radius,
  radiusCenter,
  radiusDisplaySettings,
  handleResultSelect,
  geocodingService,
  radiusSearches,
  activeRadiusSearchId
}) => {
  const {
    mapType,
    mapCenter,
    mapZoom,
    mapRef,
    featureGroupRef,
    showCountyBorders,
    countyBoundaries,
    selectedCountyBoundary,
    showZipBoundaries,
    zipBoundariesData,
    focusedZipCode,
    showOnlyFocusedBoundary,
    showStateBoundaries,
    stateBoundariesData,
    showCityBoundaries,
    cityBoundariesData,
    showMarkers
  } = useMap();

  const {
    zipResults,
    addressResults,
    geocodeResults,
    countyResults,
    removedItems,
    getRemovalKey,
    setRemovedItems,
    setZipResults
  } = useResults();

  const { addressSearches, activeAddressSearchId } = useSearch();

  const { activeTab, setActiveTab } = useUI();

  const showRadiusOverlay = radiusDisplaySettings?.showRadius !== false;

  // Determine if we should show crosshair cursor
  const shouldShowCrosshair = searchMode === 'radius' || (searchMode === 'address' && addressSubMode === 'radius');

  // Determine if we should show drawing controls
  const shouldShowDrawingControls = searchMode === 'polygon' || (searchMode === 'address' && addressSubMode === 'polygon');

  // Get tile layer URL based on map type
  const getTileLayer = () => {
    switch (mapType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      default: // street
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  return (
    <LeafletMapContainer
      center={mapCenter}
      zoom={mapZoom}
      className="w-full h-full"
      zoomControl={false}
      ref={mapRef}
      style={{
        cursor: shouldShowCrosshair ? 'crosshair' : undefined
      }}
    >
      <TileLayer
        url={getTileLayer()}
        attribution={mapType === 'street' ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' : ''}
      />

      <MapController
        center={mapCenter}
        zoom={mapZoom}
        onMapClick={handleMapClick}
        crosshairCursor={shouldShowCrosshair}
        onViewportChange={handleViewportChange}
      />

      {/* Drawing Controls - For Polygon Search and Address Polygon Mode */}
      {shouldShowDrawingControls && (
        <DrawingControls
          featureGroupRef={featureGroupRef}
          onCreated={onCreated}
          onDeleted={onDeleted}
        />
      )}

      {/* Map Markers */}
      <MapMarkers
        zipResults={zipResults}
        addressResults={addressResults}
        geocodeResults={geocodeResults}
        selectedLocation={selectedLocation}
        radius={radius}
        radiusCenter={radiusCenter}
        searchMode={searchMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleResultSelect={handleResultSelect}
        geocodingService={geocodingService}
        removedItems={removedItems}
        getRemovalKey={getRemovalKey}
        showRadius={showRadiusOverlay}
        showMarkers={showMarkers}
        radiusSearches={radiusSearches}
        activeRadiusSearchId={activeRadiusSearchId}
        addressSearches={addressSearches}
        activeAddressSearchId={activeAddressSearchId}
      />

      {/* Boundary Layers */}
      <BoundaryLayers
        showCountyBorders={showCountyBorders}
        countyBoundaries={countyBoundaries}
        selectedCountyBoundary={selectedCountyBoundary}
        showZipBoundaries={showZipBoundaries}
        zipBoundariesData={zipBoundariesData}
        focusedZipCode={focusedZipCode}
        showOnlyFocusedBoundary={showOnlyFocusedBoundary}
        showStateBoundaries={showStateBoundaries}
        stateBoundariesData={stateBoundariesData}
        showCityBoundaries={showCityBoundaries}
        cityBoundariesData={cityBoundariesData}
        countyResults={countyResults}
        zipResults={zipResults}
        removedItems={removedItems}
        getRemovalKey={getRemovalKey}
        setRemovedItems={setRemovedItems}
        setZipResults={setZipResults}
      />
    </LeafletMapContainer>
  );
};

export default MapContainer;

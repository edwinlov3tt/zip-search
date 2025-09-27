import React, { useEffect } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer } from 'react-leaflet';
import MapController from './MapController';
import DrawingControls from './DrawingControls';
import MapMarkers from './MapMarkers';
import BoundaryLayers from './BoundaryLayers';
import { useMap } from '../../contexts/MapContext';
import { useResults } from '../../contexts/ResultsContext';
import { useUI } from '../../contexts/UIContext';

const MapContainer = ({
  searchMode,
  isSearchMode,
  handleMapClick,
  handleViewportChange,
  onCreated,
  onDeleted,
  selectedLocation,
  radius,
  radiusCenter,
  handleResultSelect,
  geocodingService
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
    cityBoundariesData
  } = useMap();

  const {
    zipResults,
    countyResults,
    removedItems,
    getRemovalKey,
    setRemovedItems,
    setZipResults
  } = useResults();

  const { activeTab, setActiveTab } = useUI();

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
        cursor: searchMode === 'radius' && isSearchMode ? 'crosshair' : undefined
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
        crosshairCursor={searchMode === 'radius' && isSearchMode}
        onViewportChange={handleViewportChange}
      />

      {/* Drawing Controls - Only for Polygon Search */}
      {searchMode === 'polygon' && (
        <DrawingControls
          featureGroupRef={featureGroupRef}
          onCreated={onCreated}
          onDeleted={onDeleted}
        />
      )}

      {/* Map Markers */}
      <MapMarkers
        zipResults={zipResults}
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
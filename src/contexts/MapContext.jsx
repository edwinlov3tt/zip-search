import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import zipBoundariesService from '../services/zipBoundariesService';
import stateBoundariesService from '../services/stateBoundariesService';

const MapContext = createContext();

export const useMap = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap must be used within MapProvider');
  }
  return context;
};

export const MapProvider = ({ children }) => {
  // Map state
  const [mapType, setMapType] = useState('street');
  const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]); // Geographic center of US
  const [mapZoom, setMapZoom] = useState(4); // Zoom level to show entire US
  const [currentViewport, setCurrentViewport] = useState(null);

  // Drawing state
  const [drawnShapes, setDrawnShapes] = useState([]);
  const [isSearchMode, setIsSearchMode] = useState(true); // true = search, false = reset

  // Boundaries state
  const [showCountyBorders, setShowCountyBorders] = useState(false);
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [selectedCountyBoundary, setSelectedCountyBoundary] = useState(null);

  const [showZipBoundaries, setShowZipBoundaries] = useState(false);
  const [zipBoundariesData, setZipBoundariesData] = useState(null);
  const [loadingZipBoundaries, setLoadingZipBoundaries] = useState(false);
  const [focusedZipCode, setFocusedZipCode] = useState(null);
  const [showOnlyFocusedBoundary, setShowOnlyFocusedBoundary] = useState(false);

  const [showStateBoundaries, setShowStateBoundaries] = useState(false);
  const [stateBoundariesData, setStateBoundariesData] = useState(null);
  const [loadingStateBoundaries, setLoadingStateBoundaries] = useState(false);

  const [showCityBoundaries, setShowCityBoundaries] = useState(false);
  const [cityBoundariesData, setCityBoundariesData] = useState(null);
  const [loadingCityBoundaries, setLoadingCityBoundaries] = useState(false);

  // Map layer selector state
  const [showMapLayers, setShowMapLayers] = useState(false);

  // Marker visibility state
  const [showMarkers, setShowMarkers] = useState(true);

  // Refs
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const featureGroupRef = useRef(null);

  // Map click handler for radius placement
  const [mapClickCallback, setMapClickCallback] = useState(null);

  const handleMapClick = useCallback((e) => {
    if (e && e.latlng && mapClickCallback) {
      mapClickCallback(e.latlng);
    }
  }, [mapClickCallback]);

  // Handler for centering and zooming map when results are clicked
  const handleResultMapInteraction = useCallback(async ({ type, result, center, zoom, bounds, padding }) => {
    if (!mapRef.current) return;

    // Handle special fitBounds type
    if (type === 'fitBounds' && bounds) {
      // Fit the map to show all bounds with padding
      mapRef.current.fitBounds(bounds, {
        animate: true,
        padding: padding || 50
      });
      // Clear any focused items
      setFocusedZipCode(null);
      return;
    }

    // Set the map view directly with animation (don't update state to avoid conflicts)
    mapRef.current.setView(center, zoom, { animate: true });

    // Additional logic based on type (can be extended later for boundaries, etc.)
    switch (type) {
      case 'zip':
        // For ZIP codes, we might want to show boundaries
        setFocusedZipCode(result.zipCode);
        // Use functional update to avoid dependency on showZipBoundaries
        setShowZipBoundaries(prev => prev || true);
        break;
      case 'city':
        // For cities, clear ZIP focus
        setFocusedZipCode(null);
        break;
      case 'county':
        // For counties, show county boundaries
        setFocusedZipCode(null);
        setShowCountyBorders(true);
        setSelectedCountyBoundary({ name: result.name, state: result.state });
        break;
      case 'state':
        // For states, show state boundaries
        setFocusedZipCode(null);
        // Use functional update to avoid dependency on showStateBoundaries
        setShowStateBoundaries(prev => prev || true);
        break;
    }
  }, []); // Remove dependencies to prevent recreation

  // Viewport change handler for boundary loading
  const handleViewportChange = useCallback((viewport) => {
    setCurrentViewport(viewport);
  }, []);

  // Drawing handlers for polygon search
  const [onShapeCreatedCallback, setOnShapeCreatedCallback] = useState(null);
  const [onShapeDeletedCallback, setOnShapeDeletedCallback] = useState(null);

  const onCreated = useCallback((e) => {
    const { layer, layerType } = e;
    const newShape = { layer, type: layerType, id: layer._leaflet_id };
    setDrawnShapes(prev => [...prev, newShape]);

    // Trigger search for this shape if callback is set
    if (onShapeCreatedCallback) {
      onShapeCreatedCallback(newShape);
    }
  }, [onShapeCreatedCallback]);

  const onDeleted = useCallback((e) => {
    const { layers } = e;
    const deletedIds = [];
    const deletedShapes = [];

    layers.eachLayer((layer) => {
      deletedIds.push(layer._leaflet_id);
      // Find the shape being deleted
      const shape = drawnShapes.find(s => s.layer._leaflet_id === layer._leaflet_id);
      if (shape) {
        deletedShapes.push(shape);
      }
    });

    setDrawnShapes(prev =>
      prev.filter(shape => !deletedIds.includes(shape.layer._leaflet_id))
    );

    // Notify about deleted shapes if callback is set
    if (onShapeDeletedCallback && deletedShapes.length > 0) {
      onShapeDeletedCallback(deletedShapes);
    }
  }, [drawnShapes, onShapeDeletedCallback]);

  // Load county boundaries from static file
  const loadCountyBoundaries = useCallback(async () => {
    try {
      console.log('Loading county boundaries from static file...');
      const url = '/boundaries/us-counties.geojson';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCountyBoundaries(data);
        console.log('County boundaries loaded successfully');
      } else {
        console.warn(`County boundaries file not accessible (${response.status})`);
      }
    } catch (error) {
      console.error('Failed to load county boundaries:', error);
    }
  }, []);

  // Effect to load county boundaries when toggled
  useEffect(() => {
    if (showCountyBorders && !countyBoundaries) {
      loadCountyBoundaries();
    }
  }, [showCountyBorders, countyBoundaries, loadCountyBoundaries]);

  // Note: ZIP boundary loading now happens in GeoApplication based on search results
  // This provides better performance and only loads boundaries for relevant ZIPs

  // Effect to clear ZIP boundaries when toggled off
  useEffect(() => {
    if (!showZipBoundaries) {
      setZipBoundariesData(null);
    }
    // Note: Loading happens in GeoApplication based on search results
  }, [showZipBoundaries]);

  // Effect to clear state boundaries when toggled off
  useEffect(() => {
    if (!showStateBoundaries) {
      setStateBoundariesData(null);
    }
    // Note: Loading happens in GeoApplication based on search results
  }, [showStateBoundaries]);

  // Effect to clear city boundaries when toggled off
  useEffect(() => {
    if (!showCityBoundaries) {
      setCityBoundariesData(null);
    }
    // Note: Loading happens in GeoApplication based on search results
  }, [showCityBoundaries]);

  const value = {
    // Map state
    mapType,
    setMapType,
    mapCenter,
    setMapCenter,
    mapZoom,
    setMapZoom,
    currentViewport,
    setCurrentViewport,

    // Drawing state
    drawnShapes,
    setDrawnShapes,
    isSearchMode,
    setIsSearchMode,

    // County boundaries
    showCountyBorders,
    setShowCountyBorders,
    countyBoundaries,
    setCountyBoundaries,
    selectedCountyBoundary,
    setSelectedCountyBoundary,

    // ZIP boundaries
    showZipBoundaries,
    setShowZipBoundaries,
    zipBoundariesData,
    setZipBoundariesData,
    loadingZipBoundaries,
    setLoadingZipBoundaries,
    focusedZipCode,
    setFocusedZipCode,
    showOnlyFocusedBoundary,
    setShowOnlyFocusedBoundary,

    // State boundaries
    showStateBoundaries,
    setShowStateBoundaries,
    stateBoundariesData,
    setStateBoundariesData,
    loadingStateBoundaries,
    setLoadingStateBoundaries,

    // City boundaries
    showCityBoundaries,
    setShowCityBoundaries,
    cityBoundariesData,
    setCityBoundariesData,
    loadingCityBoundaries,
    setLoadingCityBoundaries,

    // Map layer selector
    showMapLayers,
    setShowMapLayers,

    // Marker visibility
    showMarkers,
    setShowMarkers,

    // Refs
    mapRef,
    markersRef,
    featureGroupRef,

    // Handlers
    handleMapClick,
    handleViewportChange,
    onCreated,
    onDeleted,
    setMapClickCallback,
    setOnShapeCreatedCallback,
    setOnShapeDeletedCallback,
    handleResultMapInteraction
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};
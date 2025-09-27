import React, { createContext, useContext, useState, useRef } from 'react';

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

  // Refs
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const featureGroupRef = useRef(null);

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

    // Refs
    mapRef,
    markersRef,
    featureGroupRef
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};
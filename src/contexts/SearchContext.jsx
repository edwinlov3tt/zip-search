import React, { createContext, useContext, useState, useCallback } from 'react';
import { ZipCodeService } from '../services/zipCodeService';

const SearchContext = createContext();

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
};

export const SearchProvider = ({ children }) => {
  // Search mode and parameters
  const [searchMode, setSearchMode] = useState('radius'); // 'radius', 'polygon', 'hierarchy', 'upload'
  const [searchTerm, setSearchTerm] = useState('');
  const [radius, setRadius] = useState(10);

  // Hierarchy search
  const [selectedState, setSelectedState] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [availableStates, setAvailableStates] = useState([]);
  const [availableCounties, setAvailableCounties] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(true); // Start in search mode for radius search
  const [isSearching, setIsSearching] = useState(false); // For autocomplete loading
  const [isLoading, setIsLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [searchHistory, setSearchHistory] = useState(['90210', 'New York, NY', 'Los Angeles, CA']);

  // Radius search
  const [radiusCenter, setRadiusCenter] = useState(null);
  const [placingRadius, setPlacingRadius] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Upload search
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  // CSV mapping
  const [showHeaderMappingModal, setShowHeaderMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvPreviewData, setCsvPreviewData] = useState([]);
  const [csvFullData, setCsvFullData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});

  // Reset function
  const handleReset = useCallback(() => {
    if (searchMode === 'radius') {
      // For radius mode, toggle between search and place mode
      setIsSearchMode(true);
      setRadiusCenter(null);
      setSearchPerformed(false);
    } else {
      // For other modes, full reset
      setSearchTerm('');
      setSelectedState('');
      setSelectedCounty('');
      setSelectedCity('');
      setAvailableCounties([]);
      setAvailableCities([]);
      setSearchPerformed(false);
      setApiError(null);
      setRadiusCenter(null);
      setPlacingRadius(false);
      setUploadedFile(null);
      setUploadError(null);
    }
  }, [searchMode]);

  // Search mode change handler
  const handleSearchModeChange = useCallback((newMode) => {
    setSearchMode(newMode);
    handleReset();
  }, [handleReset]);

  const value = {
    // Search mode and parameters
    searchMode,
    setSearchMode: handleSearchModeChange,
    searchTerm,
    setSearchTerm,
    radius,
    setRadius,

    // Hierarchy search
    selectedState,
    setSelectedState,
    selectedCounty,
    setSelectedCounty,
    selectedCity,
    setSelectedCity,
    availableStates,
    setAvailableStates,
    availableCounties,
    setAvailableCounties,
    availableCities,
    setAvailableCities,

    // Search state
    isSearchMode,
    setIsSearchMode,
    isSearching,
    setIsSearching,
    isLoading,
    setIsLoading,
    searchPerformed,
    setSearchPerformed,
    searchError,
    setSearchError,
    apiError,
    setApiError,
    searchHistory,
    setSearchHistory,

    // Radius search
    radiusCenter,
    setRadiusCenter,
    placingRadius,
    setPlacingRadius,
    selectedLocation,
    setSelectedLocation,

    // Upload search
    uploadedFile,
    setUploadedFile,
    uploadProcessing,
    setUploadProcessing,
    uploadError,
    setUploadError,
    processingProgress,
    setProcessingProgress,

    // CSV mapping
    showHeaderMappingModal,
    setShowHeaderMappingModal,
    csvHeaders,
    setCsvHeaders,
    csvPreviewData,
    setCsvPreviewData,
    csvFullData,
    setCsvFullData,
    columnMapping,
    setColumnMapping,

    // Functions
    handleReset
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
};
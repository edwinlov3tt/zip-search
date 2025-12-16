import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { ZipCodeService } from '../services/zipCodeService';
import { geocodingService } from '../services/geocodingService';
import { googlePlacesService } from '../services/googlePlacesService';
import { detectColumnTypes } from '../utils/csvHelpers';
import { milesToMeters } from '../utils/polygonHelpers';
import { useResults } from './ResultsContext';
import { useMap } from './MapContext';
import { useUI } from './UIContext';

const SearchContext = createContext();

// Color palette for search overlays (10 distinct, visually-tested colors)
export const SEARCH_COLOR_PALETTE = [
  '#dc2626', // red
  '#2563eb', // blue
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#c026d3', // fuchsia
  '#ca8a04', // yellow
  '#4f46e5', // indigo
  '#059669', // emerald
];

const DEFAULT_RADIUS_DISPLAY_SETTINGS = {
  showRadius: true,
  showMarkers: true,
  showZipBorders: false,
  overlayColor: null // null = auto-assign from palette based on sequence
};

const MAX_RADIUS_HISTORY = 6;

const createRadiusSettings = (overrides = {}) => ({
  ...DEFAULT_RADIUS_DISPLAY_SETTINGS,
  ...overrides
});

const generateRadiusSearchId = () =>
  `radius-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const buildRadiusSignature = (lat, lng, radius) => {
  if (lat == null || lng == null) return null;
  const normalizedRadius = radius == null ? 'na' : Number(radius);
  return `${Number(lat).toFixed(5)}|${Number(lng).toFixed(5)}|${normalizedRadius}`;
};

const formatCenterFallback = (lat, lng) => {
  if (lat == null || lng == null) return 'Radius search';
  return `${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}`;
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
};

export const SearchProvider = ({ children }) => {
  const {
    zipResults,
    setZipResults,
    setCityResults,
    setCountyResults,
    setStateResults,
    addressResults,
    setAddressResults,
    geocodeResults,
    setGeocodeResults,
    setNotFoundAddresses,
    setCurrentPage,
    setHasMoreResults,
    setTotalResults,
    clearResults
  } = useResults();

  const { setMapCenter, setMapZoom, mapRef, featureGroupRef, setDrawnShapes, setMapType, mapType, handleResultMapInteraction } = useMap();

  const { setIsSearchPanelCollapsed, setActiveTab, setDrawerState } = useUI();

  // Search mode and parameters
  const [searchMode, setSearchMode] = useState('radius'); // 'radius', 'polygon', 'hierarchy', 'upload', 'geocode'
  const [searchTerm, setSearchTerm] = useState('');
  const [radius, setRadius] = useState(10); // Default 10 miles for Radius Search (ZIP codes)
  const [addressRadius, setAddressRadius] = useState(2); // Default 2 miles for Address Search

  // Hierarchy search
  const [selectedState, setSelectedState] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [availableStates, setAvailableStates] = useState([]);
  const [availableCounties, setAvailableCounties] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);

  // Hierarchy search history
  const [hierarchySearches, setHierarchySearches] = useState([]);
  const [activeHierarchySearchId, setActiveHierarchySearchId] = useState(null);
  const [citySearchDisabled, setCitySearchDisabled] = useState(false);

  // Polygon search
  const [polygonSearches, setPolygonSearches] = useState([]);
  const [activePolygonSearchId, setActivePolygonSearchId] = useState(null);
  const [polygonDisplaySettings, setPolygonDisplaySettings] = useState({
    showShape: true,
    showMarkers: true,
    showZipBorders: false
  });
  const [availableShapeNumbers, setAvailableShapeNumbers] = useState(new Set());
  const [nextShapeNumber, setNextShapeNumber] = useState(1);

  const stateNameByCode = useMemo(() => {
    const map = new Map();
    availableStates.forEach((state) => {
      if (state?.code) {
        map.set(state.code, state.name || state.code);
      }
    });
    return map;
  }, [availableStates]);

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
  const [radiusSearches, setRadiusSearches] = useState([]);
  const [activeRadiusSearchId, setActiveRadiusSearchId] = useState(null);
  const [radiusDisplaySettings, setRadiusDisplaySettings] = useState(() => createRadiusSettings());

  // Upload search
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  // Geocode search
  const [geocodeFile, setGeocodeFile] = useState(null);
  const [geocodeProcessing, setGeocodeProcessing] = useState(false);
  const [geocodeError, setGeocodeError] = useState(null);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [geocodeJobId, setGeocodeJobId] = useState(null);
  const [geocodePreparedAddresses, setGeocodePreparedAddresses] = useState([]);

  // Address search
  const [addressSearches, setAddressSearches] = useState([]);
  const [activeAddressSearchId, setActiveAddressSearchId] = useState(null);
  const [addressSubMode, setAddressSubMode] = useState('radius'); // 'radius' or 'polygon'
  const [addressDisplaySettings, setAddressDisplaySettings] = useState({
    showMarkers: false, // Disabled by default to reduce DOM size
    showRadius: true,   // Keep radius circle visible
    showResults: true,
    showZipBorders: false
  });
  const [lastOverpassCall, setLastOverpassCall] = useState(0);
  const [overpassCooldownRemaining, setOverpassCooldownRemaining] = useState(0);

  // Worker API for address search
  const [addressJobId, setAddressJobId] = useState(null);
  const [addressJobProgress, setAddressJobProgress] = useState({ progress: 0, found: 0 });
  const addressEventSourceRef = useRef(null);

  // Mode switch modal
  const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  // Map type restoration for Address Search mode
  const [previousMapType, setPreviousMapType] = useState(null);

  // CSV mapping
  const [showHeaderMappingModal, setShowHeaderMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvPreviewData, setCsvPreviewData] = useState([]);
  const [csvFullData, setCsvFullData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});

  // Combined results controls
  const [combineSearchResults, setCombineSearchResults] = useState(true);
  const [searchResultsById, setSearchResultsById] = useState({});
  const [excludedSearchIds, setExcludedSearchIds] = useState([]);

  const getNextSequenceNumber = useCallback((list) => {
    const used = new Set();
    (list || []).forEach(entry => {
      if (entry?.sequence != null) {
        used.add(entry.sequence);
      }
    });
    let candidate = 1;
    while (used.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }, []);

  // Autocomplete
  const searchDebounceRef = useRef(null);

  const normalizeZipResults = useCallback((rawResults = []) => {
    if (!Array.isArray(rawResults)) return [];

    const seen = new Set();
    return rawResults.reduce((acc, zip, index) => {
      const zipCode = zip?.zipcode || zip?.zipCode || zip?.zip || '';
      const city = zip?.city || zip?.primary_city || '';
      const county = zip?.county || '';
      const state = zip?.stateCode || zip?.state_code || zip?.state || '';
      const lat = Number(zip?.latitude ?? zip?.lat ?? NaN);
      const lng = Number(zip?.longitude ?? zip?.lng ?? NaN);

      const id = zipCode || `${city || 'zip'}-${state || '??'}-${index}`;

      if (zipCode && seen.has(zipCode)) {
        return acc;
      }

      if (zipCode) {
        seen.add(zipCode);
      }

      acc.push({
        id,
        zipCode,
        city,
        county,
        state,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
        area: typeof zip?.area === 'number' ? zip.area : 0,
        overlap: typeof zip?.overlap === 'number' ? zip.overlap : 0,
        searchIds: [],
        searchSequences: []
      });
      return acc;
    }, []);
  }, []);

  // Function to update aggregated results for cities, counties, and states
  const updateAggregatedResults = useCallback((zipRecords, sequenceLookup = {}) => {
    if (!Array.isArray(zipRecords) || zipRecords.length === 0) {
      setCityResults([]);
      setCountyResults([]);
      setStateResults([]);
      return;
    }

    const averageCoord = (items, key) => {
      const values = items
        .map((item) => Number(item[key] ?? item[key === 'lat' ? 'latitude' : 'longitude']))
        .filter((value) => Number.isFinite(value));
      if (values.length === 0) return null;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    const cityMap = new Map();
    const countyMap = new Map();
    const stateMap = new Map();

    zipRecords.forEach((zip) => {
      if (zip.city) {
        const cityKey = `${zip.city}|${zip.state}|${zip.county || ''}`;
        if (!cityMap.has(cityKey)) cityMap.set(cityKey, []);
        cityMap.get(cityKey).push(zip);
      }

      if (zip.county) {
        const countyKey = `${zip.county}|${zip.state}`;
        if (!countyMap.has(countyKey)) countyMap.set(countyKey, []);
        countyMap.get(countyKey).push(zip);
      }

      if (zip.state) {
        const stateKey = zip.state;
        if (!stateMap.has(stateKey)) stateMap.set(stateKey, []);
        stateMap.get(stateKey).push(zip);
      }
    });

    const cityResults = Array.from(cityMap.entries()).map(([key, items]) => {
      const [city, state, county] = key.split('|');
      const lat = averageCoord(items, 'lat');
      const lng = averageCoord(items, 'lng');
      const citySearchIds = new Set();
      const citySequences = new Set();

      // Aggregate population and households
      const totalPopulation = items.reduce((sum, z) => sum + (z.population || 0), 0);
      const totalHouseholds = items.reduce((sum, z) => sum + (z.households || 0), 0);

      items.forEach(item => {
        (item.searchIds || []).forEach(id => citySearchIds.add(id));
        if (item.searchSequences && item.searchSequences.length > 0) {
          item.searchSequences.forEach(seq => citySequences.add(seq));
        } else {
          (item.searchIds || []).forEach(id => {
            const seq = sequenceLookup[id];
            if (seq != null) citySequences.add(seq);
          });
        }
      });
      return {
        id: `city-${city}-${state}-${county}`,
        name: city,
        state,
        county,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        population: totalPopulation,
        households: totalHouseholds,
        zipCount: items.length,
        searchIds: Array.from(citySearchIds),
        searchSequences: Array.from(citySequences).sort((a, b) => a - b)
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const countyResults = Array.from(countyMap.entries()).map(([key, items]) => {
      const [county, state] = key.split('|');
      const lat = averageCoord(items, 'lat');
      const lng = averageCoord(items, 'lng');
      const countySearchIds = new Set();
      const countySequences = new Set();

      // Aggregate population and households
      const totalPopulation = items.reduce((sum, z) => sum + (z.population || 0), 0);
      const totalHouseholds = items.reduce((sum, z) => sum + (z.households || 0), 0);
      const uniqueCities = new Set(items.map(z => z.city));

      items.forEach(item => {
        (item.searchIds || []).forEach(id => countySearchIds.add(id));
        if (item.searchSequences && item.searchSequences.length > 0) {
          item.searchSequences.forEach(seq => countySequences.add(seq));
        } else {
          (item.searchIds || []).forEach(id => {
            const seq = sequenceLookup[id];
            if (seq != null) countySequences.add(seq);
          });
        }
      });
      return {
        id: `county-${county}-${state}`,
        name: county,
        state,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        population: totalPopulation,
        households: totalHouseholds,
        zipCount: items.length,
        cityCount: uniqueCities.size,
        searchIds: Array.from(countySearchIds),
        searchSequences: Array.from(countySequences).sort((a, b) => a - b)
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const stateResults = Array.from(stateMap.entries()).map(([state, items]) => {
      const lat = averageCoord(items, 'lat');
      const lng = averageCoord(items, 'lng');
      const name = stateNameByCode.get(state) || state;
      const stateSearchIds = new Set();
      const stateSequences = new Set();

      // Aggregate population and households
      const totalPopulation = items.reduce((sum, z) => sum + (z.population || 0), 0);
      const totalHouseholds = items.reduce((sum, z) => sum + (z.households || 0), 0);
      const uniqueCities = new Set(items.map(z => z.city));
      const uniqueCounties = new Set(items.map(z => z.county));

      items.forEach(item => {
        (item.searchIds || []).forEach(id => stateSearchIds.add(id));
        if (item.searchSequences && item.searchSequences.length > 0) {
          item.searchSequences.forEach(seq => stateSequences.add(seq));
        } else {
          (item.searchIds || []).forEach(id => {
            const seq = sequenceLookup[id];
            if (seq != null) stateSequences.add(seq);
          });
        }
      });
      return {
        id: `state-${state}`,
        name,
        state,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        population: totalPopulation,
        households: totalHouseholds,
        zipCount: items.length,
        cityCount: uniqueCities.size,
        countyCount: uniqueCounties.size,
        searchIds: Array.from(stateSearchIds),
        searchSequences: Array.from(stateSequences).sort((a, b) => a - b)
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    setCityResults(cityResults);
    setCountyResults(countyResults);
    setStateResults(stateResults);
  }, [setCityResults, setCountyResults, setStateResults, stateNameByCode]);

  // Function to rebuild displayed results based on current state
  const rebuildDisplayedResults = useCallback((overrideMap, overrideActiveId, overrideRadiusSearches) => {
    const resultsById = overrideMap || searchResultsById;
    const searchList = (overrideRadiusSearches || radiusSearches).map((entry, idx) => ({
      ...entry,
      sequence: typeof entry.sequence === 'number' ? entry.sequence : idx + 1
    }));
    const activeId = overrideActiveId ?? activeRadiusSearchId;

    const sequenceLookup = {};
    searchList.forEach((entry) => {
      sequenceLookup[entry.id] = entry.sequence;
    });

    const excludedSet = new Set(excludedSearchIds);

    const allowedIds = combineSearchResults
      ? searchList.map(entry => entry.id).filter(id => !excludedSet.has(id))
      : (activeId && !excludedSet.has(activeId) ? [activeId] : []);

    const zipMap = new Map();

    allowedIds.forEach(id => {
      const results = resultsById[id] || [];
      const sequence = sequenceLookup[id];
      results.forEach(item => {
        const key = item.zipCode || item.id;
        if (!key) return;
        const existing = zipMap.get(key);
        if (existing) {
          if (!existing.searchIds.includes(id)) {
            existing.searchIds = [...existing.searchIds, id];
          }
          if (sequence != null && !existing.searchSequences.includes(sequence)) {
            existing.searchSequences = [...existing.searchSequences, sequence].sort((a, b) => a - b);
          }
        } else {
          const nextItem = {
            ...item,
            searchIds: item.searchIds && item.searchIds.length > 0 ? Array.from(new Set(item.searchIds.concat(id))) : [id],
            searchSequences: item.searchSequences && item.searchSequences.length > 0
              ? Array.from(new Set(item.searchSequences.concat(sequence != null ? [sequence] : []))).sort((a, b) => a - b)
              : (sequence != null ? [sequence] : [])
          };
          zipMap.set(key, nextItem);
        }
      });
    });

    const mergedZipRecords = Array.from(zipMap.values());

    setZipResults(mergedZipRecords);
    setTotalResults(mergedZipRecords.length);
    setHasMoreResults(false);
    setCurrentPage(0);
    updateAggregatedResults(mergedZipRecords, sequenceLookup);
  }, [searchResultsById, activeRadiusSearchId, radiusSearches, combineSearchResults, excludedSearchIds, setZipResults, setTotalResults, setHasMoreResults, setCurrentPage, updateAggregatedResults]);

  // Address search helper functions (must be before handleMapClickSearch)
  const checkOverpassCooldown = useCallback(() => {
    const now = Date.now();
    const timeSinceLastCall = now - lastOverpassCall;
    const minInterval = 5000; // 5 seconds
    const remaining = minInterval - timeSinceLastCall;

    if (remaining > 0) {
      return Math.ceil(remaining / 1000); // Return seconds remaining
    }
    return 0; // Ready to search
  }, [lastOverpassCall]);

  // Perform address search via Worker API with streaming
  const searchAddressesViaWorker = useCallback(async (params) => {
    const { startAddressSearch, streamAddressResults } = await import('../services/addressApiService');

    return new Promise((resolve, reject) => {
      let allAddresses = [];

      // Start the job
      startAddressSearch(params)
        .then(({ jobId }) => {
          setAddressJobId(jobId);
          setAddressJobProgress({ progress: 0, found: 0 });

          // Stream results
          const eventSource = streamAddressResults(jobId, {
            onProgress: (data) => {
              setAddressJobProgress({ progress: data.progress, found: data.found });
            },
            onBatch: (addresses) => {
              allAddresses = allAddresses.concat(addresses);
              setAddressJobProgress(prev => ({ ...prev, found: allAddresses.length }));
            },
            onComplete: (result) => {
              setAddressJobId(null);
              setAddressJobProgress({ progress: 100, found: result.totalFound });
              setLastOverpassCall(Date.now());
              resolve(allAddresses);
            },
            onError: (error) => {
              setAddressJobId(null);
              setAddressJobProgress({ progress: 0, found: 0 });
              reject(new Error(error.message || 'Address search failed'));
            }
          });

          addressEventSourceRef.current = eventSource;
        })
        .catch((err) => {
          setAddressJobId(null);
          reject(err);
        });
    });
  }, [setLastOverpassCall]);

  // Cancel active address search
  const cancelAddressSearch = useCallback(() => {
    if (addressEventSourceRef.current) {
      addressEventSourceRef.current.close();
      addressEventSourceRef.current = null;
    }
    setAddressJobId(null);
    setAddressJobProgress({ progress: 0, found: 0 });
  }, []);

  const addAddressSearch = useCallback((params, results, bounds) => {
    const {
      mode, // 'radius' or 'polygon'
      lat,
      lng,
      radius,
      coordinates,
      label,
      center
    } = params;

    const sequence = getNextSequenceNumber(addressSearches);
    const id = `address-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const newEntry = {
      id,
      sequence,
      mode,
      label: label || (mode === 'radius' ? `Address: ${lat.toFixed(3)}, ${lng.toFixed(3)} (${radius}mi)` : `Address: Polygon ${sequence}`),
      lat,
      lng,
      center: center || (lat && lng ? [lat, lng] : null), // Add center for circle rendering
      radius,
      coordinates,
      bounds,
      resultCount: results?.length || 0,
      settings: { ...addressDisplaySettings },
      timestamp: new Date().toISOString()
    };

    setAddressSearches(prev => {
      const MAX_SEARCHES = 6;
      const updated = [newEntry, ...prev].slice(0, MAX_SEARCHES);
      return updated;
    });

    setActiveAddressSearchId(id);
    setSearchPerformed(true);

    // Store results with searchIds and searchSequences tags (CRITICAL FIX)
    const resultsWithMeta = (results || []).map(result => ({
      ...result,
      searchIds: [id],
      searchSequences: [sequence]
    }));

    setSearchResultsById(prev => ({
      ...prev,
      [id]: resultsWithMeta
    }));

    return newEntry;
  }, [addressSearches, addressDisplaySettings, getNextSequenceNumber]);

  // Handle map click for radius search
  const handleMapClickSearch = useCallback(async (latlng) => {
    const lat = latlng.lat;
    const lng = latlng.lng;

    // Handle Address Search with radius submode
    if (searchMode === 'address' && addressSubMode === 'radius') {
      // Check cooldown
      const cooldownRemaining = checkOverpassCooldown();
      if (cooldownRemaining > 0) {
        setApiError(`Please wait ${cooldownRemaining} seconds before searching again`);
        return;
      }

      setIsLoading(true);
      setSearchPerformed(true);
      setApiError(null);

      try {
        // Calculate appropriate zoom based on radius
        let zoomLevel = 11;
        if (addressRadius <= 5) {
          zoomLevel = 13;
        } else if (addressRadius <= 10) {
          zoomLevel = 12;
        } else {
          zoomLevel = 11;
        }

        // Set map view
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], zoomLevel, { animate: true });
        }

        // Search addresses via Worker API
        const addresses = await searchAddressesViaWorker({
          mode: 'radius',
          center: { lat, lng },
          radius: addressRadius
        });

        // Create search entry
        const searchLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)} (${addressRadius}mi)`;
        const params = {
          mode: 'radius',
          lat,
          lng,
          radius: addressRadius,
          center: [lat, lng],
          label: searchLabel
        };

        addAddressSearch(params, addresses, null);

        // Update address results in ResultsContext
        setAddressResults(addresses);

        // Auto-switch to streets tab and show drawer (even if no results)
        setActiveTab('streets');
        setDrawerState('half');

        if (addresses.length === 0) {
          setApiError('No addresses found in this area. Try a different location or larger radius.');
        } else {
          setApiError(null);
        }
      } catch (error) {
        setApiError(error.message || 'Address search failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Handle regular Radius Search
    if (searchMode === 'radius') {
      // Set the radius center
      setRadiusCenter([lat, lng]);

      // Calculate appropriate zoom based on radius
      let zoomLevel = 11; // default
      if (radius <= 5) {
        zoomLevel = 13;
      } else if (radius <= 10) {
        zoomLevel = 12;
      } else if (radius <= 25) {
        zoomLevel = 11;
      } else if (radius <= 50) {
        zoomLevel = 10;
      } else {
        zoomLevel = 9;
      }

      // Use mapRef to set view directly with animation
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], zoomLevel, { animate: true });
      }

      setPlacingRadius(false);

      // Clear previous search term since this is a map click
      setSearchTerm('');

      // Auto-trigger search at clicked location
      setIsLoading(true);
      setSearchPerformed(true);
      setApiError(null);
      setIsSearchMode(false);

      try {
        const searchParams = {
          lat: lat,
          lng: lng,
          radius: radius,
          limit: 500,
          offset: 0
        };

        const searchResult = await ZipCodeService.search(searchParams);
        const normalizedResults = normalizeZipResults(searchResult?.results);

        const signature = buildRadiusSignature(lat, lng, radius);
        const filteredSearches = radiusSearches.filter(existing => existing.signature !== signature);
        const sequence = getNextSequenceNumber(filteredSearches);

        const newEntryId = generateRadiusSearchId();
        const baseEntry = {
          id: newEntryId,
          label: `${lat.toFixed(3)}, ${lng.toFixed(3)} (${radius}m)`,
          radius: radius,
          center: [lat, lng],
          query: null,
          summary: {
            zip: normalizedResults[0]?.zipCode || null,
            city: normalizedResults[0]?.city || null,
            state: normalizedResults[0]?.state || null
          },
          settings: createRadiusSettings({ overlayColor: SEARCH_COLOR_PALETTE[sequence % SEARCH_COLOR_PALETTE.length] }),
          searchParams: searchParams,
          selectedLocation: null,
          signature,
          timestamp: Date.now(),
          resultsCount: normalizedResults.length,
          sequence
        };

        const nextRadiusSearches = [baseEntry, ...filteredSearches].slice(0, MAX_RADIUS_HISTORY);

        setRadiusSearches(nextRadiusSearches);
        setExcludedSearchIds(prev => prev.filter(entryId => nextRadiusSearches.some(item => item.id === entryId)));

        const entry = nextRadiusSearches.find(item => item.id === newEntryId) || baseEntry;

        const resultsWithMeta = normalizedResults.map(result => ({
          ...result,
          searchIds: [entry.id],
          searchSequences: [entry.sequence]
        }));

        const overrideMap = (() => {
          const next = { ...searchResultsById };
          filteredSearches.forEach(existing => {
            if (existing.signature === signature) {
              delete next[existing.id];
            }
          });
          next[entry.id] = resultsWithMeta;
          const allowedIds = new Set(nextRadiusSearches.map(item => item.id));
          Object.keys(next).forEach(key => {
            if (!allowedIds.has(key)) {
              delete next[key];
            }
          });
          return next;
        })();

        setSearchResultsById(overrideMap);
        setActiveRadiusSearchId(entry.id);
        setRadiusDisplaySettings(createRadiusSettings(entry.settings));
        rebuildDisplayedResults(overrideMap, entry.id, nextRadiusSearches);

      } catch (error) {
        console.error('Map click search failed:', error);
        setApiError(error.message);
        clearResults();
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    searchMode,
    addressSubMode,
    radius,
    radiusSearches,
    searchResultsById,
    normalizeZipResults,
    checkOverpassCooldown,
    addAddressSearch,
    setAddressResults,
    setMapCenter,
    setMapZoom,
    setRadiusCenter,
    setSearchTerm,
    setIsLoading,
    setSearchPerformed,
    setApiError,
    setIsSearchMode,
    setRadiusSearches,
    setSearchResultsById,
    setActiveRadiusSearchId,
    setRadiusDisplaySettings,
    rebuildDisplayedResults,
    clearResults,
    setLastOverpassCall,
    mapRef,
    setActiveTab
  ]);


  const applySearchResults = useCallback((searchResult) => {
    return normalizeZipResults(searchResult?.results);
  }, [normalizeZipResults]);

  const updateMapFromResults = useCallback((zipRecords) => {
    if (!Array.isArray(zipRecords) || zipRecords.length === 0) return;
    const target = zipRecords[0];
    const lat = target?.lat ?? target?.latitude;
    const lng = target?.lng ?? target?.longitude;
    if (lat == null || lng == null) return;

    setMapCenter([lat, lng]);

    const zoom = searchMode === 'radius'
      ? 10
      : searchMode === 'hierarchy'
        ? 7
        : 9;
    setMapZoom(zoom);
  }, [setMapCenter, setMapZoom, searchMode]);

  // Load available states on mount
  useEffect(() => {
    const loadStates = async () => {
      try {
        const states = await ZipCodeService.getStates();
        setAvailableStates(states);
      } catch (error) {
        console.error('Failed to load states:', error);
      }
    };
    loadStates();
  }, []);

  // Load counties when state is selected
  useEffect(() => {
    if (selectedState) {
      const loadCounties = async () => {
        try {
          const counties = await ZipCodeService.getCounties(selectedState);
          setAvailableCounties(counties);
        } catch (error) {
          console.error('Failed to load counties:', error);
        }
      };
      loadCounties();
    } else {
      setAvailableCounties([]);
      setSelectedCounty('');
      setSelectedCity('');
    }
  }, [selectedState]);

  // Load cities when county is selected
  useEffect(() => {
    if (selectedState && selectedCounty) {
      const loadCities = async () => {
        try {
          const cities = await ZipCodeService.getCities(selectedState, selectedCounty);
          setAvailableCities(cities);
        } catch (error) {
          console.error('Failed to load cities:', error);
        }
      };
      loadCities();
    } else {
      setAvailableCities([]);
      setSelectedCity('');
    }
  }, [selectedState, selectedCounty]);

  // Hierarchy search management functions
  const addHierarchySearch = useCallback((state, county, city, includeCitySearch) => {
    const id = Date.now().toString();
    let label = '';

    const stateName = stateNameByCode.get(state) || state;

    if (state && !county) {
      label = `${stateName} (all counties)`;
    } else if (state && county && !includeCitySearch) {
      label = `${county}, ${stateName}`;
    } else if (state && county && city) {
      label = `${city}, ${county}, ${stateName}`;
    }

    const searchEntry = {
      id,
      label,
      state,
      county,
      city: includeCitySearch ? city : null,
      includeCity: includeCitySearch,
      timestamp: Date.now()
    };

    setHierarchySearches(prev => [...prev, searchEntry]);
    setActiveHierarchySearchId(id);

    return searchEntry;
  }, [stateNameByCode]);

  const removeHierarchySearch = useCallback((id) => {
    setHierarchySearches(prev => prev.filter(search => search.id !== id));
    if (activeHierarchySearchId === id) {
      setActiveHierarchySearchId(null);
    }
  }, [activeHierarchySearchId]);

  const executeHierarchySearch = useCallback(async (searchEntry) => {
    setSelectedState(searchEntry.state);
    setSelectedCounty(searchEntry.county || '');
    setSelectedCity(searchEntry.city || '');
    setCitySearchDisabled(!searchEntry.includeCity && !!searchEntry.county);
    setActiveHierarchySearchId(searchEntry.id);

    // Execute search with the stored parameters
    const searchParams = {
      mode: 'hierarchy',
      state: searchEntry.state,
      county: searchEntry.county || undefined,
      city: searchEntry.includeCity ? searchEntry.city : undefined,
      countyOnly: searchEntry.state && !searchEntry.county // Only return counties if state-only
    };

    await handleSearch({ providedParams: searchParams });
    return searchEntry;
  }, []);

  // Polygon search management functions
  const getNextShapeNumber = useCallback(() => {
    // Find the lowest unused number
    let number = 1;
    const usedNumbers = new Set(polygonSearches.map(s => s.shapeNumber));
    while (usedNumbers.has(number)) {
      number++;
    }
    return number;
  }, [polygonSearches]);

  const addPolygonSearch = useCallback((shape, bounds, extraData = {}) => {
    const id = Date.now().toString();
    const shapeNumber = getNextShapeNumber();
    const label = `Shape ${shapeNumber}`;

    // Get sequence number for color assignment (shapeNumber - 1 since shapeNumber starts at 1)
    const colorIndex = (shapeNumber - 1) % SEARCH_COLOR_PALETTE.length;
    const overlayColor = SEARCH_COLOR_PALETTE[colorIndex];

    // Update the shape layer's style with the assigned color
    if (shape?.layer?.setStyle) {
      shape.layer.setStyle({
        color: overlayColor,
        fillColor: overlayColor,
        fillOpacity: 0.15
      });
    }

    const newSearch = {
      id,
      label,
      shapeNumber,
      shape,
      bounds,
      // Store coordinates and shape type for sharing/restoration
      coordinates: extraData.coordinates || [],
      shapeType: extraData.shapeType || 'polygon',
      circleCenter: extraData.circleCenter || null,
      circleRadius: extraData.circleRadius || null,
      // Store results directly on the search entry for sharing
      results: extraData.results || [],
      resultsCount: extraData.results?.length || 0,
      timestamp: Date.now(),
      settings: {
        ...polygonDisplaySettings,
        overlayColor
      }
    };

    setPolygonSearches(prev => [...prev, newSearch]);
    setActivePolygonSearchId(id);

    return newSearch;
  }, [getNextShapeNumber, polygonDisplaySettings]);

  const removePolygonSearch = useCallback((id) => {
    // Find the search to get the shape info before removing
    const searchToRemove = polygonSearches.find(s => s.id === id);

    setPolygonSearches(prev => {
      const updated = prev.filter(search => search.id !== id);
      // No need to track available numbers, getNextShapeNumber finds the lowest unused
      return updated;
    });

    // Remove the shape from the map's drawnShapes
    if (searchToRemove?.shape?.layer) {
      setDrawnShapes(prev =>
        prev.filter(shape => shape.layer._leaflet_id !== searchToRemove.shape.layer._leaflet_id)
      );

      // Remove the layer from the feature group/map
      if (featureGroupRef.current && searchToRemove.shape.layer) {
        featureGroupRef.current.removeLayer(searchToRemove.shape.layer);
      }
    }

    if (activePolygonSearchId === id) {
      setActivePolygonSearchId(null);
    }
  }, [activePolygonSearchId, polygonSearches, setDrawnShapes, featureGroupRef]);

  const removePolygonSearchByShapeId = useCallback((shapeId) => {
    const searchToRemove = polygonSearches.find(s => s.shape?.id === shapeId);
    if (searchToRemove) {
      removePolygonSearch(searchToRemove.id);
    }
  }, [polygonSearches, removePolygonSearch]);

  const updatePolygonSearchSettings = useCallback((id, updateFn) => {
    setPolygonSearches(prev => prev.map(search => {
      if (search.id === id) {
        const newSettings = updateFn(search.settings || {});

        // Update the shape layer's style if overlayColor changed
        if (newSettings.overlayColor && search.shape?.layer?.setStyle) {
          search.shape.layer.setStyle({
            color: newSettings.overlayColor,
            fillColor: newSettings.overlayColor,
            fillOpacity: 0.15
          });
        }

        return { ...search, settings: newSettings };
      }
      return search;
    }));
  }, []);

  const executePolygonSearchFromHistory = useCallback(async (searchId) => {
    const searchEntry = polygonSearches.find(s => s.id === searchId);
    if (!searchEntry) return null;

    // Set mode to polygon when executing from history
    setSearchMode('polygon');
    setActivePolygonSearchId(searchId);

    // Trigger the search if shape data exists
    if (searchEntry.shape) {
      await performSingleShapeSearch(searchEntry.shape, false);
    }

    return { entry: searchEntry };
  }, [polygonSearches]);

  // Polygon Search mode function (searches for ZIP codes/cities/counties within polygons)
  // NOTE: This function handles the POLYGON SEARCH MODE (not Address Search with polygons)
  // For Address Search polygon functionality, see performSingleShapeSearchAddress
  const performSingleShapeSearch = useCallback(async (shape, appendResults = false) => {
    console.log('🔵 [POLYGON SEARCH MODE] performSingleShapeSearch called', { shape, appendResults });
    setIsLoading(true);

    // Always mark as performed and show drawer
    setSearchPerformed(true);
    setApiError(null);

    if (!appendResults) {
      setIsSearchMode(false);
      // Show drawer when search completes
      setDrawerState('half');
    }

    try {
      // Convert shape to polygon coordinates
      const coords = [];
      if (shape.type === 'polygon') {
        shape.layer.getLatLngs()[0].forEach(latlng => {
          coords.push({ lat: latlng.lat, lng: latlng.lng });
        });
      } else if (shape.type === 'rectangle') {
        const bounds = shape.layer.getBounds();
        coords.push(
          { lat: bounds.getNorth(), lng: bounds.getWest() },
          { lat: bounds.getNorth(), lng: bounds.getEast() },
          { lat: bounds.getSouth(), lng: bounds.getEast() },
          { lat: bounds.getSouth(), lng: bounds.getWest() }
        );
      } else if (shape.type === 'circle') {
        // Convert circle to polygon approximation
        const center = shape.layer.getLatLng();
        const radius = shape.layer.getRadius();
        const points = 32; // Number of points to approximate circle
        for (let i = 0; i < points; i++) {
          const angle = (i / points) * 2 * Math.PI;
          const lat = center.lat + (radius / 111320) * Math.cos(angle);
          const lng = center.lng + (radius / (111320 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(angle);
          coords.push({ lat, lng });
        }
      }

      const searchParams = {
        polygon: coords,
        limit: 2000,
        offset: 0
      };

      const searchResult = await ZipCodeService.search(searchParams);

      // Process and store results
      const normalizedResults = normalizeZipResults(searchResult.results || []);

      if (appendResults) {
        // Append to existing results
        setZipResults(prev => [...prev, ...normalizedResults]);

        // Update aggregated results inline
        const allZips = [...zipResults, ...normalizedResults];
        const uniqueCities = [...new Set(allZips.map(zip =>
          `${zip.city}|${zip.state}|${zip.county}`
        ))].map((cityKey, index) => {
          const [city, state, county] = cityKey.split('|');
          const cityZips = allZips.filter(zip =>
            zip.city === city && zip.state === state && zip.county === county
          );
          return {
            id: `city-${index}`,
            name: city,
            state: state,
            county: county,
            zipCount: cityZips.length,
            population: cityZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
          };
        });

        const uniqueCounties = [...new Set(allZips.map(zip =>
          `${zip.county}|${zip.state}`
        ))].map((countyKey, index) => {
          const [county, state] = countyKey.split('|');
          const countyZips = allZips.filter(zip =>
            zip.county === county && zip.state === state
          );
          return {
            id: `county-${index}`,
            name: county,
            state: state,
            zipCount: countyZips.length,
            cityCount: new Set(countyZips.map(z => z.city)).size,
            population: countyZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
          };
        });

        const uniqueStates = [...new Set(allZips.map(zip => zip.state))].map((state, index) => {
          const stateZips = allZips.filter(zip => zip.state === state);
          return {
            id: `state-${index}`,
            name: state,
            abbreviation: state,
            zipCount: stateZips.length,
            cityCount: new Set(stateZips.map(z => z.city)).size,
            countyCount: new Set(stateZips.map(z => z.county)).size,
            population: stateZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
          };
        });

        setCityResults(uniqueCities);
        setCountyResults(uniqueCounties);
        setStateResults(uniqueStates);
      } else {
        // Replace results
        setZipResults(normalizedResults);

        // Update aggregated results inline
        const uniqueCities = [...new Set(normalizedResults.map(zip =>
          `${zip.city}|${zip.state}|${zip.county}`
        ))].map((cityKey, index) => {
          const [city, state, county] = cityKey.split('|');
          const cityZips = normalizedResults.filter(zip =>
            zip.city === city && zip.state === state && zip.county === county
          );
          return {
            id: `city-${index}`,
            name: city,
            state: state,
            county: county,
            zipCount: cityZips.length,
            population: cityZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
          };
        });

        const uniqueCounties = [...new Set(normalizedResults.map(zip =>
          `${zip.county}|${zip.state}`
        ))].map((countyKey, index) => {
          const [county, state] = countyKey.split('|');
          const countyZips = normalizedResults.filter(zip =>
            zip.county === county && zip.state === state
          );
          return {
            id: `county-${index}`,
            name: county,
            state: state,
            zipCount: countyZips.length,
            cityCount: new Set(countyZips.map(z => z.city)).size,
            population: countyZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
          };
        });

        const uniqueStates = [...new Set(normalizedResults.map(zip => zip.state))].map((state, index) => {
          const stateZips = normalizedResults.filter(zip => zip.state === state);
          return {
            id: `state-${index}`,
            name: state,
            abbreviation: state,
            zipCount: stateZips.length,
            cityCount: new Set(stateZips.map(z => z.city)).size,
            countyCount: new Set(stateZips.map(z => z.county)).size,
            population: stateZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
          };
        });

        setCityResults(uniqueCities);
        setCountyResults(uniqueCounties);
        setStateResults(uniqueStates);
      }

      // Calculate and store bounds
      if (coords.length > 0) {
        const bounds = {
          minLat: Math.min(...coords.map(c => c.lat)),
          maxLat: Math.max(...coords.map(c => c.lat)),
          minLng: Math.min(...coords.map(c => c.lng)),
          maxLng: Math.max(...coords.map(c => c.lng))
        };

        // Get circle-specific data if applicable
        let circleCenter = null;
        let circleRadius = null;
        if (shape.type === 'circle') {
          const center = shape.layer.getLatLng();
          circleCenter = [center.lat, center.lng];
          circleRadius = shape.layer.getRadius();
        }

        // Store the shape in history with bounds, coordinates, and results
        const newEntry = addPolygonSearch(shape, bounds, {
          coordinates: coords,
          shapeType: shape.type || 'polygon',
          circleCenter,
          circleRadius,
          results: normalizedResults
        });
        return newEntry;
      }

    } catch (error) {
      console.error('Shape search failed:', error);
      setApiError(error.message);
      if (!appendResults) {
        clearResults();
      }
    } finally {
      setIsLoading(false);
    }
  }, [normalizeZipResults, zipResults, addPolygonSearch, clearResults, setZipResults, setApiError, setIsLoading, setCityResults, setCountyResults, setStateResults]);

  const updateAggregatedResultsFromZips = useCallback((allZips) => {
    // Group results for aggregates
    const uniqueCities = [...new Set(allZips.map(zip =>
      `${zip.city}|${zip.state}|${zip.county}`
    ))].map((cityKey, index) => {
      const [city, state, county] = cityKey.split('|');
      const cityZips = allZips.filter(z => z.city === city && z.state === state);
      const avgLat = cityZips.reduce((sum, z) => sum + z.lat, 0) / cityZips.length;
      const avgLng = cityZips.reduce((sum, z) => sum + z.lng, 0) / cityZips.length;

      // Aggregate population and households
      const totalPopulation = cityZips.reduce((sum, z) => sum + (z.population || 0), 0);
      const totalHouseholds = cityZips.reduce((sum, z) => sum + (z.households || 0), 0);

      return {
        id: index + 1,
        name: city,
        state,
        county,
        lat: avgLat,
        lng: avgLng,
        latitude: avgLat,  // Include both formats
        longitude: avgLng,  // Include both formats
        zipCount: cityZips.length,
        population: totalPopulation,
        households: totalHouseholds
      };
    });

    const uniqueCounties = [...new Set(allZips.map(zip =>
      `${zip.county}|${zip.state}`
    ))].map((countyKey, index) => {
      const [county, state] = countyKey.split('|');
      const countyZips = allZips.filter(z => z.county === county && z.state === state);
      const avgLat = countyZips.reduce((sum, z) => sum + z.lat, 0) / countyZips.length;
      const avgLng = countyZips.reduce((sum, z) => sum + z.lng, 0) / countyZips.length;

      // Aggregate population and households
      const totalPopulation = countyZips.reduce((sum, z) => sum + (z.population || 0), 0);
      const totalHouseholds = countyZips.reduce((sum, z) => sum + (z.households || 0), 0);

      return {
        id: index + 1,
        name: county,
        state,
        lat: avgLat,
        lng: avgLng,
        latitude: avgLat,  // Include both formats
        longitude: avgLng,  // Include both formats
        zipCount: countyZips.length,
        cityCount: new Set(countyZips.map(z => z.city)).size,
        population: totalPopulation,
        households: totalHouseholds
      };
    });

    const uniqueStates = [...new Set(allZips.map(zip => zip.state))].map((state, index) => {
      const stateZips = allZips.filter(z => z.state === state);
      const avgLat = stateZips.reduce((sum, z) => sum + z.lat, 0) / stateZips.length;
      const avgLng = stateZips.reduce((sum, z) => sum + z.lng, 0) / stateZips.length;

      // Aggregate population and households
      const totalPopulation = stateZips.reduce((sum, z) => sum + (z.population || 0), 0);
      const totalHouseholds = stateZips.reduce((sum, z) => sum + (z.households || 0), 0);

      // Get state name from availableStates if available
      const stateInfo = availableStates.find(s => s.code === state);

      return {
        id: index + 1,
        name: stateInfo ? stateInfo.name : state,
        state,
        lat: avgLat,
        lng: avgLng,
        latitude: avgLat,  // Include both formats
        longitude: avgLng,  // Include both formats
        zipCount: stateZips.length,
        cityCount: new Set(stateZips.map(z => z.city)).size,
        countyCount: new Set(stateZips.map(z => z.county)).size,
        population: totalPopulation,
        households: totalHouseholds
      };
    });

    setCityResults(uniqueCities);
    setCountyResults(uniqueCounties);
    setStateResults(uniqueStates);
  }, [availableStates, setCityResults, setCountyResults, setStateResults]);

  // Reset function
  const handleReset = useCallback(() => {
    if (searchMode === 'radius') {
      // For radius mode, toggle between search and place mode
      setIsSearchMode(true);
      setRadiusCenter(null);
      setSearchPerformed(false);
      setRadiusDisplaySettings(createRadiusSettings());
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

    clearResults();
  }, [searchMode, setRadiusDisplaySettings, clearResults]);

  // Clear address search results
  const clearAddressResults = useCallback(() => {
    setAddressSearches([]);
    setActiveAddressSearchId(null);
    setAddressResults([]);
    setSearchTerm('');
    setApiError(null);
  }, [setAddressResults]);

  // Clear geocode results
  const clearGeocodeResults = useCallback(() => {
    setGeocodeResults([]);
    setGeocodeFile(null);
    setGeocodeError(null);
    setGeocodeProgress({ current: 0, total: 0, percentage: 0 });
    setGeocodeJobId(null);
    setGeocodePreparedAddresses([]);
    setGeocodeProcessing(false);
  }, [setGeocodeResults]);

  // Download results as CSV
  const downloadResults = useCallback(() => {
    let data = [];
    let filename = '';

    if (searchMode === 'address') {
      // Get all addresses from addressSearches
      data = addressResults || [];
      filename = `address-search-results-${new Date().toISOString().split('T')[0]}.csv`;

      if (data.length === 0) return;

      // Convert to CSV
      const headers = ['House #', 'Street', 'Unit', 'City', 'State', 'ZIP', 'Latitude', 'Longitude', 'Search'];
      const csvRows = [headers.join(',')];

      data.forEach(result => {
        const row = [
          result.housenumber || '',
          `"${(result.street || '').replace(/"/g, '""')}"`,
          result.unit || '',
          `"${(result.city || '').replace(/"/g, '""')}"`,
          result.state || '',
          result.postcode || '',
          result.lat || '',
          result.lng || '',
          (result.searchSequences || []).join(';')
        ];
        csvRows.push(row.join(','));
      });

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else if (searchMode === 'geocode') {
      // Get geocode results
      data = geocodeResults || [];
      filename = `geocode-results-${new Date().toISOString().split('T')[0]}.csv`;

      if (data.length === 0) return;

      // Convert to CSV
      const headers = ['Business Name', 'Full Address', 'Street', 'City', 'State', 'ZIP', 'Latitude', 'Longitude', 'Accuracy'];
      const csvRows = [headers.join(',')];

      data.forEach(result => {
        const row = [
          `"${(result.businessName || '').replace(/"/g, '""')}"`,
          `"${(result.fullAddress || '').replace(/"/g, '""')}"`,
          `"${(result.street || '').replace(/"/g, '""')}"`,
          `"${(result.city || '').replace(/"/g, '""')}"`,
          result.state || '',
          result.zip || '',
          result.lat || '',
          result.lng || '',
          result.accuracy != null ? (result.accuracy * 100).toFixed(0) + '%' : ''
        ];
        csvRows.push(row.join(','));
      });

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [searchMode, addressResults, geocodeResults]);

  // Handle clear and switch mode
  const handleClearAndSwitch = useCallback(() => {
    if (searchMode === 'address') {
      clearAddressResults();
    } else if (searchMode === 'geocode') {
      clearGeocodeResults();
    }

    // Switch to pending mode
    setSearchMode(pendingMode);
    setSearchTerm('');
    setRadiusCenter(null);
    setPlacingRadius(false);
    setIsSearchMode(pendingMode === 'radius');
    setIsSearchPanelCollapsed(false);

    // Close modal
    setShowModeSwitchModal(false);
    setPendingMode(null);
  }, [searchMode, pendingMode, clearAddressResults, clearGeocodeResults, setIsSearchPanelCollapsed]);

  // Handle download and switch mode
  const handleDownloadAndSwitch = useCallback(() => {
    // Download first
    downloadResults();

    // Then clear and switch
    handleClearAndSwitch();
  }, [downloadResults, handleClearAndSwitch]);

  // Handle cancel mode switch
  const handleCancelModeSwitch = useCallback(() => {
    setShowModeSwitchModal(false);
    setPendingMode(null);
  }, []);

  // Search mode change handler
  const handleSearchModeChange = useCallback((newMode) => {
    // Define "sibling" modes that share results (radius & polygon are siblings)
    const isSiblingSwitch = (searchMode === 'radius' && newMode === 'polygon') ||
                           (searchMode === 'polygon' && newMode === 'radius');

    // Check if switching away from address or geocode mode with results
    const shouldPrompt = (searchMode === 'address' && addressSearches.length > 0) ||
                         (searchMode === 'geocode' && (geocodeResults?.length > 0 || geocodePreparedAddresses.length > 0));

    if (shouldPrompt) {
      // Show modal and store the pending mode
      setPendingMode(newMode);
      setShowModeSwitchModal(true);
      return;
    }

    // Clear results when switching away from address or geocode mode
    if (searchMode === 'address') {
      clearAddressResults();
    } else if (searchMode === 'geocode') {
      clearGeocodeResults();
    }

    // Clear ZIP/City/County/State results when switching between "cousin" modes
    // BUT keep results when switching between sibling modes (radius ↔ polygon)
    if (!isSiblingSwitch) {
      // Switching to a "cousin" mode - clear ZIP results
      const shouldClearResults = (searchMode === 'radius' || searchMode === 'polygon') &&
                                (newMode !== 'radius' && newMode !== 'polygon');

      if (shouldClearResults) {
        clearResults();
        setSearchPerformed(false);
      }
    }

    // Auto-switch map type for Address Search mode (satellite view shows buildings better)
    if (newMode === 'address' && searchMode !== 'address') {
      // Switching TO address mode - save current map type and switch to satellite
      // Save current mapType before switching (avoid nested setState)
      setPreviousMapType(mapType);
      setMapType('satellite');
    } else if (searchMode === 'address' && newMode !== 'address' && previousMapType) {
      // Switching FROM address mode - restore previous map type
      setMapType(previousMapType);
      setPreviousMapType(null);
    }

    // Normal mode switch
    setSearchMode(newMode);
    // Reset only mode-specific UI state without clearing results
    // This allows users to switch modes while keeping their search results visible
    setSearchTerm('');
    setRadiusCenter(null);
    setPlacingRadius(false);
    setIsSearchMode(newMode === 'radius' || newMode === 'polygon'); // Both radius and polygon use search mode UI
    // Expand the search panel downward to show the reset button
    setIsSearchPanelCollapsed(false);
  }, [searchMode, addressSearches, geocodeResults, geocodePreparedAddresses, clearAddressResults, clearGeocodeResults, clearResults, setIsSearchPanelCollapsed, setMapType, previousMapType]);

  useEffect(() => {
    // Skip if no results or no searches
    if (Object.keys(searchResultsById).length === 0) return;
    if (radiusSearches.length === 0) return;

    // Skip if we don't have a valid activeId and not in combine mode
    if (!combineSearchResults && !activeRadiusSearchId) return;

    rebuildDisplayedResults();
  }, [combineSearchResults, excludedSearchIds, searchResultsById, radiusSearches, activeRadiusSearchId, rebuildDisplayedResults]);

  // Main search handler
  const handleSearch = useCallback(async (options = {}) => {
    const {
      searchParams: providedParams,
      skipHistory = false,
      uiContext = null,
      addressSubMode: providedAddressSubMode,
      radius: providedRadius,
      searchTerm: providedSearchTerm
    } = options;

    // Handle address mode separately
    if (searchMode === 'address' && !providedParams) {
      // Check cooldown
      const cooldownRemaining = checkOverpassCooldown();
      if (cooldownRemaining > 0) {
        setApiError(`Please wait ${cooldownRemaining} seconds before searching again`);
        return;
      }

      const currentSubMode = providedAddressSubMode || addressSubMode;
      const currentRadius = providedRadius || radius;

      setIsLoading(true);
      setSearchPerformed(true);
      setApiError(null);

      try {
        let addresses = [];
        let searchLabel = '';
        let searchLat = null;
        let searchLng = null;
        let searchCoordinates = null;
        let bounds = null;

        if (currentSubMode === 'radius') {
          // Validate radius
          if (currentRadius > 10) {
            setApiError('Maximum radius is 10 miles');
            setIsLoading(false);
            return;
          }

          // Get location from search term using geocoding
          const currentSearchTerm = providedSearchTerm || searchTerm;
          if (!currentSearchTerm) {
            setApiError('Please enter a location to search');
            setIsLoading(false);
            return;
          }

          // Geocode the search term
          const geocodeResult = await geocodingService.searchPlaces(currentSearchTerm, 1);
          if (!geocodeResult || geocodeResult.length === 0) {
            setApiError('Location not found');
            setIsLoading(false);
            return;
          }

          const location = geocodeResult[0];
          searchLat = location.lat;
          searchLng = location.lon;

          // Search addresses via Worker API
          addresses = await searchAddressesViaWorker({
            mode: 'radius',
            center: { lat: searchLat, lng: searchLng },
            radius: currentRadius
          });
          searchLabel = `${location.display_name} (${currentRadius}mi)`;
        } else if (currentSubMode === 'polygon') {
          // This should be handled by polygon draw callback
          // But included here for completeness
          setApiError('Please draw a polygon on the map');
          setIsLoading(false);
          return;
        }

        // Store results
        const params = {
          mode: currentSubMode,
          lat: searchLat,
          lng: searchLng,
          radius: currentRadius,
          coordinates: searchCoordinates,
          label: searchLabel
        };

        const searchEntry = addAddressSearch(params, addresses, bounds);

        // Update address results in ResultsContext
        setAddressResults(addresses);

        // Auto-switch to streets tab and show drawer (even if no results)
        setActiveTab('streets');
        setDrawerState('half');

        // Show message if no results found
        if (addresses.length === 0) {
          setApiError('No addresses found in this area. The current version of this address search tool has limited data in certain areas. Try a different location or larger radius.');
        } else {
          setApiError(null);
        }

        setSearchPerformed(true);
        return { addresses, searchEntry };
      } catch (error) {
        setApiError(error.message || 'Address search failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setSearchPerformed(true);
    setApiError(null);
    setIsSearchMode(false); // Switch to reset mode after search

    try {
      const paramsBase = { limit: 2000, offset: 0 };
      let searchParams = providedParams
        ? { ...paramsBase, ...providedParams }
        : { ...paramsBase };

      const normalizedSearchTerm = searchTerm?.trim();
      const inferredMode = providedParams?.mode || searchMode;

      if (!providedParams) {
        if (searchMode === 'radius') {
          if (radiusCenter) {
            searchParams = {
              ...searchParams,
              lat: radiusCenter[0],
              lng: radiusCenter[1],
              radius: radius
            };
          } else if (normalizedSearchTerm) {
            if (/^\d{5}$/.test(normalizedSearchTerm)) {
              searchParams.query = normalizedSearchTerm;
            } else {
              searchParams.query = normalizedSearchTerm;
            }
          }
        } else if (searchMode === 'hierarchy') {
          if (selectedState) searchParams.state = selectedState;
          if (selectedCounty) searchParams.county = selectedCounty;
          if (selectedCity) searchParams.city = selectedCity;
        }
      }

      const searchResult = await ZipCodeService.search(searchParams);

      if (uiContext) {
        uiContext.setShowAutocomplete(false);
        uiContext.setAutocompleteResults([]);
      }

      const effectiveSearchTerm = normalizedSearchTerm || options.historyLabel;
      if (effectiveSearchTerm && !skipHistory && !searchHistory.includes(effectiveSearchTerm)) {
        setSearchHistory(prev => [effectiveSearchTerm, ...prev.slice(0, 9)]);
      }

      const normalizedResults = applySearchResults(searchResult);

      if (!skipHistory && inferredMode === 'radius') {
        const latValue = searchParams.lat ?? (Array.isArray(radiusCenter) ? radiusCenter[0] : null);
        const lngValue = searchParams.lng ?? (Array.isArray(radiusCenter) ? radiusCenter[1] : null);
        const radiusValue = searchParams.radius ?? radius;
        const signature = buildRadiusSignature(latValue, lngValue, radiusValue);

        if (signature) {
          const firstResult = searchResult?.results?.[0] || null;
          const zip = firstResult?.zipCode || firstResult?.zipcode || null;
          const city = firstResult?.city || firstResult?.primary_city || null;
          const state = firstResult?.state || firstResult?.stateCode || firstResult?.state_code || null;
          const labelParts = [];

          if (zip) labelParts.push(zip);
          if (city && state) labelParts.push(`${city}, ${state}`);
          else if (city) labelParts.push(city);
          else if (effectiveSearchTerm) labelParts.push(effectiveSearchTerm);

          const baseLabel = labelParts.length > 0
            ? labelParts.join(' - ')
            : formatCenterFallback(latValue, lngValue);

          const radiusLabel = radiusValue != null ? `${Number(radiusValue)}m` : null;
          const computedLabel = radiusLabel ? `${baseLabel} (${radiusLabel})` : baseLabel;

          const filteredSearches = radiusSearches.filter(existing => existing.signature !== signature);
          const sequence = getNextSequenceNumber(filteredSearches);

          const newEntryId = generateRadiusSearchId();
          const baseEntry = {
            id: newEntryId,
            label: computedLabel,
            radius: radiusValue != null ? Number(radiusValue) : radius,
            center: latValue != null && lngValue != null ? [Number(latValue), Number(lngValue)] : null,
            query: effectiveSearchTerm || null,
            summary: { zip, city, state },
            settings: createRadiusSettings({ overlayColor: SEARCH_COLOR_PALETTE[sequence % SEARCH_COLOR_PALETTE.length] }),
            searchParams: { ...searchParams, mode: 'radius' },
            selectedLocation: selectedLocation ? { ...selectedLocation } : null,
            signature,
            timestamp: Date.now(),
            resultsCount: normalizedResults.length,
            sequence
          };

          const nextRadiusSearches = [baseEntry, ...filteredSearches].slice(0, MAX_RADIUS_HISTORY);

          setRadiusSearches(nextRadiusSearches);
          setExcludedSearchIds(prev => prev.filter(entryId => nextRadiusSearches.some(item => item.id === entryId)));

          const entry = nextRadiusSearches.find(item => item.id === newEntryId) || baseEntry;

          const resultsWithMeta = normalizedResults.map(result => ({
            ...result,
            searchIds: [entry.id],
            searchSequences: [entry.sequence]
          }));

          const overrideMap = (() => {
            const next = { ...searchResultsById };
            filteredSearches.forEach(existing => {
              if (existing.signature === signature) {
                delete next[existing.id];
              }
            });
            next[entry.id] = resultsWithMeta;
            const allowedIds = new Set(nextRadiusSearches.map(item => item.id));
            Object.keys(next).forEach(key => {
              if (!allowedIds.has(key)) {
                delete next[key];
              }
            });
            return next;
          })();

          setSearchResultsById(overrideMap);
          setActiveRadiusSearchId(entry.id);
          setRadiusDisplaySettings(createRadiusSettings(entry.settings));
          rebuildDisplayedResults(overrideMap, entry.id, nextRadiusSearches);
        }
      }

      if (inferredMode !== 'radius') {
        setZipResults(normalizedResults);
        setTotalResults(typeof searchResult?.total === 'number' ? searchResult.total : normalizedResults.length);
        setHasMoreResults(Boolean(searchResult?.hasMore));
        setCurrentPage(0);
        updateAggregatedResults(normalizedResults, {});
      }
      updateMapFromResults(normalizedResults);

      return searchResult;
    } catch (error) {
      console.error('Search failed:', error);
      setApiError(error.message);
      clearResults();
    } finally {
      setIsLoading(false);
    }
  }, [
    searchMode,
    searchTerm,
    radius,
    radiusCenter,
    selectedState,
    selectedCounty,
    selectedCity,
    searchHistory,
    selectedLocation,
    applySearchResults,
    updateMapFromResults,
    clearResults,
    radiusSearches,
    searchResultsById,
    setSearchResultsById,
    rebuildDisplayedResults,
    setZipResults,
    setTotalResults,
    setHasMoreResults,
    setCurrentPage,
    updateAggregatedResults,
    addressSubMode,
    checkOverpassCooldown,
    addAddressSearch,
    setAddressResults
  ]);

  const updateRadiusSearchSettings = useCallback((id, updater) => {
    let nextSettingsForActive = null;

    setRadiusSearches(prev =>
      prev.map(entry => {
        if (entry.id !== id) {
          return entry;
        }

        const baseSettings = entry.settings || DEFAULT_RADIUS_DISPLAY_SETTINGS;
        const resolvedSettings = typeof updater === 'function'
          ? updater(baseSettings)
          : updater;
        const normalizedSettings = createRadiusSettings(resolvedSettings);

        if (activeRadiusSearchId === id) {
          nextSettingsForActive = normalizedSettings;
        }

        return {
          ...entry,
          settings: normalizedSettings
        };
      })
    );

    if (nextSettingsForActive) {
      setRadiusDisplaySettings(nextSettingsForActive);
    }
  }, [activeRadiusSearchId, setRadiusDisplaySettings]);

  const removeRadiusSearch = useCallback((id) => {
    const filteredSearches = radiusSearches.filter(entry => entry.id !== id);
    const nextActiveEntry = activeRadiusSearchId === id ? filteredSearches[0] || null : radiusSearches.find(entry => entry.id === activeRadiusSearchId) || null;
    setRadiusSearches(filteredSearches);
    setActiveRadiusSearchId(nextActiveEntry ? nextActiveEntry.id : null);
    setRadiusDisplaySettings(nextActiveEntry ? createRadiusSettings(nextActiveEntry.settings) : createRadiusSettings());

    setSearchResultsById(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setExcludedSearchIds(prev => prev.filter(entryId => entryId !== id));

    rebuildDisplayedResults(
      (() => {
        const next = { ...searchResultsById };
        delete next[id];
        const allowedIds = new Set(filteredSearches.map(entry => entry.id));
        Object.keys(next).forEach(key => {
          if (!allowedIds.has(key)) {
            delete next[key];
          }
        });
        return next;
      })(),
      nextActiveEntry ? nextActiveEntry.id : null,
      filteredSearches
    );
  }, [radiusSearches, activeRadiusSearchId, setActiveRadiusSearchId, setRadiusDisplaySettings, searchResultsById, rebuildDisplayedResults]);

  const renameRadiusSearch = useCallback((id, newLabel) => {
    if (!newLabel || !newLabel.trim()) return;
    setRadiusSearches(prev => prev.map(entry => entry.id === id ? { ...entry, label: newLabel.trim() } : entry));
  }, []);

  const executeRadiusSearchFromHistory = useCallback(async (id) => {
    const entry = radiusSearches.find(item => item.id === id);
    if (!entry) return null;

    setSearchMode('radius');
    setActiveRadiusSearchId(entry.id);
    setRadiusDisplaySettings(createRadiusSettings(entry.settings));

    if (entry.query != null) {
      setSearchTerm(entry.query);
    } else {
      setSearchTerm('');
    }

    if (entry.radius != null) {
      setRadius(entry.radius);
    }

    if (entry.center) {
      setRadiusCenter(entry.center);
    }

    if (entry.selectedLocation) {
      setSelectedLocation(entry.selectedLocation);
    } else {
      setSelectedLocation(null);
    }

    const result = await handleSearch({ searchParams: entry.searchParams, skipHistory: true });
    rebuildDisplayedResults(undefined, entry.id);
    return { entry, result };
  }, [radiusSearches, handleSearch, setSearchMode, setSearchTerm, setRadius, setRadiusCenter, setSelectedLocation, setRadiusDisplaySettings, setActiveRadiusSearchId, rebuildDisplayedResults]);

  const toggleSearchExclusion = useCallback((id) => {
    setExcludedSearchIds(prev => prev.includes(id)
      ? prev.filter(entryId => entryId !== id)
      : [...prev, id]
    );
  }, []);

  const isSearchExcluded = useCallback((id) => excludedSearchIds.includes(id), [excludedSearchIds]);

  // Restore searches from shared state (for share URL feature)
  // Returns boundary settings for the caller to apply
  const restoreFromShareState = useCallback(async (sharedState) => {
    if (!sharedState) return null;

    console.log('[Share] Restoring from shared state:', sharedState);

    // Set the search mode
    if (sharedState.mode) {
      setSearchMode(sharedState.mode);
    }

    // Set map view
    if (sharedState.mapView) {
      if (sharedState.mapView.center) {
        setMapCenter(sharedState.mapView.center);
      }
      if (sharedState.mapView.zoom) {
        setMapZoom(sharedState.mapView.zoom);
      }
    }

    setIsLoading(true);

    try {
      // Restore radius searches
      if (sharedState.radiusSearches && sharedState.radiusSearches.length > 0) {
        console.log('[Share] Restoring', sharedState.radiusSearches.length, 'radius searches');

        const newSearches = [];
        const newResultsById = {};

        for (let i = 0; i < sharedState.radiusSearches.length; i++) {
          const savedSearch = sharedState.radiusSearches[i];
          if (savedSearch.center && savedSearch.radius) {
            try {
              let normalizedResults;

              // Check if we have stored results (new API format)
              if (savedSearch.results && savedSearch.results.length > 0) {
                console.log('[Share] Using stored results for radius search');
                normalizedResults = normalizeZipResults(savedSearch.results);
              } else {
                // Fall back to re-executing search (legacy format)
                console.log('[Share] Re-executing radius search (no stored results)');
                const searchParams = {
                  lat: savedSearch.center[0],
                  lng: savedSearch.center[1],
                  radius: savedSearch.radius,
                  limit: 500,
                  offset: 0
                };
                const searchResult = await ZipCodeService.search(searchParams);
                normalizedResults = normalizeZipResults(searchResult?.results);
              }

              // Create search entry
              const signature = buildRadiusSignature(savedSearch.center[0], savedSearch.center[1], savedSearch.radius);
              const newEntryId = savedSearch.id || generateRadiusSearchId();
              const sequence = i + 1;
              const colorIndex = i % SEARCH_COLOR_PALETTE.length;

              // Build label
              const firstResult = normalizedResults?.[0] || null;
              const zip = firstResult?.zipCode || firstResult?.zipcode || null;
              const city = firstResult?.city || firstResult?.primary_city || null;
              const state = firstResult?.state || firstResult?.stateCode || null;
              const labelParts = [];
              if (zip) labelParts.push(zip);
              if (city && state) labelParts.push(`${city}, ${state}`);
              const baseLabel = labelParts.length > 0 ? labelParts.join(' - ') : formatCenterFallback(savedSearch.center[0], savedSearch.center[1]);
              const computedLabel = `${baseLabel} (${savedSearch.radius}m)`;

              const entry = {
                id: newEntryId,
                label: savedSearch.label || computedLabel,
                radius: savedSearch.radius,
                center: savedSearch.center,
                query: savedSearch.query || null,
                summary: { zip, city, state },
                settings: createRadiusSettings({
                  overlayColor: savedSearch.overlayColor || savedSearch.settings?.overlayColor || SEARCH_COLOR_PALETTE[colorIndex]
                }),
                searchParams: { lat: savedSearch.center[0], lng: savedSearch.center[1], radius: savedSearch.radius, mode: 'radius' },
                signature,
                timestamp: Date.now(),
                resultsCount: normalizedResults.length,
                sequence
              };

              // Tag results with search info
              const resultsWithMeta = normalizedResults.map(result => ({
                ...result,
                searchIds: [newEntryId],
                searchSequences: [sequence]
              }));

              newSearches.push(entry);
              newResultsById[newEntryId] = resultsWithMeta;
            } catch (error) {
              console.error('[Share] Error restoring radius search:', error);
            }
          }
        }

        // Batch update all state at once
        if (newSearches.length > 0) {
          setRadiusSearches(newSearches);
          setSearchResultsById(newResultsById);
          setActiveRadiusSearchId(newSearches[newSearches.length - 1].id);
          setRadiusDisplaySettings(createRadiusSettings(newSearches[newSearches.length - 1].settings));
          setIsSearchMode(false);
          setSearchPerformed(true);
          setDrawerState('half');
          rebuildDisplayedResults(newResultsById, newSearches[newSearches.length - 1].id, newSearches);
        }
      }

      // Restore polygon searches (shapes will be drawn by caller with access to featureGroupRef)
      if (sharedState.polygonSearches && sharedState.polygonSearches.length > 0) {
        console.log('[Share] Restoring', sharedState.polygonSearches.length, 'polygon searches');

        const newPolygonSearches = [];

        for (let i = 0; i < sharedState.polygonSearches.length; i++) {
          const savedSearch = sharedState.polygonSearches[i];
          if (savedSearch.coordinates && savedSearch.coordinates.length > 0) {
            const newEntryId = savedSearch.id || Date.now().toString() + i;
            const shapeNumber = savedSearch.shapeNumber || (i + 1);
            const colorIndex = i % SEARCH_COLOR_PALETTE.length;

            // Normalize results if stored
            let results = [];
            if (savedSearch.results && savedSearch.results.length > 0) {
              results = normalizeZipResults(savedSearch.results);
            }

            const entry = {
              id: newEntryId,
              label: savedSearch.label || `Shape ${shapeNumber}`,
              shapeNumber,
              coordinates: savedSearch.coordinates,
              shapeType: savedSearch.shapeType || 'polygon',
              circleCenter: savedSearch.circleCenter,
              circleRadius: savedSearch.circleRadius,
              bounds: savedSearch.bounds,
              results, // Store results directly on the search entry
              timestamp: Date.now(),
              settings: {
                ...polygonDisplaySettings,
                overlayColor: savedSearch.overlayColor || savedSearch.settings?.overlayColor || SEARCH_COLOR_PALETTE[colorIndex]
              },
              // Mark as needing shape creation (caller will handle)
              needsShapeCreation: true
            };

            newPolygonSearches.push(entry);
          }
        }

        if (newPolygonSearches.length > 0) {
          setPolygonSearches(newPolygonSearches);
          setActivePolygonSearchId(newPolygonSearches[newPolygonSearches.length - 1].id);
          setIsSearchMode(false);
          setSearchPerformed(true);
          setDrawerState('half');

          // Set ZIP results from the stored polygon results
          const allZipResults = newPolygonSearches.flatMap(s => s.results || []);
          if (allZipResults.length > 0) {
            setZipResults(allZipResults);

            // Calculate and set aggregated city/county/state results
            const uniqueCities = [...new Set(allZipResults.map(zip =>
              `${zip.city}|${zip.state}|${zip.county}`
            ))].map((cityKey, index) => {
              const [city, state, county] = cityKey.split('|');
              const cityZips = allZipResults.filter(zip =>
                zip.city === city && zip.state === state && zip.county === county
              );
              return {
                id: `city-${index}`,
                name: city,
                state: state,
                county: county,
                zipCount: cityZips.length,
                population: cityZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
              };
            });

            const uniqueCounties = [...new Set(allZipResults.map(zip =>
              `${zip.county}|${zip.state}`
            ))].map((countyKey, index) => {
              const [county, state] = countyKey.split('|');
              const countyZips = allZipResults.filter(zip =>
                zip.county === county && zip.state === state
              );
              return {
                id: `county-${index}`,
                name: county,
                state: state,
                zipCount: countyZips.length,
                cityCount: new Set(countyZips.map(z => z.city)).size,
                population: countyZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
              };
            });

            const uniqueStates = [...new Set(allZipResults.map(zip => zip.state))].map((state, index) => {
              const stateZips = allZipResults.filter(zip => zip.state === state);
              return {
                id: `state-${index}`,
                name: state,
                abbreviation: state,
                zipCount: stateZips.length,
                cityCount: new Set(stateZips.map(z => z.city)).size,
                countyCount: new Set(stateZips.map(z => z.county)).size,
                population: stateZips.reduce((sum, zip) => sum + (zip.population || 0), 0)
              };
            });

            setCityResults(uniqueCities);
            setCountyResults(uniqueCounties);
            setStateResults(uniqueStates);
          }
        }
      }

      // Restore address searches - re-query via Worker API
      if (sharedState.addressSearches && sharedState.addressSearches.length > 0) {
        console.log('[Share] Restoring', sharedState.addressSearches.length, 'address searches via Worker API');

        // Process each address search
        for (let i = 0; i < sharedState.addressSearches.length; i++) {
          const savedSearch = sharedState.addressSearches[i];

          try {
            let addresses = [];

            // Re-query using stored parameters via Worker API
            if (savedSearch.mode === 'radius' && savedSearch.center) {
              const lat = savedSearch.center[0] || savedSearch.lat;
              const lng = savedSearch.center[1] || savedSearch.lng;
              const radius = savedSearch.radius;

              if (lat && lng && radius) {
                console.log('[Share] Re-querying radius address search:', { lat, lng, radius });
                addresses = await searchAddressesViaWorker({
                  mode: 'radius',
                  center: { lat, lng },
                  radius
                });
              }
            } else if (savedSearch.mode === 'polygon' && savedSearch.coordinates) {
              // Convert coordinates to API format
              const apiCoords = savedSearch.coordinates.map(coord =>
                Array.isArray(coord) ? { lat: coord[0], lng: coord[1] } : coord
              );

              console.log('[Share] Re-querying polygon address search:', apiCoords.length, 'points');
              addresses = await searchAddressesViaWorker({
                mode: 'polygon',
                coordinates: apiCoords
              });
            }

            // Create search entry with fresh results
            const colorIndex = i % SEARCH_COLOR_PALETTE.length;
            const params = {
              mode: savedSearch.mode,
              lat: savedSearch.center?.[0] || savedSearch.lat,
              lng: savedSearch.center?.[1] || savedSearch.lng,
              radius: savedSearch.radius,
              coordinates: savedSearch.coordinates,
              center: savedSearch.center,
              label: savedSearch.label
            };

            addAddressSearch(params, addresses, null);
            console.log('[Share] Restored address search with', addresses.length, 'addresses');

          } catch (error) {
            console.error('[Share] Failed to restore address search:', error);
            // Fall back to stored results if available
            if (savedSearch.results && savedSearch.results.length > 0) {
              const params = {
                mode: savedSearch.mode,
                lat: savedSearch.center?.[0] || savedSearch.lat,
                lng: savedSearch.center?.[1] || savedSearch.lng,
                radius: savedSearch.radius,
                coordinates: savedSearch.coordinates,
                center: savedSearch.center,
                label: savedSearch.label
              };
              addAddressSearch(params, savedSearch.results, null);
            }
          }
        }

        // Update UI state after all searches are restored
        setActiveTab('streets');
        setIsSearchMode(false);
        setSearchPerformed(true);
        setDrawerState('half');
      }

      console.log('[Share] Restoration complete');
    } finally {
      setIsLoading(false);
    }

    // Return boundary settings for caller to apply (requires MapContext access)
    return sharedState.boundarySettings || null;
  }, [setSearchMode, setMapCenter, setMapZoom, setIsLoading, setRadiusSearches, setSearchResultsById, setActiveRadiusSearchId, setRadiusDisplaySettings, setIsSearchMode, setSearchPerformed, setDrawerState, rebuildDisplayedResults, setPolygonSearches, setActivePolygonSearchId, setZipResults, polygonDisplaySettings, setAddressSearches, setActiveAddressSearchId, searchAddressesViaWorker, addAddressSearch, setActiveTab]);

  // Input change handler with autocomplete
  const handleSearchInputChange = useCallback(async (e, uiContext) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear selected location if user starts typing again
    if (selectedLocation) {
      setSelectedLocation(null);
      setRadiusCenter(null);
    }

    // Clear existing debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Reset autocomplete for short queries
    if (value.length < 2) {
      if (uiContext) {
        uiContext.setAutocompleteResults([]);
        uiContext.setShowAutocomplete(false);
      }
      return;
    }

    // Set searching state
    setIsSearching(true);

    // Debounce the search
    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Search for places using geocoding service
        const results = await geocodingService.searchPlaces(value, 8);

        if (uiContext) {
          uiContext.setAutocompleteResults(results);
          uiContext.setShowAutocomplete(results.length > 0);
        }
      } catch (error) {
        console.error('Autocomplete search failed:', error);
        if (uiContext) {
          uiContext.setAutocompleteResults([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  }, [selectedLocation]);

  // Autocomplete handlers
  const handleAutocompleteBlur = useCallback((uiContext) => {
    // Delay to allow clicking on results
    setTimeout(() => {
      if (uiContext) {
        uiContext.setShowAutocomplete(false);
      }
    }, 200);
  }, []);

  const handleAutocompleteSelect = useCallback(async (location, uiContext) => {
    // Handle Google Places results (need to fetch full details)
    let finalLocation = location;

    if (location.source === 'google' && location.id) {
      try {
        // Pass the placeId to get full details
        const placeDetails = await googlePlacesService.selectPlace(location.id);

        if (placeDetails) {
          finalLocation = placeDetails;
        } else {
          console.warn('Failed to get Google Place details, using prediction data');
        }
      } catch (error) {
        console.error('Error fetching Google Place details:', error);
      }
    }

    setSelectedLocation(finalLocation);

    // Update search term with location name
    if (finalLocation.displayName) {
      setSearchTerm(finalLocation.displayName);
    } else if (finalLocation.display_name) {
      setSearchTerm(finalLocation.display_name);
    }

    // Hide autocomplete dropdown
    if (uiContext) {
      uiContext.setShowAutocomplete(false);
      uiContext.setAutocompleteResults([]);
    }

    // Determine zoom level based on location type
    let zoomLevel = 13; // Default zoom

    // Adjust zoom based on location type for better UX
    if (finalLocation.type === 'zipcode' || finalLocation.type === 'address') {
      zoomLevel = 13; // Street level for precise locations
    } else if (finalLocation.type === 'city') {
      zoomLevel = 11; // City level
    } else if (finalLocation.type === 'county') {
      zoomLevel = 9; // County level
    } else if (finalLocation.type === 'state') {
      zoomLevel = 6; // State level
    }

    // Check if we're in Address Search mode with polygon
    if (searchMode === 'address' && addressSubMode === 'polygon') {
      // Polygon mode: Zoom in closer for better polygon drawing
      zoomLevel = 15;
    }

    // Center and zoom map on selected location using direct map control
    handleResultMapInteraction({
      type: finalLocation.type || 'place',
      result: finalLocation,
      center: [finalLocation.lat, finalLocation.lng],
      zoom: zoomLevel
    });

    // Also update state for consistency
    setMapCenter([finalLocation.lat, finalLocation.lng]);
    setMapZoom(zoomLevel);

    // Check if we're in Address Search polygon mode - exit early
    if (searchMode === 'address' && addressSubMode === 'polygon') {
      // Just center the map, don't trigger search
      // User will draw polygon manually after centering
      setApiError(null);
      return; // Exit early - don't trigger any search
    }

    // Check if we're in Polygon search mode - exit early (just zoom to location)
    if (searchMode === 'polygon') {
      // Just center the map, don't trigger any search
      // User will draw polygon manually after centering
      setApiError(null);
      return; // Exit early - don't trigger any search
    }

    if (searchMode === 'address' && addressSubMode === 'radius') {
      // Radius mode: Trigger Address Search
      setIsLoading(true);
      setSearchPerformed(true);
      setApiError(null);

      try {
        // Check cooldown
        const cooldown = checkOverpassCooldown();
        if (cooldown > 0) {
          setApiError(`Please wait ${cooldown} seconds before searching again`);
          setIsLoading(false);
          return;
        }

        // Search addresses via Worker API
        const addresses = await searchAddressesViaWorker({
          mode: 'radius',
          center: { lat: finalLocation.lat, lng: finalLocation.lng },
          radius: addressRadius
        });

        // Create search entry
        const displayName = finalLocation.displayName || finalLocation.display_name;
        const searchLabel = `${displayName || finalLocation.lat.toFixed(4) + ', ' + finalLocation.lng.toFixed(4)} (${addressRadius}mi)`;
        const params = {
          mode: 'radius',
          lat: finalLocation.lat,
          lng: finalLocation.lng,
          radius: addressRadius,
          center: [finalLocation.lat, finalLocation.lng],
          label: searchLabel
        };

        addAddressSearch(params, addresses, null);

        // Update address results in ResultsContext
        setAddressResults(addresses);

        // Auto-switch to streets tab and show drawer
        setActiveTab('streets');
        setDrawerState('half');

        if (addresses.length === 0) {
          setApiError('No addresses found in this area. Try a different location or larger radius.');
        } else {
          setApiError(null);
        }
      } catch (error) {
        console.error('Address search from autocomplete failed:', error);
        setApiError(error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Default: ZIP code radius search
      setRadiusCenter([finalLocation.lat, finalLocation.lng]);
      setIsLoading(true);
      setSearchPerformed(true);
      setApiError(null);
      setIsSearchMode(false);

      try {
        const searchParams = {
          lat: finalLocation.lat,
          lng: finalLocation.lng,
          radius: radius,
          limit: 500,
          offset: 0
        };

        const searchResult = await ZipCodeService.search(searchParams);
        const normalizedResults = normalizeZipResults(searchResult?.results);

        // Calculate sequence number and create search entry (matching map click pattern)
        const signature = buildRadiusSignature(finalLocation.lat, finalLocation.lng, radius);
        const filteredSearches = radiusSearches.filter(existing => existing.signature !== signature);
        const sequence = getNextSequenceNumber(filteredSearches);

        const displayName = finalLocation.displayName || finalLocation.display_name;
        const newEntryId = generateRadiusSearchId();
        const baseEntry = {
          id: newEntryId,
          label: displayName || `${finalLocation.lat.toFixed(3)}, ${finalLocation.lng.toFixed(3)} (${radius}m)`,
          radius: radius,
          center: [finalLocation.lat, finalLocation.lng],
          query: displayName || null,
          summary: {
            zip: normalizedResults[0]?.zipCode || null,
            city: normalizedResults[0]?.city || null,
            state: normalizedResults[0]?.state || null
          },
          settings: createRadiusSettings({ overlayColor: SEARCH_COLOR_PALETTE[sequence % SEARCH_COLOR_PALETTE.length] }),
          searchParams: searchParams,
          selectedLocation: finalLocation,
          signature,
          timestamp: Date.now(),
          resultsCount: normalizedResults.length,
          sequence
        };

        const nextRadiusSearches = [baseEntry, ...filteredSearches].slice(0, MAX_RADIUS_HISTORY);

        setRadiusSearches(nextRadiusSearches);
        setExcludedSearchIds(prev => prev.filter(entryId => nextRadiusSearches.some(item => item.id === entryId)));

        const entry = nextRadiusSearches.find(item => item.id === newEntryId) || baseEntry;

        // Tag results with searchIds and searchSequences (CRITICAL FIX)
        const resultsWithMeta = normalizedResults.map(result => ({
          ...result,
          searchIds: [entry.id],
          searchSequences: [entry.sequence]
        }));

        // Store results in searchResultsById tracking system
        const overrideMap = (() => {
          const next = { ...searchResultsById };
          filteredSearches.forEach(existing => {
            if (existing.signature === signature) {
              delete next[existing.id];
            }
          });
          next[entry.id] = resultsWithMeta;
          const allowedIds = new Set(nextRadiusSearches.map(item => item.id));
          Object.keys(next).forEach(key => {
            if (!allowedIds.has(key)) {
              delete next[key];
            }
          });
          return next;
        })();

        setSearchResultsById(overrideMap);
        setActiveRadiusSearchId(entry.id);
        setRadiusDisplaySettings(createRadiusSettings(entry.settings));

        // Use rebuildDisplayedResults instead of direct setZipResults
        rebuildDisplayedResults(overrideMap, entry.id, nextRadiusSearches);

        setTotalResults(typeof searchResult?.total === 'number' ? searchResult.total : normalizedResults.length);
        setHasMoreResults(Boolean(searchResult?.hasMore));
        setCurrentPage(0);

      } catch (error) {
        console.error('Autocomplete search failed:', error);
        setApiError(error.message);
        clearResults();
      } finally {
        setIsLoading(false);
      }
    }
  }, [
    searchMode,
    addressSubMode,
    addressRadius,
    radius,
    setMapCenter,
    setMapZoom,
    checkOverpassCooldown,
    setLastOverpassCall,
    addAddressSearch,
    setAddressResults,
    setActiveTab,
    setDrawerState,
    normalizeZipResults,
    updateAggregatedResults,
    createRadiusSettings
  ]);

  // Process data in batches for CSV upload
  const processDataInBatches = useCallback(async (data, batchSize = 50) => {
    console.log('🔵 processDataInBatches started - data:', data.length, 'batchSize:', batchSize);

    // All API results are ZIP codes regardless of search type
    const allZipResults = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      console.log('🔵 Processing batch', Math.floor(i/batchSize) + 1, 'items:', batch.length);

      // Update progress
      setProcessingProgress({ current: Math.min(i + batchSize, data.length), total: data.length });

      try {
        // Process batch items in parallel
        const batchPromises = batch.map(async (item) => {
          try {
            const response = await ZipCodeService.search({ query: item.query });
            const results = response.results || [];

            // Filter for valid coordinates
            const validResults = results.filter(r => r && r.latitude != null && r.longitude != null);
            console.log(`Search for "${item.query}" (type: ${item.type}) returned ${validResults.length} results`);

            return validResults;
          } catch (error) {
            console.warn(`Failed to search for ${item.query}:`, error);
            return [];
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // All results are ZIP codes - transform them to have consistent structure
        batchResults.forEach((results) => {
          const transformedResults = results.map((r, index) => ({
            ...r,
            id: `zip-${r.zipcode || r.zip_code || 'unknown'}-${Date.now()}-${index}`,
            // Ensure consistent coordinate properties
            lat: r.latitude,
            lng: r.longitude,
            latitude: r.latitude,
            longitude: r.longitude,
            // Normalize property names
            zipCode: r.zipcode || r.zip_code,
            city: r.city || r.place || r.city_name,
            county: r.county || r.province || r.county_name,
            state: r.state || r.state_code || r.state_abbreviation,
            population: r.population || 0,
            households: r.households || 0
          }));

          allZipResults.push(...transformedResults);
        });

        // Small delay between batches to avoid overwhelming the API
        if (i + batchSize < data.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Error processing batch:', error);
      }
    }

    // Update results
    console.log('🟢 processDataInBatches complete. Total ZIP results:', allZipResults.length);

    // Remove duplicates based on ZIP code
    const uniqueZipResults = [];
    const seenZipCodes = new Set();

    allZipResults.forEach(result => {
      if (result.zipCode && !seenZipCodes.has(result.zipCode)) {
        seenZipCodes.add(result.zipCode);
        uniqueZipResults.push(result);
      }
    });

    console.log('Unique ZIP results after deduplication:', uniqueZipResults.length);

    // Set ZIP results
    setZipResults(uniqueZipResults);

    // Aggregate to cities, counties, and states
    const uniqueCities = [...new Set(uniqueZipResults.map(zip =>
      `${zip.city}|${zip.state}|${zip.county}`
    ))].map((cityKey, index) => {
      const [city, state, county] = cityKey.split('|');
      const cityZips = uniqueZipResults.filter(zip =>
        zip.city === city && zip.state === state && zip.county === county
      );
      return {
        id: `city-${index}`,
        name: city,
        state: state,
        county: county,
        zipCount: cityZips.length,
        population: cityZips.reduce((sum, zip) => sum + (zip.population || 0), 0),
        households: cityZips.reduce((sum, zip) => sum + (zip.households || 0), 0)
      };
    });

    const uniqueCounties = [...new Set(uniqueZipResults.map(zip =>
      `${zip.county}|${zip.state}`
    ))].map((countyKey, index) => {
      const [county, state] = countyKey.split('|');
      const countyZips = uniqueZipResults.filter(zip =>
        zip.county === county && zip.state === state
      );
      return {
        id: `county-${index}`,
        name: county,
        state: state,
        zipCount: countyZips.length,
        cityCount: new Set(countyZips.map(z => z.city)).size,
        population: countyZips.reduce((sum, zip) => sum + (zip.population || 0), 0),
        households: countyZips.reduce((sum, zip) => sum + (zip.households || 0), 0)
      };
    });

    const uniqueStates = [...new Set(uniqueZipResults.map(zip => zip.state))].map((state, index) => {
      const stateZips = uniqueZipResults.filter(zip => zip.state === state);
      return {
        id: `state-${index}`,
        name: state,
        abbreviation: state,
        zipCount: stateZips.length,
        cityCount: new Set(stateZips.map(z => z.city)).size,
        countyCount: new Set(stateZips.map(z => z.county)).size,
        population: stateZips.reduce((sum, zip) => sum + (zip.population || 0), 0),
        households: stateZips.reduce((sum, zip) => sum + (zip.households || 0), 0)
      };
    });

    setCityResults(uniqueCities);
    setCountyResults(uniqueCounties);
    setStateResults(uniqueStates);

    // Mark search as performed
    setSearchPerformed(true);
    setUploadProcessing(false);
    setProcessingProgress(null);

    console.log('Final aggregated results:', {
      zips: uniqueZipResults.length,
      cities: uniqueCities.length,
      counties: uniqueCounties.length,
      states: uniqueStates.length
    });
  }, [setZipResults, setCityResults, setCountyResults, setStateResults]);

  // Analyze columns for automatic mapping
  const analyzeColumnForType = useCallback((header, sampleValues) => {
    const lowerHeader = header.toLowerCase().replace(/[_\s-]/g, ''); // Remove separators for matching

    // Direct header matches - more robust patterns
    // ZIP variations: zip, zips, zipcode, zip_code, zip code, postal, postal_code, postal code, postcode
    if (/^(zip|zips|zipcode|zipcodee|postalcode|postal|postcode)s?$/i.test(lowerHeader)) return 'zip';

    // City variations: city, cities, town, place, municipality, city_name, cityname
    if (/^(city|cities|town|towns|place|municipality|cityname)$/i.test(lowerHeader)) return 'city';

    // County variations: county, counties, parish, county_name, countyname
    if (/^(county|counties|parish|parishes|countyname)$/i.test(lowerHeader)) return 'county';

    // State variations: state, st, province, state_code, statecode, state_name, statename
    if (/^(state|states|st|province|statecode|statename)$/i.test(lowerHeader)) return 'state';

    // General location variations: location, address, query
    if (/^(location|address|query|search)$/i.test(lowerHeader)) return 'general';

    // Analyze sample values
    const nonEmpty = sampleValues.filter(v => v && v.toString().trim());
    if (nonEmpty.length === 0) return 'ignore';

    // Check if values look like ZIP codes (3-5 digits, handling leading zeros stripped)
    const zipPattern = /^\d{3,5}(-\d{4})?$/;
    if (nonEmpty.some(v => zipPattern.test(v.toString().trim()))) {
      return 'zip';
    }

    // Check if values are 2-letter state codes
    const statePattern = /^[A-Z]{2}$/i;
    if (nonEmpty.every(v => statePattern.test(v.toString().trim().toUpperCase()))) {
      return 'state';
    }

    // Default to general search if unclear
    return 'general';
  }, []);

  // Process CSV after mapping confirmation
  const processCSVWithMapping = useCallback(async () => {
    try {
      console.log('🔵 processCSVWithMapping started');
      console.log('🔵 csvFullData rows:', csvFullData?.length);
      console.log('🔵 columnMapping:', JSON.stringify(columnMapping));
      if (csvFullData?.length > 0) {
        console.log('🔵 First row keys:', Object.keys(csvFullData[0]));
        console.log('🔵 First row values:', Object.values(csvFullData[0]));
      }

      const transformedData = [];

      // Process each row once, creating a single search query per row
      csvFullData.forEach((row, rowIndex) => {
        // Find the mapped columns for this row
        const mappedColumns = Object.entries(columnMapping).filter(([header, type]) =>
          type !== 'ignore' && row[header] && row[header].toString().trim()
        );

        if (rowIndex === 0) {
          console.log('🔵 Row 0 mappedColumns:', mappedColumns);
        }

        if (mappedColumns.length === 0) return; // Skip empty rows

        // Determine the best search query for this row based on available data
        // Priority: ZIP > City+State > County+State > State > General
        let searchQuery = null;
        let searchType = 'general';

        // Check for ZIP code first (most specific)
        const zipCol = mappedColumns.find(([h, t]) => t === 'zip');
        if (zipCol && row[zipCol[0]]) {
          const zipValue = row[zipCol[0]].toString().trim();
          // More lenient ZIP pattern: 3-5 digits (to handle ZIPs with leading zeros stripped)
          // Also handle ZIP+4 format
          if (zipValue && /^\d{3,5}(-\d{4})?$/.test(zipValue)) {
            // Pad to 5 digits if necessary (leading zeros)
            searchQuery = zipValue.includes('-')
              ? zipValue.split('-')[0].padStart(5, '0') + zipValue.slice(zipValue.indexOf('-'))
              : zipValue.padStart(5, '0');
            searchType = 'zip';
          }
        }

        // If no ZIP, try city + state
        if (!searchQuery) {
          const cityCol = mappedColumns.find(([h, t]) => t === 'city');
          const stateCol = mappedColumns.find(([h, t]) => t === 'state');

          if (cityCol && row[cityCol[0]]) {
            const cityValue = row[cityCol[0]].toString().trim();
            if (cityValue) {
              // Check if city already includes state
              if (cityValue.includes(',')) {
                searchQuery = cityValue;
                searchType = 'city';
              } else if (stateCol && row[stateCol[0]]) {
                // Combine city with state
                const stateValue = row[stateCol[0]].toString().trim();
                searchQuery = `${cityValue}, ${stateValue}`;
                searchType = 'city';
              } else {
                // City without state - still search but may be less accurate
                searchQuery = cityValue;
                searchType = 'city';
              }
            }
          }
        }

        // If no city, try county + state
        if (!searchQuery) {
          const countyCol = mappedColumns.find(([h, t]) => t === 'county');
          const stateCol = mappedColumns.find(([h, t]) => t === 'state');

          if (countyCol && row[countyCol[0]]) {
            const countyValue = row[countyCol[0]].toString().trim();
            if (countyValue) {
              // Check if county already includes state
              if (countyValue.includes(',')) {
                searchQuery = countyValue;
                searchType = 'county';
              } else if (stateCol && row[stateCol[0]]) {
                // Combine county with state
                const stateValue = row[stateCol[0]].toString().trim();
                searchQuery = `${countyValue}, ${stateValue}`;
                searchType = 'county';
              } else {
                // County without state
                searchQuery = countyValue;
                searchType = 'county';
              }
            }
          }
        }

        // If no county, try state only
        if (!searchQuery) {
          const stateCol = mappedColumns.find(([h, t]) => t === 'state');
          if (stateCol && row[stateCol[0]]) {
            const stateValue = row[stateCol[0]].toString().trim();
            if (stateValue) {
              searchQuery = stateValue;
              searchType = 'state';
            }
          }
        }

        // If still no query, use first available general column
        if (!searchQuery) {
          const generalCol = mappedColumns.find(([h, t]) => t === 'general');
          if (generalCol && row[generalCol[0]]) {
            const generalValue = row[generalCol[0]].toString().trim();
            if (generalValue) {
              // Check if it's actually a ZIP code
              if (/^\d{5}(-\d{4})?$/.test(generalValue)) {
                searchQuery = generalValue;
                searchType = 'zip';
              } else {
                searchQuery = generalValue;
                searchType = 'general';
              }
            }
          }
        }

        // Add the query if we found valid data
        if (searchQuery) {
          transformedData.push({
            query: searchQuery,
            type: searchType,
            rowIndex // Keep track of source row for debugging
          });
        }
      });

      if (transformedData.length === 0) {
        throw new Error('No valid location data found after mapping columns');
      }

      // Process in batches
      console.log('🟢 Starting processDataInBatches with', transformedData.length, 'items');
      console.log('Sample queries:', transformedData.slice(0, 5)); // Log first 5 for debugging
      await processDataInBatches(transformedData);

      // Mark search as performed and show drawer
      setSearchPerformed(true);
      setDrawerState('half');
      setUploadProcessing(false);

      // Close modal
      setShowHeaderMappingModal(false);
      setCsvHeaders([]);
      setCsvPreviewData([]);
      setCsvFullData([]);
      setColumnMapping({});

      console.log('✅ CSV upload processing complete');
    } catch (error) {
      console.error('❌ CSV upload processing error:', error);
      setUploadError(error.message);
      setUploadProcessing(false);
    }
  }, [csvFullData, columnMapping, processDataInBatches, setDrawerState]);

  // CSV Upload handler with Papa Parse
  const handleCSVUpload = useCallback((file) => {
    console.log('🔵 handleCSVUpload called with file:', file.name, 'size:', file.size);
    setUploadedFile(file);
    setUploadError(null);
    setUploadProcessing(true);

    // Parse the CSV file with Papa Parse - preview first 10 rows for mapping
    console.log('🔵 Starting Papa Parse preview...');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 10,
      delimiter: "",  // Auto-detect delimiter
      newline: "",    // Auto-detect line break
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header) => header.trim(), // Trim whitespace from headers
      complete: (results) => {
        console.log('🔵 Papa Parse preview complete:', {
          dataCount: results.data?.length,
          errors: results.errors,
          meta: results.meta
        });

        // Filter out non-critical errors (like delimiter detection warnings)
        const criticalErrors = results.errors.filter(error =>
          error.type === 'Quotes' ||
          error.type === 'FieldMismatch' ||
          error.code === 'TooFewFields' ||
          error.code === 'TooManyFields'
        );

        if (criticalErrors.length > 0) {
          console.error('🔴 Critical CSV parsing errors:', criticalErrors);
          setUploadError(`CSV parsing error: ${criticalErrors[0].message}`);
          setUploadProcessing(false);
          return;
        }

        const headers = results.meta.fields || [];
        const preview = results.data || [];

        console.log('🔵 Headers found:', headers);
        console.log('🔵 Preview data:', preview);

        if (headers.length === 0 || preview.length === 0) {
          setUploadError('No valid data found in CSV file');
          setUploadProcessing(false);
          return;
        }

        // Detect headerless CSV files (e.g., exported ZIP lists)
        // If the header looks like a ZIP code or the file has only 1 column with numeric data,
        // it's likely a headerless file
        const isLikelyHeaderless = headers.length === 1 && (
          /^\d{5}(-\d{4})?$/.test(headers[0]) || // Header is a ZIP code
          /^\d+$/.test(headers[0]) // Header is just numbers
        );

        if (isLikelyHeaderless) {
          console.log('🟡 Detected headerless CSV file. Re-parsing without headers...');

          // Re-parse the file without headers
          Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            delimiter: results.meta.delimiter,
            complete: (headerlessResults) => {
              const allData = headerlessResults.data || [];
              console.log('🔵 Headerless parse complete. Total rows:', allData.length);

              if (allData.length === 0) {
                setUploadError('No valid data rows found in CSV');
                setUploadProcessing(false);
                return;
              }

              // Create synthetic header based on data analysis
              const firstColumnValues = allData.slice(0, 10).map(row => row[0]);
              const syntheticHeader = analyzeColumnForType('data', firstColumnValues);

              console.log('🔵 Detected column type:', syntheticHeader);

              // Convert array data to object format with synthetic header
              const convertedData = allData.map(row => ({
                [syntheticHeader]: row[0]
              }));

              // Set up mapping with synthetic header
              const syntheticMapping = {
                [syntheticHeader]: syntheticHeader
              };

              // Store data and show mapping modal
              setCsvHeaders([syntheticHeader]);
              setCsvPreviewData(convertedData.slice(0, 10));
              setCsvFullData(convertedData);
              setColumnMapping(syntheticMapping);
              setShowHeaderMappingModal(true);
              setUploadProcessing(false);
            },
            error: (error) => {
              console.error('🔴 Headerless CSV parsing error:', error);
              setUploadError(`Failed to parse CSV: ${error.message}`);
              setUploadProcessing(false);
            }
          });
          return; // Exit early, don't continue with header parsing
        }

        // Auto-detect column types for normal CSV with headers
        const autoMapping = {};
        headers.forEach(header => {
          const sampleValues = preview.map(row => row[header]);
          autoMapping[header] = analyzeColumnForType(header, sampleValues);
        });

        console.log('🔵 Auto-detected mapping:', autoMapping);

        // Now parse the full file
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: results.meta.delimiter, // Use detected delimiter
          transformHeader: (header) => header.trim(),
          complete: (fullResults) => {
            console.log('🔵 Full parse complete. Rows:', fullResults.data?.length);

            if (fullResults.data?.length === 0) {
              setUploadError('No valid data rows found in CSV');
              setUploadProcessing(false);
              return;
            }

            // Store data and show mapping modal
            setCsvHeaders(headers);
            setCsvPreviewData(preview);
            setCsvFullData(fullResults.data);
            setColumnMapping(autoMapping);
            setShowHeaderMappingModal(true);
            setUploadProcessing(false);
          },
          error: (error) => {
            console.error('🔴 CSV parsing error:', error);
            setUploadError(`Failed to parse CSV: ${error.message}`);
            setUploadProcessing(false);
          }
        });
      },
      error: (error) => {
        console.error('🔴 CSV preview parsing error:', error);
        setUploadError(`Failed to parse CSV: ${error.message}`);
        setUploadProcessing(false);
      }
    });
  }, [analyzeColumnForType]);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    setUploadError(null);
    setSearchPerformed(false);
  }, []);

  // Geocode CSV upload handlers
  const handleGeocodeCSVUpload = useCallback((file) => {
    console.log('🔵 handleGeocodeCSVUpload called with file:', file.name);
    setGeocodeFile(file);
    setGeocodeError(null);
    setGeocodeProcessing(true);
    setGeocodeProgress({ current: 0, total: 0, percentage: 0 });

    // Parse CSV for geocoding - preview first 10 rows for column mapping
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      preview: 10,
      delimiter: "",
      newline: "",
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const criticalErrors = results.errors.filter(error =>
          error.type === 'Quotes' ||
          error.type === 'FieldMismatch' ||
          error.code === 'TooFewFields' ||
          error.code === 'TooManyFields'
        );

        if (criticalErrors.length > 0) {
          setGeocodeError(`CSV parsing error: ${criticalErrors[0].message}`);
          setGeocodeProcessing(false);
          return;
        }

        const headers = results.meta.fields || [];
        const preview = results.data || [];

        if (headers.length === 0 || preview.length === 0) {
          setGeocodeError('No valid data found in CSV file');
          setGeocodeProcessing(false);
          return;
        }

        // Auto-detect geocoding columns
        const detectedMapping = detectColumnTypes(preview, headers, true); // true for geocode mode

        // Set headers and preview for mapping modal
        setCsvHeaders(headers);
        setCsvPreviewData(preview);
        setColumnMapping(detectedMapping);

        // Parse full CSV and store for later processing
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          newline: "",
          quoteChar: '"',
          escapeChar: '"',
          transformHeader: (header) => header.trim(),
          complete: (fullResults) => {
            setCsvFullData(fullResults.data || []);
            setShowHeaderMappingModal(true);
            setGeocodeProcessing(false);
          },
          error: (error) => {
            setGeocodeError(`Error reading CSV: ${error.message}`);
            setGeocodeProcessing(false);
          }
        });
      },
      error: (error) => {
        setGeocodeError(`Error reading CSV: ${error.message}`);
        setGeocodeProcessing(false);
      }
    });
  }, []);

  const handleRemoveGeocodeFile = useCallback(() => {
    setGeocodeFile(null);
    setGeocodeError(null);
    setGeocodeProgress({ current: 0, total: 0, percentage: 0 });
    setGeocodeJobId(null);
    setGeocodePreparedAddresses([]);
    setShowHeaderMappingModal(false);
    setCsvHeaders([]);
    setCsvPreviewData([]);
    setCsvFullData([]);
    setColumnMapping({});
  }, []);

  // Process geocoding after column mapping is confirmed
  const processGeocodeCSV = useCallback(async () => {
    if (!csvFullData || csvFullData.length === 0) {
      setGeocodeError('No data to process');
      return;
    }

    setGeocodeProcessing(true);
    setShowHeaderMappingModal(false);

    try {
      // Prepare addresses using the geocoding service
      const preparedAddresses = geocodingService.prepareAddressesForGeocoding(csvFullData, columnMapping);

      if (preparedAddresses.length === 0) {
        setGeocodeError('No valid addresses found in CSV');
        setGeocodeProcessing(false);
        return;
      }

      setGeocodePreparedAddresses(preparedAddresses);
      setGeocodeProgress({ current: 0, total: preparedAddresses.length, percentage: 0 });

      // Extract just the address strings for the API
      const addressStrings = preparedAddresses.map(addr => addr.addressString);

      // Submit batch geocoding job
      const jobInfo = await geocodingService.submitBatchGeocodeJob(addressStrings);

      let results;

      // Check if API returned results synchronously or requires polling
      if (jobInfo.synchronous) {
        console.log('✅ Got results immediately (synchronous)');
        results = { results: jobInfo.results };
        // Update progress to 100%
        setGeocodeProgress({
          current: jobInfo.total,
          total: jobInfo.total,
          percentage: 100
        });
      } else {
        console.log('⏳ Polling for results (asynchronous)');
        setGeocodeJobId(jobInfo.job_id);
        console.log('Geocoding job submitted:', jobInfo.job_id, 'Total addresses:', jobInfo.total_addresses);

        // Poll for results
        results = await geocodingService.pollUntilComplete(
          jobInfo.job_id,
          (status) => {
            // Update progress from real API status
            setGeocodeProgress({
              current: status.processed || 0,
              total: status.total_addresses || preparedAddresses.length,
              percentage: status.percentage || 0
            });
          }
        );
      }

      console.log('Geocoding complete:', results);

      // Process results and combine with original data
      const geocodedResults = [];
      const notFound = [];

      preparedAddresses.forEach((prepared, index) => {
        const apiResult = results.results?.[index];

        if (apiResult && apiResult.success && apiResult.lat && apiResult.lng) {
          // Parse formatted_address to extract components
          const formatted = apiResult.formatted_address || apiResult.address || '';

          // Try to extract ZIP code from formatted address (5 digits)
          const zipMatch = formatted.match(/\b(\d{5})(?:-\d{4})?\b/);
          const extractedZip = zipMatch ? zipMatch[1] : '';

          // Try to extract state from formatted address (2-letter code or full name)
          const stateMatch = formatted.match(/,?\s*([A-Z]{2})\s*\d{5}/) ||
                            formatted.match(/,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming),/i);
          const extractedState = stateMatch ? stateMatch[1] : '';

          // Try to extract city (text before state or before ZIP)
          let extractedCity = '';
          if (extractedState) {
            const cityMatch = formatted.match(/,\s*([^,]+),\s*(?:${extractedState}|[A-Z]{2})/i);
            extractedCity = cityMatch ? cityMatch[1].trim() : '';
          }

          // Build address from user-provided components or original input
          const city = prepared.components.city || extractedCity;
          const state = prepared.components.state || extractedState;
          const zip = prepared.components.zip || extractedZip;
          const county = prepared.components.county || '';

          // Build clean address field from components
          let address = '';
          if (prepared.components.street) {
            // User provided separate street component
            address = prepared.components.street;
          } else if (prepared.components.fullAddress) {
            // User provided full address in one field
            address = prepared.components.fullAddress;
          } else {
            // Extract street from addressString (remove city, state, zip)
            address = prepared.addressString
              .replace(new RegExp(`,?\\s*${city}.*$`, 'i'), '')
              .replace(new RegExp(`,?\\s*${state}.*$`, 'i'), '')
              .replace(/,?\s*\d{5}(-\d{4})?$/, '')
              .trim();
          }

          // Successfully geocoded
          geocodedResults.push({
            id: `geocode-${Date.now()}-${index}`,
            businessName: prepared.businessName || '',
            address: address,
            city: city,
            state: state,
            zip: zip,
            county: county,
            lat: parseFloat(apiResult.lat),
            lng: parseFloat(apiResult.lng),
            accuracy: apiResult.accuracy || null,
            provider: apiResult.provider || 'unknown',
            success: true,
            originalData: prepared.originalData
          });
        } else {
          // Failed to geocode
          notFound.push({
            ...prepared,
            reason: apiResult?.error || 'Address not found'
          });
        }
      });

      // Update results in ResultsContext
      setGeocodeResults(geocodedResults);
      setNotFoundAddresses(notFound);

      // Mark search as performed to show drawer
      setSearchPerformed(true);

      // Expand drawer to show results
      setDrawerState('half');

      // Switch to geocode results tab
      setActiveTab('geocode');

      console.log(`Geocoding complete: ${geocodedResults.length} found, ${notFound.length} not found`);

    } catch (error) {
      console.error('Geocoding error:', error);
      setGeocodeError(`Geocoding failed: ${error.message}`);
    } finally {
      setGeocodeProcessing(false);
    }
  }, [csvFullData, columnMapping, setGeocodeResults, setNotFoundAddresses, setActiveTab]);

  // Other address search functions
  const removeAddressSearch = useCallback((id) => {
    setAddressSearches(prev => prev.filter(search => search.id !== id));

    // Remove from results map
    setSearchResultsById(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    if (activeAddressSearchId === id) {
      setActiveAddressSearchId(null);
    }
  }, [activeAddressSearchId]);

  const updateAddressSearchSettings = useCallback((id, updateFn) => {
    setAddressSearches(prev => prev.map(search =>
      search.id === id
        ? { ...search, settings: updateFn(search.settings || {}) }
        : search
    ));
  }, []);

  const executeAddressSearchFromHistory = useCallback(async (searchId) => {
    const searchEntry = addressSearches.find(s => s.id === searchId);
    if (!searchEntry) return null;

    setActiveAddressSearchId(searchId);

    // Restore results from stored data
    const storedResults = searchResultsById[searchId];
    if (storedResults) {
      // Results are already stored, just need to update display
      rebuildDisplayedResults();
    }

    return { entry: searchEntry };
  }, [addressSearches, searchResultsById, rebuildDisplayedResults]);

  // Address polygon search functions
  // NOTE: This function handles polygon drawing in ADDRESS SEARCH mode
  // It is separate from the regular Polygon Search mode (performSingleShapeSearch)
  const performSingleShapeSearchAddress = useCallback(async (shape, appendResults = false) => {
    setIsLoading(true);

    // Always mark search as performed and show drawer
    setSearchPerformed(true);
    setDrawerState('half');

    if (!appendResults) {
      setApiError(null);
    }

    // Check cooldown
    const cooldownRemaining = checkOverpassCooldown();
    if (cooldownRemaining > 0) {
      setApiError(`Please wait ${cooldownRemaining} seconds before searching again`);
      setIsLoading(false);
      return;
    }

    try {
      // Convert shape to polygon coordinates
      const coords = [];
      if (shape.layer && shape.layer.getLatLngs) {
        const latLngs = shape.layer.getLatLngs()[0];
        latLngs.forEach(latLng => {
          coords.push([latLng.lat, latLng.lng]);
        });
      }

      // Validate polygon size (max 100 square miles - worker API handles chunking)
      const { validatePolygonSize } = await import('../utils/polygonHelpers');
      const validation = validatePolygonSize(coords, 100);

      if (!validation.valid) {
        setApiError(`Polygon too large: ${validation.area.toFixed(2)} sq mi (max 100 sq mi)`);
        setIsLoading(false);
        return;
      }

      // Convert coords to worker API format (array of {lat, lng})
      const apiCoords = coords.map(([lat, lng]) => ({ lat, lng }));

      // Search addresses via Worker API
      const results = await searchAddressesViaWorker({
        mode: 'polygon',
        coordinates: apiCoords
      });

      // Create search entry
      const label = `Polygon ${addressSearches.length + 1}`;
      addAddressSearch(
        {
          mode: 'polygon',
          coordinates: coords,
          label,
          shapeId: shape.id
        },
        results,
        null
      );

      // Update address results in ResultsContext
      setAddressResults(results);

      // Auto-switch to streets tab
      setActiveTab('streets');

      // Show message if no results found
      if (results.length === 0) {
        setApiError('No addresses found in this area. Try drawing in a different location.');
      } else {
        setApiError(null);
      }
    } catch (error) {
      setApiError(error.message || 'Failed to search addresses');
    } finally {
      setIsLoading(false);
    }
  }, [addressSearches, checkOverpassCooldown, addAddressSearch, setAddressResults, setActiveTab]);

  const removeAddressSearchByShapeId = useCallback((shapeId) => {
    const searchToRemove = addressSearches.find(s => s.shapeId === shapeId);
    if (searchToRemove) {
      removeAddressSearch(searchToRemove.id);
    }
  }, [addressSearches, removeAddressSearch]);

  // Reset search handler
  const handleResetSearch = useCallback(() => {
    handleReset();
    setSearchTerm('');
    setIsSearchMode(true);
  }, [handleReset]);

  const value = {
    // Search mode and parameters
    searchMode,
    setSearchMode: handleSearchModeChange,
    searchTerm,
    setSearchTerm,
    radius,
    setRadius,
    addressRadius,
    setAddressRadius,

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

    // Hierarchy search history
    hierarchySearches,
    setHierarchySearches,
    activeHierarchySearchId,
    setActiveHierarchySearchId,
    citySearchDisabled,
    setCitySearchDisabled,
    addHierarchySearch,
    removeHierarchySearch,
    executeHierarchySearch,

    // Polygon search
    polygonSearches,
    setPolygonSearches,
    activePolygonSearchId,
    setActivePolygonSearchId,
    polygonDisplaySettings,
    setPolygonDisplaySettings,
    addPolygonSearch,
    removePolygonSearch,
    removePolygonSearchByShapeId,
    updatePolygonSearchSettings,
    executePolygonSearchFromHistory,
    performSingleShapeSearch,

    // Address search
    addressSearches,
    setAddressSearches,
    activeAddressSearchId,
    setActiveAddressSearchId,
    addressSubMode,
    setAddressSubMode,
    addressDisplaySettings,
    setAddressDisplaySettings,
    lastOverpassCall,
    setLastOverpassCall,
    overpassCooldownRemaining,
    setOverpassCooldownRemaining,
    checkOverpassCooldown,
    addressJobId,
    addressJobProgress,
    cancelAddressSearch,
    addAddressSearch,
    removeAddressSearch,
    updateAddressSearchSettings,
    executeAddressSearchFromHistory,
    performSingleShapeSearchAddress,
    removeAddressSearchByShapeId,

    // Mode switch modal
    showModeSwitchModal,
    setShowModeSwitchModal,
    pendingMode,
    handleClearAndSwitch,
    handleDownloadAndSwitch,
    handleCancelModeSwitch,

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
    radiusSearches,
    activeRadiusSearchId,
    radiusDisplaySettings,
    setRadiusDisplaySettings,
    updateRadiusSearchSettings,
    removeRadiusSearch,
    executeRadiusSearchFromHistory,
    restoreFromShareState,
    combineSearchResults,
    setCombineSearchResults,
    toggleSearchExclusion,
    isSearchExcluded,
    renameRadiusSearch,
    excludedSearchIds,

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
    processCSVWithMapping,

    // Geocode search
    geocodeFile,
    setGeocodeFile,
    geocodeProcessing,
    setGeocodeProcessing,
    geocodeError,
    setGeocodeError,
    geocodeProgress,
    setGeocodeProgress,
    geocodeJobId,
    setGeocodeJobId,
    geocodePreparedAddresses,
    setGeocodePreparedAddresses,

    // Functions
    handleReset,
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

    // Helper for hierarchy locations
    hierarchyLocations: {
      states: availableStates,
      counties: availableCounties,
      cities: availableCities
    }
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
};

import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';

const ResultsContext = createContext();

export const useResults = () => {
  const context = useContext(ResultsContext);
  if (!context) {
    throw new Error('useResults must be used within ResultsProvider');
  }
  return context;
};

export const ResultsProvider = ({ children }) => {
  // Results organized by type
  const [zipResults, setZipResults] = useState([]);
  const [cityResults, setCityResults] = useState([]);
  const [countyResults, setCountyResults] = useState([]);
  const [stateResults, setStateResults] = useState([]);
  const [addressResults, setAddressResults] = useState([]); // Street-level addresses
  const [geocodeResults, setGeocodeResults] = useState([]); // Geocoded addresses
  const [notFoundAddresses, setNotFoundAddresses] = useState([]); // Failed geocoding attempts

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [totalResults, setTotalResults] = useState(0);

  // Removed and excluded items
  const [removedItems, setRemovedItems] = useState(new Set());
  const [excludedGeos, setExcludedGeos] = useState({
    zips: [],
    cities: [],
    counties: [],
    states: []
  });

  // Selection state
  const [selectedResult, setSelectedResult] = useState(null);

  // Map interaction callback (will be set by MapContext)
  const [mapInteractionCallback, setMapInteractionCallback] = useState(null);

  // Marker refs for popup interaction
  const markersRef = useRef({});

  // Helper function to generate removal key
  const getRemovalKey = useCallback((type, item) => {
    switch (type) {
      case 'zip': return `zip-${item.zipCode}`;
      case 'city': return `city-${item.name}-${item.state}`;
      case 'county': return `county-${item.name}-${item.state}`;
      case 'state': return `state-${item.state || item.name}`;
      default: return `${type}-${item.id}`;
    }
  }, []);

  // Function to remove item and all related items
  const removeItem = useCallback((type, item) => {
    const newRemovedItems = new Set(removedItems);
    const newExcludedGeos = { ...excludedGeos };

    if (type === 'state') {
      const stateName = item.state || item.name;
      // Add state to excluded
      newExcludedGeos.states.push(item);
      // Remove state
      newRemovedItems.add(`state-${stateName}`);

      // Remove all counties in state
      countyResults.forEach(county => {
        if (county.state === stateName) {
          newRemovedItems.add(getRemovalKey('county', county));
          newExcludedGeos.counties.push(county);
        }
      });
      // Remove all cities in state
      cityResults.forEach(city => {
        if (city.state === stateName) {
          newRemovedItems.add(getRemovalKey('city', city));
          newExcludedGeos.cities.push(city);
        }
      });
      // Remove all zips in state
      zipResults.forEach(zip => {
        if (zip.state === stateName) {
          newRemovedItems.add(getRemovalKey('zip', zip));
          newExcludedGeos.zips.push(zip);
        }
      });
    } else if (type === 'county') {
      // Add county to excluded
      newExcludedGeos.counties.push(item);
      // Remove county
      newRemovedItems.add(getRemovalKey('county', item));

      // Remove all cities in county
      cityResults.forEach(city => {
        if (city.county === item.name && city.state === item.state) {
          newRemovedItems.add(getRemovalKey('city', city));
          newExcludedGeos.cities.push(city);
        }
      });
      // Remove all zips in county
      zipResults.forEach(zip => {
        if (zip.county === item.name && zip.state === item.state) {
          newRemovedItems.add(getRemovalKey('zip', zip));
          newExcludedGeos.zips.push(zip);
        }
      });
    } else if (type === 'city') {
      // Add city to excluded
      newExcludedGeos.cities.push(item);
      // Remove city
      newRemovedItems.add(getRemovalKey('city', item));

      // Remove all zips in city
      zipResults.forEach(zip => {
        if (zip.city === item.name && zip.state === item.state) {
          newRemovedItems.add(getRemovalKey('zip', zip));
          newExcludedGeos.zips.push(zip);
        }
      });
    } else if (type === 'zip') {
      // Add zip to excluded
      newExcludedGeos.zips.push(item);
      // Remove just the zip
      newRemovedItems.add(getRemovalKey('zip', item));
    }

    setRemovedItems(newRemovedItems);
    setExcludedGeos(newExcludedGeos);
  }, [removedItems, excludedGeos, countyResults, cityResults, zipResults, getRemovalKey]);

  // Function to restore excluded items
  const restoreItem = useCallback((type, item) => {
    const newRemovedItems = new Set(removedItems);
    const newExcludedGeos = { ...excludedGeos };

    if (type === 'state') {
      const stateName = item.state || item.name;
      // Remove state from excluded
      newExcludedGeos.states = newExcludedGeos.states.filter(s => (s.state || s.name) !== stateName);
      // Restore state
      newRemovedItems.delete(`state-${stateName}`);

      // Restore all counties in state
      newExcludedGeos.counties = newExcludedGeos.counties.filter(county => {
        if (county.state === stateName) {
          newRemovedItems.delete(getRemovalKey('county', county));
          return false;
        }
        return true;
      });

      // Restore all cities in state
      newExcludedGeos.cities = newExcludedGeos.cities.filter(city => {
        if (city.state === stateName) {
          newRemovedItems.delete(getRemovalKey('city', city));
          return false;
        }
        return true;
      });

      // Restore all zips in state
      newExcludedGeos.zips = newExcludedGeos.zips.filter(zip => {
        if (zip.state === stateName) {
          newRemovedItems.delete(getRemovalKey('zip', zip));
          return false;
        }
        return true;
      });
    } else if (type === 'county') {
      // Remove county from excluded
      newExcludedGeos.counties = newExcludedGeos.counties.filter(c =>
        !(c.name === item.name && c.state === item.state)
      );
      // Restore county
      newRemovedItems.delete(getRemovalKey('county', item));

      // Restore all cities in county
      newExcludedGeos.cities = newExcludedGeos.cities.filter(city => {
        if (city.county === item.name && city.state === item.state) {
          newRemovedItems.delete(getRemovalKey('city', city));
          return false;
        }
        return true;
      });

      // Restore all zips in county
      newExcludedGeos.zips = newExcludedGeos.zips.filter(zip => {
        if (zip.county === item.name && zip.state === item.state) {
          newRemovedItems.delete(getRemovalKey('zip', zip));
          return false;
        }
        return true;
      });
    } else if (type === 'city') {
      // Remove city from excluded
      newExcludedGeos.cities = newExcludedGeos.cities.filter(c =>
        !(c.name === item.name && c.state === item.state)
      );
      // Restore city
      newRemovedItems.delete(getRemovalKey('city', item));

      // Restore all zips in city
      newExcludedGeos.zips = newExcludedGeos.zips.filter(zip => {
        if (zip.city === item.name && zip.state === item.state) {
          newRemovedItems.delete(getRemovalKey('zip', zip));
          return false;
        }
        return true;
      });
    } else if (type === 'zip') {
      // Remove zip from excluded
      newExcludedGeos.zips = newExcludedGeos.zips.filter(z =>
        z.zipCode !== item.zipCode
      );
      // Restore just the zip
      newRemovedItems.delete(getRemovalKey('zip', item));
    }

    setRemovedItems(newRemovedItems);
    setExcludedGeos(newExcludedGeos);
  }, [removedItems, excludedGeos, getRemovalKey]);

  // Filter function that respects removed items
  const filterResults = useCallback((results, type) => {
    return results.filter(item => !removedItems.has(getRemovalKey(type, item)));
  }, [removedItems, getRemovalKey]);

  // Geocode results management
  const removeGeocodeResult = useCallback((geocodeItem) => {
    const newRemovedItems = new Set(removedItems);
    newRemovedItems.add(`geocode-${geocodeItem.id}`);
    setRemovedItems(newRemovedItems);
  }, [removedItems]);

  const moveToNotFound = useCallback((geocodeItem) => {
    setNotFoundAddresses(prev => [...prev, geocodeItem]);
    removeGeocodeResult(geocodeItem);
  }, [removeGeocodeResult]);

  const restoreFromNotFound = useCallback((notFoundItem) => {
    setNotFoundAddresses(prev => prev.filter(item => item.id !== notFoundItem.id));
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setZipResults([]);
    setCityResults([]);
    setCountyResults([]);
    setStateResults([]);
    setAddressResults([]);
    setGeocodeResults([]);
    setNotFoundAddresses([]);
    setTotalResults(0);
    setHasMoreResults(false);
    setCurrentPage(0);
    setExcludedGeos({
      zips: [],
      cities: [],
      counties: [],
      states: []
    });
    setRemovedItems(new Set());
    setSelectedResult(null);
  }, [setCurrentPage, setHasMoreResults, setTotalResults]);

  // Sort configuration
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Sort handler
  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Get filtered results - using useMemo to compute once per render
  const filteredZipResults = useMemo(() => filterResults(zipResults, 'zip'), [filterResults, zipResults]);
  const filteredCityResults = useMemo(() => filterResults(cityResults, 'city'), [filterResults, cityResults]);
  const filteredCountyResults = useMemo(() => filterResults(countyResults, 'county'), [filterResults, countyResults]);
  const filteredStateResults = useMemo(() => filterResults(stateResults, 'state'), [filterResults, stateResults]);
  const filteredAddressResults = useMemo(() => filterResults(addressResults, 'address'), [filterResults, addressResults]);
  const filteredGeocodeResults = useMemo(() => {
    return geocodeResults.filter(item => !removedItems.has(`geocode-${item.id}`));
  }, [geocodeResults, removedItems]);

  // Get current filtered and sorted data
  const getCurrentData = useCallback((activeTab) => {
    let data = [];
    switch (activeTab) {
      case 'zips':
        data = filteredZipResults;
        break;
      case 'cities':
        data = filteredCityResults;
        break;
      case 'counties':
        data = filteredCountyResults;
        break;
      case 'states':
        data = filteredStateResults;
        break;
      case 'streets':
        data = filteredAddressResults;
        break;
      case 'geocode':
        data = filteredGeocodeResults;
        break;
      default:
        data = [];
    }

    // Apply sorting
    if (sortConfig.key) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (Array.isArray(aVal) && Array.isArray(bVal)) {
          const aMin = aVal.length > 0 ? Math.min(...aVal) : Number.POSITIVE_INFINITY;
          const bMin = bVal.length > 0 ? Math.min(...bVal) : Number.POSITIVE_INFINITY;
          return sortConfig.direction === 'asc'
            ? aMin - bMin
            : bMin - aMin;
        }

        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      });
    }

    return data;
  }, [filteredZipResults, filteredCityResults, filteredCountyResults, filteredStateResults, filteredAddressResults, filteredGeocodeResults, sortConfig]);

  // Result selection handlers with zoom logic
  // Single click always selects/focuses (use double-click to deselect)
  const handleResultSelect = useCallback(async (type, result) => {
    // Always select/re-focus the item (deselection is handled by double-click)
    setSelectedResult({ type, id: result.id });

    // Ensure we have valid coordinates
    const lat = parseFloat(result.lat || result.latitude);
    const lng = parseFloat(result.lng || result.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates for result:', result);
      return;
    }

    const newCenter = [lat, lng];

    // If we have a map interaction callback, use it to control the map
    if (mapInteractionCallback) {
      // Different zoom levels based on type (matching old GeoApplication.jsx logic)
      let zoomLevel;
      switch (type) {
        case 'zip':
          zoomLevel = 13; // Close zoom for ZIP codes
          break;
        case 'city':
          zoomLevel = 12; // Medium-close for cities
          break;
        case 'county':
          zoomLevel = 9; // Wider zoom for counties
          break;
        case 'state':
          zoomLevel = 7; // Wide zoom for states
          break;
        default:
          zoomLevel = 10;
      }

      // Call the map interaction callback with type-specific logic
      await mapInteractionCallback({
        type,
        result,
        center: newCenter,
        zoom: zoomLevel
      });

      // For ZIP markers, open the popup after a delay
      if (type === 'zip' && markersRef.current[`zip-${result.id}`]) {
        setTimeout(() => {
          const marker = markersRef.current[`zip-${result.id}`];
          if (marker) {
            marker.openPopup();
          }
        }, 500); // Delay to allow map animation to complete
      }
    }
  }, [mapInteractionCallback]);

  const handleResultDoubleClick = useCallback(async (type, result) => {
    if (selectedResult && selectedResult.type === type && selectedResult.id === result.id) {
      setSelectedResult(null); // Unselect

      // Also clear the map's focused state by calling with fitBounds type
      if (mapInteractionCallback) {
        await mapInteractionCallback({
          type: 'fitBounds',
          bounds: null // Will be handled in MapContext to clear focus
        });
      }
    }
  }, [selectedResult, mapInteractionCallback]);

  const isResultSelected = useCallback((type, resultId) => {
    return selectedResult && selectedResult.type === type && selectedResult.id === resultId;
  }, [selectedResult]);

  // Get total excluded count
  const getTotalExcludedCount = useCallback(() => {
    return excludedGeos.zips.length + excludedGeos.cities.length +
           excludedGeos.counties.length + excludedGeos.states.length;
  }, [excludedGeos]);


  const value = {
    // Results
    zipResults,
    setZipResults,
    cityResults,
    setCityResults,
    countyResults,
    setCountyResults,
    stateResults,
    setStateResults,
    addressResults,
    setAddressResults,
    geocodeResults,
    setGeocodeResults,
    notFoundAddresses,
    setNotFoundAddresses,

    // Pagination
    currentPage,
    setCurrentPage,
    hasMoreResults,
    setHasMoreResults,
    totalResults,
    setTotalResults,

    // Removed and excluded
    removedItems,
    setRemovedItems,
    excludedGeos,
    setExcludedGeos,

    // Selection
    selectedResult,
    setSelectedResult,

    // Map interaction
    mapInteractionCallback,
    setMapInteractionCallback,
    markersRef,

    // Functions
    getRemovalKey,
    removeItem,
    restoreItem,
    filterResults,
    clearResults,
    handleSort,
    getCurrentData,
    handleResultSelect,
    handleResultDoubleClick,
    isResultSelected,
    getTotalExcludedCount,
    removeGeocodeResult,
    moveToNotFound,
    restoreFromNotFound,

    // Filtered results
    filteredZipResults,
    filteredCityResults,
    filteredCountyResults,
    filteredStateResults,
    filteredAddressResults,
    filteredGeocodeResults,

    // Sort config
    sortConfig,
    setSortConfig
  };

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
};

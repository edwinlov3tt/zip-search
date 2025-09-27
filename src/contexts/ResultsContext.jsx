import React, { createContext, useContext, useState, useCallback } from 'react';

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

  // Clear results
  const clearResults = useCallback(() => {
    setZipResults([]);
    setCityResults([]);
    setCountyResults([]);
    setStateResults([]);
    setExcludedGeos({
      zips: [],
      cities: [],
      counties: [],
      states: []
    });
    setRemovedItems(new Set());
    setSelectedResult(null);
  }, []);

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

    // Functions
    getRemovalKey,
    removeItem,
    restoreItem,
    filterResults,
    clearResults
  };

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
};
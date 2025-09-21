import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, FeatureGroup, GeoJSON } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import { Search, Map as MapIcon, Layers, Circle as CircleIcon, Square, Download, Filter, MapPin, Crosshair, ZoomIn, ZoomOut, Maximize2, RotateCcw, ChevronUp, Globe, Copy, FileDown, Plus, X, Minus, ArrowUpDown, Sun, Moon, Check, Upload } from 'lucide-react';
import L from 'leaflet';
import Papa from 'papaparse';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { ZipCodeService } from './services/zipCodeService';
import { geocodingService } from './services/geocodingService';
import { mapboxGeocodingService } from './services/mapboxGeocodingService';
import zipBoundariesService from './services/zipBoundariesService';

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map component that handles view changes and click events
function MapController({ center, zoom, onMapClick, crosshairCursor, onViewportChange }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (onMapClick) {
      map.on('click', onMapClick);
      return () => {
        map.off('click', onMapClick);
      };
    }
  }, [map, onMapClick]);

  // Track viewport changes for ZIP boundaries
  useEffect(() => {
    if (onViewportChange) {
      const handleViewportChange = () => {
        const bounds = map.getBounds();
        onViewportChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      };

      map.on('moveend', handleViewportChange);
      map.on('zoomend', handleViewportChange);

      // Initial viewport
      handleViewportChange();

      return () => {
        map.off('moveend', handleViewportChange);
        map.off('zoomend', handleViewportChange);
      };
    }
  }, [map, onViewportChange]);

  // Apply crosshair cursor to all map layers
  useEffect(() => {
    const container = map.getContainer();
    if (crosshairCursor) {
      container.style.cursor = 'crosshair';
      // Also apply to all child elements to override Leaflet's default cursors
      const style = document.createElement('style');
      style.id = 'crosshair-cursor-style';
      style.textContent = `
        .leaflet-container,
        .leaflet-container * {
          cursor: crosshair !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      container.style.cursor = '';
      const existingStyle = document.getElementById('crosshair-cursor-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    }
    return () => {
      const existingStyle = document.getElementById('crosshair-cursor-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [map, crosshairCursor]);

  return null;
}

const GeoApplication = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [radius, setRadius] = useState(10);
  const [mapType, setMapType] = useState('street');
  const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]); // Geographic center of US
  const [mapZoom, setMapZoom] = useState(4); // Zoom level to show entire US

  // Results organized by type
  const [zipResults, setZipResults] = useState([]);
  const [cityResults, setCityResults] = useState([]);
  const [countyResults, setCountyResults] = useState([]);
  const [stateResults, setStateResults] = useState([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Pagination and loading
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [apiError, setApiError] = useState(null);

  // Removed items tracking
  const [removedItems, setRemovedItems] = useState(new Set());

  // Excluded items tracking for the Excluded tab
  const [excludedGeos, setExcludedGeos] = useState({
    zips: [],
    cities: [],
    counties: [],
    states: []
  });

  const [searchMode, setSearchMode] = useState('radius'); // 'radius', 'polygon', 'hierarchy', 'upload'
  const [selectedState, setSelectedState] = useState('');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [availableStates, setAvailableStates] = useState([]);
  const [availableCounties, setAvailableCounties] = useState([]);
  const [availableCities, setAvailableCities] = useState([]);

  // UI State
  const [drawerState, setDrawerState] = useState('half'); // 'full', 'half', 'collapsed'
  const [drawerHeight, setDrawerHeight] = useState(50); // For custom resize in half mode
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(null);
  const [startHeight, setStartHeight] = useState(null);
  const [activeTab, setActiveTab] = useState('zips');
  const [excludedSubTab, setExcludedSubTab] = useState('zips'); // Sub-tabs within excluded tab
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [drawerSearchTerm, setDrawerSearchTerm] = useState('');

  const [searchHistory, setSearchHistory] = useState(['90210', 'New York, NY', 'Los Angeles, CA']);
  const [isLoading, setIsLoading] = useState(false);
  const [drawnShapes, setDrawnShapes] = useState([]);
  const [isSearchMode, setIsSearchMode] = useState(true); // true = search, false = reset
  const [radiusCenter, setRadiusCenter] = useState(null);
  const [placingRadius, setPlacingRadius] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showCountyBorders, setShowCountyBorders] = useState(false);
  const [countyBoundaries, setCountyBoundaries] = useState(null);
  const [showZipBoundaries, setShowZipBoundaries] = useState(false);
  const [zipBoundariesData, setZipBoundariesData] = useState(null);
  const [loadingZipBoundaries, setLoadingZipBoundaries] = useState(false);
  const [currentViewport, setCurrentViewport] = useState(null);
  const [selectedCountyBoundary, setSelectedCountyBoundary] = useState(null);
  const [focusedZipCode, setFocusedZipCode] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCustomExport, setShowCustomExport] = useState(false);

  // Upload Search state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showHeaderMappingModal, setShowHeaderMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvPreviewData, setCsvPreviewData] = useState([]);
  const [csvFullData, setCsvFullData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

  // Autocomplete state
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Selection state for map-drawer synchronization
  const [selectedResult, setSelectedResult] = useState(null); // { type: 'zip', id: 123 }
  const tableContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const featureGroupRef = useRef(null);

  // Helper function to handle result selection from drawer
  const handleResultSelect = async (type, result) => {
    setSelectedResult({ type, id: result.id });

    // Ensure we have valid coordinates
    const lat = parseFloat(result.lat || result.latitude);
    const lng = parseFloat(result.lng || result.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates for result:', result);
      return;
    }

    // Force map update with precise coordinates
    const newCenter = [lat, lng];
    setMapCenter(newCenter);

    // Set appropriate zoom level and show boundaries based on type
    if (type === 'zip') {
      setMapZoom(13); // Close zoom for ZIP codes
      setFocusedZipCode(result.zipCode); // Highlight this ZIP

      // Auto-enable ZIP boundaries and load if not already shown
      if (!showZipBoundaries) {
        setShowZipBoundaries(true);
      }

      // Load boundary for this specific ZIP if not already loaded
      if (zipBoundariesData && !zipBoundariesData.features.find(f => f.properties?.zipcode === result.zipCode)) {
        await loadBoundariesForSearchResults([result.zipCode]);
      }

    } else if (type === 'city') {
      setMapZoom(11); // Medium zoom for cities
      setFocusedZipCode(null);

      // Show ZIP boundaries for all ZIPs in this city
      if (!showZipBoundaries) {
        setShowZipBoundaries(true);
      }

    } else if (type === 'county') {
      setMapZoom(9); // Wider zoom for counties
      setFocusedZipCode(null);

      // Show county border and all ZIP boundaries within
      setShowCountyBorders(true);
      setSelectedCountyBoundary({ name: result.name, state: result.state });

      // Enable ZIP boundaries to show all ZIPs in county
      if (!showZipBoundaries) {
        setShowZipBoundaries(true);
      }

      // Load all ZIP boundaries for this county
      const countyZips = zipResults.filter(z => z.county === result.name && z.state === result.state);
      const countyZipCodes = countyZips.map(z => z.zipCode);
      if (countyZipCodes.length > 0) {
        await loadBoundariesForSearchResults(countyZipCodes);
      }

    } else if (type === 'state') {
      setMapZoom(6); // Wide zoom for states
      setFocusedZipCode(null);
    }

    // Open popup for ZIP markers when selected from drawer
    if (type === 'zip') {
      // Use a longer delay and direct map manipulation for more reliable popup opening
      setTimeout(() => {
        const marker = markersRef.current[`zip-${result.id}`];
        if (marker && mapRef.current) {
          // Ensure map is centered first, then open popup
          mapRef.current.setView(newCenter, 13, { animate: true });
          setTimeout(() => {
            marker.openPopup();
          }, 300); // Additional delay after map animation
        }
      }, 200);
    }
  };

  // Helper function to check if a result is selected
  const isResultSelected = (type, resultId) => {
    return selectedResult && selectedResult.type === type && selectedResult.id === resultId;
  };

  // Helper function to handle double-click unselect
  const handleResultDoubleClick = (type, result) => {
    if (isResultSelected(type, result.id)) {
      setSelectedResult(null); // Unselect the row
    }
  };

  // Effect to scroll to selected item when selection changes from map click
  useEffect(() => {
    if (selectedResult && tableContainerRef.current) {
      // Find the selected row and scroll to it
      const selectedRow = tableContainerRef.current.querySelector(`[data-result-id="${selectedResult.type}-${selectedResult.id}"]`);
      if (selectedRow) {
        selectedRow.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [selectedResult]);

  // Load available states on component mount
  useEffect(() => {
    const loadStates = async () => {
      try {
        const states = await ZipCodeService.getStates();
        setAvailableStates(states);
      } catch (error) {
        console.error('Failed to load states:', error);
        setApiError('Failed to load states');
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
          // Auto-search when state is selected
          if (searchMode === 'hierarchy') {
            performHierarchySearch(selectedState, '', '');
          }
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
          // Auto-search when county is selected
          if (searchMode === 'hierarchy') {
            performHierarchySearch(selectedState, selectedCounty, '');
          }
        } catch (error) {
          console.error('Failed to load cities:', error);
        }
      };
      loadCities();
    } else {
      setAvailableCities([]);
      setSelectedCity('');
    }
  }, [selectedCounty]);

  // Auto-search when city is selected
  useEffect(() => {
    if (selectedState && selectedCity && searchMode === 'hierarchy') {
      performHierarchySearch(selectedState, selectedCounty, selectedCity);
    }
  }, [selectedCity]);

  // Load county boundaries when toggled
  useEffect(() => {
    if (showCountyBorders && !countyBoundaries) {
      loadCountyBoundaries();
    }
  }, [showCountyBorders]);

  // Load ZIP boundaries when toggled or viewport changes
  useEffect(() => {
    if (showZipBoundaries) {
      // Load cached boundaries first when toggled on
      const cachedBoundaries = zipBoundariesService.getAllCachedBoundaries();
      if (cachedBoundaries && cachedBoundaries.features.length > 0) {
        console.log(`Loaded ${cachedBoundaries.features.length} cached boundaries from localStorage`);
        setZipBoundariesData(cachedBoundaries);
      }

      // Don't auto-load viewport boundaries - only load search result boundaries
      // if (currentViewport) {
      //   loadZipBoundariesForViewport();
      // }
    } else if (!showZipBoundaries) {
      setZipBoundariesData(null);
    }
  }, [showZipBoundaries, currentViewport]);

  // Load ZIP boundaries for search results when available
  useEffect(() => {
    if (showZipBoundaries && searchPerformed && zipResults.length > 0) {
      loadBoundariesForSearchResults();
    }
  }, [showZipBoundaries, zipResults, searchPerformed]);


  const loadCountyBoundaries = async () => {
    try {
      console.log('Loading county boundaries...');
      // Load from public boundaries folder
      const response = await fetch('/boundaries/us-counties.geojson');
      if (response.ok) {
        const data = await response.json();
        setCountyBoundaries(data);
        console.log('County boundaries loaded successfully');
      } else {
        console.warn('County boundaries file not found. Please follow setup instructions.');
      }
    } catch (error) {
      console.error('Failed to load county boundaries:', error);
    }
  };

  // Debounced function to load ZIP boundaries for viewport
  const loadZipBoundariesForViewport = useCallback(
    debounce(async () => {
      if (!currentViewport || !showZipBoundaries) return;

      setLoadingZipBoundaries(true);
      try {
        // Determine appropriate limit based on zoom level
        const zoomLevel = mapRef.current?.getZoom() || 10;
        const limit = zoomLevel > 12 ? 100 : zoomLevel > 10 ? 50 : 30;

        const data = await zipBoundariesService.getViewportBoundaries(
          currentViewport,
          limit,
          true // Use simplified geometry
        );

        if (data && data.features) {
          setZipBoundariesData(prevData => {
            // If no previous data, just return new data
            if (!prevData || !prevData.features) {
              console.log(`Loaded ${data.features.length} ZIP boundaries (initial load)`);
              return data;
            }

            // Create a Set of existing ZIP codes for quick lookup
            const existingZips = new Set(
              prevData.features.map(f => f.properties?.zipcode)
            );

            // Filter out duplicates from new data
            const newFeatures = data.features.filter(
              feature => !existingZips.has(feature.properties?.zipcode)
            );

            // If we have new features, merge them
            if (newFeatures.length > 0) {
              const mergedData = {
                ...data,
                features: [...prevData.features, ...newFeatures]
              };
              console.log(`Added ${newFeatures.length} new ZIP boundaries (total: ${mergedData.features.length})`);
              return mergedData;
            }

            // No new features, return existing data
            console.log(`No new boundaries in viewport (total: ${prevData.features.length})`);
            return prevData;
          });
        }
      } catch (error) {
        console.error('Failed to load ZIP boundaries:', error);
      } finally {
        setLoadingZipBoundaries(false);
      }
    }, 500),
    [currentViewport, showZipBoundaries]
  );

  // Handle viewport change
  const handleViewportChange = useCallback((viewport) => {
    setCurrentViewport(viewport);
  }, []);

  // Load boundaries specifically for search results (only load ZIPs that are in results)
  const loadBoundariesForSearchResults = async (additionalZips = []) => {
    if (!zipResults || zipResults.length === 0) return;

    // Extract unique ZIP codes from search results
    const resultZipCodes = [...new Set(zipResults.map(result => result.zipCode || result.zipcode))];

    // Combine with any additional ZIPs requested
    const allZipCodes = [...new Set([...resultZipCodes, ...additionalZips])];

    console.log(`Loading boundaries for ${allZipCodes.length} ZIP codes (${resultZipCodes.length} from results, ${additionalZips.length} additional)`);
    setLoadingZipBoundaries(true);

    try {
      // Fetch boundaries for search result ZIPs only
      const searchResultBoundaries = await zipBoundariesService.getMultipleZipBoundaries(
        allZipCodes,
        true
      );

      if (searchResultBoundaries && searchResultBoundaries.features.length > 0) {
        // Mark features based on whether they're in search results
        searchResultBoundaries.features.forEach(feature => {
          const zipCode = feature.properties?.zipcode;
          feature.properties.inSearchResults = resultZipCodes.includes(zipCode);
          feature.properties.isAdditional = additionalZips.includes(zipCode);
        });

        setZipBoundariesData(searchResultBoundaries);
        console.log(`Loaded ${searchResultBoundaries.features.length} boundaries`);
      }
    } catch (error) {
      console.error('Failed to load search result boundaries:', error);
    } finally {
      setLoadingZipBoundaries(false);
    }
  };


  // Helper function to generate removal key
  const getRemovalKey = (type, item) => {
    switch (type) {
      case 'zip': return `zip-${item.zipCode}`;
      case 'city': return `city-${item.name}-${item.state}`;
      case 'county': return `county-${item.name}-${item.state}`;
      case 'state': return `state-${item.state || item.name}`;
      default: return `${type}-${item.id}`;
    }
  };

  // Function to remove item and all related items
  const removeItem = (type, item) => {
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
  };

  // Function to restore excluded items
  const restoreItem = (type, item) => {
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
  };

  // Calculate total excluded count
  const getTotalExcludedCount = () => {
    return excludedGeos.zips.length + excludedGeos.cities.length +
           excludedGeos.counties.length + excludedGeos.states.length;
  };

  // Copy excluded items to clipboard
  const copyExcludedItems = () => {
    const lines = [];

    if (excludedGeos.states.length > 0) {
      lines.push('STATES:');
      excludedGeos.states.forEach(state => {
        lines.push(`  ${state.name || state.state}`);
      });
      lines.push('');
    }

    if (excludedGeos.counties.length > 0) {
      lines.push('COUNTIES:');
      excludedGeos.counties.forEach(county => {
        lines.push(`  ${county.name}, ${county.state}`);
      });
      lines.push('');
    }

    if (excludedGeos.cities.length > 0) {
      lines.push('CITIES:');
      excludedGeos.cities.forEach(city => {
        lines.push(`  ${city.name}, ${city.state}`);
      });
      lines.push('');
    }

    if (excludedGeos.zips.length > 0) {
      lines.push('ZIP CODES:');
      excludedGeos.zips.forEach(zip => {
        lines.push(`  ${zip.zipCode} - ${zip.city}, ${zip.state}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
  };

  // Export excluded items as CSV
  const exportExcludedAsCSV = () => {
    const rows = [];
    rows.push(['Type', 'Name', 'State', 'County', 'ZIP Code']);

    excludedGeos.states.forEach(state => {
      rows.push(['State', state.name || state.state, state.name || state.state, '', '']);
    });

    excludedGeos.counties.forEach(county => {
      rows.push(['County', county.name, county.state, county.name, '']);
    });

    excludedGeos.cities.forEach(city => {
      rows.push(['City', city.name, city.state, city.county || '', '']);
    });

    excludedGeos.zips.forEach(zip => {
      rows.push(['ZIP', zip.zipCode, zip.state, zip.county, zip.zipCode]);
    });

    const csv = rows.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'excluded-geos.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter function that respects removed items
  const filterResults = (results, type) => {
    return results.filter(item => !removedItems.has(getRemovalKey(type, item)));
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setSearchPerformed(true);
    setApiError(null);
    setCurrentPage(0);
    setIsSearchMode(false); // Switch to reset mode

    try {
      let searchParams = { limit: 2000, offset: 0 }; // Increased limit to show more results

      if (searchMode === 'radius') {
        // Radius search
        if (searchTerm) {
          // First geocode the search term to get coordinates
          try {
            const geocoded = await ZipCodeService.geocodeLocation(searchTerm);
            searchParams.lat = geocoded.lat;
            searchParams.lng = geocoded.lng;
            searchParams.radius = radius;
          } catch (geocodeError) {
            // If geocoding fails, fallback to text search
            searchParams.query = searchTerm;
          }
        }
      } else if (searchMode === 'polygon') {
        // Polygon search is handled automatically when shapes are drawn
        if (drawnShapes.length === 0) {
          setApiError('Please draw a shape on the map to search');
          setIsLoading(false);
          return;
        }
        // All shapes are already searched, just continue with the existing results
      } else if (searchMode === 'hierarchy') {
        // Hierarchical search
        if (selectedState) searchParams.state = selectedState;
        if (selectedCounty) searchParams.county = selectedCounty;
        if (selectedCity) searchParams.city = selectedCity;
      }

      // Perform the search
      const searchResult = await ZipCodeService.search(searchParams);

      // Transform API results to match our component structure
      const transformedZips = searchResult.results.map((zip, index) => ({
        id: index + 1,
        zipCode: zip.zipcode,
        city: zip.city,
        county: zip.county,
        state: zip.stateCode,
        lat: zip.latitude,
        lng: zip.longitude,
        latitude: zip.latitude,  // Include both formats
        longitude: zip.longitude, // Include both formats
        area: Math.round((Math.random() * 10 + 1) * 10) / 10, // Mock area for now
        overlap: Math.round(Math.random() * 40 + 60) // Mock overlap for now
      }));

      setZipResults(transformedZips);
      setTotalResults(searchResult.total);
      setHasMoreResults(searchResult.hasMore);

      // Group results into cities, counties, and states
      const uniqueCities = [...new Set(transformedZips.map(zip =>
        `${zip.city}|${zip.state}|${zip.county}`
      ))].map((cityKey, index) => {
        const [city, state, county] = cityKey.split('|');
        const cityZips = transformedZips.filter(z => z.city === city && z.state === state);
        const avgLat = cityZips.reduce((sum, z) => sum + z.lat, 0) / cityZips.length;
        const avgLng = cityZips.reduce((sum, z) => sum + z.lng, 0) / cityZips.length;
        return {
          id: index + 1,
          name: city,
          state,
          county,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      const uniqueCounties = [...new Set(transformedZips.map(zip =>
        `${zip.county}|${zip.state}`
      ))].map((countyKey, index) => {
        const [county, state] = countyKey.split('|');
        const countyZips = transformedZips.filter(z => z.county === county && z.state === state);
        const avgLat = countyZips.reduce((sum, z) => sum + z.lat, 0) / countyZips.length;
        const avgLng = countyZips.reduce((sum, z) => sum + z.lng, 0) / countyZips.length;
        return {
          id: index + 1,
          name: county,
          state,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      const uniqueStates = [...new Set(transformedZips.map(zip => zip.state))].map((state, index) => {
        const stateZips = transformedZips.filter(z => z.state === state);
        const avgLat = stateZips.reduce((sum, z) => sum + z.lat, 0) / stateZips.length;
        const avgLng = stateZips.reduce((sum, z) => sum + z.lng, 0) / stateZips.length;
        const stateInfo = availableStates.find(s => s.code === state);
        return {
          id: index + 1,
          name: stateInfo ? stateInfo.name : state,
          state: state,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      setCityResults(uniqueCities);
      setCountyResults(uniqueCounties);
      setStateResults(uniqueStates);

      // Center map on first result
      if (transformedZips.length > 0) {
        setMapCenter([transformedZips[0].lat, transformedZips[0].lng]);
        setMapZoom(searchMode === 'radius' ? 11 : 9);
      }

      // Update search history
      if (searchTerm && !searchHistory.includes(searchTerm)) {
        setSearchHistory(prev => [searchTerm, ...prev.slice(0, 9)]);
      }

      // Don't auto-enable ZIP boundaries anymore - let user control it
      // if ((searchMode === 'radius' || searchMode === 'polygon') && transformedZips.length > 0) {
      //   console.log('Auto-enabling ZIP boundaries for search results');
      //   setShowZipBoundaries(true);
      // }

    } catch (error) {
      console.error('Search failed:', error);
      setApiError(error.message);
      setZipResults([]);
      setCityResults([]);
      setCountyResults([]);
      setStateResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const performHierarchySearch = async (state, county, city) => {
    setIsLoading(true);
    setSearchPerformed(true);
    setApiError(null);
    setCurrentPage(0);
    // Don't change search mode for hierarchy

    try {
      const searchParams = { limit: 5000, offset: 0 }; // Increased limit to get all zips
      if (state) searchParams.state = state;
      if (county) searchParams.county = county;
      if (city) searchParams.city = city;

      const searchResult = await ZipCodeService.search(searchParams);

      // Transform API results
      const transformedZips = searchResult.results.map((zip, index) => ({
        id: index + 1,
        zipCode: zip.zipcode,
        city: zip.city,
        county: zip.county,
        state: zip.stateCode,
        lat: zip.latitude,
        lng: zip.longitude,
        latitude: zip.latitude,  // Include both formats
        longitude: zip.longitude, // Include both formats
        area: Math.round((Math.random() * 10 + 1) * 10) / 10,
        overlap: Math.round(Math.random() * 40 + 60)
      }));

      setZipResults(transformedZips);
      setTotalResults(searchResult.total);
      setHasMoreResults(searchResult.hasMore);

      // Group results for aggregation
      const uniqueCities = [...new Set(transformedZips.map(zip =>
        `${zip.city}|${zip.state}|${zip.county}`
      ))].map((cityKey, index) => {
        const [city, state, county] = cityKey.split('|');
        const cityZips = transformedZips.filter(z => z.city === city && z.state === state);
        const avgLat = cityZips.reduce((sum, z) => sum + z.lat, 0) / cityZips.length;
        const avgLng = cityZips.reduce((sum, z) => sum + z.lng, 0) / cityZips.length;
        return {
          id: index + 1,
          name: city,
          state,
          county,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      const uniqueCounties = [...new Set(transformedZips.map(zip =>
        `${zip.county}|${zip.state}`
      ))].map((countyKey, index) => {
        const [county, state] = countyKey.split('|');
        const countyZips = transformedZips.filter(z => z.county === county && z.state === state);
        const avgLat = countyZips.reduce((sum, z) => sum + z.lat, 0) / countyZips.length;
        const avgLng = countyZips.reduce((sum, z) => sum + z.lng, 0) / countyZips.length;
        return {
          id: index + 1,
          name: county,
          state,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      const uniqueStates = [...new Set(transformedZips.map(zip => zip.state))].map((state, index) => {
        const stateZips = transformedZips.filter(z => z.state === state);
        const avgLat = stateZips.reduce((sum, z) => sum + z.lat, 0) / stateZips.length;
        const avgLng = stateZips.reduce((sum, z) => sum + z.lng, 0) / stateZips.length;
        const stateInfo = availableStates.find(s => s.code === state);
        return {
          id: index + 1,
          name: stateInfo ? stateInfo.name : state,
          state: state,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      setCityResults(uniqueCities);
      setCountyResults(uniqueCounties);
      setStateResults(uniqueStates);

      // Center map based on selection level
      if (transformedZips.length > 0) {
        const avgLat = transformedZips.reduce((sum, z) => sum + z.lat, 0) / transformedZips.length;
        const avgLng = transformedZips.reduce((sum, z) => sum + z.lng, 0) / transformedZips.length;
        setMapCenter([avgLat, avgLng]);

        // Adjust zoom based on selection level
        if (city) {
          setMapZoom(13); // City level - close zoom
        } else if (county) {
          setMapZoom(10); // County level - medium zoom
        } else if (state) {
          setMapZoom(6); // State level - wide zoom
        }
      }

    } catch (error) {
      console.error('Search failed:', error);
      setApiError(error.message);
      setZipResults([]);
      setCityResults([]);
      setCountyResults([]);
      setStateResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSearchTerm('');
    setSelectedState('');
    setSelectedCounty('');
    setSelectedCity('');
    setAvailableCounties([]);
    setAvailableCities([]);
    setSearchPerformed(false);
    setZipResults([]);
    setCityResults([]);
    setCountyResults([]);
    setStateResults([]);
    setApiError(null);
    setIsSearchMode(true);
    setRadiusCenter(null);
    setPlacingRadius(false);
    // Clear exclusions
    setExcludedGeos({
      zips: [],
      cities: [],
      counties: [],
      states: []
    });
    setDrawnShapes([]);
    setRemovedItems(new Set());
    setSelectedResult(null); // Clear selection
    // If on Excluded tab, switch back to Zips tab
    if (activeTab === 'excluded') {
      setActiveTab('zips');
    }

    // Clear autocomplete state
    setAutocompleteResults([]);
    setShowAutocomplete(false);
    setSelectedLocation(null);
    setIsSearching(false);

    // Clear drawn shapes from the map
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }

    // Reset map to default center (entire US)
    setMapCenter([39.8283, -98.5795]); // Geographic center of US
    setMapZoom(4);
  };

  // Handle search mode change with auto-reset
  const handleSearchModeChange = (newMode) => {
    setSearchMode(newMode);
    handleReset();
  };

  // Autocomplete Functions
  const handleAutocompleteSearch = async (query) => {
    if (!query || query.length < 2) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    setIsSearching(true);
    try {
      // Try MapBox first (more accurate), fallback to Nominatim if MapBox fails
      let results = await mapboxGeocodingService.searchPlaces(query, 8);

      // If MapBox returns no results or API key not configured, fallback to Nominatim
      if (results.length === 0) {
        console.log('Falling back to Nominatim geocoding...');
        results = await geocodingService.searchPlaces(query, 8);
      }

      setAutocompleteResults(results);
      setShowAutocomplete(results.length > 0);
    } catch (error) {
      console.error('Autocomplete search failed:', error);
      // Try fallback to Nominatim on error
      try {
        const fallbackResults = await geocodingService.searchPlaces(query, 8);
        setAutocompleteResults(fallbackResults);
        setShowAutocomplete(fallbackResults.length > 0);
      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        setAutocompleteResults([]);
        setShowAutocomplete(false);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = async (location) => {
    setSelectedLocation(location);
    // Use the appropriate service based on the location source
    const displayName = location.raw && location.raw.place_name
      ? mapboxGeocodingService.formatDisplayName(location)
      : geocodingService.formatDisplayName(location);
    setSearchTerm(displayName);
    setAutocompleteResults([]);
    setShowAutocomplete(false);

    // Set the radius center to the selected location
    setRadiusCenter([location.lat, location.lng]);
    setMapCenter([location.lat, location.lng]);
    setMapZoom(13);

    // Auto-trigger radius search
    setIsLoading(true);
    setSearchPerformed(true);
    setApiError(null);
    setCurrentPage(0);
    setIsSearchMode(false);

    try {
      const searchParams = {
        lat: location.lat,
        lng: location.lng,
        radius: radius,
        limit: 2000,
        offset: 0
      };

      const searchResult = await ZipCodeService.search(searchParams);

      // Transform API results to match our component structure
      const transformedZips = searchResult.results.map((zip, index) => ({
        id: index + 1,
        zipCode: zip.zipcode,
        city: zip.city,
        county: zip.county,
        state: zip.stateCode,
        lat: zip.latitude,
        lng: zip.longitude,
        latitude: zip.latitude,  // Include both formats
        longitude: zip.longitude, // Include both formats
        timezone: zip.timezone || 'N/A',
        population: zip.estimatedPopulation || 0,
        medianIncome: zip.medianHouseholdIncome || 0,
        area: Math.round((Math.random() * 10 + 1) * 10) / 10, // Mock area for now
        overlap: Math.round(Math.random() * 40 + 60) // Mock overlap for now
      }));

      setZipResults(transformedZips);

      // Process cities from ZIP results
      const uniqueCities = [...new Set(transformedZips.map(zip =>
        `${zip.city}|${zip.state}`
      ))].map((cityKey, index) => {
        const [city, state] = cityKey.split('|');
        const cityZips = transformedZips.filter(z => z.city === city && z.state === state);
        const avgLat = cityZips.reduce((sum, z) => sum + z.lat, 0) / cityZips.length;
        const avgLng = cityZips.reduce((sum, z) => sum + z.lng, 0) / cityZips.length;
        return {
          id: index + 1,
          name: city,
          state,
          county: cityZips[0].county, // Use first ZIP's county
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      // Process counties from ZIP results
      const uniqueCounties = [...new Set(transformedZips.map(zip =>
        `${zip.county}|${zip.state}`
      ))].map((countyKey, index) => {
        const [county, state] = countyKey.split('|');
        const countyZips = transformedZips.filter(z => z.county === county && z.state === state);
        const avgLat = countyZips.reduce((sum, z) => sum + z.lat, 0) / countyZips.length;
        const avgLng = countyZips.reduce((sum, z) => sum + z.lng, 0) / countyZips.length;
        return {
          id: index + 1,
          name: county,
          state,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      // Process states from ZIP results
      const uniqueStates = [...new Set(transformedZips.map(zip => zip.state))].map((state, index) => {
        const stateZips = transformedZips.filter(z => z.state === state);
        const avgLat = stateZips.reduce((sum, z) => sum + z.lat, 0) / stateZips.length;
        const avgLng = stateZips.reduce((sum, z) => sum + z.lng, 0) / stateZips.length;
        return {
          id: index + 1,
          name: state,
          code: state,
          lat: avgLat,
          lng: avgLng,
          latitude: avgLat,  // Include both formats
          longitude: avgLng  // Include both formats
        };
      });

      setCityResults(uniqueCities);
      setCountyResults(uniqueCounties);
      setStateResults(uniqueStates);

    } catch (error) {
      console.error('Radius search error:', error);
      setApiError(error.message || 'Search failed. Please try again.');
      // Clear all results on error
      setCityResults([]);
      setCountyResults([]);
      setStateResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear selected location if user starts typing again
    if (selectedLocation && value !== geocodingService.formatDisplayName(selectedLocation)) {
      setSelectedLocation(null);
      setRadiusCenter(null);
    }

    // Trigger autocomplete search
    handleAutocompleteSearch(value);
  };

  const handleAutocompleteBlur = () => {
    // Delay hiding to allow for clicking on results
    setTimeout(() => {
      setShowAutocomplete(false);
    }, 200);
  };

  // CSV Upload Handling Functions
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setUploadError(null);
    // Clear any existing search results
    setZipResults([]);
    setCityResults([]);
    setCountyResults([]);
    setSearchPerformed(false);
  };

  const processDataInBatches = async (data, batchSize = 50) => {
    console.log('🔵 processDataInBatches started - data:', data.length, 'batchSize:', batchSize);
    const allResults = {
      zips: [],
      cities: [],
      counties: []
    };

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

            // Filter for valid coordinates and categorize
            const validResults = results.filter(r => r && r.latitude != null && r.longitude != null);

            return {
              type: item.type,
              results: validResults
            };
          } catch (error) {
            console.warn(`Failed to search for ${item.query}:`, error);
            return { type: item.type, results: [] };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Aggregate results by type and transform coordinates
        batchResults.forEach(({ type, results }) => {
          // Transform results to have consistent lat/lng properties and proper structure
          const transformedResults = results.map((r, index) => ({
            ...r,
            id: `${type}-${r.zipcode || r.name || 'unknown'}-${index}`,
            // Ensure consistent coordinate properties
            lat: r.latitude,
            lng: r.longitude,
            latitude: r.latitude,
            longitude: r.longitude,
            // Add display properties based on type
            zipCode: r.zipcode || r.zipCode,
            city: r.city || r.place,
            county: r.county || r.province,
            state: r.stateCode || r.state_code || r.state,
            // Add mock data for consistency with other search modes
            area: Math.round((Math.random() * 10 + 1) * 10) / 10,
            overlap: Math.round(Math.random() * 40 + 60)
          }));

          if (type === 'zip') {
            allResults.zips.push(...transformedResults);
          } else if (type === 'city') {
            allResults.cities.push(...transformedResults);
          } else if (type === 'county') {
            allResults.counties.push(...transformedResults);
          }
        });

        // Update the UI with current results (progressive update)
        setZipResults(prev => {
          const newResults = [...prev, ...allResults.zips];
          // Remove duplicates based on zipCode
          const uniqueResults = Array.from(
            new Map(newResults.map(item => [item.zipCode, item])).values()
          );
          return uniqueResults;
        });
        setCityResults(prev => {
          const newResults = [...prev, ...allResults.cities];
          // Remove duplicates based on city+state
          const uniqueResults = Array.from(
            new Map(newResults.map(item => [`${item.city}-${item.state}`, item])).values()
          );
          return uniqueResults;
        });
        setCountyResults(prev => {
          const newResults = [...prev, ...allResults.counties];
          // Remove duplicates based on county+state
          const uniqueResults = Array.from(
            new Map(newResults.map(item => [`${item.county}-${item.state}`, item])).values()
          );
          return uniqueResults;
        });

        // Clear aggregated results for next batch
        allResults.zips = [];
        allResults.cities = [];
        allResults.counties = [];

      } catch (error) {
        console.error('Batch processing error:', error);
        // Continue processing remaining batches even if one fails
      }
    }

    // Mark search as performed and update total count
    setSearchPerformed(true);
    setUploadProcessing(false);
    setProcessingProgress({ current: 0, total: 0 });
  };

  const handleHeaderMappingConfirm = async () => {
    console.log('🟢 handleHeaderMappingConfirm called');
    console.log('🔵 csvFullData length:', csvFullData?.length);
    console.log('🔵 Column mapping:', columnMapping);

    setShowHeaderMappingModal(false);
    setUploadProcessing(true);
    setUploadError(null);
    setProcessingProgress({ current: 0, total: csvFullData.length });

    try {
      // Transform CSV data based on column mapping
      const transformedData = [];

      csvFullData.forEach(row => {
        const searchItems = [];

        // Track which columns are being used for each row
        let zipCode = null;
        let city = null;
        let county = null;
        let state = null;

        Object.entries(columnMapping).forEach(([header, type]) => {
          if (type !== 'ignore' && row[header]) {
            const value = row[header].trim();

            switch(type) {
              case 'zipcode':
                if (value && /^\d{5}(-\d{4})?$/.test(value)) {
                  zipCode = value;
                }
                break;
              case 'city':
                city = value;
                break;
              case 'county':
                county = value;
                break;
              case 'state':
                state = normalizeState(value);
                break;
            }
          }
        });

        // Create search items based on available data
        if (zipCode) {
          searchItems.push({ type: 'zip', query: zipCode });
        }
        if (city && state) {
          searchItems.push({ type: 'city', query: `${city}, ${state}` });
        } else if (city) {
          searchItems.push({ type: 'city', query: city });
        }
        if (county && state) {
          searchItems.push({ type: 'county', query: `${county}, ${state}` });
        } else if (county) {
          searchItems.push({ type: 'county', query: county });
        }

        transformedData.push(...searchItems);
      });

      if (transformedData.length === 0) {
        throw new Error('No valid location data found after mapping columns');
      }

      // Process in batches
      console.log('🟢 Starting processDataInBatches with', transformedData.length, 'items');
      await processDataInBatches(transformedData);

    } catch (error) {
      setUploadError(error.message);
      setUploadProcessing(false);
    }
  };

  const handleCSVUpload = (file) => {
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
        console.log('🔵 Preview data rows:', preview.length);

        if (headers.length === 0) {
          console.error('🔴 No headers found in CSV');
          setUploadError('No headers found in CSV file');
          setUploadProcessing(false);
          return;
        }

        // Store preview data and headers
        setCsvHeaders(headers);
        setCsvPreviewData(preview);

        // Auto-detect column types and set initial mapping
        const initialMapping = {};
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('zip') || lowerHeader.includes('postal')) {
            initialMapping[header] = 'zipcode';
          } else if (lowerHeader.includes('city') || lowerHeader.includes('town')) {
            initialMapping[header] = 'city';
          } else if (lowerHeader.includes('county')) {
            initialMapping[header] = 'county';
          } else if (lowerHeader.includes('state') || lowerHeader.includes('province')) {
            initialMapping[header] = 'state';
          } else {
            initialMapping[header] = 'ignore';
          }
        });
        setColumnMapping(initialMapping);
        console.log('🔵 Initial column mapping:', initialMapping);

        // Parse the full file in the background
        console.log('🔵 Starting full file parse...');
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",  // Auto-detect delimiter
          newline: "",    // Auto-detect line break
          quoteChar: '"',
          escapeChar: '"',
          transformHeader: (header) => header.trim(),
          complete: (fullResults) => {
            // Check if we have valid data
            if (!fullResults.data || fullResults.data.length === 0) {
              setUploadError('No data found in CSV file');
              setUploadProcessing(false);
              return;
            }

            // Store the full data
            setCsvFullData(fullResults.data);
            setUploadProcessing(false);

            // Log delimiter info for debugging
            console.log('CSV parsed successfully:', {
              delimiter: fullResults.meta.delimiter,
              linebreak: fullResults.meta.linebreak,
              rowCount: fullResults.data.length,
              headers: fullResults.meta.fields
            });

            // Show the header mapping modal
            console.log('🟢 Setting showHeaderMappingModal to true');
            setShowHeaderMappingModal(true);
          },
          error: (error) => {
            console.error('🔴 Error parsing full CSV:', error);
            setUploadError(`Error parsing full CSV: ${error.message}`);
            setUploadProcessing(false);
          }
        });
      },
      error: (error) => {
        setUploadError(`Error parsing CSV: ${error.message}`);
        setUploadProcessing(false);
      }
    });
  };


  const normalizeState = (state) => {
    const stateMap = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH',
      'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
      'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA',
      'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN',
      'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA',
      'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const normalized = state.toLowerCase().trim();
    return stateMap[normalized] || state.toUpperCase();
  };


  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedData = (data) => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc'
        ? aVal - bVal
        : bVal - aVal;
    });
  };

  // Helper function to dedupe and sort data
  const dedupeAndSort = (data, tab) => {
    const seen = new Set();
    const unique = [];

    for (const item of data) {
      let key;
      switch (tab) {
        case 'zips':
          key = item.zipCode;
          break;
        case 'cities':
          key = `${item.name}|${item.state}`;
          break;
        case 'counties':
          key = `${item.name}|${item.state}`;
          break;
        case 'states':
          key = item.state;
          break;
        default:
          key = item.id;
      }

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    // Sort by primary field
    return unique.sort((a, b) => {
      let aVal, bVal;
      switch (tab) {
        case 'zips':
          aVal = a.zipCode;
          bVal = b.zipCode;
          break;
        case 'cities':
        case 'counties':
        case 'states':
          aVal = a.name;
          bVal = b.name;
          break;
        default:
          return 0;
      }
      return String(aVal).localeCompare(String(bVal));
    });
  };

  // Simple export function (minimal columns)
  const exportSimpleCsv = (data) => {
    const deduped = dedupeAndSort(data, activeTab);

    let csv = '';

    // Create CSV based on tab type
    if (activeTab === 'zips') {
      csv = deduped.map(item => item.zipCode).join('\n');
    } else if (activeTab === 'cities') {
      csv = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
    } else if (activeTab === 'counties') {
      csv = deduped.map(item => `${item.name} County, ${item.state}`).join('\n');
    } else if (activeTab === 'states') {
      csv = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
    }

    // Generate filename with pattern
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `${activeTab}_${deduped.length}rows_${timestamp}.csv`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (data) => {
    let text = '';

    if (activeTab === 'zips') {
      // Copy only ZIP codes
      text = data.map(item => item.zipCode).join('\n');
    } else if (activeTab === 'cities') {
      // Copy cities with state code (e.g., "Dallas, TX")
      text = data.map(item => `${item.name}, ${item.state}`).join('\n');
    } else if (activeTab === 'counties') {
      // Copy counties with state code (e.g., "Dallas County, TX")
      text = data.map(item => `${item.name} County, ${item.state}`).join('\n');
    } else if (activeTab === 'states') {
      // Copy state names with state code (e.g., "Texas, TX")
      text = data.map(item => `${item.name}, ${item.state}`).join('\n');
    }

    try {
      await navigator.clipboard.writeText(text);
      // Show success feedback
      setCopySuccess(true);
      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Function removed - no longer needed as we don't have state exclusion feature

  const getCurrentData = () => {
    let data;
    switch (activeTab) {
      case 'zips': data = getSortedData(filterResults(zipResults, 'zip')); break;
      case 'cities': data = getSortedData(filterResults(cityResults, 'city')); break;
      case 'counties': data = getSortedData(filterResults(countyResults, 'county')); break;
      case 'states': data = getSortedData(filterResults(stateResults, 'state')); break;
      default: data = [];
    }

    // Apply drawer search filter
    if (drawerSearchTerm) {
      const searchLower = drawerSearchTerm.toLowerCase();
      data = data.filter(item => {
        if (activeTab === 'zips') {
          return item.zipCode.toLowerCase().includes(searchLower) ||
                 item.city.toLowerCase().includes(searchLower) ||
                 item.county.toLowerCase().includes(searchLower) ||
                 item.state.toLowerCase().includes(searchLower);
        } else if (activeTab === 'cities') {
          return item.name.toLowerCase().includes(searchLower) ||
                 item.state.toLowerCase().includes(searchLower) ||
                 (item.county && item.county.toLowerCase().includes(searchLower));
        } else if (activeTab === 'counties') {
          return item.name.toLowerCase().includes(searchLower) ||
                 item.state.toLowerCase().includes(searchLower);
        } else if (activeTab === 'states') {
          return item.name.toLowerCase().includes(searchLower) ||
                 item.state.toLowerCase().includes(searchLower);
        }
        return false;
      });
    }

    return data;
  };

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

  // Handle drawing events
  const onCreated = (e) => {
    const { layer, layerType } = e;
    const newShape = { layer, type: layerType, id: layer._leaflet_id };
    const updatedShapes = [...drawnShapes, newShape];
    setDrawnShapes(updatedShapes);

    // Perform search for this single shape and append results
    if (searchMode === 'polygon') {
      performSingleShapeSearch(newShape, drawnShapes.length > 0);
    }
  };

  const onDeleted = (e) => {
    const { layers } = e;
    const deletedIds = [];
    layers.eachLayer((layer) => {
      deletedIds.push(layer._leaflet_id);
    });

    const newShapes = drawnShapes.filter(shape =>
      !deletedIds.includes(shape.layer._leaflet_id)
    );
    setDrawnShapes(newShapes);

    // Re-aggregate results when shapes are deleted
    if (searchMode === 'polygon') {
      if (newShapes.length === 0) {
        // Clear results if no shapes
        setZipResults([]);
        setCityResults([]);
        setCountyResults([]);
        setStateResults([]);
        setSearchPerformed(false);
      } else {
        // Filter out results from deleted shapes
        const remainingShapeIds = new Set(newShapes.map(s => s.id));
        const remainingZips = zipResults.filter(zip =>
          !zip.shapeId || remainingShapeIds.has(zip.shapeId)
        );
        setZipResults(remainingZips);
        updateAggregatedResults(remainingZips);
      }
    }
  };

  const performSingleShapeSearch = async (shape, appendResults = false) => {
    setIsLoading(true);
    if (!appendResults) {
      setSearchPerformed(true);
      setApiError(null);
      setIsSearchMode(false);
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

      // Transform results
      const transformedZips = searchResult.results.map((zip, index) => ({
        id: appendResults ? zipResults.length + index + 1 : index + 1,
        zipCode: zip.zipcode,
        city: zip.city,
        county: zip.county,
        state: zip.stateCode,
        lat: zip.latitude,
        lng: zip.longitude,
        latitude: zip.latitude,  // Include both formats
        longitude: zip.longitude, // Include both formats
        area: Math.round((Math.random() * 10 + 1) * 10) / 10,
        overlap: Math.round(Math.random() * 40 + 60),
        shapeId: shape.id // Track which shape found this zip
      }));

      // Append or replace results
      if (appendResults) {
        // Merge with existing results, avoiding duplicates
        const existingZipCodes = new Set(zipResults.map(z => z.zipCode));
        const newZips = transformedZips.filter(z => !existingZipCodes.has(z.zipCode));
        setZipResults(prev => [...prev, ...newZips]);
        setTotalResults(prev => prev + newZips.length);
      } else {
        setZipResults(transformedZips);
        setTotalResults(searchResult.total);
      }

      setHasMoreResults(searchResult.hasMore);

      // Update aggregated results based on all current zips
      updateAggregatedResults(appendResults ? [...zipResults, ...transformedZips] : transformedZips);

    } catch (error) {
      console.error('Shape search failed:', error);
      setApiError(error.message);
      if (!appendResults) {
        setZipResults([]);
        setCityResults([]);
        setCountyResults([]);
        setStateResults([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateAggregatedResults = (allZips) => {
    // Group results for aggregates
    const uniqueCities = [...new Set(allZips.map(zip =>
      `${zip.city}|${zip.state}|${zip.county}`
    ))].map((cityKey, index) => {
      const [city, state, county] = cityKey.split('|');
      const cityZips = allZips.filter(z => z.city === city && z.state === state);
      const avgLat = cityZips.reduce((sum, z) => sum + z.lat, 0) / cityZips.length;
      const avgLng = cityZips.reduce((sum, z) => sum + z.lng, 0) / cityZips.length;
      return {
        id: index + 1,
        name: city,
        state,
        county,
        lat: avgLat,
        lng: avgLng,
        latitude: avgLat,  // Include both formats
        longitude: avgLng  // Include both formats
      };
    });

    const uniqueCounties = [...new Set(allZips.map(zip =>
      `${zip.county}|${zip.state}`
    ))].map((countyKey, index) => {
      const [county, state] = countyKey.split('|');
      const countyZips = allZips.filter(z => z.county === county && z.state === state);
      const avgLat = countyZips.reduce((sum, z) => sum + z.lat, 0) / countyZips.length;
      const avgLng = countyZips.reduce((sum, z) => sum + z.lng, 0) / countyZips.length;
      return {
        id: index + 1,
        name: county,
        state,
        lat: avgLat,
        lng: avgLng,
        latitude: avgLat,  // Include both formats
        longitude: avgLng  // Include both formats
      };
    });

    const uniqueStates = [...new Set(allZips.map(zip => zip.state))].map((state, index) => {
      const stateZips = allZips.filter(z => z.state === state);
      const avgLat = stateZips.reduce((sum, z) => sum + z.lat, 0) / stateZips.length;
      const avgLng = stateZips.reduce((sum, z) => sum + z.lng, 0) / stateZips.length;
      const stateInfo = availableStates.find(s => s.code === state);
      return {
        id: index + 1,
        name: stateInfo ? stateInfo.name : state,
        state: state,
        lat: avgLat,
        lng: avgLng,
        latitude: avgLat,  // Include both formats
        longitude: avgLng  // Include both formats
      };
    });

    setCityResults(uniqueCities);
    setCountyResults(uniqueCounties);
    setStateResults(uniqueStates);
  };

  // Handle map click for radius placement
  const handleMapClick = async (e) => {
    if (searchMode === 'radius' && isSearchMode) {
      const { lat, lng } = e.latlng;
      setRadiusCenter([lat, lng]);

      // Automatically perform search at clicked location
      setIsLoading(true);
      setSearchPerformed(true);
      setApiError(null);
      setCurrentPage(0);
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

        // Transform and set results (same logic as handleSearch)
        const transformedZips = searchResult.results.map((zip, index) => ({
          id: index + 1,
          zipCode: zip.zipcode,
          city: zip.city,
          county: zip.county,
          state: zip.stateCode,
          lat: zip.latitude,
          lng: zip.longitude,
          latitude: zip.latitude,  // Include both formats
          longitude: zip.longitude, // Include both formats
          area: Math.round((Math.random() * 10 + 1) * 10) / 10,
          overlap: Math.round(Math.random() * 40 + 60)
        }));

        setZipResults(transformedZips);
        setTotalResults(searchResult.total);
        setHasMoreResults(searchResult.hasMore);

        // Group results into cities, counties, and states
        const uniqueCities = [...new Set(transformedZips.map(zip =>
          `${zip.city}|${zip.state}|${zip.county}`
        ))].map((cityKey, index) => {
          const [city, state, county] = cityKey.split('|');
          const cityZips = transformedZips.filter(z => z.city === city && z.state === state);
          const avgLat = cityZips.reduce((sum, z) => sum + z.lat, 0) / cityZips.length;
          const avgLng = cityZips.reduce((sum, z) => sum + z.lng, 0) / cityZips.length;
          return {
            id: index + 1,
            name: city,
            state,
            county,
            lat: avgLat,
            lng: avgLng,
            latitude: avgLat,  // Include both formats
            longitude: avgLng  // Include both formats
          };
        });

        const uniqueCounties = [...new Set(transformedZips.map(zip =>
          `${zip.county}|${zip.state}`
        ))].map((countyKey, index) => {
          const [county, state] = countyKey.split('|');
          const countyZips = transformedZips.filter(z => z.county === county && z.state === state);
          const avgLat = countyZips.reduce((sum, z) => sum + z.lat, 0) / countyZips.length;
          const avgLng = countyZips.reduce((sum, z) => sum + z.lng, 0) / countyZips.length;
          return {
            id: index + 1,
            name: county,
            state,
            lat: avgLat,
            lng: avgLng,
            latitude: avgLat,  // Include both formats
            longitude: avgLng  // Include both formats
          };
        });

        const uniqueStates = [...new Set(transformedZips.map(zip => zip.state))].map((state, index) => {
          const stateZips = transformedZips.filter(z => z.state === state);
          const avgLat = stateZips.reduce((sum, z) => sum + z.lat, 0) / stateZips.length;
          const avgLng = stateZips.reduce((sum, z) => sum + z.lng, 0) / stateZips.length;
          const stateInfo = availableStates.find(s => s.code === state);
          return {
            id: index + 1,
            name: stateInfo ? stateInfo.name : state,
            state: state,
            lat: avgLat,
            lng: avgLng,
            latitude: avgLat,  // Include both formats
            longitude: avgLng  // Include both formats
          };
        });

        setCityResults(uniqueCities);
        setCountyResults(uniqueCounties);
        setStateResults(uniqueStates);

        // Center map on clicked location
        setMapCenter([lat, lng]);
        setMapZoom(11);

        // Don't auto-enable ZIP boundaries anymore - let user control it
        // if (transformedZips.length > 0) {
        //   console.log('Auto-enabling ZIP boundaries for map click radius search');
        //   setShowZipBoundaries(true);
        // }

      } catch (error) {
        console.error('Search failed:', error);
        setApiError(error.message);
        setZipResults([]);
        setCityResults([]);
        setCountyResults([]);
        setStateResults([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredZipResults = filterResults(zipResults, 'zip');
  const filteredCityResults = filterResults(cityResults, 'city');
  const filteredCountyResults = filterResults(countyResults, 'county');
  const filteredStateResults = filterResults(stateResults, 'state');

  // Handle drawer resize
  const handleMouseDown = (e) => {
    if (drawerState === 'half') {
      setIsResizing(true);
      setStartY(e.clientY);
      setStartHeight(drawerHeight);
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing && startY !== null) {
        requestAnimationFrame(() => {
          const deltaY = startY - e.clientY;
          const viewportHeight = window.innerHeight;
          const deltaPercent = (deltaY / viewportHeight) * 100;
          const newHeight = Math.min(90, Math.max(20, startHeight + deltaPercent));
          setDrawerHeight(Math.round(newHeight * 10) / 10); // Round to 1 decimal for smoother updates
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setStartY(null);
      setStartHeight(null);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, startY, startHeight, drawerHeight]);

  const getDrawerHeight = () => {
    switch (drawerState) {
      case 'full':
        return 'calc(100% - 2rem)'; // Full height minus a small gap
      case 'half':
        return `${drawerHeight}%`;
      case 'collapsed':
        return '48px'; // Fixed height for collapsed
      default:
        return '50%';
    }
  };

  const cycleDrawerState = () => {
    if (drawerState === 'collapsed') {
      setDrawerState('half');
      setDrawerHeight(50);
    } else if (drawerState === 'half') {
      setDrawerState('full');
    } else {
      setDrawerState('collapsed');
    }
  };

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b px-6 py-4 z-20`}>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Globe className="h-8 w-8 text-red-600" />
            <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>GeoSearch Pro</h1>
          </div>

          {/* Search Mode Toggle - Absolutely Centered in Header */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className={`flex ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg p-1`}>
              <button
                onClick={() => handleSearchModeChange('radius')}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  searchMode === 'radius'
                    ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
                    : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
                }`}
              >
                Radius Search
              </button>
              <button
                onClick={() => handleSearchModeChange('polygon')}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  searchMode === 'polygon'
                    ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
                    : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
                }`}
              >
                Polygon Search
              </button>
              <button
                onClick={() => handleSearchModeChange('hierarchy')}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  searchMode === 'hierarchy'
                    ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
                    : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
                }`}
              >
                Hierarchy Search
              </button>
              <button
                onClick={() => handleSearchModeChange('upload')}
                className={`px-4 py-2 text-sm rounded transition-colors ${
                  searchMode === 'upload'
                    ? `${isDarkMode ? 'bg-gray-600 text-white' : 'bg-white text-gray-900'} shadow-sm`
                    : `${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`
                }`}
              >
                Upload Search
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Dark Mode Toggle */}
            <div className={`flex items-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full p-1`}>
              <button
                onClick={() => setIsDarkMode(false)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-colors ${
                  !isDarkMode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <Sun className="h-3 w-3" />
                <span>Light</span>
              </button>
              <button
                onClick={() => setIsDarkMode(true)}
                className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-colors ${
                  isDarkMode
                    ? 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-700'
                }`}
              >
                <Moon className="h-3 w-3" />
                <span>Dark</span>
              </button>
            </div>
            <button className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>Help</button>
            <div className="h-8 w-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              U
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Floating Search Container - positioned relative to map container */}
          <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} rounded-lg shadow-lg border p-4`}>
          <div className="flex items-center space-x-4">
            {searchMode === 'radius' ? (
              // Radius Search Controls
              <>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    placeholder="Search addresses, cities, ZIP codes..."
                    value={searchTerm}
                    onChange={handleSearchInputChange}
                    onBlur={handleAutocompleteBlur}
                    onFocus={() => searchTerm.length >= 2 && autocompleteResults.length > 0 && setShowAutocomplete(true)}
                    disabled={searchMode === 'radius' && !isSearchMode}
                    className={`w-[380px] pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                      searchMode === 'radius' && !isSearchMode
                        ? 'bg-gray-100 text-gray-500 border-gray-300'
                        : isDarkMode
                          ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400'
                          : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && (searchMode !== 'radius' || isSearchMode) && handleSearch()}
                  />

                  {/* Loading indicator */}
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    </div>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showAutocomplete && autocompleteResults.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg shadow-lg border z-50 ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-white border-gray-200'
                    }`}>
                      {autocompleteResults.map((result) => (
                        <div
                          key={result.id}
                          className={`px-4 py-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                            isDarkMode
                              ? 'hover:bg-gray-600 border-gray-600 text-white'
                              : 'hover:bg-gray-50 border-gray-100 text-gray-900'
                          }`}
                          onClick={() => handleLocationSelect(result)}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">
                              {result.raw && result.raw.place_name
                                ? mapboxGeocodingService.getResultIcon(result.type)
                                : geocodingService.getResultIcon(result.type)
                              }
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {result.raw && result.raw.place_name
                                  ? mapboxGeocodingService.formatDisplayName(result)
                                  : geocodingService.formatDisplayName(result)
                                }
                              </p>
                              <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Radius:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    disabled={!isSearchMode}
                    className={`w-16 p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
                      !isSearchMode
                        ? 'bg-gray-100 text-gray-500 border-gray-300'
                        : isDarkMode
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-white text-gray-900 border-gray-300'
                    }`}
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>miles</span>
                  {isSearchMode && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      isDarkMode
                        ? 'text-red-400 bg-red-900/20'
                        : 'text-red-600 bg-red-50'
                    }`}>
                      Click on map to place radius
                    </span>
                  )}
                </div>
              </>
            ) : searchMode === 'polygon' ? (
              // Polygon Search Controls
              <div className="flex items-center space-x-4">
                <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Draw shapes on the map to search within them
                </div>
                {drawnShapes.length > 0 && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    isDarkMode
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {drawnShapes.length} shape{drawnShapes.length > 1 ? 's' : ''} drawn
                  </span>
                )}
              </div>
            ) : searchMode === 'hierarchy' ? (
              // Hierarchy Search Controls
              <>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedCounty(''); // Reset county and city when state changes
                    setSelectedCity('');
                  }}
                  disabled={false}
                  className={`p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
                    isDarkMode
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-white text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">Select State</option>
                  {availableStates.map(state => (
                    <option key={state.code} value={state.code}>{state.name} ({state.code})</option>
                  ))}
                </select>

                <select
                  value={selectedCounty}
                  onChange={(e) => {
                    setSelectedCounty(e.target.value);
                    setSelectedCity(''); // Reset city when county changes
                  }}
                  disabled={!selectedState}
                  className={`w-40 p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
                    !selectedState
                      ? isDarkMode
                        ? 'bg-gray-800 text-gray-500 border-gray-700'
                        : 'bg-gray-100 text-gray-500 border-gray-300'
                      : isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">Select County</option>
                  {availableCounties.map(county => (
                    <option key={county.name} value={county.name}>{county.name}</option>
                  ))}
                </select>

                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={!selectedState}
                  className={`w-40 p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
                    !selectedState
                      ? isDarkMode
                        ? 'bg-gray-800 text-gray-500 border-gray-700'
                        : 'bg-gray-100 text-gray-500 border-gray-300'
                      : isDarkMode
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white text-gray-900 border-gray-300'
                  }`}
                >
                  <option value="">Select City</option>
                  {availableCities.map(city => (
                    <option key={city.name} value={city.name}>{city.name}</option>
                  ))}
                </select>
              </>
            ) : searchMode === 'upload' ? (
              // Upload Search Controls
              <>
                <CSVUploadInterface
                  onFileUpload={handleCSVUpload}
                  onRemoveFile={handleRemoveFile}
                  uploadedFile={uploadedFile}
                  isLoading={uploadProcessing}
                  error={uploadError}
                  isDarkMode={isDarkMode}
                />
                {/* Progress Indicator */}
                {processingProgress.total > 0 && uploadProcessing && (
                  <div className={`px-2 pb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        Processing locations...
                      </span>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {processingProgress.current} / {processingProgress.total}
                      </span>
                    </div>
                    <div className={`w-full h-1.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div
                        className="h-1.5 bg-red-600 rounded transition-all duration-300"
                        style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {searchMode === 'radius' && (
              <button
                onClick={isSearchMode ? handleSearch : handleReset}
                disabled={isLoading}
                className={`py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors ${
                  isSearchMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : isDarkMode
                      ? 'bg-gray-600 text-white hover:bg-gray-500'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : isSearchMode ? (
                  <Search className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span>{isLoading ? 'Searching...' : isSearchMode ? 'Search' : 'Reset'}</span>
              </button>
            )}
            {searchMode === 'polygon' && (
              <button
                onClick={handleReset}
                disabled={isLoading || drawnShapes.length === 0}
                className={`py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors ${
                  drawnShapes.length === 0
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}
            {searchMode === 'hierarchy' && (
              <button
                onClick={handleReset}
                disabled={isLoading || !selectedState}
                className={`py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors ${
                  !selectedState
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

          {/* Map Area */}
          <div
            className="relative"
            style={{
              transition: isResizing ? 'none' : 'height 300ms ease-in-out',
              height: searchPerformed && (filteredZipResults.length > 0 || filteredCityResults.length > 0 || filteredCountyResults.length > 0 || filteredStateResults.length > 0)
                ? drawerState === 'collapsed' ? 'calc(100% - 48px)' : drawerState === 'full' ? '2rem' : `${100 - drawerHeight}%`
                : '100%'
            }}
          >
            {/* Map Type Controls - Moved to Right */}
            <div className={`absolute top-4 right-4 z-[1000] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} rounded-lg shadow-lg border p-2`}>
              <div className="space-y-1">
                {[
                  { type: 'street', label: 'Street', icon: MapIcon },
                  { type: 'satellite', label: 'Satellite', icon: Globe },
                  { type: 'terrain', label: 'Terrain', icon: Layers }
                ].map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => setMapType(type)}
                    className={`w-full p-2 text-left rounded flex items-center space-x-2 transition-colors ${
                      mapType === type
                        ? 'bg-red-600 text-white'
                        : isDarkMode
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Removed duplicate drawing tools tooltip - info is in floating search bar */}

            {/* Leaflet Map */}
            <MapContainer
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
                <FeatureGroup ref={featureGroupRef}>
                  <EditControl
                    position="topleft"
                    onCreated={onCreated}
                    onDeleted={onDeleted}
                    draw={{
                      rectangle: {
                        shapeOptions: {
                          color: '#dc2626',
                          fillOpacity: 0.1
                        }
                      },
                      polygon: {
                        allowIntersection: false,
                        shapeOptions: {
                          color: '#dc2626',
                          fillOpacity: 0.1
                        }
                      },
                      circle: {
                        shapeOptions: {
                          color: '#dc2626',
                          fillOpacity: 0.1
                        }
                      },
                      marker: false,
                      circlemarker: false,
                      polyline: false
                    }}
                    edit={{
                      featureGroup: undefined,
                      edit: {
                        selectedPathOptions: {
                          color: '#fe57a1',
                          opacity: 0.6,
                          dashArray: '10, 10',
                          fill: true,
                          fillColor: '#fe57a1',
                          fillOpacity: 0.1
                        }
                      },
                      remove: {
                        selectedPathOptions: {
                          color: '#fe57a1',
                          opacity: 0.6,
                          dashArray: '10, 10',
                          fill: true,
                          fillColor: '#fe57a1',
                          fillOpacity: 0.1
                        }
                      }
                    }}
                  />
                </FeatureGroup>
              )}

              {/* Add markers for ZIP results */}
              {filteredZipResults
                .filter(result => (result.lat != null && result.lng != null) || (result.latitude != null && result.longitude != null))
                .map((result) => (
                <Marker
                  key={result.id}
                  position={[result.lat || result.latitude, result.lng || result.longitude]}
                  ref={(ref) => {
                    if (ref) {
                      markersRef.current[`zip-${result.id}`] = ref;
                    }
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedResult({ type: 'zip', id: result.id });
                      // Auto-switch to zips tab if not already selected
                      if (activeTab !== 'zips') {
                        setActiveTab('zips');
                      }
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <strong>{result.zipCode}</strong><br/>
                      {result.city}, {result.state}<br/>
                      {result.county}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Target marker for selected location */}
              {searchMode === 'radius' && selectedLocation && (
                <Marker
                  position={[selectedLocation.lat, selectedLocation.lng]}
                  icon={L.divIcon({
                    html: `
                      <div style="
                        width: 20px;
                        height: 20px;
                        background: #dc2626;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        position: relative;
                      ">
                        <div style="
                          position: absolute;
                          top: 50%;
                          left: 50%;
                          transform: translate(-50%, -50%);
                          width: 2px;
                          height: 2px;
                          background: white;
                          border-radius: 50%;
                        "></div>
                      </div>
                    `,
                    className: 'target-marker',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                  })}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-semibold text-gray-900">📍 Search Center</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {geocodingService.formatDisplayName(selectedLocation)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {radius} mile radius from this location
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Add circles for radius search */}
              {searchMode === 'radius' && radiusCenter && (
                <Circle
                  center={radiusCenter}
                  radius={radius * 1609.34} // Convert miles to meters
                  pathOptions={{ color: '#dc2626', fillOpacity: 0.1, weight: 2 }}
                />
              )}

              {/* County Boundaries Layer */}
              {showCountyBorders && countyBoundaries && (
                <GeoJSON
                  key={`county-boundaries-${selectedCountyBoundary?.name}`}
                  data={countyBoundaries}
                  style={(feature) => {
                    const isSelected = selectedCountyBoundary &&
                      feature.properties?.NAME === selectedCountyBoundary.name;

                    return {
                      color: isSelected ? '#dc2626' : '#ff7800',
                      weight: isSelected ? 3 : 2,
                      opacity: isSelected ? 1 : 0.8,
                      fillOpacity: isSelected ? 0.15 : 0.1,
                      fillColor: isSelected ? '#dc2626' : '#ff7800'
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    if (feature.properties && feature.properties.NAME) {
                      const countyName = feature.properties.NAME;
                      const stateName = feature.properties.STATE;

                      // Check if this county has ZIPs in results
                      const countyZips = zipResults.filter(z => z.county === countyName);
                      const hasResults = countyZips.length > 0;

                      layer.bindPopup(`
                        <strong>${countyName} County</strong><br/>
                        State: ${stateName}<br/>
                        ${hasResults ? `ZIPs in results: ${countyZips.length}` : 'No ZIPs in search results'}
                      `);

                      // Click handler to select county
                      layer.on('click', () => {
                        setSelectedCountyBoundary({ name: countyName, state: stateName });
                        // Load ZIP boundaries for this county
                        if (hasResults) {
                          const countyZipCodes = countyZips.map(z => z.zipCode);
                          loadBoundariesForSearchResults(countyZipCodes);
                        }
                      });
                    }
                  }}
                />
              )}

              {/* ZIP Boundaries Layer */}
              {showZipBoundaries && zipBoundariesData && (
                <GeoJSON
                  key={`zip-boundaries-${zipBoundariesData.features.length}-${focusedZipCode}`} // Re-render when features count or focus changes
                  data={zipBoundariesData}
                  style={(feature) => {
                    const zipCode = feature.properties?.zipcode;
                    const isInResults = feature.properties?.inSearchResults;
                    const isFocused = zipCode === focusedZipCode;
                    const isAdditional = feature.properties?.isAdditional;

                    // Different styles based on status
                    if (isFocused) {
                      return {
                        color: '#ff0000',
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.2,
                        fillColor: '#dc2626'
                      };
                    } else if (isInResults) {
                      return {
                        color: '#dc2626',
                        weight: 1.5,
                        opacity: 0.8,
                        fillOpacity: 0.1,
                        fillColor: '#dc2626'
                      };
                    } else if (isAdditional) {
                      return {
                        color: '#6b7280', // Gray for additional/clickable
                        weight: 1,
                        opacity: 0.6,
                        fillOpacity: 0.05,
                        fillColor: '#6b7280',
                        dashArray: '3, 3' // Dashed border
                      };
                    } else {
                      return {
                        color: '#9ca3af',
                        weight: 1,
                        opacity: 0.5,
                        fillOpacity: 0.02
                      };
                    }
                  }}
                  onEachFeature={(feature, layer) => {
                    const zipCode = feature.properties?.zipcode;
                    const isInResults = feature.properties?.inSearchResults;

                    if (zipCode) {
                      // Create popup content with add button if not in results
                      const popupContent = document.createElement('div');
                      popupContent.innerHTML = `
                        <div style="min-width: 150px;">
                          <strong>ZIP: ${zipCode}</strong><br/>
                          ${!isInResults ? `
                            <button
                              id="add-zip-${zipCode}"
                              style="margin-top: 8px; padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;"
                            >
                              Add to Results
                            </button>
                          ` : '<span style="color: green;">✓ In Results</span>'}
                        </div>
                      `;

                      layer.bindPopup(popupContent);

                      // Add click handler for the add button
                      layer.on('popupopen', () => {
                        const addButton = document.getElementById(`add-zip-${zipCode}`);
                        if (addButton) {
                          addButton.addEventListener('click', () => {
                            // Add ZIP to results
                            const newZip = {
                              id: zipResults.length + 1,
                              zipCode: zipCode,
                              city: feature.properties.city || 'Unknown',
                              county: feature.properties.county || 'Unknown',
                              state: feature.properties.state_fips || 'Unknown',
                              lat: feature.properties.lat || 0,
                              lng: feature.properties.lng || 0,
                              latitude: feature.properties.lat || 0,
                              longitude: feature.properties.lng || 0,
                              area: 0,
                              overlap: 0,
                              addedManually: true
                            };
                            setZipResults(prev => [...prev, newZip]);
                            layer.closePopup();
                            // Reload boundaries to update styling
                            loadBoundariesForSearchResults();
                          });
                        }
                      });

                      // Add hover effect
                      layer.on({
                        mouseover: (e) => {
                          if (zipCode !== focusedZipCode) {
                            e.target.setStyle({
                              weight: isInResults ? 2.5 : 2,
                              fillOpacity: isInResults ? 0.2 : 0.1
                            });
                          }
                        },
                        mouseout: (e) => {
                          if (zipCode !== focusedZipCode) {
                            e.target.setStyle({
                              weight: isInResults ? 1.5 : 1,
                              fillOpacity: isInResults ? 0.1 : 0.05
                            });
                          }
                        }
                      });
                    }
                  }}
                />
              )}

            </MapContainer>

          </div>

          {/* Results Drawer */}
          {searchPerformed && (filteredZipResults.length > 0 || filteredCityResults.length > 0 || filteredCountyResults.length > 0 || filteredStateResults.length > 0) && (
            <div
              className={`absolute bottom-0 left-0 right-0 ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} border-t shadow-lg flex flex-col`}
              style={{
                height: getDrawerHeight(),
                zIndex: drawerState === 'full' ? 1001 : 1000,
                transition: isResizing ? 'none' : 'height 300ms ease-in-out'
              }}
            >
              {/* Drawer Header with Resize Handle */}
              <div
                className={`flex items-center justify-between px-4 py-2 border-b ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'} ${
                  drawerState === 'half' ? isDarkMode ? 'cursor-ns-resize hover:bg-gray-600' : 'cursor-ns-resize hover:bg-gray-100' : ''
                }`}
                onMouseDown={handleMouseDown}
                style={{ userSelect: isResizing ? 'none' : 'auto' }}
              >
                <div className="flex items-center space-x-4">
                  {/* Drawer State Controls */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={cycleDrawerState}
                      className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                      title={drawerState === 'collapsed' ? 'Expand to Half' : drawerState === 'half' ? 'Expand to Full' : 'Collapse'}
                    >
                      {drawerState === 'collapsed' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : drawerState === 'half' ? (
                        <Maximize2 className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                    </button>
                    <div className={`text-xs px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {drawerState === 'full' ? 'Full' : drawerState === 'half' ? `Half (${Math.round(drawerHeight)}%)` : 'Min'}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex space-x-1">
                    {[
                      { key: 'zips', label: `ZIPs (${filteredZipResults.length})` },
                      { key: 'cities', label: `Cities (${filteredCityResults.length})` },
                      { key: 'counties', label: `Counties (${filteredCountyResults.length})` },
                      { key: 'states', label: `States (${filteredStateResults.length})` },
                      ...(getTotalExcludedCount() > 0 ? [{ key: 'excluded', label: `Excluded (${getTotalExcludedCount()})` }] : [])
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-1 text-sm rounded transition-colors ${
                          activeTab === tab.key
                            ? 'bg-red-600 text-white'
                            : isDarkMode
                              ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                              : 'bg-white hover:bg-gray-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Bar for Drawer */}
                  {drawerState !== 'collapsed' && (
                    <div
                      className="relative z-50"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 z-50 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                      <input
                        type="text"
                        placeholder="Search"
                        value={drawerSearchTerm}
                        onChange={(e) => {
                          console.log('Drawer search input changed:', e.target.value);
                          setDrawerSearchTerm(e.target.value);
                        }}
                        onFocus={() => console.log('Drawer search input focused')}
                        onBlur={() => console.log('Drawer search input blurred')}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-48 pl-7 pr-3 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-red-500 relative z-50 ${
                          isDarkMode
                            ? 'bg-gray-600 text-white border-gray-500 placeholder-gray-400'
                            : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500'
                        }`}
                        style={{ position: 'relative', zIndex: 9999 }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions and Boundary Controls */}
                <div className="flex items-center space-x-4">
                  {/* Boundary Toggle Controls */}
                  <div className={`flex items-center space-x-4 border-r pr-4 ${isDarkMode ? 'border-gray-500' : 'border-gray-300'}`}>
                    <label className="flex items-center space-x-1 text-xs">
                      <input
                        type="checkbox"
                        checked={showCountyBorders}
                        onChange={(e) => setShowCountyBorders(e.target.checked)}
                        className="rounded"
                      />
                      <span>County Borders</span>
                    </label>
                    <label className="flex items-center space-x-1 text-xs">
                      <input
                        type="checkbox"
                        checked={showZipBoundaries}
                        onChange={(e) => {
                          setShowZipBoundaries(e.target.checked);
                          // Clear cached boundaries when toggled off
                          if (!e.target.checked) {
                            setZipBoundariesData(null);
                          }
                        }}
                        className="rounded"
                        disabled={loadingZipBoundaries}
                      />
                      <span className="flex items-center space-x-1">
                        ZIP Boundaries
                        {loadingZipBoundaries && (
                          <span className="inline-block animate-spin">⟳</span>
                        )}
                        {zipBoundariesData && zipBoundariesData.features && (
                          <span className="text-[10px] opacity-70">
                            ({zipBoundariesData.features.length})
                          </span>
                        )}
                        {(() => {
                          const stats = zipBoundariesService.getCacheStats();
                          if (stats.available && stats.totalZips > 0) {
                            return (
                              <span className="text-[10px] opacity-50" title={`Cache: ${stats.sizeKB}KB, ${stats.viewports} viewports, expires ${stats.expires.toLocaleDateString()}`}>
                                [💾 {stats.totalZips}]
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </span>
                    </label>
                    {showZipBoundaries && zipBoundariesData && zipBoundariesData.features && zipBoundariesData.features.length > 0 && (
                      <button
                        onClick={() => {
                          setZipBoundariesData(null);
                          zipBoundariesService.clearPersistentCache();
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                        title="Clear all cached ZIP boundaries (memory + localStorage)"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(getCurrentData())}
                      className={`p-1 rounded transition-all duration-200 ${
                        copySuccess
                          ? 'bg-green-100 text-green-600'
                          : isDarkMode
                            ? 'hover:bg-gray-600'
                            : 'hover:bg-gray-200'
                      }`}
                      title={copySuccess ? "Copied!" : "Copy to clipboard"}
                    >
                      {copySuccess ? (
                        <Check className="h-4 w-4 animate-pulse" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      onClick={() => exportSimpleCsv(getCurrentData())}
                      className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                      title={`Export ${activeTab} (minimal)`}
                    >
                      <FileDown className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setShowCustomExport(true)}
                      className={`p-1 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}`}
                      title="Custom export options"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Content with Scrollbar */}
              {drawerState !== 'collapsed' && (
                <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100% - 48px)' }}>
                  {activeTab === 'zips' && (
                    <table className="w-full text-sm">
                      <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th className="px-2 py-2 w-8"></th>
                          {[
                            { key: 'zipCode', label: 'ZIP Code' },
                            { key: 'city', label: 'City' },
                            { key: 'county', label: 'County' },
                            { key: 'state', label: 'State' },
                            { key: 'lat', label: 'Latitude' },
                            { key: 'lng', label: 'Longitude' },
                            { key: 'area', label: 'Area (sq mi)' },
                            { key: 'overlap', label: 'Overlap %' }
                          ].map(col => (
                            <th
                              key={col.key}
                              className={`px-4 py-2 text-left font-medium cursor-pointer transition-colors ${
                                isDarkMode
                                  ? 'text-gray-300 hover:bg-gray-600'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => handleSort(col.key)}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{col.label}</span>
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentData().map(result => (
                          <tr
                            key={result.id}
                            data-result-id={`zip-${result.id}`}
                            onClick={() => handleResultSelect('zip', result)}
                            onDoubleClick={() => handleResultDoubleClick('zip', result)}
                            className={`transition-colors cursor-pointer ${
                              isResultSelected('zip', result.id)
                                ? isDarkMode
                                  ? 'bg-red-800/40 border-y border-red-400'
                                  : 'bg-red-100 border-y border-red-300'
                                : isDarkMode
                                  ? 'border-b border-gray-600 hover:bg-gray-700'
                                  : 'border-b border-gray-100 hover:bg-gray-50'
                            }`}>
                            <td className="px-2 py-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click when removing
                                  removeItem('zip', result);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove ZIP"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                            <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{result.zipCode}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.city}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.county}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.state}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.latitude ? result.latitude.toFixed(4) : 'N/A'}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.longitude ? result.longitude.toFixed(4) : 'N/A'}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.area}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.overlap}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'cities' && (
                    <table className="w-full text-sm">
                      <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th className="px-2 py-2 w-8"></th>
                          {[
                            { key: 'name', label: 'City Name' },
                            { key: 'state', label: 'State' },
                            { key: 'county', label: 'County' },
                            { key: 'lat', label: 'Latitude' },
                            { key: 'lng', label: 'Longitude' }
                          ].map(col => (
                            <th
                              key={col.key}
                              className={`px-4 py-2 text-left font-medium cursor-pointer transition-colors ${
                                isDarkMode
                                  ? 'text-gray-300 hover:bg-gray-600'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => handleSort(col.key)}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{col.label}</span>
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentData().map(result => (
                          <tr
                            key={result.id}
                            data-result-id={`city-${result.id}`}
                            onClick={() => handleResultSelect('city', result)}
                            onDoubleClick={() => handleResultDoubleClick('city', result)}
                            className={`transition-colors cursor-pointer ${
                              isResultSelected('city', result.id)
                                ? isDarkMode
                                  ? 'bg-red-800/40 border-y border-red-400'
                                  : 'bg-red-100 border-y border-red-300'
                                : isDarkMode
                                  ? 'border-b border-gray-600 hover:bg-gray-700'
                                  : 'border-b border-gray-100 hover:bg-gray-50'
                            }`}>
                            <td className="px-2 py-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click when removing
                                  removeItem('city', result);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove City (and all ZIPs in city)"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                            <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{result.name}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.state}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.county || ''}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.latitude ? result.latitude.toFixed(4) : 'N/A'}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.longitude ? result.longitude.toFixed(4) : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'counties' && (
                    <table className="w-full text-sm">
                      <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th className="px-2 py-2 w-8"></th>
                          {[
                            { key: 'name', label: 'County Name' },
                            { key: 'state', label: 'State' },
                            { key: 'lat', label: 'Latitude' },
                            { key: 'lng', label: 'Longitude' }
                          ].map(col => (
                            <th
                              key={col.key}
                              className={`px-4 py-2 text-left font-medium cursor-pointer transition-colors ${
                                isDarkMode
                                  ? 'text-gray-300 hover:bg-gray-600'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => handleSort(col.key)}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{col.label}</span>
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentData().map(result => (
                          <tr
                            key={result.id}
                            data-result-id={`county-${result.id}`}
                            onClick={() => handleResultSelect('county', result)}
                            onDoubleClick={() => handleResultDoubleClick('county', result)}
                            className={`transition-colors cursor-pointer ${
                              isResultSelected('county', result.id)
                                ? isDarkMode
                                  ? 'bg-red-800/40 border-y border-red-400'
                                  : 'bg-red-100 border-y border-red-300'
                                : isDarkMode
                                  ? 'border-b border-gray-600 hover:bg-gray-700'
                                  : 'border-b border-gray-100 hover:bg-gray-50'
                            }`}>
                            <td className="px-2 py-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click when removing
                                  removeItem('county', result);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove County (and all cities/ZIPs in county)"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                            <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{result.name}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.state}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.latitude ? result.latitude.toFixed(4) : 'N/A'}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.longitude ? result.longitude.toFixed(4) : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'states' && (
                    <table className="w-full text-sm">
                      <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th className="px-2 py-2 w-8"></th>
                          {[
                            { key: 'name', label: 'State Name' },
                            { key: 'state', label: 'State Code' },
                            { key: 'lat', label: 'Latitude' },
                            { key: 'lng', label: 'Longitude' }
                          ].map(col => (
                            <th
                              key={col.key}
                              className={`px-4 py-2 text-left font-medium cursor-pointer transition-colors ${
                                isDarkMode
                                  ? 'text-gray-300 hover:bg-gray-600'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={() => handleSort(col.key)}
                            >
                              <div className="flex items-center space-x-1">
                                <span>{col.label}</span>
                                <ArrowUpDown className="h-3 w-3" />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentData().map(result => (
                          <tr
                            key={result.id}
                            data-result-id={`state-${result.id}`}
                            onClick={() => handleResultSelect('state', result)}
                            onDoubleClick={() => handleResultDoubleClick('state', result)}
                            className={`transition-colors cursor-pointer ${
                              isResultSelected('state', result.id)
                                ? isDarkMode
                                  ? 'bg-red-800/40 border-y border-red-400'
                                  : 'bg-red-100 border-y border-red-300'
                                : isDarkMode
                                  ? 'border-b border-gray-600 hover:bg-gray-700'
                                  : 'border-b border-gray-100 hover:bg-gray-50'
                            }`}>
                            <td className="px-2 py-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click when removing
                                  removeItem('state', result);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove State (and all counties/cities/ZIPs in state)"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </td>
                            <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{result.name}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.state}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.latitude ? result.latitude.toFixed(4) : 'N/A'}</td>
                            <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{result.longitude ? result.longitude.toFixed(4) : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'excluded' && (
                    <div className="flex flex-col h-full">
                      {/* Actions and Sub-tabs Header with Background */}
                      <div className={`flex items-center px-4 py-2 ${
                        isDarkMode ? 'bg-gray-750' : 'bg-gray-50'
                      }`}>
                        {/* Copy and CSV Export Buttons */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={copyExcludedItems}
                            className={`px-3 py-1 text-sm rounded flex items-center space-x-1.5 transition-colors ${
                              isDarkMode
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </button>
                          <button
                            onClick={exportExcludedAsCSV}
                            className={`px-3 py-1 text-sm rounded flex items-center space-x-1.5 transition-colors ${
                              isDarkMode
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            <span>CSV</span>
                          </button>
                        </div>

                        {/* Divider */}
                        <div className={`mx-3 h-5 w-px ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>

                        {/* Sub-tabs */}
                        <div className="flex space-x-1">
                          {[
                            ...(excludedGeos.zips.length > 0 ? [{ key: 'zips', label: `ZIPs (${excludedGeos.zips.length})` }] : []),
                            ...(excludedGeos.cities.length > 0 ? [{ key: 'cities', label: `Cities (${excludedGeos.cities.length})` }] : []),
                            ...(excludedGeos.counties.length > 0 ? [{ key: 'counties', label: `Counties (${excludedGeos.counties.length})` }] : []),
                            ...(excludedGeos.states.length > 0 ? [{ key: 'states', label: `States (${excludedGeos.states.length})` }] : [])
                          ].map(subTab => (
                            <button
                              key={subTab.key}
                              onClick={() => setExcludedSubTab(subTab.key)}
                              className={`px-3 py-1 text-sm rounded transition-colors ${
                                excludedSubTab === subTab.key
                                  ? 'bg-red-600 text-white'
                                  : isDarkMode
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                                    : 'bg-white hover:bg-gray-100 border border-gray-200'
                              }`}
                            >
                              {subTab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Table Content Container */}
                      <div className="flex-1 overflow-y-auto mt-1">

                      {/* Excluded Sub-tab Content */}
                      {excludedSubTab === 'zips' && excludedGeos.zips.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <tr>
                              <th className="px-2 py-2 w-8"></th>
                              {[
                                { key: 'zipCode', label: 'ZIP Code' },
                                { key: 'city', label: 'City' },
                                { key: 'county', label: 'County' },
                                { key: 'state', label: 'State' }
                              ].map(col => (
                                <th
                                  key={col.key}
                                  className={`px-4 py-2 text-left font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}
                                >
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excludedGeos.zips.map((zip, index) => (
                              <tr
                                key={`excluded-zip-${index}`}
                                className={`transition-colors ${
                                  isDarkMode
                                    ? 'border-b border-gray-600 hover:bg-gray-700'
                                    : 'border-b border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => restoreItem('zip', zip)}
                                    className="text-green-500 hover:text-green-700 p-1"
                                    title="Restore ZIP"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </td>
                                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {zip.zipCode}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {zip.city}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {zip.county}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {zip.state}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {excludedSubTab === 'cities' && excludedGeos.cities.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <tr>
                              <th className="px-2 py-2 w-8"></th>
                              {[
                                { key: 'name', label: 'City Name' },
                                { key: 'county', label: 'County' },
                                { key: 'state', label: 'State' }
                              ].map(col => (
                                <th
                                  key={col.key}
                                  className={`px-4 py-2 text-left font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}
                                >
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excludedGeos.cities.map((city, index) => (
                              <tr
                                key={`excluded-city-${index}`}
                                className={`transition-colors ${
                                  isDarkMode
                                    ? 'border-b border-gray-600 hover:bg-gray-700'
                                    : 'border-b border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => restoreItem('city', city)}
                                    className="text-green-500 hover:text-green-700 p-1"
                                    title="Restore City"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </td>
                                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {city.name}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {city.county || 'N/A'}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {city.state}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {excludedSubTab === 'counties' && excludedGeos.counties.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <tr>
                              <th className="px-2 py-2 w-8"></th>
                              {[
                                { key: 'name', label: 'County Name' },
                                { key: 'state', label: 'State' }
                              ].map(col => (
                                <th
                                  key={col.key}
                                  className={`px-4 py-2 text-left font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}
                                >
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excludedGeos.counties.map((county, index) => (
                              <tr
                                key={`excluded-county-${index}`}
                                className={`transition-colors ${
                                  isDarkMode
                                    ? 'border-b border-gray-600 hover:bg-gray-700'
                                    : 'border-b border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => restoreItem('county', county)}
                                    className="text-green-500 hover:text-green-700 p-1"
                                    title="Restore County"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </td>
                                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {county.name}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {county.state}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {excludedSubTab === 'states' && excludedGeos.states.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <tr>
                              <th className="px-2 py-2 w-8"></th>
                              {[
                                { key: 'name', label: 'State Name' },
                                { key: 'state', label: 'State Code' }
                              ].map(col => (
                                <th
                                  key={col.key}
                                  className={`px-4 py-2 text-left font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                  }`}
                                >
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {excludedGeos.states.map((state, index) => (
                              <tr
                                key={`excluded-state-${index}`}
                                className={`transition-colors ${
                                  isDarkMode
                                    ? 'border-b border-gray-600 hover:bg-gray-700'
                                    : 'border-b border-gray-100 hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => restoreItem('state', state)}
                                    className="text-green-500 hover:text-green-700 p-1"
                                    title="Restore State"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </td>
                                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {state.name || state.state}
                                </td>
                                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {state.state || state.name}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom Export Modal */}
          {showCustomExport && (
            <CustomExportModal
              isOpen={showCustomExport}
              onClose={() => setShowCustomExport(false)}
              data={getCurrentData()}
              activeTab={activeTab}
              isDarkMode={isDarkMode}
            />
          )}

          {/* Header Mapping Modal */}
          <HeaderMappingModal
            isOpen={showHeaderMappingModal}
            onClose={() => {
              setShowHeaderMappingModal(false);
              setUploadError(null);
            }}
            headers={csvHeaders}
            previewData={csvPreviewData}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            onConfirm={handleHeaderMappingConfirm}
            isDarkMode={isDarkMode}
            processingProgress={processingProgress}
          />
        </div>
      </div>
  );
};

// CSV Upload Interface Component
const CSVUploadInterface = ({ onFileUpload, onRemoveFile, uploadedFile, isLoading, error, isDarkMode }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    console.log('🔵 CSVUploadInterface handleFileSelect - file:', file?.name, 'type:', file?.type);
    // Check for CSV file by extension or MIME type
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
      console.log('🟢 Calling onFileUpload with CSV file');
      onFileUpload(file);
    } else {
      alert('Please select a CSV file. File type detected: ' + file?.type);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    console.log('🔵 CSVUploadInterface handleDrop - file:', file?.name, 'type:', file?.type);
    // Check for CSV file by extension or MIME type
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
      console.log('🟢 Calling onFileUpload with CSV file via drag-drop');
      onFileUpload(file);
    } else {
      alert('Please drop a CSV file. File type detected: ' + file?.type);
    }
  };

  return (
    <div className={`px-2 pt-1 pb-3 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      {/* Upload Area - Full Width */}
      <div className="w-full">
        <h3 className="text-base font-medium mb-2 flex items-center">
          <Upload className="w-4 h-4 mr-2" />
          Upload CSV File
        </h3>

        {uploadedFile ? (
          // Show uploaded file with remove button
          <div className={`border-2 rounded-lg p-3 ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Upload className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {uploadedFile.name}
                </span>
              </div>
              <button
                onClick={onRemoveFile}
                disabled={isLoading}
                className={`ml-2 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'
                }`}
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          // Show upload area
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDarkMode
                ? 'border-gray-600 hover:border-red-400 hover:bg-gray-700'
                : 'border-gray-300 hover:border-red-500 hover:bg-red-50'
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Processing CSV...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className={`w-8 h-8 mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <p className={`mb-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="font-medium">Click to upload</span> or drag and drop
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  CSV files only
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {error && (
          <div className={`mt-2 p-2 rounded-md ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-700'}`}>
            <p className="text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={`w-full border-t mt-3 pt-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
        {/* Notes/Tips - Below Upload */}
        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <span className="font-medium text-red-600">Supported:</span> ZIP Codes (12345, 12345-6789), Cities ("New York, NY"), Counties ("Cook County, IL") - Headers auto-detected
        </div>
      </div>
    </div>
  );
};

// Custom Export Modal Component
const CustomExportModal = ({ isOpen, onClose, data, activeTab, isDarkMode }) => {
  const [preset, setPreset] = useState('minimal');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [sortBy, setSortBy] = useState('');
  const [deduplicate, setDeduplicate] = useState(true);
  const [filename, setFilename] = useState('');
  const [alsoExportAll, setAlsoExportAll] = useState(false);

  // Define all available columns for each tab
  const schemaByTab = {
    zips: ['zipCode', 'city', 'county', 'state', 'lat', 'lng', 'area', 'overlap'],
    cities: ['name', 'state', 'county', 'lat', 'lng'],
    counties: ['name', 'state', 'lat', 'lng'],
    states: ['name', 'state', 'lat', 'lng']
  };

  const minimalColumns = {
    zips: ['zipCode'],
    cities: ['name', 'state'],
    counties: ['name', 'state'],
    states: ['name', 'state']
  };

  const presets = {
    minimal: { name: 'Minimal (recommended)', description: 'Essential fields only' },
    all: { name: 'All fields', description: 'Include all available data' },
    meta: { name: 'Meta Ads', description: 'ZIP codes only, no header' },
    google: { name: 'Google Ads', description: 'City + State format' },
    last: { name: 'Last used', description: 'Your previous selection' }
  };

  // Initialize columns based on preset
  useEffect(() => {
    let cols = [];
    switch (preset) {
      case 'minimal':
        cols = minimalColumns[activeTab] || [];
        setIncludeHeader(true);
        break;
      case 'all':
        cols = schemaByTab[activeTab] || [];
        setIncludeHeader(true);
        break;
      case 'meta':
        cols = activeTab === 'zips' ? ['zipCode'] : minimalColumns[activeTab];
        setIncludeHeader(false);
        break;
      case 'google':
        cols = activeTab === 'cities' ? ['name', 'state'] : minimalColumns[activeTab];
        setIncludeHeader(true);
        break;
      case 'last':
        const saved = localStorage.getItem(`exportColumns_${activeTab}`);
        cols = saved ? JSON.parse(saved) : minimalColumns[activeTab];
        break;
      default:
        cols = minimalColumns[activeTab] || [];
    }
    setSelectedColumns(cols);
    setSortBy(cols[0] || '');
  }, [preset, activeTab]);

  // Generate filename
  useEffect(() => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const count = data.length;
    setFilename(`${activeTab}_${count}rows_${timestamp}.csv`);
  }, [activeTab, data]);

  const handleColumnToggle = (column) => {
    setSelectedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(schemaByTab[activeTab] || []);
  };

  const handleSelectNone = () => {
    setSelectedColumns([]);
  };

  const processData = (data, sortField, dedupe) => {
    let processed = [...data];

    // Deduplicate
    if (dedupe) {
      const seen = new Set();
      processed = processed.filter(item => {
        let key;
        switch (activeTab) {
          case 'zips':
            key = item.zipCode;
            break;
          case 'cities':
            key = `${item.name}|${item.state}`;
            break;
          case 'counties':
            key = `${item.name}|${item.state}`;
            break;
          case 'states':
            key = item.state;
            break;
          default:
            key = item.id;
        }
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Sort
    if (sortField) {
      processed.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        return String(aVal || '').localeCompare(String(bVal || ''));
      });
    }

    return processed;
  };

  const generateCSV = (data, columns, includeHeader, delimiter) => {
    const lines = [];

    if (includeHeader) {
      lines.push(columns.join(delimiter));
    }

    for (const item of data) {
      const row = columns.map(col => {
        let value = item[col] || '';
        // Special formatting for some columns
        if (col === 'name' && activeTab === 'counties' && !value.toLowerCase().includes('county')) {
          value = `${value} County`;
        }
        if (col === 'state' && (activeTab === 'cities' || activeTab === 'counties') && columns.includes('name')) {
          return value; // Just state code for name,state combinations
        }
        // Quote values that contain delimiter or quotes
        if (String(value).includes(delimiter) || String(value).includes('"')) {
          value = `"${String(value).replace(/"/g, '""')}"`;
        }
        return value;
      }).join(delimiter);
      lines.push(row);
    }

    return lines.join('\n');
  };

  const handleDownload = () => {
    const processed = processData(data, sortBy, deduplicate);
    const csv = generateCSV(processed, selectedColumns, includeHeader, delimiter);

    // Save user preferences
    localStorage.setItem(`exportColumns_${activeTab}`, JSON.stringify(selectedColumns));
    localStorage.setItem('exportSettings', JSON.stringify({
      includeHeader,
      delimiter,
      deduplicate
    }));

    // Download main file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Download all fields file if requested
    if (alsoExportAll) {
      const allColumns = schemaByTab[activeTab] || [];
      const allCsv = generateCSV(processed, allColumns, includeHeader, delimiter);
      const allBlob = new Blob([allCsv], { type: 'text/csv' });
      const allUrl = URL.createObjectURL(allBlob);
      const allA = document.createElement('a');
      allA.href = allUrl;
      allA.download = filename.replace('.csv', '_all.csv');
      allA.click();
      URL.revokeObjectURL(allUrl);
    }

    onClose();
  };

  if (!isOpen) return null;

  const processed = processData(data, sortBy, deduplicate);
  const previewData = processed.slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Custom Export</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Selection: {activeTab} · {data.length} rows
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Presets */}
          <div>
            <label className="block text-sm font-medium mb-2">Export Preset</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className={`w-full p-2 border rounded ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300'
              }`}
            >
              {Object.entries(presets).map(([key, { name, description }]) => (
                <option key={key} value={key}>{name} - {description}</option>
              ))}
            </select>
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Columns</label>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Select All
                </button>
                <button
                  onClick={handleSelectNone}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Select None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(schemaByTab[activeTab] || []).map(column => (
                <label key={column} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleColumnToggle(column)}
                    className="rounded"
                  />
                  <span className="text-sm">{column}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Options */}
          <details className={`border rounded p-4 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <summary className="cursor-pointer font-medium">Advanced Options</summary>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Delimiter</label>
                <select
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value=",">Comma</option>
                  <option value="\t">Tab</option>
                  <option value=";">Semicolon</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="">No sorting</option>
                  {selectedColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Include header row</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={(e) => setDeduplicate(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Remove duplicates</span>
              </label>
            </div>
          </details>

          {/* Filename */}
          <div>
            <label className="block text-sm font-medium mb-2">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className={`w-full p-2 border rounded ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300'
              }`}
            />
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={alsoExportAll}
                onChange={(e) => setAlsoExportAll(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Also download full dataset</span>
            </label>
          </div>

          {/* Preview */}
          {selectedColumns.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Preview (first 10 rows)</h3>
              <div className="overflow-x-auto border rounded">
                <table className={`w-full text-xs ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  {includeHeader && (
                    <thead>
                      <tr>
                        {selectedColumns.map(col => (
                          <th key={col} className="px-2 py-1 text-left border-b">{col}</th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {previewData.map((item, idx) => (
                      <tr key={idx}>
                        {selectedColumns.map(col => (
                          <td key={col} className="px-2 py-1 border-b">
                            {item[col] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} flex justify-end space-x-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded ${
              isDarkMode
                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedColumns.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download {alsoExportAll ? '(2 files)' : ''}
          </button>
        </div>
      </div>
    </div>
  );
};


// Header Mapping Modal Component
const HeaderMappingModal = ({ isOpen, onClose, headers, previewData, columnMapping, setColumnMapping, onConfirm, isDarkMode, processingProgress }) => {
  if (!isOpen) return null;

  const handleMappingChange = (header, value) => {
    setColumnMapping(prev => ({ ...prev, [header]: value }));
  };

  // Check if at least one column is mapped to something other than 'ignore'
  const hasValidMapping = Object.values(columnMapping).some(value => value !== 'ignore');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className={`p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto shadow-2xl ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2" />
          Map CSV Columns to Data Types
        </h3>

        <p className={`mb-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Please map each column from your CSV to the appropriate data type. We've pre-selected options based on column names where possible.
        </p>

        {/* Column Mapping */}
        <div className="space-y-3 mb-6">
          <div className={`grid grid-cols-3 gap-4 pb-3 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <div className="font-medium">Column Name</div>
            <div className="font-medium">Sample Data</div>
            <div className="font-medium">Map To</div>
          </div>

          {headers.map((header, index) => (
            <div key={header} className={`grid grid-cols-3 gap-4 items-center py-2 ${index % 2 === 1 ? (isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50') : ''}`}>
              <div className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                {header}
              </div>

              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} truncate`}>
                {previewData[0] && previewData[0][header] ? (
                  <span title={previewData[0][header]}>{previewData[0][header]}</span>
                ) : (
                  <span className="italic">Empty</span>
                )}
              </div>

              <select
                value={columnMapping[header] || 'ignore'}
                onChange={(e) => handleMappingChange(header, e.target.value)}
                className={`px-3 py-2 rounded border ${
                  columnMapping[header] !== 'ignore'
                    ? 'border-red-500 font-medium'
                    : ''
                } ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="ignore">Do Not Include</option>
                <option value="zipcode">ZIP Code</option>
                <option value="city">City</option>
                <option value="state">State</option>
                <option value="county">County</option>
              </select>
            </div>
          ))}
        </div>

        {/* Data Preview */}
        {previewData.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Preview of First 5 Rows</h4>
            <div className={`overflow-x-auto border rounded ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <table className={`w-full text-xs ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <thead>
                  <tr className={isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}>
                    {headers.filter(h => columnMapping[h] !== 'ignore').map(header => (
                      <th key={header} className="px-2 py-1 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 5).map((row, i) => (
                    <tr key={i} className={i % 2 === 1 ? (isDarkMode ? 'bg-gray-800' : 'bg-white') : ''}>
                      {headers.filter(h => columnMapping[h] !== 'ignore').map(header => (
                        <td key={header} className="px-2 py-1">{row[header] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {processingProgress.total > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Processing...</span>
              <span>{processingProgress.current} / {processingProgress.total}</span>
            </div>
            <div className={`w-full h-2 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
              <div
                className="h-2 bg-red-600 rounded transition-all duration-300"
                style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {previewData.length} rows detected
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded transition-colors ${
                isDarkMode
                  ? 'bg-gray-600 hover:bg-gray-700 text-white'
                  : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!hasValidMapping}
              className={`px-4 py-2 rounded transition-colors ${
                hasValidMapping
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }`}
            >
              Process File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeoApplication;
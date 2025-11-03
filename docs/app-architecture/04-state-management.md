# State Management Architecture

## Overview

GeoSearch Pro uses **React Context API** for state management, organized into four specialized providers that manage different concerns. This architecture avoids prop drilling, enables selective re-rendering, and maintains clear separation of concerns.

## Why Context Over Redux/MobX?

| Criterion | Context API | Redux | MobX |
|-----------|-------------|-------|------|
| **Setup Complexity** | Low | High | Medium |
| **Bundle Size** | 0 KB (built-in) | ~20 KB | ~15 KB |
| **Boilerplate** | Minimal | Extensive | Moderate |
| **Learning Curve** | Low | High | Medium |
| **TypeScript Support** | Excellent | Good | Good |
| **DevTools** | React DevTools | Redux DevTools | MobX DevTools |
| **Performance** | Selective | Excellent | Excellent |
| **Best For** | Medium apps | Large apps | OOP-style apps |

**Decision**: Context API for simplicity and zero external dependencies while maintaining sufficient performance for our use case.

## Four-Layer Context Architecture

```
UIContext (Presentation State)
    ├── Drawer, modals, tabs
    ├── Dark mode, theme
    └── Autocomplete dropdown state

SearchContext (Business Logic)
    ├── Search parameters (mode, term, radius, etc.)
    ├── Search orchestration
    ├── History management
    └── Loading states

ResultsContext (Data Storage)
    ├── Search results (ZIPs, cities, streets)
    ├── Hierarchical operations
    └── Export functionality

MapContext (Visualization)
    ├── Map view (center, zoom, bounds)
    ├── Drawn shapes and markers
    ├── Boundary visibility
    └── Layer selection
```

**Key Principle**: Each context handles a single concern, preventing unnecessary re-renders when unrelated state changes.

## Context Providers

### 1. UIContext - Presentation State

**File**: `src/contexts/UIContext.jsx` (~400 lines)

**Purpose**: Manages all UI-only state that doesn't affect data or business logic

**State Variables** (12 total):
```javascript
// Drawer & Navigation
const [isDrawerOpen, setIsDrawerOpen] = useState(false);
const [activeTab, setActiveTab] = useState('zips');
const [isSearchPanelCollapsed, setIsSearchPanelCollapsed] = useState(false);

// Modals
const [showExportModal, setShowExportModal] = useState(false);
const [showUploadModal, setShowUploadModal] = useState(false);
const [showHistoryModal, setShowHistoryModal] = useState(false);

// Autocomplete
const [autocompleteResults, setAutocompleteResults] = useState([]);
const [showAutocomplete, setShowAutocomplete] = useState(false);
const [isSearching, setIsSearching] = useState(false);

// Theme
const [isDarkMode, setIsDarkMode] = useState(() => {
  const saved = localStorage.getItem('darkMode');
  return saved === 'true';
});

// Notifications
const [apiError, setApiError] = useState(null);
const [apiSuccess, setApiSuccess] = useState(null);
```

**Context Value**:
```javascript
const value = {
  // State
  isDarkMode,
  isDrawerOpen,
  activeTab,
  isSearchPanelCollapsed,
  showExportModal,
  showUploadModal,
  showHistoryModal,
  autocompleteResults,
  showAutocomplete,
  isSearching,
  apiError,
  apiSuccess,

  // Setters
  setIsDarkMode,
  setIsDrawerOpen,
  setActiveTab,
  setIsSearchPanelCollapsed,
  setShowExportModal,
  setShowUploadModal,
  setShowHistoryModal,
  setAutocompleteResults,
  setShowAutocomplete,
  setIsSearching,
  setApiError,
  setApiSuccess,

  // Utility functions
  toggleDarkMode: () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('darkMode', next);
      return next;
    });
  },
  toggleDrawer: () => setIsDrawerOpen(prev => !prev),
  clearNotifications: () => {
    setApiError(null);
    setApiSuccess(null);
  }
};
```

**Usage Example**:
```javascript
import { useUI } from '../contexts/UIContext';

function Header() {
  const { isDarkMode, toggleDarkMode } = useUI();

  return (
    <button onClick={toggleDarkMode}>
      {isDarkMode ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
```

**Why Separate?**
- UI state changes frequently but doesn't affect data
- Components only re-render when UI state they use changes
- Theme/modal state unrelated to search/results

---

### 2. SearchContext - Business Logic

**File**: `src/contexts/SearchContext.jsx` (~2,954 lines - largest context)

**Purpose**: Orchestrates all search operations, manages search parameters, and coordinates with other contexts

**State Variables** (40+ total):

**Search Mode & Parameters**:
```javascript
const [searchMode, setSearchMode] = useState('radius'); // 'radius' | 'polygon' | 'hierarchy' | 'upload' | 'address' | 'geocode'
const [searchTerm, setSearchTerm] = useState('');
const [searchRadius, setSearchRadius] = useState(25); // miles
const [searchCenter, setSearchCenter] = useState(null); // [lat, lng]
const [searchPerformed, setSearchPerformed] = useState(false);
const [isLoading, setIsLoading] = useState(false);
```

**Hierarchy Search**:
```javascript
const [selectedState, setSelectedState] = useState(null);
const [selectedCounty, setSelectedCounty] = useState(null);
const [selectedCity, setSelectedCity] = useState(null);
const [hierarchyLocations, setHierarchyLocations] = useState({
  states: [],
  counties: [],
  cities: []
});
```

**Polygon Search**:
```javascript
const [polygonSearches, setPolygonSearches] = useState([]);
const [activePolygonSearchId, setActivePolygonSearchId] = useState(null);
const [polygonDisplaySettings, setPolygonDisplaySettings] = useState({
  showShape: true,
  showMarkers: true,
  showZipBorders: false
});
```

**Address Search**:
```javascript
const [addressSubMode, setAddressSubMode] = useState('radius'); // 'radius' | 'polygon'
const [addressRadius, setAddressRadius] = useState(5);
```

**Upload Search**:
```javascript
const [uploadedFile, setUploadedFile] = useState(null);
const [uploadFileName, setUploadFileName] = useState('');
const [uploadedData, setUploadedData] = useState([]);
```

**Geocode Search**:
```javascript
const [geocodeFile, setGeocodeFile] = useState(null);
const [geocodeFileName, setGeocodeFileName] = useState('');
const [geocodeProgress, setGeocodeProgress] = useState(0);
```

**Search History**:
```javascript
const [searchHistory, setSearchHistory] = useState(() => {
  const saved = localStorage.getItem('searchHistory');
  return saved ? JSON.parse(saved) : [];
});

const [radiusSearches, setRadiusSearches] = useState(() => {
  const saved = localStorage.getItem('radiusSearches');
  return saved ? JSON.parse(saved) : [];
});
```

**Map Integration**:
```javascript
const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]); // Geographic center of USA
const [mapZoom, setMapZoom] = useState(4);
```

**Key Functions**:

**1. handleSearch()** - Main search orchestrator
```javascript
const handleSearch = async (customParams = {}) => {
  setIsLoading(true);
  setSearchPerformed(false);
  clearError();

  try {
    let results = [];

    switch (searchMode) {
      case 'radius':
        results = await handleRadiusSearch();
        break;
      case 'hierarchy':
        results = await handleHierarchySearch(customParams);
        break;
      case 'address':
        results = await handleAddressSearch();
        break;
      case 'upload':
        results = await handleUploadSearch();
        break;
      case 'geocode':
        results = await handleGeocodeSearch();
        break;
      default:
        throw new Error(`Unknown search mode: ${searchMode}`);
    }

    setResults(results);
    setSearchPerformed(true);
    setIsDrawerOpen(true);

    // Save to history
    addSearchToHistory({
      mode: searchMode,
      params: customParams,
      timestamp: Date.now(),
      resultCount: results.length
    });

  } catch (error) {
    console.error('Search failed:', error);
    setApiError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

**2. handleAutocompleteSelect()** - Location selection with intelligent zoom
```javascript
const handleAutocompleteSelect = async (result, uiState) => {
  const { setShowAutocomplete, setIsSearching } = uiState;

  setShowAutocomplete(false);
  setIsSearching(true);

  try {
    // Get detailed location data
    const locationDetails = await GeocodingService.getPlaceDetails(result.place_id);

    const finalLocation = {
      lat: locationDetails.lat,
      lng: locationDetails.lng,
      displayName: locationDetails.displayName,
      type: locationDetails.type
    };

    // Intelligent zoom based on location type
    let zoomLevel = 13; // Default
    if (finalLocation.type === 'zipcode' || finalLocation.type === 'address') {
      zoomLevel = 13; // Street level
    } else if (finalLocation.type === 'city') {
      zoomLevel = 11; // City level
    } else if (finalLocation.type === 'county') {
      zoomLevel = 9; // County level
    } else if (finalLocation.type === 'state') {
      zoomLevel = 6; // State level
    }

    // Special case: Polygon mode needs higher zoom for drawing
    if (searchMode === 'address' && addressSubMode === 'polygon') {
      zoomLevel = 15;
    } else if (searchMode === 'polygon') {
      zoomLevel = 15;
    }

    // Center map on location using MapContext
    handleResultMapInteraction({
      type: finalLocation.type || 'place',
      result: finalLocation,
      center: [finalLocation.lat, finalLocation.lng],
      zoom: zoomLevel
    });

    // Update state
    setSearchTerm(finalLocation.displayName);
    setSearchCenter([finalLocation.lat, finalLocation.lng]);
    setMapCenter([finalLocation.lat, finalLocation.lng]);
    setMapZoom(zoomLevel);

  } catch (error) {
    console.error('Autocomplete select failed:', error);
    setApiError('Could not load location details');
  } finally {
    setIsSearching(false);
  }
};
```

**3. handlePolygonSearch()** - Polygon search with validation
```javascript
const handlePolygonSearch = async (shape, shapeType) => {
  setIsLoading(true);

  try {
    // Extract coordinates
    const coords = shape.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
    coords.push(coords[0]); // Close polygon

    // Validate area (<70 sq miles)
    const area = turf.area(turf.polygon([coords]));
    const sqMiles = area / 2589988.11;

    if (sqMiles > 70) {
      throw new Error(`Area too large: ${sqMiles.toFixed(1)} sq mi (max 70 sq mi)`);
    }

    // Search for ZIPs within polygon
    const results = await ZipCodeService.searchWithinPolygon(coords);

    // Calculate bounds
    const bounds = coords.reduce((acc, [lng, lat]) => ({
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng)
    }), { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });

    // Create search entry
    const searchId = `polygon_${Date.now()}`;
    const searchEntry = {
      id: searchId,
      label: `${shapeType} - ${results.length} ZIPs`,
      shapeType,
      coords,
      bounds,
      results,
      timestamp: Date.now(),
      settings: { ...polygonDisplaySettings }
    };

    // Add to history
    setPolygonSearches(prev => [...prev, searchEntry]);
    setActivePolygonSearchId(searchId);

    // Update results
    setResults(results);
    setSearchPerformed(true);

    // Save to localStorage
    localStorage.setItem('polygonSearches', JSON.stringify([...polygonSearches, searchEntry]));

  } catch (error) {
    console.error('Polygon search failed:', error);
    setApiError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

**Context Value** (Simplified - actual has 80+ exports):
```javascript
const value = {
  // Search state
  searchMode,
  searchTerm,
  searchRadius,
  searchCenter,
  searchPerformed,
  isLoading,

  // Hierarchy
  selectedState,
  selectedCounty,
  selectedCity,
  hierarchyLocations,

  // Polygon
  polygonSearches,
  activePolygonSearchId,
  polygonDisplaySettings,

  // Actions
  handleSearch,
  handleSearchInputChange,
  handleAutocompleteSelect,
  handleAutocompleteBlur,
  handleResetSearch,
  handleCSVUpload,
  handleGeocodeCSVUpload,

  // Setters
  setSearchMode,
  setSearchRadius,
  setSelectedState,
  setSelectedCounty,
  setSelectedCity,
  setAddressSubMode,
  setAddressRadius,
  // ... 30+ more
};
```

---

### 3. ResultsContext - Data Storage

**File**: `src/contexts/ResultsContext.jsx` (~600 lines)

**Purpose**: Manages search results, filtering, and export operations

**State Variables**:
```javascript
const [results, setResults] = useState([]); // ZIP code results
const [streetResults, setStreetResults] = useState([]); // Address results
const [filteredResults, setFilteredResults] = useState([]);
const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
const [selectedColumns, setSelectedColumns] = useState([
  'zipCode', 'city', 'state', 'county', 'latitude', 'longitude'
]);
```

**Key Functions**:

**1. removeStateFromResults()** - Hierarchical removal
```javascript
const removeStateFromResults = (stateCode) => {
  setResults(prevResults => {
    return prevResults.filter(result => result.state !== stateCode);
  });

  setFilteredResults(prevFiltered => {
    return prevFiltered.filter(result => result.state !== stateCode);
  });

  // Clear hierarchy selections if removing active state
  if (selectedState === stateCode) {
    setSelectedState(null);
    setSelectedCounty(null);
    setSelectedCity(null);
  }
};
```

**2. removeCountyFromResults()** - Hierarchical removal
```javascript
const removeCountyFromResults = (stateCode, countyName) => {
  setResults(prevResults => {
    return prevResults.filter(result =>
      !(result.state === stateCode && result.county === countyName)
    );
  });

  setFilteredResults(prevFiltered => {
    return prevFiltered.filter(result =>
      !(result.state === stateCode && result.county === countyName)
    );
  });

  // Clear county/city selections if removing active county
  if (selectedCounty === countyName) {
    setSelectedCounty(null);
    setSelectedCity(null);
  }
};
```

**3. removeCityFromResults()** - Hierarchical removal
```javascript
const removeCityFromResults = (stateCode, cityName) => {
  setResults(prevResults => {
    return prevResults.filter(result =>
      !(result.state === stateCode && result.city === cityName)
    );
  });

  setFilteredResults(prevFiltered => {
    return prevFiltered.filter(result =>
      !(result.state === stateCode && result.city === cityName)
    );
  });

  // Clear city selection if removing active city
  if (selectedCity === cityName) {
    setSelectedCity(null);
  }
};
```

**4. sortResults()** - Table sorting
```javascript
const sortResults = (key) => {
  let direction = 'asc';

  if (sortConfig.key === key && sortConfig.direction === 'asc') {
    direction = 'desc';
  }

  const sorted = [...filteredResults].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === 'string') {
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  setFilteredResults(sorted);
  setSortConfig({ key, direction });
};
```

**5. exportToCSV()** - CSV export with custom columns
```javascript
const exportToCSV = () => {
  const exportData = filteredResults.map(result => {
    const row = {};
    selectedColumns.forEach(col => {
      row[col] = result[col] ?? '';
    });
    return row;
  });

  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `geosearch_${searchMode}_${Date.now()}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

**Context Value**:
```javascript
const value = {
  // State
  results,
  streetResults,
  filteredResults,
  sortConfig,
  selectedColumns,

  // Setters
  setResults,
  setStreetResults,
  setFilteredResults,
  setSelectedColumns,

  // Actions
  removeStateFromResults,
  removeCountyFromResults,
  removeCityFromResults,
  sortResults,
  exportToCSV,
  copyToClipboard
};
```

---

### 4. MapContext - Visualization

**File**: `src/contexts/MapContext.jsx` (~285 lines)

**Purpose**: Manages map state, drawn shapes, boundaries, and layer selection

**State Variables**:
```javascript
const [mapRef, setMapRef] = useState(null); // Leaflet map instance
const [drawnShapes, setDrawnShapes] = useState([]);
const [showZipBoundaries, setShowZipBoundaries] = useState(false);
const [loadedBoundaries, setLoadedBoundaries] = useState({});
const [mapLayer, setMapLayer] = useState('street'); // 'street' | 'satellite' | 'terrain'
const [markers, setMarkers] = useState([]);
```

**Key Functions**:

**1. handleResultMapInteraction()** - Direct map control
```javascript
const handleResultMapInteraction = ({ type, result, center, zoom }) => {
  if (!mapRef) return;

  // Animate to location
  mapRef.flyTo(center, zoom, {
    animate: true,
    duration: 1.5
  });

  // Add temporary marker
  const marker = L.marker(center, {
    icon: L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pulse"></div>`
    })
  }).addTo(mapRef);

  // Remove after 3 seconds
  setTimeout(() => {
    mapRef.removeLayer(marker);
  }, 3000);
};
```

**2. handleShapeDrawn()** - Drawing tool callback
```javascript
const handleShapeDrawn = (layer, shapeType) => {
  const shape = {
    id: `shape_${Date.now()}`,
    type: shapeType,
    layer,
    coords: layer.getLatLngs ? layer.getLatLngs() : null
  };

  setDrawnShapes(prev => [...prev, shape]);

  // Trigger polygon search
  if (searchMode === 'polygon') {
    handlePolygonSearch(layer, shapeType);
  } else if (searchMode === 'address' && addressSubMode === 'polygon') {
    handleAddressSearch({ polygon: layer });
  }
};
```

**3. loadZipBoundaries()** - Lazy boundary loading
```javascript
const loadZipBoundaries = async (zipCodes) => {
  const unloadedZips = zipCodes.filter(zip => !loadedBoundaries[zip]);

  if (unloadedZips.length === 0) return;

  try {
    const boundaries = await BoundaryService.getZipBoundaries(unloadedZips);

    const boundaryMap = {};
    boundaries.forEach(b => {
      boundaryMap[b.zipCode] = b.geometry;
    });

    setLoadedBoundaries(prev => ({ ...prev, ...boundaryMap }));

    // Add to map
    Object.entries(boundaryMap).forEach(([zip, geometry]) => {
      L.geoJSON(geometry, {
        style: {
          color: '#3b82f6',
          weight: 2,
          fillOpacity: 0.1
        }
      }).addTo(mapRef);
    });

  } catch (error) {
    console.error('Failed to load boundaries:', error);
  }
};
```

**4. clearDrawnShapes()** - Remove all drawn shapes
```javascript
const clearDrawnShapes = () => {
  drawnShapes.forEach(shape => {
    if (shape.layer && mapRef) {
      mapRef.removeLayer(shape.layer);
    }
  });

  setDrawnShapes([]);
};
```

**Context Value**:
```javascript
const value = {
  // State
  mapRef,
  drawnShapes,
  showZipBoundaries,
  loadedBoundaries,
  mapLayer,
  markers,

  // Setters
  setMapRef,
  setShowZipBoundaries,
  setMapLayer,

  // Actions
  handleResultMapInteraction,
  handleShapeDrawn,
  loadZipBoundaries,
  clearDrawnShapes,
  addMarkers,
  removeMarkers
};
```

---

## Context Composition Pattern

**File**: `src/main.jsx`

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UIProvider } from './contexts/UIContext';
import { SearchProvider } from './contexts/SearchContext';
import { ResultsProvider } from './contexts/ResultsContext';
import { MapProvider } from './contexts/MapContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UIProvider>
      <SearchProvider>
        <ResultsProvider>
          <MapProvider>
            <App />
          </MapProvider>
        </ResultsProvider>
      </SearchProvider>
    </UIProvider>
  </React.StrictMode>
);
```

**Order Matters**:
1. **UIProvider** first - Provides theme/UI state
2. **SearchProvider** second - Uses UIContext for notifications
3. **ResultsProvider** third - Uses SearchContext for mode
4. **MapProvider** fourth - Uses SearchContext and ResultsContext

## Cross-Context Communication

### Pattern 1: Context Consuming Another Context

**SearchContext uses MapContext**:
```javascript
import { useMap } from './MapContext';

export const SearchProvider = ({ children }) => {
  const { handleResultMapInteraction, setShowZipBoundaries } = useMap();

  const handleAutocompleteSelect = async (result) => {
    // ... autocomplete logic

    // Call MapContext function
    handleResultMapInteraction({
      type: result.type,
      result,
      center: [result.lat, result.lng],
      zoom: 13
    });
  };

  // ... rest of context
};
```

### Pattern 2: Shared State via Props

**Component uses multiple contexts**:
```javascript
import { useSearch } from '../contexts/SearchContext';
import { useResults } from '../contexts/ResultsContext';
import { useMap } from '../contexts/MapContext';
import { useUI } from '../contexts/UIContext';

function ResultsTable() {
  const { searchMode } = useSearch();
  const { results, sortResults } = useResults();
  const { handleResultMapInteraction } = useMap();
  const { isDarkMode } = useUI();

  // Component logic using all 4 contexts
}
```

### Pattern 3: Event Broadcasting

**Using custom events for loose coupling**:
```javascript
// SearchContext triggers event
const handleSearchComplete = (results) => {
  setResults(results);

  // Broadcast event
  window.dispatchEvent(new CustomEvent('searchComplete', {
    detail: { mode: searchMode, count: results.length }
  }));
};

// MapContext listens for event
useEffect(() => {
  const handler = (e) => {
    if (e.detail.count > 0) {
      fitBoundsToResults();
    }
  };

  window.addEventListener('searchComplete', handler);
  return () => window.removeEventListener('searchComplete', handler);
}, []);
```

## Performance Optimization

### 1. Selective Re-rendering

**Problem**: Single context with all state causes every consumer to re-render on any state change

**Solution**: Multiple contexts + selective consumption
```javascript
// ❌ Bad: Component re-renders on any state change
const { allState } = useApp();

// ✅ Good: Component only re-renders when theme changes
const { isDarkMode } = useUI();
```

### 2. Memoized Context Values

**Prevent unnecessary re-renders**:
```javascript
const value = useMemo(() => ({
  searchMode,
  searchRadius,
  handleSearch,
  handleReset
}), [searchMode, searchRadius]); // Only recreate when dependencies change
```

### 3. Callback Stability

**Use useCallback for event handlers**:
```javascript
const handleSearch = useCallback(async (params) => {
  setIsLoading(true);
  const results = await ZipCodeService.search(params);
  setResults(results);
  setIsLoading(false);
}, []); // No dependencies = stable reference
```

### 4. Lazy State Initialization

**Expensive initial state from localStorage**:
```javascript
const [searchHistory, setSearchHistory] = useState(() => {
  // Only runs once on mount
  const saved = localStorage.getItem('searchHistory');
  return saved ? JSON.parse(saved) : [];
});
```

## State Persistence Strategy

### LocalStorage Keys

```javascript
// UI preferences
'darkMode' → boolean
'drawerWidth' → number

// Search history
'searchHistory' → Array<SearchHistoryEntry>
'radiusSearches' → Array<RadiusSearch>
'polygonSearches' → Array<PolygonSearch>

// Caching
'autocomplete_${query}' → AutocompleteResult[]
'boundaries_${zipCode}' → GeoJSON
'geocoding_${address}' → { lat, lng }

// API usage tracking
'google_places_usage' → number
'nominatim_usage' → number
```

### Sync Pattern

**Sync state to localStorage on change**:
```javascript
useEffect(() => {
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}, [searchHistory]);

useEffect(() => {
  localStorage.setItem('darkMode', isDarkMode);
}, [isDarkMode]);
```

## Testing Strategy (Planned)

### 1. Context Unit Tests

```javascript
import { renderHook, act } from '@testing-library/react';
import { SearchProvider, useSearch } from './SearchContext';

describe('SearchContext', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider
    });

    expect(result.current.searchMode).toBe('radius');
    expect(result.current.searchRadius).toBe(25);
  });

  it('should update search mode', () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider
    });

    act(() => {
      result.current.setSearchMode('polygon');
    });

    expect(result.current.searchMode).toBe('polygon');
  });
});
```

### 2. Integration Tests

```javascript
describe('Search Flow Integration', () => {
  it('should complete radius search end-to-end', async () => {
    const { result } = renderHook(() => ({
      search: useSearch(),
      results: useResults(),
      map: useMap()
    }), {
      wrapper: AllProviders
    });

    // Perform search
    await act(async () => {
      await result.current.search.handleSearch({
        lat: 40.7128,
        lng: -74.0060,
        radius: 25
      });
    });

    // Verify results
    expect(result.current.results.results.length).toBeGreaterThan(0);
    expect(result.current.search.searchPerformed).toBe(true);
  });
});
```

## Common Patterns

### Pattern 1: Loading State Management

```javascript
const handleSearch = async () => {
  setIsLoading(true);
  setApiError(null);

  try {
    const results = await ZipCodeService.search(params);
    setResults(results);
    setSearchPerformed(true);
  } catch (error) {
    setApiError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

### Pattern 2: Optimistic Updates

```javascript
const removeFromHistory = (id) => {
  // Optimistic update
  const newHistory = searchHistory.filter(h => h.id !== id);
  setSearchHistory(newHistory);

  // Persist
  localStorage.setItem('searchHistory', JSON.stringify(newHistory));

  // Show feedback
  setApiSuccess('Removed from history');
};
```

### Pattern 3: Derived State

```javascript
// Don't store derived state
const [filteredResults, setFilteredResults] = useState([]);

// Instead, compute on render
const filteredResults = useMemo(() => {
  return results.filter(r => r.state === selectedState);
}, [results, selectedState]);
```

## State Debugging

### React DevTools

```javascript
// Add display names for better debugging
SearchContext.displayName = 'SearchContext';
ResultsContext.displayName = 'ResultsContext';
MapContext.displayName = 'MapContext';
UIContext.displayName = 'UIContext';
```

### Console Logging (Development Only)

```javascript
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[SearchContext] State updated:', {
      searchMode,
      searchRadius,
      resultsCount: results.length
    });
  }
}, [searchMode, searchRadius, results]);
```

## Anti-Patterns to Avoid

### ❌ 1. Prop Drilling Through Context

```javascript
// Don't pass context values as props
<ChildComponent searchMode={searchMode} />

// Use context directly in child
const ChildComponent = () => {
  const { searchMode } = useSearch();
};
```

### ❌ 2. Storing Everything in Context

```javascript
// Don't put temporary UI state in context
const [inputValue, setInputValue] = useState(''); // ✅ Local state

// Don't use context for this
const { setInputValue } = useSearch(); // ❌ Too granular
```

### ❌ 3. Circular Dependencies

```javascript
// Don't create circular context dependencies
// SearchContext uses MapContext ✅
// MapContext uses SearchContext ❌ (creates circular dependency)
```

## Next Steps

- **SearchContext Details**: See `contexts/SearchContext.md`
- **MapContext Details**: See `contexts/MapContext.md`
- **ResultsContext Details**: See `contexts/ResultsContext.md`
- **UIContext Details**: See `contexts/UIContext.md`
- **Data Flow**: See `03-data-flow.md`

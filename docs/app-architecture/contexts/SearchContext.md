# SearchContext - Search Orchestration

## Overview

**File**: `src/contexts/SearchContext.jsx` (2,954 lines)

**Purpose**: The SearchContext is the central orchestrator for all search operations in GeoSearch Pro. It manages search parameters, coordinates with external services, handles all 6 search modes, and maintains search history.

**Key Responsibilities**:
- Orchestrate all search operations (6 modes)
- Manage search parameters and state
- Handle autocomplete and geocoding
- Maintain search history
- Coordinate with MapContext, ResultsContext, and UIContext
- Manage loading and error states

## Architecture Position

```
UIContext (presentation)
    ↓
SearchContext (business logic) ← YOU ARE HERE
    ↓
ResultsContext (data storage)
    ↓
MapContext (visualization)
```

## State Variables (40+)

### Core Search State

```javascript
const [searchMode, setSearchMode] = useState('radius');
// Values: 'radius' | 'polygon' | 'hierarchy' | 'upload' | 'address' | 'geocode'

const [searchTerm, setSearchTerm] = useState('');
// User input for location search (autocomplete)

const [searchCenter, setSearchCenter] = useState(null);
// [lat, lng] of search center point

const [searchRadius, setSearchRadius] = useState(25);
// Radius in miles for radius/address searches

const [searchPerformed, setSearchPerformed] = useState(false);
// Indicates if a search has been completed

const [isLoading, setIsLoading] = useState(false);
// Loading state for async operations
```

### Radius Search State

```javascript
const [radiusSearches, setRadiusSearches] = useState(() => {
  const saved = localStorage.getItem('radiusSearches');
  return saved ? JSON.parse(saved) : [];
});
// Array of past radius searches with chips UI

const [activeRadiusSearchId, setActiveRadiusSearchId] = useState(null);
// Currently focused radius search
```

**RadiusSearch Type**:
```javascript
{
  id: string,              // Unique ID: `radius_${timestamp}`
  label: string,           // Display label: "New York, NY - 25 mi"
  lat: number,
  lng: number,
  radius: number,          // Miles
  displayName: string,
  timestamp: number,
  resultCount: number,
  results: ZipCode[]       // Cached results
}
```

### Polygon Search State

```javascript
const [polygonSearches, setPolygonSearches] = useState(() => {
  const saved = localStorage.getItem('polygonSearches');
  return saved ? JSON.parse(saved) : [];
});
// Array of drawn polygons with search results

const [activePolygonSearchId, setActivePolygonSearchId] = useState(null);
// Currently focused polygon

const [polygonDisplaySettings, setPolygonDisplaySettings] = useState({
  showShape: true,         // Show polygon overlay
  showMarkers: true,       // Show ZIP markers
  showZipBorders: false    // Show ZIP boundaries
});
// Default display settings for polygons
```

**PolygonSearch Type**:
```javascript
{
  id: string,              // `polygon_${timestamp}`
  label: string,           // "Rectangle - 156 ZIPs"
  shapeType: string,       // 'rectangle' | 'circle' | 'polygon'
  coords: [[lng, lat]],    // GeoJSON coordinates
  bounds: {                // Bounding box
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number
  },
  area: number,            // Square miles
  timestamp: number,
  results: ZipCode[],
  settings: {              // Per-polygon display settings
    showShape: boolean,
    showMarkers: boolean,
    showZipBorders: boolean
  }
}
```

### Hierarchy Search State

```javascript
const [selectedState, setSelectedState] = useState(null);
// Two-letter state code: 'IL', 'CA', etc.

const [selectedCounty, setSelectedCounty] = useState(null);
// County name: 'Cook County', 'Los Angeles County'

const [selectedCity, setSelectedCity] = useState(null);
// City name: 'Chicago', 'Los Angeles'

const [hierarchyLocations, setHierarchyLocations] = useState({
  states: [],    // Array of all 50 states
  counties: [],  // Counties in selected state
  cities: []     // Cities in selected county
});
```

**HierarchyLocation Types**:
```javascript
// State
{
  code: string,           // 'IL'
  name: string,           // 'Illinois'
  zipCount: number        // Number of ZIPs in state
}

// County
{
  name: string,           // 'Cook County'
  state: string,          // 'IL'
  zipCount: number,
  cityCount: number
}

// City
{
  name: string,           // 'Chicago'
  county: string,         // 'Cook County'
  state: string,          // 'IL'
  zipCount: number
}
```

### Address Search State

```javascript
const [addressSubMode, setAddressSubMode] = useState('radius');
// 'radius' | 'polygon' - Search for addresses within radius or drawn polygon

const [addressRadius, setAddressRadius] = useState(5);
// Radius in miles for address radius searches (default 5, max 25)
```

### Upload Search State

```javascript
const [uploadedFile, setUploadedFile] = useState(null);
// File object from file input

const [uploadFileName, setUploadFileName] = useState('');
// Display name of uploaded file

const [uploadedData, setUploadedData] = useState([]);
// Parsed CSV data
```

### Geocode Search State

```javascript
const [geocodeFile, setGeocodeFile] = useState(null);
// File object for geocoding

const [geocodeFileName, setGeocodeFileName] = useState('');
// Display name

const [geocodeProgress, setGeocodeProgress] = useState(0);
// Progress percentage (0-100) during batch geocoding
```

### Map Integration State

```javascript
const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]);
// Geographic center of contiguous USA

const [mapZoom, setMapZoom] = useState(4);
// Initial zoom level showing full USA
```

### Search History

```javascript
const [searchHistory, setSearchHistory] = useState(() => {
  const saved = localStorage.getItem('searchHistory');
  return saved ? JSON.parse(saved) : [];
});
// Global search history across all modes
```

**SearchHistoryEntry Type**:
```javascript
{
  id: string,
  mode: string,           // Search mode
  params: object,         // Search parameters
  timestamp: number,
  resultCount: number,
  label: string           // Human-readable description
}
```

## Key Functions

### 1. handleSearch() - Main Search Orchestrator

**Purpose**: Routes search to appropriate handler based on search mode

**Location**: Lines 850-920

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

      case 'polygon':
        // Polygon searches are triggered by drawing, not button click
        throw new Error('Use drawing tools to create polygon search');

      default:
        throw new Error(`Unknown search mode: ${searchMode}`);
    }

    // Update results context
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

**Flow**:
1. Set loading state
2. Route to mode-specific handler
3. Update ResultsContext with results
4. Update UIContext (drawer, errors)
5. Save to search history
6. Clear loading state

---

### 2. handleRadiusSearch() - Radius Search Handler

**Purpose**: Search for ZIP codes within a radius of a point

**Location**: Lines 925-1050

```javascript
const handleRadiusSearch = async () => {
  if (!searchCenter) {
    throw new Error('Please select a location first');
  }

  const [lat, lng] = searchCenter;

  // Search for ZIPs within radius
  const results = await ZipCodeService.searchWithinRadius({
    lat,
    lng,
    radius: searchRadius
  });

  // Create search entry for history
  const searchId = `radius_${Date.now()}`;
  const searchEntry = {
    id: searchId,
    label: `${searchTerm} - ${searchRadius} mi`,
    lat,
    lng,
    radius: searchRadius,
    displayName: searchTerm,
    timestamp: Date.now(),
    resultCount: results.length,
    results
  };

  // Add to radius search history
  setRadiusSearches(prev => {
    const updated = [...prev, searchEntry];
    localStorage.setItem('radiusSearches', JSON.stringify(updated));
    return updated;
  });

  setActiveRadiusSearchId(searchId);

  // Zoom map to results
  if (results.length > 0) {
    fitMapToResults(results);
  }

  return results;
};
```

**Service Call**:
```javascript
// ZipCodeService.searchWithinRadius() flow:
// 1. Try Supabase PostGIS query (ST_Distance)
// 2. Fallback to API endpoint
// 3. Last resort: Static data with haversine formula
```

**Error Handling**:
- No location selected → User-friendly error
- Service failures → Graceful fallback chain
- No results → Empty array (not an error)

---

### 3. handlePolygonSearch() - Polygon Search Handler

**Purpose**: Search for ZIP codes within a drawn polygon

**Location**: Lines 1650-1850

```javascript
const handlePolygonSearch = async (layer, shapeType) => {
  setIsLoading(true);

  try {
    // Extract coordinates from Leaflet layer
    const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
    coords.push(coords[0]); // Close polygon for GeoJSON

    // Validate area (<70 sq miles for performance)
    const polygon = turf.polygon([coords]);
    const areaMeters = turf.area(polygon);
    const areaSqMiles = areaMeters / 2589988.11;

    if (areaSqMiles > 70) {
      throw new Error(
        `Polygon area (${areaSqMiles.toFixed(1)} sq mi) exceeds maximum (70 sq mi). ` +
        `Please draw a smaller area.`
      );
    }

    // Search for ZIPs within polygon
    const results = await ZipCodeService.searchWithinPolygon(coords);

    // Calculate bounding box for map fitting
    const bounds = coords.reduce((acc, [lng, lat]) => ({
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng)
    }), {
      minLat: Infinity,
      maxLat: -Infinity,
      minLng: Infinity,
      maxLng: -Infinity
    });

    // Create search entry
    const searchId = `polygon_${Date.now()}`;
    const searchEntry = {
      id: searchId,
      label: `${shapeType} - ${results.length} ZIPs`,
      shapeType,
      coords,
      bounds,
      area: areaSqMiles,
      timestamp: Date.now(),
      results,
      settings: { ...polygonDisplaySettings }
    };

    // Add to history
    setPolygonSearches(prev => {
      const updated = [...prev, searchEntry];
      localStorage.setItem('polygonSearches', JSON.stringify(updated));
      return updated;
    });

    setActivePolygonSearchId(searchId);

    // Update results
    setResults(results);
    setSearchPerformed(true);
    setIsDrawerOpen(true);

    return results;

  } catch (error) {
    console.error('Polygon search failed:', error);
    setApiError(error.message);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

**Validation Rules**:
- Maximum area: 70 square miles
- Minimum points: 3 (triangle)
- Must be closed polygon (first point = last point)

**Shape Types**:
- `rectangle` - Drawn with rectangle tool
- `circle` - Drawn with circle tool
- `polygon` - Drawn with polygon tool

---

### 4. handleHierarchySearch() - Hierarchy Search Handler

**Purpose**: Search by State → County → City hierarchy

**Location**: Lines 1150-1350

```javascript
const handleHierarchySearch = async ({ level, value }) => {
  // level: 'state' | 'county' | 'city'
  // value: state code, county name, or city name

  let results = [];

  switch (level) {
    case 'state':
      // Get all ZIPs in state
      results = await ZipCodeService.searchByState(value);

      // Load counties for this state
      const counties = await HierarchyService.getCountiesByState(value);
      setHierarchyLocations(prev => ({ ...prev, counties }));

      // Set zoom to state level
      setMapZoom(6);
      break;

    case 'county':
      // Get all ZIPs in county
      results = await ZipCodeService.searchByCounty(selectedState, value);

      // Load cities for this county
      const cities = await HierarchyService.getCitiesByCounty(selectedState, value);
      setHierarchyLocations(prev => ({ ...prev, cities }));

      // Set zoom to county level
      setMapZoom(9);
      break;

    case 'city':
      // Get all ZIPs in city
      results = await ZipCodeService.searchByCity(selectedState, selectedCounty, value);

      // Set zoom to city level
      setMapZoom(11);
      break;

    default:
      throw new Error(`Invalid hierarchy level: ${level}`);
  }

  // Update results
  setResults(results);
  setSearchPerformed(true);
  setIsDrawerOpen(true);

  // Fit map to results
  if (results.length > 0) {
    fitMapToResults(results);
  }

  return results;
};
```

**Cascading Updates**:
```javascript
// When state changes, reset county/city
useEffect(() => {
  if (selectedState) {
    setSelectedCounty(null);
    setSelectedCity(null);
    handleHierarchySearch({ level: 'state', value: selectedState });
  }
}, [selectedState]);

// When county changes, reset city
useEffect(() => {
  if (selectedCounty) {
    setSelectedCity(null);
    handleHierarchySearch({ level: 'county', value: selectedCounty });
  }
}, [selectedCounty]);

// When city changes, search
useEffect(() => {
  if (selectedCity) {
    handleHierarchySearch({ level: 'city', value: selectedCity });
  }
}, [selectedCity]);
```

---

### 5. handleAddressSearch() - Address Search Handler

**Purpose**: Search for street addresses within radius or polygon

**Location**: Lines 1990-2100

```javascript
const handleAddressSearch = async () => {
  if (addressSubMode === 'radius') {
    // Radius mode: Search around a point
    if (!searchCenter) {
      throw new Error('Please select a location first');
    }

    const [lat, lng] = searchCenter;

    // Import OverpassService dynamically
    const { default: overpassService } = await import('../services/overpassService');

    // Search for addresses within radius
    const addresses = await overpassService.searchAddresses({
      lat,
      lng,
      radius: milesToMeters(addressRadius)
    });

    // Update street results
    setStreetResults(addresses);
    setSearchPerformed(true);
    setIsDrawerOpen(true);
    setActiveTab('streets'); // Switch to streets tab

    return addresses;

  } else if (addressSubMode === 'polygon') {
    // Polygon mode: Search within drawn polygon
    const activeShape = drawnShapes.find(s => s.id === activePolygonSearchId);

    if (!activeShape) {
      throw new Error('Please draw a polygon first');
    }

    const coords = activeShape.coords;

    const { default: overpassService } = await import('../services/overpassService');

    // Search for addresses within polygon
    const addresses = await overpassService.searchAddressesInPolygon(coords);

    setStreetResults(addresses);
    setSearchPerformed(true);
    setIsDrawerOpen(true);
    setActiveTab('streets');

    return addresses;
  }
};
```

**Rate Limiting**:
- Overpass API: 5-second cooldown between requests
- Timeout: 25 seconds
- Error handling: User-friendly messages for 504, 400, 429

---

### 6. handleAutocompleteSelect() - Location Selection

**Purpose**: Handle user selection from autocomplete dropdown with intelligent map zoom

**Location**: Lines 1920-2050

**This is a critical function - see full implementation in 03-data-flow.md**

**Intelligent Zoom Levels**:
```javascript
// Zoom levels by location type
const zoomLevels = {
  address: 13,    // Street level
  zipcode: 13,    // Street level
  city: 11,       // City level
  county: 9,      // County level
  state: 6,       // State level
  country: 4      // Country level
};

// Special cases
if (searchMode === 'polygon' || (searchMode === 'address' && addressSubMode === 'polygon')) {
  zoomLevel = 15; // Higher zoom for drawing
}
```

**Map Control**:
```javascript
// Direct map control via MapContext
handleResultMapInteraction({
  type: finalLocation.type || 'place',
  result: finalLocation,
  center: [finalLocation.lat, finalLocation.lng],
  zoom: zoomLevel
});
```

---

### 7. handleResetSearch() - Reset Search State

**Purpose**: Clear current search and reset to initial state

**Location**: Lines 2650-2720

```javascript
const handleResetSearch = () => {
  // Clear search parameters
  setSearchTerm('');
  setSearchCenter(null);
  setSearchPerformed(false);
  setIsLoading(false);

  // Clear results
  setResults([]);
  setStreetResults([]);

  // Clear hierarchy selections
  if (searchMode === 'hierarchy') {
    setSelectedState(null);
    setSelectedCounty(null);
    setSelectedCity(null);
    setHierarchyLocations({
      states: hierarchyLocations.states, // Keep states loaded
      counties: [],
      cities: []
    });
  }

  // Clear drawn shapes (polygon mode)
  if (searchMode === 'polygon') {
    clearDrawnShapes();
  }

  // Clear uploads
  if (searchMode === 'upload') {
    setUploadedFile(null);
    setUploadFileName('');
    setUploadedData([]);
  }

  // Clear geocode
  if (searchMode === 'geocode') {
    setGeocodeFile(null);
    setGeocodeFileName('');
    setGeocodeProgress(0);
  }

  // Reset map to initial view
  setMapCenter([39.8283, -98.5795]);
  setMapZoom(4);

  // Clear errors
  clearError();
};
```

---

### 8. executeRadiusSearchFromHistory() - Re-execute Saved Search

**Purpose**: Re-run a saved radius search from history chips

**Location**: Lines 1080-1150

```javascript
const executeRadiusSearchFromHistory = async (searchId) => {
  const search = radiusSearches.find(s => s.id === searchId);

  if (!search) {
    console.error('Search not found:', searchId);
    return;
  }

  setIsLoading(true);

  try {
    // Restore search parameters
    setSearchCenter([search.lat, search.lng]);
    setSearchRadius(search.radius);
    setSearchTerm(search.displayName);

    // Check if cached results are still valid
    const cacheAge = Date.now() - search.timestamp;
    const cacheExpired = cacheAge > 30 * 60 * 1000; // 30 minutes

    let results;

    if (cacheExpired || !search.results) {
      // Re-fetch fresh data
      results = await ZipCodeService.searchWithinRadius({
        lat: search.lat,
        lng: search.lng,
        radius: search.radius
      });

      // Update cache
      const updatedSearch = { ...search, results, timestamp: Date.now() };
      setRadiusSearches(prev => {
        const updated = prev.map(s => s.id === searchId ? updatedSearch : s);
        localStorage.setItem('radiusSearches', JSON.stringify(updated));
        return updated;
      });
    } else {
      // Use cached results
      results = search.results;
    }

    // Update state
    setResults(results);
    setSearchPerformed(true);
    setActiveRadiusSearchId(searchId);
    setIsDrawerOpen(true);

    // Center map on search
    handleResultMapInteraction({
      type: 'place',
      result: { lat: search.lat, lng: search.lng },
      center: [search.lat, search.lng],
      zoom: 13
    });

    return { results, entry: search };

  } catch (error) {
    console.error('Failed to execute search from history:', error);
    setApiError('Failed to load search from history');
  } finally {
    setIsLoading(false);
  }
};
```

**Cache Strategy**:
- Cache results for 30 minutes
- Re-fetch if expired
- Update localStorage cache
- Return both results and search entry

---

## Service Integration

### ZipCodeService

**Primary service for ZIP code searches**

```javascript
import { ZipCodeService } from '../services/zipCodeService';

// Radius search
const results = await ZipCodeService.searchWithinRadius({ lat, lng, radius });

// Polygon search
const results = await ZipCodeService.searchWithinPolygon(coords);

// Hierarchy searches
const results = await ZipCodeService.searchByState(stateCode);
const results = await ZipCodeService.searchByCounty(stateCode, countyName);
const results = await ZipCodeService.searchByCity(stateCode, countyName, cityName);
```

### GeocodingService

**Autocomplete and geocoding**

```javascript
import { GeocodingService } from '../services/geocodingService';

// Autocomplete
const results = await GeocodingService.autocomplete(searchTerm);
// Returns: Google Places → Nominatim fallback

// Get place details
const details = await GeocodingService.getPlaceDetails(placeId);

// Geocode address
const { lat, lng } = await GeocodingService.geocode(address);
```

### OverpassService

**Street address queries**

```javascript
import overpassService from '../services/overpassService';

// Radius search
const addresses = await overpassService.searchAddresses({ lat, lng, radius });

// Polygon search
const addresses = await overpassService.searchAddressesInPolygon(coords);
```

## Context Value Export

**Full Context API** (80+ exports):

```javascript
const value = {
  // === SEARCH MODE ===
  searchMode,
  setSearchMode,

  // === SEARCH PARAMETERS ===
  searchTerm,
  setSearchTerm,
  searchCenter,
  setSearchCenter,
  searchRadius,
  setSearchRadius,
  searchPerformed,
  setSearchPerformed,
  isLoading,
  setIsLoading,

  // === RADIUS SEARCH ===
  radiusSearches,
  setRadiusSearches,
  activeRadiusSearchId,
  setActiveRadiusSearchId,
  executeRadiusSearchFromHistory,
  removeRadiusSearch,

  // === POLYGON SEARCH ===
  polygonSearches,
  setPolygonSearches,
  activePolygonSearchId,
  setActivePolygonSearchId,
  polygonDisplaySettings,
  setPolygonDisplaySettings,
  updatePolygonSearchSettings,
  executePolygonSearchFromHistory,
  removePolygonSearch,

  // === HIERARCHY SEARCH ===
  selectedState,
  setSelectedState,
  selectedCounty,
  setSelectedCounty,
  selectedCity,
  setSelectedCity,
  hierarchyLocations,
  setHierarchyLocations,

  // === ADDRESS SEARCH ===
  addressSubMode,
  setAddressSubMode,
  addressRadius,
  setAddressRadius,

  // === UPLOAD SEARCH ===
  uploadedFile,
  setUploadedFile,
  uploadFileName,
  setUploadFileName,
  uploadedData,
  setUploadedData,

  // === GEOCODE SEARCH ===
  geocodeFile,
  setGeocodeFile,
  geocodeFileName,
  setGeocodeFileName,
  geocodeProgress,
  setGeocodeProgress,

  // === MAP INTEGRATION ===
  mapCenter,
  setMapCenter,
  mapZoom,
  setMapZoom,

  // === SEARCH HISTORY ===
  searchHistory,
  setSearchHistory,
  addSearchToHistory,
  clearSearchHistory,

  // === SEARCH ACTIONS ===
  handleSearch,
  handleRadiusSearch,
  handlePolygonSearch,
  handleHierarchySearch,
  handleAddressSearch,
  handleUploadSearch,
  handleGeocodeSearch,
  handleResetSearch,

  // === AUTOCOMPLETE ===
  handleSearchInputChange,
  handleAutocompleteSelect,
  handleAutocompleteBlur,

  // === FILE UPLOADS ===
  handleCSVUpload,
  handleRemoveFile,
  handleGeocodeCSVUpload,
  handleRemoveGeocodeFile
};
```

## Usage Example

```javascript
import { useSearch } from '../contexts/SearchContext';

function RadiusSearch() {
  const {
    searchTerm,
    searchRadius,
    isLoading,
    setSearchRadius,
    handleSearch,
    handleSearchInputChange,
    handleAutocompleteSelect,
    handleResetSearch
  } = useSearch();

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => handleSearchInputChange(e)}
        placeholder="Search location..."
      />

      <input
        type="number"
        value={searchRadius}
        onChange={(e) => setSearchRadius(Number(e.target.value))}
      />

      <button
        onClick={handleSearch}
        disabled={isLoading}
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>

      <button onClick={handleResetSearch}>
        Reset
      </button>
    </div>
  );
}
```

## Performance Considerations

### 1. Debounced Autocomplete

```javascript
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch.length >= 3) {
    performAutocomplete(debouncedSearch);
  }
}, [debouncedSearch]);
```

### 2. Memoized Search Results

```javascript
const memoizedResults = useMemo(() => {
  return results.filter(r => r.state === selectedState);
}, [results, selectedState]);
```

### 3. Lazy Loading States

```javascript
// Only load counties when state is selected
useEffect(() => {
  if (selectedState) {
    loadCounties(selectedState);
  }
}, [selectedState]);
```

## Testing Strategy

```javascript
describe('SearchContext', () => {
  it('should handle radius search', async () => {
    const { result } = renderHook(() => useSearch(), {
      wrapper: SearchProvider
    });

    await act(async () => {
      result.current.setSearchCenter([40.7128, -74.0060]);
      result.current.setSearchRadius(25);
      await result.current.handleRadiusSearch();
    });

    expect(result.current.searchPerformed).toBe(true);
    expect(result.current.results.length).toBeGreaterThan(0);
  });
});
```

## Related Documentation

- **Data Flow**: `03-data-flow.md`
- **State Management**: `04-state-management.md`
- **MapContext**: `contexts/MapContext.md`
- **ResultsContext**: `contexts/ResultsContext.md`
- **UIContext**: `contexts/UIContext.md`

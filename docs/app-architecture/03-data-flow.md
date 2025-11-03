# Data Flow Architecture

## Overview

GeoSearch Pro follows a unidirectional data flow pattern with clear separation between user actions, state updates, and UI rendering. This document describes how data moves through the application across all search modes and features.

## Core Data Flow Pattern

```
User Action
    ↓
Event Handler (Component)
    ↓
Context Action (SearchContext/MapContext)
    ↓
Service Layer (Data Fetching)
    ↓
External APIs/Database
    ↓
Data Transformation
    ↓
Context State Update
    ↓
Component Re-render
    ↓
UI Update
```

## Search Mode Data Flows

### 1. Radius Search Flow

**User Journey**: Search for ZIP codes within X miles of a location

```
User enters location in autocomplete
    ↓
handleSearchInputChange (SearchContext)
    ↓
GeocodingService.autocomplete()
    ├── Try: Google Places API (session token strategy)
    └── Fallback: Nominatim API
    ↓
UIContext.setAutocompleteResults()
    ↓
User selects location from dropdown
    ↓
handleAutocompleteSelect (SearchContext)
    ↓
Set searchCenter, mapCenter, mapZoom
    ↓
MapContext.handleResultMapInteraction()
    ↓
Map animates to location with intelligent zoom
    ↓
User clicks "Search" button
    ↓
handleSearch (SearchContext)
    ↓
ZipCodeService.searchWithinRadius()
    ├── Try: SupabaseService.searchZipsWithinRadius()
    ├── Fallback: API endpoint
    └── Last Resort: OptimizedStaticService
    ↓
ResultsContext.setResults()
    ↓
MapContext adds markers and boundaries
    ↓
ResultsDrawer displays table
```

**Key Files**:
- `src/contexts/SearchContext.jsx` (lines 1920-2100)
- `src/services/zipCodeService.js`
- `src/services/geocodingService.js`
- `src/services/supabaseService.js`

**API Sequence**:
1. **Autocomplete**: Google Places → Nominatim
2. **ZIP Search**: Supabase → API → Static data
3. **Boundary Loading**: Supabase (on-demand)

### 2. Polygon Search Flow

**User Journey**: Draw custom shape and find ZIP codes within it

```
User searches for location (autocomplete)
    ↓
Map centers on location (zoom: 15)
    ↓
User selects drawing tool (rectangle/circle/polygon)
    ↓
User draws shape on map
    ↓
MapContext.handleShapeDrawn()
    ↓
Validate shape area (<70 sq mi using turf.area())
    ↓
SearchContext.handlePolygonSearch()
    ↓
Extract polygon coordinates
    ↓
ZipCodeService.searchWithinPolygon()
    ↓
SupabaseService.searchZipsWithinPolygon()
    ├── PostGIS ST_Within query
    └── Filter ZIP centroids inside polygon
    ↓
Store in polygonSearches history
    ↓
ResultsContext.setResults()
    ↓
MapContext renders shape overlay + markers
    ↓
Save search to localStorage
```

**Key Files**:
- `src/contexts/SearchContext.jsx` (lines 1650-1850)
- `src/contexts/MapContext.jsx` (lines 180-250)
- `src/components/Search/PolygonSearch.jsx`
- `src/utils/polygonHelpers.js`

**Data Transformations**:
```javascript
// 1. Leaflet shape → GeoJSON coordinates
const coords = layer.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);

// 2. Calculate area with Turf.js
const area = turf.area(turf.polygon([coords]));
const sqMiles = area / 2589988.11; // Convert sq meters to sq miles

// 3. Query Supabase with polygon
const { data } = await supabase
  .from('zip_codes')
  .select('*')
  .overlaps('boundary', geoJSON);
```

### 3. Hierarchy Search Flow

**User Journey**: Navigate State → County → City → ZIP codes

```
User selects search mode: "hierarchy"
    ↓
Load all 50 states (cached in SearchContext)
    ↓
User selects state from dropdown
    ↓
SearchContext.handleSearch({ level: 'state' })
    ↓
ZipCodeService.searchByState()
    ↓
SupabaseService.getZipsByState()
    ↓
Load counties for selected state
    ↓
HierarchyService.getCountiesByState()
    ↓
ResultsContext.setResults() (all ZIPs in state)
    ↓
MapContext zooms to state bounds (zoom: 6)
    ↓
User selects county from dropdown
    ↓
Filter results by county
    ↓
Load cities for selected county
    ↓
HierarchyService.getCitiesByCounty()
    ↓
MapContext zooms to county (zoom: 9)
    ↓
User selects city
    ↓
Filter results to city only
    ↓
MapContext zooms to city (zoom: 11)
```

**Key Files**:
- `src/services/hierarchyService.js`
- `src/components/Search/HierarchySearch.jsx`
- `src/contexts/SearchContext.jsx` (lines 1150-1350)

**State Management**:
```javascript
// Hierarchy state variables
const [selectedState, setSelectedState] = useState(null);
const [selectedCounty, setSelectedCounty] = useState(null);
const [selectedCity, setSelectedCity] = useState(null);
const [hierarchyLocations, setHierarchyLocations] = useState({
  states: [],
  counties: [],
  cities: []
});

// Cascading updates
useEffect(() => {
  if (selectedState) {
    loadCounties(selectedState);
  }
}, [selectedState]);

useEffect(() => {
  if (selectedCounty) {
    loadCities(selectedCounty);
  }
}, [selectedCounty]);
```

### 4. Upload Search Flow

**User Journey**: Upload CSV with ZIP codes to validate and enrich

```
User clicks "Upload CSV" button
    ↓
File picker opens
    ↓
User selects CSV file
    ↓
handleCSVUpload (SearchContext)
    ↓
PapaParse.parse(file)
    ├── Auto-detect headers
    ├── Infer data types
    └── Parse rows
    ↓
Detect ZIP column (looks for 'zip', 'zipcode', 'postal_code')
    ↓
Extract unique ZIP codes
    ↓
ZipCodeService.validateZips()
    ↓
SupabaseService.getZipDetails()
    ├── Batch query (500 at a time)
    └── Match against database
    ↓
Merge CSV data with database data
    ↓
ResultsContext.setResults()
    ├── Found: ZIP codes with full details
    └── Not Found: Original CSV row with 'Invalid ZIP' note
    ↓
MapContext adds markers for found ZIPs
    ↓
Show statistics (X found, Y not found)
```

**Key Files**:
- `src/contexts/SearchContext.jsx` (lines 2150-2350)
- `src/services/csvService.js`
- `src/components/Search/UploadSearch.jsx`
- `src/utils/csvExport.js`

**CSV Processing**:
```javascript
// 1. Parse CSV
Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const headers = Object.keys(results.data[0]);

    // 2. Detect ZIP column
    const zipColumn = headers.find(h =>
      /zip|postal/i.test(h)
    );

    // 3. Extract unique ZIPs
    const zips = [...new Set(
      results.data.map(row => row[zipColumn])
    )];

    // 4. Validate against database
    validateZips(zips);
  }
});
```

### 5. Address Search Flow

**User Journey**: Find street addresses within radius or polygon

**Radius Mode**:
```
User enters location in autocomplete
    ↓
Map centers on location
    ↓
User sets radius (e.g., 5 miles)
    ↓
User clicks "Search for Addresses"
    ↓
SearchContext.handleAddressSearch()
    ↓
Convert radius to bounding box
    ↓
OverpassService.searchAddresses()
    ├── Build Overpass QL query
    ├── Query OpenStreetMap for addresses
    └── Rate limit: 5-second cooldown
    ↓
Parse Overpass XML response
    ↓
Filter addresses within radius (using turf.distance)
    ↓
ResultsContext.setStreetResults()
    ↓
MapContext adds address markers
    ↓
StreetsTable displays results
```

**Polygon Mode**:
```
User draws polygon on map
    ↓
User clicks "Search for Addresses"
    ↓
OverpassService.searchAddresses()
    ├── Polygon bounds query
    └── Timeout: 25 seconds
    ↓
Filter addresses within polygon (turf.booleanPointInPolygon)
    ↓
ResultsContext.setStreetResults()
```

**Key Files**:
- `src/services/overpassService.js`
- `src/contexts/SearchContext.jsx` (lines 1990-2100)
- `src/components/Results/StreetsTable.jsx`

**Overpass Query Example**:
```javascript
const query = `
  [out:json][timeout:25];
  (
    node["addr:housenumber"](${south},${west},${north},${east});
    way["addr:housenumber"](${south},${west},${north},${east});
  );
  out center;
`;
```

### 6. Geocode Search Flow

**User Journey**: Batch geocode addresses from CSV

```
User uploads CSV with addresses
    ↓
PapaParse.parse(file)
    ↓
Detect address columns (street, city, state, zip)
    ↓
User confirms column mappings
    ↓
SearchContext.handleGeocodeSearch()
    ↓
For each address:
    ↓
    GeocodingService.geocode()
    ├── Try: Google Places API
    ├── Fallback: Nominatim
    └── Fallback: Mapbox (if configured)
    ↓
    Rate limiting: 1 request/second for Nominatim
    ↓
    Update progress indicator
    ↓
Collect results with lat/lng
    ↓
ResultsContext.setResults()
    ├── Successful: Address + lat/lng + confidence score
    └── Failed: Address + error message
    ↓
MapContext adds markers for geocoded addresses
    ↓
Export to CSV with new lat/lng columns
```

**Key Files**:
- `src/services/geocodingService.js`
- `src/components/Search/GeocodeSearch.jsx`
- `src/contexts/SearchContext.jsx` (lines 2350-2550)

**Batch Processing**:
```javascript
const geocodeResults = [];
const totalAddresses = addresses.length;

for (let i = 0; i < totalAddresses; i++) {
  const address = addresses[i];

  // Update progress
  setProgress(Math.round((i / totalAddresses) * 100));

  try {
    const result = await GeocodingService.geocode(address);
    geocodeResults.push({
      ...address,
      lat: result.lat,
      lng: result.lng,
      confidence: result.confidence,
      status: 'success'
    });
  } catch (error) {
    geocodeResults.push({
      ...address,
      status: 'failed',
      error: error.message
    });
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## Caching Strategy

### Multi-Layer Cache Architecture

```
Request
    ↓
1. In-Memory Cache (Map<string, any>)
    ├── TTL: 5 minutes
    ├── Storage: RAM
    └── Speed: Instant
    ↓ (if miss)
2. LocalStorage Cache
    ├── TTL: 24 hours
    ├── Storage: Browser
    └── Speed: <10ms
    ↓ (if miss)
3. Supabase Query Cache
    ├── TTL: Server-side
    └── Speed: <200ms
    ↓ (if miss)
4. Database Query
    ├── PostGIS spatial queries
    └── Speed: 500ms-2s
```

**Implementation**:
```javascript
// src/services/cacheService.js
class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  async get(key, fetchFn) {
    // 1. Check memory
    const memCached = this.memoryCache.get(key);
    if (memCached && Date.now() < memCached.expires) {
      return memCached.data;
    }

    // 2. Check localStorage
    const lsCached = localStorage.getItem(key);
    if (lsCached) {
      const parsed = JSON.parse(lsCached);
      if (Date.now() < parsed.expires) {
        // Promote to memory cache
        this.memoryCache.set(key, parsed);
        return parsed.data;
      }
    }

    // 3. Fetch from source
    const data = await fetchFn();

    // 4. Store in all layers
    const cacheEntry = {
      data,
      expires: Date.now() + this.ttl
    };
    this.memoryCache.set(key, cacheEntry);
    localStorage.setItem(key, JSON.stringify(cacheEntry));

    return data;
  }
}
```

**Cache Keys**:
- `radius_${lat}_${lng}_${miles}` - Radius search
- `polygon_${hash(coordinates)}` - Polygon search
- `state_${stateCode}` - Hierarchy search
- `autocomplete_${query}` - Autocomplete results
- `boundaries_${zipCode}` - ZIP boundaries

## State Update Patterns

### Context Update Flow

```
Component Event
    ↓
Context Action Function
    ↓
setState() calls
    ↓
React Re-render Cycle
    ↓
useEffect Triggers (if dependencies changed)
    ↓
Side Effects (API calls, map updates, etc.)
    ↓
Additional setState() calls
    ↓
Final Re-render
```

**Example: Radius Search State Updates**
```javascript
// 1. User clicks Search button
handleSearch() {
  setIsLoading(true);        // Trigger loading spinner
  setSearchPerformed(false); // Reset previous state

  // 2. Fetch data
  const results = await ZipCodeService.searchWithinRadius({
    lat: searchCenter[0],
    lng: searchCenter[1],
    radius: searchRadius
  });

  // 3. Update multiple contexts
  setResults(results);              // ResultsContext
  setSearchPerformed(true);         // SearchContext
  setIsLoading(false);              // SearchContext
  setDrawerOpen(true);              // UIContext
  addMarkersToMap(results);         // MapContext

  // 4. Save to history
  addSearchToHistory({
    mode: 'radius',
    params: { lat, lng, radius },
    timestamp: Date.now()
  });
}
```

### Hierarchical Result Removal

**Pattern**: When removing a parent, remove all children

```javascript
// User clicks "Remove Illinois" from results
removeState(stateCode) {
  setResults(prevResults => {
    return prevResults.filter(result => {
      // Remove state and all its counties/cities/ZIPs
      return result.state !== stateCode;
    });
  });

  // Also update hierarchy selections
  if (selectedState === stateCode) {
    setSelectedState(null);
    setSelectedCounty(null);
    setSelectedCity(null);
  }
}
```

## API Integration Patterns

### Google Places API

**Session Token Strategy** (Cost Optimization):
```javascript
class GooglePlacesService {
  constructor() {
    this.sessionToken = null;
    this.usageCount = this.getUsageFromLocalStorage();
  }

  async autocomplete(input) {
    // Create session token for request sequence
    if (!this.sessionToken) {
      this.sessionToken = new google.maps.places.AutocompleteSessionToken();
    }

    const request = {
      input,
      sessionToken: this.sessionToken
    };

    const predictions = await this.service.getPlacePredictions(request);
    return predictions;
  }

  async getPlaceDetails(placeId) {
    // Use same session token for details
    const details = await this.service.getDetails({
      placeId,
      sessionToken: this.sessionToken
    });

    // Session complete - reset token
    this.sessionToken = null;

    // Track usage
    this.incrementUsage();

    return details;
  }

  incrementUsage() {
    this.usageCount++;
    localStorage.setItem('google_places_usage', this.usageCount);

    // Auto-switch to Nominatim at 90% quota
    if (this.usageCount >= 9500) {
      console.warn('Approaching Google Places quota, using Nominatim');
    }
  }
}
```

### Supabase PostGIS Queries

**Spatial Query Example**:
```javascript
// Search ZIPs within radius
async searchZipsWithinRadius({ lat, lng, radius }) {
  const radiusMeters = radius * 1609.34; // miles to meters

  const { data, error } = await supabase.rpc('zips_within_radius', {
    lat: lat,
    lng: lng,
    radius_meters: radiusMeters
  });

  if (error) throw error;
  return data;
}

// PostgreSQL function (database side)
CREATE OR REPLACE FUNCTION zips_within_radius(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
  zip_code TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    z.zip_code,
    z.city,
    z.state,
    z.latitude,
    z.longitude,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(z.longitude, z.latitude), 4326)::geography
    ) AS distance_meters
  FROM zip_codes z
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(z.longitude, z.latitude), 4326)::geography,
    radius_meters
  )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;
```

### Nominatim Rate Limiting

**1 Request/Second Pattern**:
```javascript
class GeocodingService {
  constructor() {
    this.lastNominatimRequest = 0;
    this.nominatimDelay = 1000; // 1 second
  }

  async nominatimGeocode(address) {
    // Enforce rate limit
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastNominatimRequest;

    if (timeSinceLastRequest < this.nominatimDelay) {
      const waitTime = this.nominatimDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Make request
    const result = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`
    );

    this.lastNominatimRequest = Date.now();
    return result.json();
  }
}
```

## Error Handling Flow

```
API Request
    ↓
Try Primary Service
    ↓
Error Caught
    ↓
Log Warning (console.warn)
    ↓
Try Fallback Service
    ↓
Error Caught Again
    ↓
Log Error (console.error)
    ↓
Set User-Friendly Error Message
    ↓
UIContext.setApiError()
    ↓
Toast Notification Displayed
    ↓
Fallback to Static Data (if available)
```

**Example Implementation**:
```javascript
async search(params) {
  try {
    // Primary: Supabase
    return await supabaseService.searchZips(params);
  } catch (error) {
    console.warn('Supabase failed:', error);

    try {
      // Secondary: API endpoint
      return await this.apiSearch(params);
    } catch (apiError) {
      console.error('API failed:', apiError);

      // User-friendly message
      setApiError('Search service temporarily unavailable. Using cached data.');

      // Tertiary: Static data
      return OptimizedStaticService.search(params);
    }
  }
}
```

## Performance Optimization

### Debounced Search Input

```javascript
// Autocomplete with 300ms debounce
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch.length >= 3) {
    performAutocomplete(debouncedSearch);
  }
}, [debouncedSearch]);
```

### Lazy Loading Boundaries

```javascript
// Only load boundaries when zoomed in
useEffect(() => {
  if (mapZoom >= 10 && results.length > 0) {
    loadZipBoundaries(results.map(r => r.zipCode));
  }
}, [mapZoom, results]);
```

### Virtual Scrolling (Planned)

```javascript
// For 1000+ results
import { useVirtualScroll } from '../hooks/useVirtualScroll';

const { visibleItems, scrollProps } = useVirtualScroll({
  items: results,
  itemHeight: 40,
  overscan: 10
});
```

## Data Export Flow

```
User clicks "Export to CSV"
    ↓
UIContext.setShowExportModal(true)
    ↓
User selects columns to include
    ↓
handleExport (ResultsContext)
    ↓
Filter results based on selections
    ↓
CSVExportService.generateCSV()
    ├── PapaParse.unparse()
    └── Custom column formatting
    ↓
Create Blob
    ↓
Create download link
    ↓
Trigger browser download
    ↓
Filename: `geosearch_${mode}_${timestamp}.csv`
```

## Next Steps

- **Context Details**: See `contexts/` directory
- **Service Implementation**: See `services/` directory
- **Search Mode Specifics**: See `search-modes/` directory
- **State Management Deep Dive**: See `04-state-management.md`

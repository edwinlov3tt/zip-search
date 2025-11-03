# MapContext - Map Visualization & Interaction

## Overview

**File**: `src/contexts/MapContext.jsx` (308 lines)

**Purpose**: MapContext manages all map-related state including map view, drawn shapes, boundary visualization, and map-result interactions. It provides the interface between Leaflet map components and the rest of the application.

**Key Responsibilities**:
- Manage Leaflet map instance and viewport
- Handle drawing tools and drawn shapes
- Load and display boundaries (ZIP, County, State, City, VTD)
- Control marker visibility
- Manage map layer selection (street, satellite, terrain)
- Handle map click events and interactions

## Architecture Position

```
UIContext (presentation)
    ↓
SearchContext (business logic)
    ↓
ResultsContext (data storage)
    ↓
MapContext (visualization) ← YOU ARE HERE
```

## State Variables

### Map State

```javascript
const [mapType, setMapType] = useState('street');
// Values: 'street' | 'satellite' | 'terrain'

const [mapCenter, setMapCenter] = useState([39.8283, -98.5795]);
// Geographic center of contiguous USA

const [mapZoom, setMapZoom] = useState(4);
// Zoom level showing entire USA initially

const [currentViewport, setCurrentViewport] = useState(null);
// Current map viewport { bounds, zoom, center } for boundary loading
```

### Drawing State

```javascript
const [drawnShapes, setDrawnShapes] = useState([]);
// Array of shapes drawn with Leaflet.draw tools

const [isSearchMode, setIsSearchMode] = useState(true);
// true = search mode, false = reset mode (legacy)
```

**DrawnShape Type**:
```javascript
{
  id: number,             // Leaflet layer ID
  layer: L.Layer,         // Leaflet layer object
  type: string            // 'rectangle' | 'circle' | 'polygon' | 'marker'
}
```

### Boundary States

**County Boundaries**:
```javascript
const [showCountyBorders, setShowCountyBorders] = useState(false);
// Toggle county boundary visibility

const [countyBoundaries, setCountyBoundaries] = useState(null);
// GeoJSON data for all US counties

const [selectedCountyBoundary, setSelectedCountyBoundary] = useState(null);
// Currently selected county: { name, state }
```

**ZIP Boundaries**:
```javascript
const [showZipBoundaries, setShowZipBoundaries] = useState(false);
// Toggle ZIP boundary visibility

const [zipBoundariesData, setZipBoundariesData] = useState(null);
// GeoJSON data for loaded ZIP boundaries

const [loadingZipBoundaries, setLoadingZipBoundaries] = useState(false);
// Loading indicator for ZIP boundary fetch

const [focusedZipCode, setFocusedZipCode] = useState(null);
// Currently focused ZIP code (highlights boundary)

const [showOnlyFocusedBoundary, setShowOnlyFocusedBoundary] = useState(false);
// Show only the focused boundary (hides others)
```

**State Boundaries**:
```javascript
const [showStateBoundaries, setShowStateBoundaries] = useState(false);
// Toggle state boundary visibility

const [stateBoundariesData, setStateBoundariesData] = useState(null);
// GeoJSON data for state boundaries

const [loadingStateBoundaries, setLoadingStateBoundaries] = useState(false);
// Loading indicator
```

**City Boundaries**:
```javascript
const [showCityBoundaries, setShowCityBoundaries] = useState(false);
// Toggle city boundary visibility

const [cityBoundariesData, setCityBoundariesData] = useState(null);
// GeoJSON data for city boundaries

const [loadingCityBoundaries, setLoadingCityBoundaries] = useState(false);
// Loading indicator
```

**VTD (Voting District) Boundaries**:
```javascript
const [showVtdBoundaries, setShowVtdBoundaries] = useState(false);
// Toggle VTD boundary visibility

const [vtdBoundariesData, setVtdBoundariesData] = useState(null);
// GeoJSON data for VTD boundaries

const [loadingVtdBoundaries, setLoadingVtdBoundaries] = useState(false);
// Loading indicator

const [focusedVtd, setFocusedVtd] = useState(null);
// Currently focused VTD
```

### UI State

```javascript
const [showMapLayers, setShowMapLayers] = useState(false);
// Toggle map layer selector dropdown

const [showMarkers, setShowMarkers] = useState(true);
// Toggle marker visibility on map
```

### Refs

```javascript
const mapRef = useRef(null);
// Leaflet map instance reference

const markersRef = useRef({});
// Map of marker IDs to marker objects

const featureGroupRef = useRef(null);
// Leaflet feature group for drawn items
```

### Callbacks

```javascript
const [mapClickCallback, setMapClickCallback] = useState(null);
// Callback function for map click events (radius placement)

const [onShapeCreatedCallback, setOnShapeCreatedCallback] = useState(null);
// Callback triggered when shape is drawn

const [onShapeDeletedCallback, setOnShapeDeletedCallback] = useState(null);
// Callback triggered when shape is deleted
```

## Key Functions

### 1. handleResultMapInteraction() - Direct Map Control

**Purpose**: Center and zoom map in response to user actions, with type-specific behavior

**Location**: Lines 71-114

**Signature**:
```javascript
handleResultMapInteraction({
  type,      // 'zip' | 'city' | 'county' | 'state' | 'place' | 'fitBounds'
  result,    // Result object with lat/lng
  center,    // [lat, lng]
  zoom,      // Zoom level
  bounds,    // For fitBounds type
  padding    // Padding for fitBounds
})
```

**Implementation**:
```javascript
const handleResultMapInteraction = useCallback(async ({ type, result, center, zoom, bounds, padding }) => {
  if (!mapRef.current) return;

  // Special handling for fitBounds
  if (type === 'fitBounds' && bounds) {
    mapRef.current.fitBounds(bounds, {
      animate: true,
      padding: padding || 50
    });
    setFocusedZipCode(null);
    return;
  }

  // Set map view with animation
  mapRef.current.setView(center, zoom, { animate: true });

  // Type-specific actions
  switch (type) {
    case 'zip':
      // Show ZIP boundary
      setFocusedZipCode(result.zipCode);
      setShowZipBoundaries(prev => prev || true);
      break;

    case 'city':
      // Clear ZIP focus
      setFocusedZipCode(null);
      break;

    case 'county':
      // Show county boundary
      setFocusedZipCode(null);
      setShowCountyBorders(true);
      setSelectedCountyBoundary({
        name: result.name,
        state: result.state
      });
      break;

    case 'state':
      // Show state boundary
      setFocusedZipCode(null);
      setShowStateBoundaries(prev => prev || true);
      break;
  }
}, []);
```

**Usage Example**:
```javascript
// From SearchContext autocomplete select
handleResultMapInteraction({
  type: 'city',
  result: { lat: 40.7128, lng: -74.0060, name: 'New York' },
  center: [40.7128, -74.0060],
  zoom: 11
});

// From ResultsContext to fit all results
handleResultMapInteraction({
  type: 'fitBounds',
  bounds: [[minLat, minLng], [maxLat, maxLng]],
  padding: 50
});
```

---

### 2. onCreated() - Shape Drawing Handler

**Purpose**: Handle creation of shapes via Leaflet.draw tools

**Location**: Lines 125-134

**Implementation**:
```javascript
const onCreated = useCallback((e) => {
  const { layer, layerType } = e;

  // Create shape object
  const newShape = {
    layer,
    type: layerType,
    id: layer._leaflet_id
  };

  // Add to shapes array
  setDrawnShapes(prev => [...prev, newShape]);

  // Trigger search callback if set
  if (onShapeCreatedCallback) {
    onShapeCreatedCallback(newShape);
  }
}, [onShapeCreatedCallback]);
```

**Integration with SearchContext**:
```javascript
// In GeoApplication.jsx
const { setOnShapeCreatedCallback } = useMap();
const { handlePolygonSearch } = useSearch();

useEffect(() => {
  setOnShapeCreatedCallback((shape) => {
    handlePolygonSearch(shape.layer, shape.type);
  });
}, []);
```

---

### 3. onDeleted() - Shape Deletion Handler

**Purpose**: Handle deletion of shapes via Leaflet.draw delete tool

**Location**: Lines 136-158

**Implementation**:
```javascript
const onDeleted = useCallback((e) => {
  const { layers } = e;
  const deletedIds = [];
  const deletedShapes = [];

  // Collect deleted layers
  layers.eachLayer((layer) => {
    deletedIds.push(layer._leaflet_id);

    // Find shape being deleted
    const shape = drawnShapes.find(s => s.layer._leaflet_id === layer._leaflet_id);
    if (shape) {
      deletedShapes.push(shape);
    }
  });

  // Remove from state
  setDrawnShapes(prev =>
    prev.filter(shape => !deletedIds.includes(shape.layer._leaflet_id))
  );

  // Notify callback
  if (onShapeDeletedCallback && deletedShapes.length > 0) {
    onShapeDeletedCallback(deletedShapes);
  }
}, [drawnShapes, onShapeDeletedCallback]);
```

**SearchContext Integration**:
```javascript
// Automatically remove search results when shape is deleted
setOnShapeDeletedCallback((deletedShapes) => {
  deletedShapes.forEach(shape => {
    const shapeId = `polygon_${shape.id}`;
    removePolygonSearch(shapeId);
  });
});
```

---

### 4. loadCountyBoundaries() - County Boundary Loader

**Purpose**: Load US county boundaries from static GeoJSON file

**Location**: Lines 161-176

**Implementation**:
```javascript
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
```

**Auto-loading Effect**:
```javascript
useEffect(() => {
  if (showCountyBorders && !countyBoundaries) {
    loadCountyBoundaries();
  }
}, [showCountyBorders, countyBoundaries, loadCountyBoundaries]);
```

**File Structure**:
```
public/
  boundaries/
    us-counties.geojson  (~20 MB)
    us-states.geojson    (~500 KB)
```

---

### 5. handleMapClick() - Map Click Handler

**Purpose**: Handle map click events for radius placement or other actions

**Location**: Lines 64-68

**Implementation**:
```javascript
const handleMapClick = useCallback((e) => {
  if (e && e.latlng && mapClickCallback) {
    mapClickCallback(e.latlng);
  }
}, [mapClickCallback]);
```

**Usage Example**:
```javascript
// In RadiusSearch component
const { setMapClickCallback } = useMap();

useEffect(() => {
  setMapClickCallback((latlng) => {
    setSearchCenter([latlng.lat, latlng.lng]);
    setSearchTerm(`${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
  });

  return () => setMapClickCallback(null); // Cleanup
}, []);
```

---

### 6. handleViewportChange() - Viewport Change Handler

**Purpose**: Track map viewport for on-demand boundary loading

**Location**: Lines 117-119

**Implementation**:
```javascript
const handleViewportChange = useCallback((viewport) => {
  setCurrentViewport(viewport);
}, []);
```

**Viewport-Based Boundary Loading**:
```javascript
// In GeoApplication.jsx
const { currentViewport, showZipBoundaries } = useMap();

useEffect(() => {
  if (currentViewport && showZipBoundaries && currentViewport.zoom >= 10) {
    // Load ZIP boundaries for visible area
    const visibleZips = getZipsInViewport(currentViewport);
    loadZipBoundaries(visibleZips);
  }
}, [currentViewport, showZipBoundaries]);
```

---

## Boundary Loading Strategy

### Lazy Loading Pattern

**Problem**: Loading all boundaries at once is slow and memory-intensive

**Solution**: Load boundaries on-demand based on:
1. User toggling boundary visibility
2. Map zoom level (only load when zoomed in)
3. Visible viewport (only load visible features)
4. Search results (only load relevant boundaries)

**Example: ZIP Boundary Loading**
```javascript
// In GeoApplication.jsx
useEffect(() => {
  if (showZipBoundaries && zipResults.length > 0 && mapZoom >= 10) {
    // Only load boundaries for search results when zoomed in
    const zipCodes = zipResults.map(r => r.zipCode);
    loadZipBoundaries(zipCodes);
  }
}, [showZipBoundaries, zipResults, mapZoom]);
```

### Service Integration

```javascript
import zipBoundariesService from '../services/zipBoundariesService';
import stateBoundariesService from '../services/stateBoundariesService';

// Load ZIP boundaries
const boundaries = await zipBoundariesService.getBoundaries(zipCodes);
setZipBoundariesData(boundaries);

// Load state boundaries
const stateData = await stateBoundariesService.getStateBoundary(stateCode);
setStateBoundariesData(stateData);
```

---

## Marker Management

### Marker Refs Pattern

**Purpose**: Store marker references for popup control and cleanup

```javascript
const markersRef = useRef({});

// Add marker
const marker = L.marker([lat, lng], { icon: customIcon })
  .addTo(mapRef.current);

markersRef.current[`zip-${zipCode}`] = marker;

// Open popup
const marker = markersRef.current[`zip-${zipCode}`];
if (marker) {
  marker.openPopup();
}

// Cleanup
Object.values(markersRef.current).forEach(marker => {
  mapRef.current.removeLayer(marker);
});
markersRef.current = {};
```

### Marker Visibility Toggle

```javascript
const { showMarkers } = useMap();

useEffect(() => {
  Object.values(markersRef.current).forEach(marker => {
    if (showMarkers) {
      marker.addTo(mapRef.current);
    } else {
      mapRef.current.removeLayer(marker);
    }
  });
}, [showMarkers]);
```

---

## Map Layer Types

### Layer Configuration

```javascript
const layers = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri'
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap contributors'
  }
};

const { mapType } = useMap();
const currentLayer = layers[mapType];
```

### Layer Switching

```javascript
const { setMapType } = useMap();

<button onClick={() => setMapType('satellite')}>
  Satellite View
</button>
```

---

## Context Value Export

**Full API** (60+ exports):

```javascript
const value = {
  // === MAP STATE ===
  mapType,
  setMapType,
  mapCenter,
  setMapCenter,
  mapZoom,
  setMapZoom,
  currentViewport,
  setCurrentViewport,

  // === DRAWING ===
  drawnShapes,
  setDrawnShapes,
  isSearchMode,
  setIsSearchMode,

  // === COUNTY BOUNDARIES ===
  showCountyBorders,
  setShowCountyBorders,
  countyBoundaries,
  setCountyBoundaries,
  selectedCountyBoundary,
  setSelectedCountyBoundary,

  // === ZIP BOUNDARIES ===
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

  // === STATE BOUNDARIES ===
  showStateBoundaries,
  setShowStateBoundaries,
  stateBoundariesData,
  setStateBoundariesData,
  loadingStateBoundaries,
  setLoadingStateBoundaries,

  // === CITY BOUNDARIES ===
  showCityBoundaries,
  setShowCityBoundaries,
  cityBoundariesData,
  setCityBoundariesData,
  loadingCityBoundaries,
  setLoadingCityBoundaries,

  // === VTD BOUNDARIES ===
  showVtdBoundaries,
  setShowVtdBoundaries,
  vtdBoundariesData,
  setVtdBoundariesData,
  loadingVtdBoundaries,
  setLoadingVtdBoundaries,
  focusedVtd,
  setFocusedVtd,

  // === UI ===
  showMapLayers,
  setShowMapLayers,
  showMarkers,
  setShowMarkers,

  // === REFS ===
  mapRef,
  markersRef,
  featureGroupRef,

  // === HANDLERS ===
  handleMapClick,
  handleViewportChange,
  onCreated,
  onDeleted,
  setMapClickCallback,
  setOnShapeCreatedCallback,
  setOnShapeDeletedCallback,
  handleResultMapInteraction
};
```

---

## Usage Example

```javascript
import { useMap } from '../contexts/MapContext';

function MapControls() {
  const {
    mapType,
    setMapType,
    showZipBoundaries,
    setShowZipBoundaries,
    showMarkers,
    setShowMarkers,
    mapZoom
  } = useMap();

  return (
    <div>
      {/* Map Layer Selector */}
      <select value={mapType} onChange={(e) => setMapType(e.target.value)}>
        <option value="street">Street</option>
        <option value="satellite">Satellite</option>
        <option value="terrain">Terrain</option>
      </select>

      {/* Boundary Toggles */}
      <label>
        <input
          type="checkbox"
          checked={showZipBoundaries}
          onChange={(e) => setShowZipBoundaries(e.target.checked)}
          disabled={mapZoom < 10}
        />
        Show ZIP Boundaries {mapZoom < 10 && '(zoom in)'}
      </label>

      {/* Marker Toggle */}
      <label>
        <input
          type="checkbox"
          checked={showMarkers}
          onChange={(e) => setShowMarkers(e.target.checked)}
        />
        Show Markers
      </label>
    </div>
  );
}
```

---

## Performance Considerations

### 1. Viewport-Based Loading

Only load boundaries for visible area:

```javascript
const getVisibleZips = (viewport, results) => {
  const { bounds } = viewport;
  return results.filter(r => {
    return r.lat >= bounds.south &&
           r.lat <= bounds.north &&
           r.lng >= bounds.west &&
           r.lng <= bounds.east;
  });
};
```

### 2. Zoom-Based Feature Loading

Different features at different zoom levels:

```javascript
// Zoom: 1-5 (country level) - Show state boundaries only
// Zoom: 6-9 (state level) - Show county boundaries
// Zoom: 10-12 (city level) - Show ZIP boundaries
// Zoom: 13+ (street level) - Show full detail + markers
```

### 3. Boundary Simplification

Use simplified GeoJSON for lower zoom levels:

```javascript
const boundaryUrl = mapZoom < 8
  ? '/boundaries/us-counties-simplified.geojson'  // 2 MB
  : '/boundaries/us-counties-full.geojson';        // 20 MB
```

---

## Integration with Leaflet

### Map Initialization

```javascript
import { MapContainer, TileLayer } from 'react-leaflet';

function MapComponent() {
  const { mapRef, mapCenter, mapZoom, mapType, setMapCenter, setMapZoom } = useMap();

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      ref={mapRef}
      whenCreated={(map) => {
        mapRef.current = map;
      }}
    >
      <TileLayer
        url={layers[mapType].url}
        attribution={layers[mapType].attribution}
      />
    </MapContainer>
  );
}
```

### Drawing Tools

```javascript
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';

function DrawingTools() {
  const { onCreated, onDeleted, featureGroupRef } = useMap();

  return (
    <FeatureGroup ref={featureGroupRef}>
      <EditControl
        position="topright"
        onCreated={onCreated}
        onDeleted={onDeleted}
        draw={{
          rectangle: true,
          circle: true,
          polygon: true,
          marker: false,
          polyline: false,
          circlemarker: false
        }}
      />
    </FeatureGroup>
  );
}
```

---

## Testing Strategy

```javascript
describe('MapContext', () => {
  it('should handle result map interaction', () => {
    const { result } = renderHook(() => useMap(), {
      wrapper: MapProvider
    });

    act(() => {
      result.current.handleResultMapInteraction({
        type: 'zip',
        result: { zipCode: '60601' },
        center: [41.8781, -87.6298],
        zoom: 13
      });
    });

    expect(result.current.focusedZipCode).toBe('60601');
    expect(result.current.showZipBoundaries).toBe(true);
  });
});
```

---

## Related Documentation

- **SearchContext**: `contexts/SearchContext.md`
- **ResultsContext**: `contexts/ResultsContext.md`
- **UIContext**: `contexts/UIContext.md`
- **Data Flow**: `03-data-flow.md`
- **State Management**: `04-state-management.md`

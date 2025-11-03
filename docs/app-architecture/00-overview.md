# GeoSearch Pro - Application Overview

## Purpose

GeoSearch Pro is a comprehensive React-based geographic search application that enables users to discover and analyze ZIP codes, cities, counties, and street addresses across the United States using multiple search methodologies and interactive mapping.

## Core Capabilities

### 1. **Six Search Modes**
- **Radius Search**: Find ZIP codes within a specified distance from a point
- **Polygon Search**: Draw custom shapes and find ZIP codes within them
- **Hierarchy Search**: Navigate State → County → City hierarchy
- **Upload Search**: Batch search via CSV upload
- **Address Search**: Find street addresses within radius or polygon
- **Geocode Search**: Batch geocode addresses from CSV

### 2. **Interactive Mapping**
- Real-time Leaflet-based mapping with drawing tools
- Boundary visualization (ZIP, State, City, County, VTD)
- Multiple map layers (Street, Satellite, Terrain)
- Click-to-search functionality
- Smart zoom based on search type

### 3. **Data Management**
- Import/Export via CSV
- Custom column selection
- Search history with re-execution
- Hierarchical result removal
- Copy to clipboard functionality

### 4. **Advanced Features**
- Google Places autocomplete with intelligent fallbacks
- Real-time boundary loading based on viewport
- Multi-layer caching (in-memory + localStorage)
- Quota management for external APIs
- Dark mode support

## User Personas

### 1. **Marketing Professionals**
- **Need**: Target ZIP codes for campaigns
- **Use**: Radius search around store locations, export lists

### 2. **Data Analysts**
- **Need**: Geographic data enrichment
- **Use**: Geocode search for address validation, CSV import/export

### 3. **Researchers**
- **Need**: Demographic boundary analysis
- **Use**: Hierarchy search, boundary visualization

### 4. **Logistics Planners**
- **Need**: Service area mapping
- **Use**: Polygon search to define custom delivery zones

## Key Features at a Glance

| Feature | Description |
|---------|-------------|
| **Search Modes** | 6 distinct search methodologies |
| **Data Sources** | Supabase (PostgreSQL/PostGIS), Nominatim, Google Places, Overpass API |
| **Boundary Types** | ZIP, State, City, County, VTD (Voting Districts) |
| **Autocomplete** | Google Places (10K/month free) with Nominatim fallback |
| **Map Library** | Leaflet with react-leaflet and leaflet-draw |
| **State Management** | 4 Context providers (Search, Map, Results, UI) |
| **Caching** | Multi-layer: in-memory + localStorage + query cache |
| **Export Formats** | CSV (simple/custom), Clipboard |
| **Import Formats** | CSV with intelligent column detection |
| **Search History** | Persistent chip-based UI per search mode |

## Application Statistics

```
Codebase Size:        76 source files
React Components:     40+ components
Services:            16 services (data, geocoding, boundaries)
Context Providers:   4 (Search, Map, Results, UI)
Custom Hooks:        5 (debounce, localStorage, resize, geolocation, virtualScroll)
Utility Modules:     7 (polygons, CSV, exports, geo helpers, diagnostics)
Lines of Code:       ~15,000 LOC
```

## Technology Stack

### Frontend
- **Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.2
- **Styling**: Tailwind CSS 4.1.13
- **Mapping**: Leaflet 1.9.4, react-leaflet 5.0.0, leaflet-draw
- **Icons**: Lucide React 0.544.0

### Data Processing
- **Geo Libraries**: @turf/turf 7.2.0 (spatial operations)
- **CSV Parser**: PapaParse 5.5.3
- **HTTP Client**: Native fetch API

### Backend Services
- **Primary Database**: Supabase (PostgreSQL + PostGIS)
- **Geocoding**: Google Places API, Nominatim
- **Address Data**: Overpass API (OpenStreetMap)
- **Map Tiles**: OpenStreetMap, Mapbox (optional)

## Architecture Highlights

### Context-Based State Management
```
UIContext (UI state)
    ↓
SearchContext (search operations)
    ↓
ResultsContext (search results)
    ↓
MapContext (map state & interactions)
```

### Service Layer with Fallbacks
```
Primary (Supabase) → Secondary (API) → Tertiary (Static Data)
```

### Component Composition
```
GeoApplicationNew (root)
    ├── SearchModeToggle
    ├── SearchControls
    │   ├── RadiusSearch
    │   ├── PolygonSearch
    │   ├── HierarchySearch
    │   ├── UploadSearch
    │   ├── AddressSearch
    │   └── GeocodeSearch
    ├── MapContainer
    │   ├── BoundaryManager
    │   └── MapLayerSelector
    └── ResultsDrawer
        ├── DrawerTabs
        ├── ResultsTable
        └── StreetsTable
```

## Use Case Examples

### Example 1: Store Radius Search
1. User selects "Radius Search" mode
2. Types store address in autocomplete
3. Selects from dropdown (map zooms to location)
4. Sets 25-mile radius
5. Clicks "Search"
6. Views 200+ ZIP codes in results table
7. Exports to CSV for marketing campaign

### Example 2: Custom Service Area
1. User selects "Polygon Search" mode
2. Uses drawing tools to outline service territory
3. Application validates area (must be <70 sq mi)
4. Searches for ZIP codes within polygon
5. Saves search to history
6. Re-executes later with updated parameters

### Example 3: Batch Geocoding
1. User selects "Geocode Search" mode
2. Uploads CSV with 500 addresses
3. Application detects address columns automatically
4. User confirms column mappings
5. Batch geocoding runs with progress indicator
6. Results show: 485 found, 15 not found
7. Exports geocoded results with lat/lng

## Performance Characteristics

- **Search Speed**: <2s for most searches (depends on dataset size)
- **Map Rendering**: Handles 10,000+ markers with good performance
- **Boundary Loading**: Viewport-based lazy loading
- **Cache Hit Rate**: ~80% for repeated searches
- **Autocomplete Latency**: <500ms with Google Places, <2s with Nominatim

## Browser Support

- **Chrome**: 90+ ✅
- **Firefox**: 88+ ✅
- **Safari**: 14+ ✅
- **Edge**: 90+ ✅
- **Mobile**: iOS Safari 14+, Chrome Android 90+

## API Dependencies

| API | Purpose | Rate Limit | Cost |
|-----|---------|-----------|------|
| Supabase | Primary data source | None (self-hosted) | Free tier: 500MB DB |
| Google Places | Autocomplete | 10,000/month free | $17/1K requests after |
| Nominatim | Geocoding fallback | 1 req/sec | Free |
| Overpass API | Street addresses | 5 sec cooldown | Free |
| Mapbox (optional) | Premium geocoding | Usage-based | Pay as you go |

## Data Flow Overview

```
User Input
    ↓
SearchContext (orchestration)
    ↓
Service Layer (data fetching)
    ↓
API/Database (external data)
    ↓
Data Transformation (formatting)
    ↓
ResultsContext (storage)
    ↓
MapContext (visualization)
    ↓
Components (rendering)
```

## Next Steps

- **Architecture Details**: See `01-architecture-principles.md`
- **State Management**: See `04-state-management.md`
- **Search Modes**: See `search-modes/` directory
- **Services**: See `services/` directory
- **Components**: See `components/` directory

## Related Documentation

- **Setup Guide**: `docs/SUPABASE_SETUP.md`, `docs/MAPBOX_SETUP.md`
- **API Documentation**: `docs/API_QUICKSTART.md`
- **Developer Guide**: `docs/developer-guides/getting-started.md` (coming soon)
- **Project Info**: `docs/PROJECT_INFO.md`

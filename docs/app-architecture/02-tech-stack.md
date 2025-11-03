# Technology Stack

## Frontend Framework

### React 19.1.1
- **Why**: Industry standard, large ecosystem, component-based
- **Alternatives Considered**: Vue (less ecosystem), Svelte (smaller community)
- **Key Features Used**: Hooks, Context API, Suspense, Error Boundaries (planned)

### Vite 7.1.2
- **Why**: Lightning-fast HMR (<200ms), modern ESM-based
- **Dev Server**: ~200ms startup vs CRA's ~30s
- **Build Time**: 20s production build
- **Alternatives Considered**: Create React App (deprecated), Webpack (slower)

## Styling

### Tailwind CSS 4.1.13
- **Why**: Utility-first, no CSS files to maintain, consistent design
- **Configuration**: `tailwind.config.js`, `postcss.config.js`
- **Dark Mode**: `class` strategy for user toggle
- **Custom Colors**: Extended palette in config

## Mapping

### Leaflet 1.9.4
- **Why**: Open-source, free, highly customizable
- **Size**: ~40KB (vs Google Maps ~150KB)
- **Plugins Used**:
  - `react-leaflet` 5.0.0 - React integration
  - `leaflet-draw` - Drawing tools (rectangle, polygon, circle)
- **Tile Providers**: OpenStreetMap (free), Mapbox (optional premium)

## Data Processing

### @turf/turf 7.2.0
- **Purpose**: Geospatial analysis (area calculation, bounds, simplification)
- **Key Functions**:
  - `turf.area()` - Polygon area in sq meters
  - `turf.bbox()` - Bounding box calculation
  - `turf.simplify()` - Geometry simplification
- **Bundle Size**: 200KB (consider tree-shaking specific functions)

### PapaParse 5.5.3
- **Purpose**: CSV parsing and generation
- **Features**: Auto-detect headers, type inference, streaming for large files
- **Used For**: Upload Search, Geocode Search, CSV exports

## UI Components

### Lucide React 0.544.0
- **Why**: Lightweight (tree-shakable), consistent design, 1000+ icons
- **Icons Used**: Search, MapPin, Upload, Download, X, RotateCcw, ChevronDown, etc.
- **Size**: Only imports used icons (~2KB per icon)

## Backend Services

### Supabase
- **Database**: PostgreSQL 15+ with PostGIS extension
- **Purpose**: Primary data source for ZIP codes, boundaries
- **Features Used**:
  - Spatial queries (`ST_Distance`, `ST_Within`)
  - Client-side filtering
  - Row Level Security (RLS)
- **Caching**: 5-minute TTL in-memory cache

### Google Places API
- **Purpose**: Autocomplete for location search
- **Quota**: 10,000 requests/month free (session token strategy)
- **Usage Tracking**: Client-side in localStorage
- **Auto-Switch**: Falls back to Nominatim at 9,500 requests

### Nominatim (OpenStreetMap)
- **Purpose**: Geocoding fallback
- **Rate Limit**: 1 request/second
- **Cost**: Free
- **Cache**: 10-minute TTL

### Overpass API (OpenStreetMap)
- **Purpose**: Street address queries
- **Rate Limit**: 5-second cooldown between requests
- **Query Language**: Overpass QL
- **Timeout**: 25-second abort

### Mapbox Geocoding API (Optional)
- **Purpose**: Premium geocoding for higher accuracy
- **Cost**: Pay-as-you-go
- **Usage**: Can be swapped in for Nominatim

## Development Tools

### ESLint 9
- **Config**: `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`
- **Purpose**: Code quality, catch bugs, enforce patterns
- **Run**: `npm run lint`

### Node.js
- **Version**: 18+ recommended
- **Purpose**: Dev server, build process

## Deployment

### Vercel
- **Config**: `vercel.json`
- **Build Command**: `npm run build`
- **Output Directory**: `dist/`
- **Environment Variables**: Set via Vercel dashboard

## Package.json Dependencies

```json
{
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0",
    "leaflet-draw": "^1.0.4",
    "@turf/turf": "^7.2.0",
    "lucide-react": "^0.544.0",
    "papaparse": "^5.5.3",
    "@supabase/supabase-js": "^2.47.10"
  },
  "devDependencies": {
    "vite": "^7.1.2",
    "tailwindcss": "^4.1.13",
    "eslint": "^9.18.0"
  }
}
```

## Browser APIs Used

- **Fetch API**: HTTP requests
- **LocalStorage**: Caching, quota tracking, preferences
- **Geolocation API**: User location (optional)
- **Clipboard API**: Copy results

## Bundle Size Analysis

```
Total:          ~800KB (uncompressed)
React:          ~140KB
Leaflet:        ~140KB
Turf.js:        ~200KB
Application:    ~320KB
```

**Optimization Opportunities**:
- Tree-shake @turf/turf (import specific functions)
- Code-split heavy components
- Lazy load modals
- CDN for Leaflet

# Architecture Overview

GeoSearch Pro - A React-based geographic search application for ZIP codes, cities, and counties.

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 19.1.1 + Vite 7.1.2 | SPA with HMR development |
| Styling | Tailwind CSS 4.1.13 | Utility-first CSS framework |
| Mapping | Leaflet 1.9.4 + react-leaflet 5.0.0 | Interactive maps and drawing |
| Geo Processing | @turf/turf 7.2.0 | Spatial analysis and calculations |
| Database | Supabase (PostgreSQL + PostGIS) | Primary data storage |
| Caching | Upstash Redis | Rate limiting and caching |
| Hosting | Vercel (main) + Cloudflare Workers (APIs) | Serverless deployment |
| Icons | Lucide React 0.544.0 | UI icons |
| CSV | PapaParse 5.5.3 | CSV parsing for uploads |

## Directory Structure

```
zip-search/
├── src/                      # Main application source
│   ├── contexts/             # React Context providers (4 files, ~5000 lines)
│   │   ├── SearchContext.jsx # Search orchestration (~3000 lines)
│   │   ├── MapContext.jsx    # Map state and boundaries
│   │   ├── ResultsContext.jsx# Data storage and filtering
│   │   └── UIContext.jsx     # Presentation state
│   ├── components/           # React components
│   │   ├── Map/              # Map, markers, boundaries, layers
│   │   ├── Search/           # Search mode components
│   │   ├── Results/          # Results drawer and tables
│   │   ├── Modals/           # Share, export, upload modals
│   │   └── Header/           # App header
│   ├── services/             # API and data services
│   │   ├── zipCodeService.js # ZIP code data access
│   │   ├── geocodingService.js# Autocomplete and geocoding
│   │   ├── zipBoundariesService.js
│   │   └── [other services]
│   ├── hooks/                # Custom React hooks
│   └── utils/                # Utility functions
├── workers/                  # Cloudflare Workers
│   ├── address-api/          # Address search API
│   └── share-api/            # Share/link generation API
├── api/                      # Express dev server (local)
├── docs/                     # Existing architecture docs
│   └── app-architecture/     # Detailed context provider docs
├── public/                   # Static assets
│   └── boundaries/           # GeoJSON boundary files
├── scripts/                  # Build/data scripts
├── supabase/                 # Supabase config
└── .claude/                  # Claude Code config & docs
    ├── commands/             # Slash commands
    └── docs/                 # This documentation
```

## Key Components

### Four-Layer Context Architecture
- **UIContext**: Drawer, modals, tabs, dark mode, autocomplete state
- **SearchContext**: Search params, mode, radius, history, loading states
- **ResultsContext**: ZIP/city/address results, hierarchical operations, export
- **MapContext**: Map view, boundaries, markers, drawn shapes, layers

### Six Search Modes
1. **Radius Search** - Find ZIPs within X miles of a point
2. **Polygon Search** - Draw shapes and find ZIPs within
3. **Hierarchy Search** - Navigate State → County → City → ZIPs
4. **Upload Search** - Batch search via CSV upload
5. **Address Search** - Find street addresses within radius/polygon
6. **Geocode Search** - Batch geocode addresses from CSV

### Service Layer Pattern
- Pure functions/classes separate from React components
- Fallback chain: Supabase → API → Static data
- Multi-layer caching (in-memory + localStorage + query cache)

## Data Flow

```
User Action → SearchContext → Service Layer → Supabase/API
                   ↓
            ResultsContext (stores data)
                   ↓
            MapContext (visualizes on map)
                   ↓
            UIContext (controls drawer/display)
```

## External Services

| Service | Purpose | Docs |
|---------|---------|------|
| Supabase | Primary database (ZIP codes, boundaries) | `.claude/docs/services/supabase.md` |
| Google Places API | Autocomplete (10K/month free) | `.claude/docs/services/google-places.md` |
| Nominatim | Geocoding fallback (OpenStreetMap) | `.claude/docs/services/nominatim.md` |
| Overpass API | Street address data (OpenStreetMap) | `.claude/docs/services/overpass.md` |
| Upstash Redis | Rate limiting | `.claude/docs/services/upstash.md` |
| Cloudflare Workers | Address API, Share API | `.claude/docs/services/cloudflare.md` |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Places autocomplete | Yes |
| `VITE_MAPBOX_ACCESS_TOKEN` | Mapbox satellite tiles | No |
| `VITE_API_URL` | API base URL | No |
| `VITE_GEO_API_BASE` | Geo API base URL | No |
| `VITE_ENV` | Environment (dev/prod) | No |
| `VITE_API_TIMEOUT` | API timeout in ms | No |

## Deployment

### Production
- **Platform**: Vercel
- **URL**: (configured in Vercel dashboard)
- **Deploy**: Auto-deploy on push to main

### Workers (APIs)
- **Platform**: Cloudflare Workers
- **Address API**: `workers/address-api/`
- **Share API**: `workers/share-api/`

## Security Considerations

- Authentication: Supabase anon key (RLS policies for data access)
- Authorization: Row-level security on Supabase tables
- Secrets: Environment variables (not committed)
- CORS: Configured for allowed origins

## Performance Notes

- **Caching**: Multi-layer (in-memory, localStorage, React Query)
- **Rate limits**: Upstash Redis for API rate limiting
- **Known optimizations**:
  - Boundary data loaded on-demand by viewport
  - Results paginated for large datasets
  - Map markers limited to prevent browser hang (max 5000)

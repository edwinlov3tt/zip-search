# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based geographic search application built with Vite that allows users to search for ZIP codes, cities, and counties with radius-based and hierarchical search capabilities. The application features a map view and results drawer for displaying search data.

## Development Commands

### Core Commands
```bash
npm run dev        # Start Vite dev server on http://localhost:5173
npm run build      # Build for production (outputs to dist/)
npm run preview    # Preview production build locally
npm run lint       # Run ESLint checks
```

### Quick Start
```bash
npm install        # Install all dependencies
npm run dev        # Start development server
```

## Project Architecture

### Comprehensive Documentation

**For detailed architecture information, see `docs/app-architecture/`**

This folder contains living documentation that provides complete context about the application's architecture, features, and implementation patterns for any LLM working with this codebase.

**Start here**:
- `00-overview.md` - Application overview, capabilities, and statistics
- `01-architecture-principles.md` - Design philosophy and architectural decisions
- `02-tech-stack.md` - Complete technology inventory with rationale
- `03-data-flow.md` - Visual flow diagrams for all 6 search modes
- `04-state-management.md` - Context provider architecture details

**Context Providers** (`contexts/` subdirectory):
- `SearchContext.md` - Search orchestration (2,954 lines, 40+ state variables)
- `MapContext.md` - Map visualization and boundary management
- `ResultsContext.md` - Data storage and hierarchical removal
- `UIContext.md` - Presentation state (drawer, tabs, theme, modals)

**Critical Files to Understand**:
1. `src/contexts/SearchContext.jsx` - Main search orchestration
2. `src/contexts/MapContext.jsx` - Map state and interactions
3. `src/contexts/ResultsContext.jsx` - Result storage and filtering
4. `src/contexts/UIContext.jsx` - UI state management
5. `src/services/zipCodeService.js` - ZIP code data access
6. `src/services/geocodingService.js` - Autocomplete and geocoding
7. `src/GeoApplicationNew.jsx` - Main application component (200 lines)

### Architecture Overview

**Four-Layer Context Architecture**:
```
UIContext (Presentation State)
    ├── Drawer, modals, tabs
    ├── Dark mode, theme
    └── Autocomplete dropdown state

SearchContext (Business Logic)
    ├── Search parameters (mode, term, radius)
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

**Six Search Modes**:
1. **Radius Search** - Find ZIP codes within X miles of a point
2. **Polygon Search** - Draw custom shapes and find ZIPs within them
3. **Hierarchy Search** - Navigate State → County → City → ZIPs
4. **Upload Search** - Batch search via CSV upload
5. **Address Search** - Find street addresses within radius or polygon
6. **Geocode Search** - Batch geocode addresses from CSV

**Service Layer Pattern**:
- Pure functions/classes separate from React components
- Fallback chain: Supabase → API → Static data
- Multi-layer caching (in-memory + localStorage + query cache)

### Technology Stack
- **Build Tool**: Vite (v7.1.2) - Fast build tool with HMR
- **Framework**: React 19.1.1
- **Styling**: Tailwind CSS v4.1.13
- **Mapping**: Leaflet 1.9.4 + react-leaflet 5.0.0 + leaflet-draw
- **Icons**: Lucide React (v0.544.0)
- **Geo Processing**: @turf/turf 7.2.0
- **CSV**: PapaParse 5.5.3
- **Linting**: ESLint 9 with React-specific rules

### Backend Services
- **Primary Database**: Supabase (PostgreSQL + PostGIS)
- **Autocomplete**: Google Places API (10K/month free) → Nominatim fallback
- **Street Addresses**: Overpass API (OpenStreetMap)
- **Map Tiles**: OpenStreetMap, Mapbox (optional)

## Working with the Codebase

### Before Making Changes

1. **Read the documentation**: Start with `docs/app-architecture/00-overview.md`
2. **Understand the context system**: Review `04-state-management.md`
3. **Check existing patterns**: Look at similar implementations in the codebase
4. **Review service layer**: Check `docs/app-architecture/` for API patterns

### Common Tasks

**Adding a new search mode**:
1. Add mode to SearchContext.jsx
2. Create component in `src/components/Search/`
3. Update SearchControls.jsx to include new mode
4. Document in `docs/app-architecture/search-modes/`

**Adding a new service**:
1. Create in `src/services/`
2. Follow fallback pattern (primary → secondary → tertiary)
3. Add caching if appropriate
4. Document API integration in `docs/app-architecture/api-integration/`

**Modifying state**:
1. Identify which context owns the state
2. Update context provider
3. Test cross-context dependencies
4. Update relevant documentation

### Testing

- Put all tests in `@tests/` directory
- Refer back to tests for troubleshooting issues

### Documentation Maintenance

**When making changes, update the following** (if applicable):
- Relevant files in `docs/app-architecture/`
- This CLAUDE.md file
- Component-level JSDoc comments
- README.md for user-facing changes
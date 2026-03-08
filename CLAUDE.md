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

## Roadmap Updates

When completing significant features, bug fixes, or improvements, post an update to the project roadmap.

### API Details
- **Base URL**: `https://feedback.edwinlovett.com/roadmap/api/v1`
- **Project Name**: `GeoSearch Pro`
- **Auth Header**: `Authorization: Bearer a4b494fc27a887b52ba11a5c72ac7446ffbc6bd1a9a6815941839edbb709d13e`

### Posting Updates
```bash
curl -X POST "https://feedback.edwinlovett.com/roadmap/api/v1/projects/GeoSearch%20Pro/updates" \
  -H "Authorization: Bearer a4b494fc27a887b52ba11a5c72ac7446ffbc6bd1a9a6815941839edbb709d13e" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Your update here", "status": "Completed"}'
```

### Status Options
- `Completed` - Feature shipped and working
- `In Progress` - Currently being developed
- `Testing` - In QA/testing phase
- `On Hold` - Paused or blocked

### Writing Guidelines
- Write in simple, non-technical English
- Focus on WHAT changed and WHY it matters to users
- Use action verbs: Added, Fixed, Improved, Updated, Removed, Integrated
- Template: `[verb] [action] [user benefit]`

### When to Post Updates
✅ Post for: New features, bug fixes, significant refactors, service integrations, performance improvements
❌ Skip for: Minor edits, config changes, internal refactoring with no user impact

---

## RuntimeScope Monitoring

This project has RuntimeScope SDK installed for runtime profiling and debugging.

### SDK Configuration
RuntimeScope is initialized in `src/main.jsx` with the following features:
- **Network Requests**: All fetch/XHR calls are intercepted
- **Console Messages**: All console.log/warn/error captured
- **Performance Metrics**: Web Vitals (LCP, FCP, CLS, TTFB, INP) tracked
- **React Renders**: Component render profiling enabled
- **Connection**: WebSocket to `ws://localhost:9090`

### Available RuntimeScope Commands

| Command | What it does |
|---------|-------------|
| `/diagnose` | Full health check - issues, API health, performance |
| `/trace` | Trace a user flow - clear events, reproduce, analyze |
| `/renders` | React render audit - find excessive re-renders |
| `/api` | API health report - endpoints, latency, errors |
| `/network` | Network analysis - failed/slow requests, patterns |

### Using RuntimeScope

1. **Start your dev server**: `npm run dev`
2. **Open the app** in your browser
3. **Check connection**: Ask Claude to run `get_session_info` to verify SDK is connected
4. **Debug issues**: Use `detect_issues` to find problems automatically
5. **Trace flows**: Use `clear_events`, reproduce the issue, then `get_event_timeline`

### Common Debugging Workflows

**Performance issues**:
```
1. clear_events
2. Reproduce the slow interaction
3. detect_issues - identifies bottlenecks
4. get_render_profile - shows component re-renders
5. get_performance_metrics - Web Vitals analysis
```

**API issues**:
```
1. get_api_catalog - discover all endpoints
2. get_api_health - latency and error rates
3. get_network_requests with filters - drill into specific requests
```

**State debugging**:
```
1. get_state_snapshots - if stores are configured
2. get_console_messages - filter by level
3. get_errors_with_source_context - errors with stack traces
```

---

## Documentation Protocol

This project uses an automated documentation system. Follow these protocols to keep documentation current and accurate.

### Quick Reference

| Command | When to Use | Example |
|---------|-------------|---------|
| `/doc` | After every coding session | `/doc` |
| `/issue` | When you find a bug or edge case | `/issue API timeout on large payloads` |
| `/decision` | When you make a technical choice | `/decision Using Redis over Memcached` |
| `/service` | When you add/modify external service | `/service Stripe` |
| `/audit` | Full project analysis (periodic) | `/audit` |
| `/doc-status` | Check documentation health | `/doc-status` |
| `/handoff` | Before sharing with another dev | `/handoff` |

### Documentation Locations

| Document | Purpose | Update Frequency |
|----------|---------|------------------|
| `.claude/docs/CHANGELOG.md` | What changed and when | Every session |
| `.claude/docs/KNOWN_ISSUES.md` | Bugs, edge cases, tech debt | When discovered |
| `.claude/docs/DECISIONS.md` | Why things were built this way | When deciding |
| `.claude/docs/ARCHITECTURE.md` | System overview, env vars | When structure changes |
| `.claude/docs/services/*.md` | External service integrations | When services change |
| `.claude/docs/components/*.md` | Internal component docs | When components change |

### Workflow Rules

**After Every Coding Session**: Run `/doc` to update CHANGELOG.md with what was done, flag any new issues discovered, and update affected service/component docs.

**When You Encounter a Bug or Edge Case**: Run `/issue [description]` immediately. Don't trust your memory.

**When You Make a Non-Obvious Technical Decision**: Run `/decision [what you decided]` to capture context for future developers.

**When You Add or Modify External Services**: Run `/service [service name]` to document the integration.

**Before Handing Off to Another Developer**: Run `/handoff` to generate a comprehensive onboarding document.

### Issue Severity Guide

| Level | Description | Example |
|-------|-------------|---------|
| CRITICAL | System unusable, data loss risk | Auth completely broken |
| HIGH | Major feature broken, no workaround | Checkout fails silently |
| MEDIUM | Feature impaired, workaround exists | Export works but slow |
| LOW | Minor inconvenience | Typo in error message |

### Decision Recording Guide

Record a decision when:
- Choosing between technologies (e.g., "Why Cloudflare over Vercel")
- Designing data models or APIs
- Setting up infrastructure
- Establishing patterns that will be repeated
- Making tradeoffs that won't be obvious later

Don't record:
- Obvious choices (standard patterns)
- Temporary implementations
- Personal preferences without project impact
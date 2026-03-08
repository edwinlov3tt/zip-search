# Architectural Decisions

Record of significant technical decisions and their rationale.

---

## ADR-001: Four-Layer Context Architecture

**Date**: 2025-01-15
**Status**: Active

### Context
The application needs to manage complex state across search modes, map interactions, results display, and UI controls.

### Decision
Separate concerns into four React Context providers:
- **UIContext**: Presentation state (drawer, modals, theme)
- **SearchContext**: Business logic (search params, history, orchestration)
- **ResultsContext**: Data storage (results, filtering, export)
- **MapContext**: Visualization (map view, boundaries, markers)

### Consequences
- **Pros**: Clear separation of concerns, easier to reason about state
- **Cons**: Large SearchContext (~3000 lines), cross-context dependencies need careful management

---

## ADR-002: Service Layer with Fallback Chain

**Date**: 2025-01-15
**Status**: Active

### Context
Application needs reliable data access with multiple potential data sources.

### Decision
Implement services as pure functions/classes with fallback chains:
- Primary: Supabase (PostgreSQL + PostGIS)
- Secondary: REST APIs
- Tertiary: Static data files

### Consequences
- **Pros**: High availability, graceful degradation
- **Cons**: More complex service implementations, need to maintain multiple data sources

---

## ADR-003: Supabase for Primary Database

**Date**: 2025-01-14
**Status**: Active

### Context
Need a database for ZIP code data, boundaries, and user-generated content.

### Decision
Use Supabase (PostgreSQL + PostGIS) as primary database.

### Alternatives Considered
- Firebase: Good for real-time, but less suited for geographic queries
- Raw PostgreSQL: More control, but more infrastructure to manage
- D1 (Cloudflare): Limited PostGIS support

### Consequences
- **Pros**: PostGIS for spatial queries, built-in auth, Row Level Security, generous free tier
- **Cons**: Vendor lock-in, latency for some regions

---

## ADR-004: Google Places API for Autocomplete

**Date**: 2025-01-16
**Status**: Active

### Context
Need location autocomplete for search inputs.

### Decision
Use Google Places API (10K requests/month free tier) with Nominatim fallback.

### Consequences
- **Pros**: Best autocomplete quality, familiar to users
- **Cons**: Cost at scale, fallback has lower quality results

---

## ADR-005: Cloudflare Workers for Edge APIs

**Date**: 2025-01-19
**Status**: Active

### Context
Need serverless APIs for address search and share functionality.

### Decision
Deploy API endpoints as Cloudflare Workers.

### Consequences
- **Pros**: Global edge deployment, low latency, generous free tier
- **Cons**: Cold start times, limited execution time (50ms CPU on free tier)

---

## ADR-006: Leaflet for Map Rendering

**Date**: 2025-01-14
**Status**: Active

### Context
Need interactive map with drawing capabilities, boundary rendering, and custom markers.

### Decision
Use Leaflet with react-leaflet and leaflet-draw.

### Alternatives Considered
- Mapbox GL JS: Better performance, but more expensive at scale
- Google Maps: Good but costly, less customizable
- OpenLayers: More complex API

### Consequences
- **Pros**: Free, well-documented, good React integration, great drawing tools
- **Cons**: Canvas rendering can be slower than WebGL for many features

---

## ADR-007: Single-Click Select, Double-Click Deselect

**Date**: 2025-01-20
**Status**: Active

### Context
Users need intuitive way to focus on specific ZIP boundaries.

### Decision
- Single click on result/marker: Always select and show boundary
- Double click: Deselect and hide boundary

### Consequences
- **Pros**: Intuitive UX, easy to switch between results
- **Cons**: Double-click less discoverable

---

## Decision Template

```markdown
## ADR-XXX: [Title]

**Date**: YYYY-MM-DD
**Status**: [Proposed | Active | Deprecated | Superseded]

### Context
[What is the issue we're facing?]

### Decision
[What have we decided to do?]

### Alternatives Considered
[What other options were evaluated?]

### Consequences
- **Pros**: [Benefits]
- **Cons**: [Drawbacks]
```

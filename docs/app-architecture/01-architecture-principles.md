# Architecture Principles

## Design Philosophy

GeoSearch Pro follows a **context-driven, service-oriented architecture** with clear separation of concerns between UI presentation, business logic, and data access.

## Core Principles

### 1. Context-Based State Management

**Why Not Redux/MobX?**
- **Simplicity**: Built-in React Context API eliminates external dependencies
- **Colocated Logic**: Related state and operations live together
- **Performance**: Selective re-rendering through multiple providers
- **Type Safety**: Better TypeScript support (future migration)

**Four-Layer Context Architecture**:
```
UI State (UIContext)
    ├── Drawer, modals, dark mode
    └── Independent of data

Search State (SearchContext)
    ├── Search parameters, mode, history
    └── Orchestrates searches

Results State (ResultsContext)
    ├── Search results storage
    └── Hierarchical operations

Map State (MapContext)
    ├── Map view, boundaries, drawing
    └── Visualization layer
```

### 2. Service Layer Separation

**Pattern**: Services are pure functions/classes with no React dependencies
```javascript
// ✅ Good: Pure service
export class ZipCodeService {
  static async search(params) {
    // Data fetching logic
    return await fetch(...)
  }
}

// ❌ Bad: Service with React hooks
export const useZipCodeSearch = () => {
  const [data, setData] = useState()  // Don't mix concerns
}
```

**Benefits**:
- **Testable**: Services can be unit tested without React
- **Reusable**: Same service in different contexts
- **Portable**: Easy to extract to backend if needed

### 3. Fallback Chains for Resilience

**Three-Tier Data Access**:
```
Primary: Supabase (fast, up-to-date)
    ↓ (if unavailable)
Secondary: API Endpoint (slower, cached)
    ↓ (if unavailable)
Tertiary: Static Data (fastest, stale)
```

**Example Implementation**:
```javascript
async search(params) {
  try {
    // Try Supabase first
    return await supabaseService.searchZips(params);
  } catch (error) {
    console.warn('Supabase failed, trying API', error);
    try {
      // Fallback to API
      return await this.apiSearch(params);
    } catch (apiError) {
      console.warn('API failed, using static data', apiError);
      // Last resort: static data
      return OptimizedStaticService.search(params);
    }
  }
}
```

### 4. Component Composition Over Inheritance

**Pattern**: Small, focused components composed together
```
SearchControls (smart component)
    ├── RadiusSearch (presentation)
    ├── PolygonSearch (presentation)
    └── AddressSearch (presentation)
```

**Why?**
- **Easier Testing**: Test small units independently
- **Better Reusability**: Mix and match components
- **Clearer Intent**: Each component has single responsibility

### 5. Colocated State

**Rule**: State should live as close as possible to where it's used

```javascript
// ✅ Good: Local state for UI-only concerns
function SearchInput() {
  const [inputValue, setInputValue] = useState(''); // Local
  const { performSearch } = useSearch(); // Global
}

// ❌ Bad: Everything in global context
// Don't put temporary input values in SearchContext
```

**Benefits**:
- **Performance**: Fewer re-renders
- **Maintainability**: Easier to understand scope
- **Encapsulation**: Changes don't affect other components

## Architectural Decisions

### Decision 1: Why Refactor from GeoApplication.jsx?

**Problem**: Single 4,983-line file
```
GeoApplication.jsx (4,983 lines)
├── All state management
├── All event handlers
├── All search logic
└── All UI rendering
```

**Solution**: Split into contexts + components
```
GeoApplicationNew.jsx (200 lines) - Composition only
    ├── SearchContext.jsx (2,954 lines) - Search logic
    ├── MapContext.jsx (285 lines) - Map logic
    ├── ResultsContext.jsx (600 lines) - Results logic
    ├── UIContext.jsx (400 lines) - UI logic
    └── 40+ focused components (<200 lines each)
```

**Benefits**:
- **Maintainability**: Find code faster
- **Collaboration**: Multiple devs can work simultaneously
- **Testing**: Test individual pieces
- **Performance**: Selective re-rendering

### Decision 2: Why Multiple Contexts Instead of One?

**Alternative**: Single AppContext with all state
```javascript
// ❌ Anti-pattern
const AppContext = {
  search: {...},
  map: {...},
  results: {...},
  ui: {...}
}
```

**Problem**: Every state update re-renders all consumers

**Our Approach**: Separate contexts by concern
```javascript
// ✅ Good: Consumers only re-render when relevant state changes
const search = useSearch();  // Only re-renders on search changes
const map = useMap();        // Only re-renders on map changes
```

### Decision 3: Why Leaflet Over Google Maps?

| Criteria | Leaflet | Google Maps |
|----------|---------|-------------|
| **Cost** | Free, open-source | $200/month for loads |
| **Customization** | Full control | Limited |
| **Drawing Tools** | leaflet-draw (free) | Drawing API (paid) |
| **Offline** | Works offline | Requires connection |
| **Bundle Size** | ~40KB | ~150KB |

**Decision**: Leaflet for cost and flexibility

### Decision 4: Why Vite Over Create React App?

| Feature | Vite | CRA |
|---------|------|-----|
| **Dev Start Time** | ~200ms | ~30s |
| **HMR Speed** | Instant | 1-3s |
| **Build Time** | 20s | 60s |
| **Bundle Size** | Smaller (tree-shaking) | Larger |
| **Active Development** | Yes | Deprecated |

**Decision**: Vite for speed and modern tooling

### Decision 5: Why Context Over Props?

**Before** (prop drilling):
```javascript
<GeoApplication>
  <SearchControls
    handleSearch={handleSearch}
    handleReset={handleReset}
    searchTerm={searchTerm}
    radius={radius}
    // ... 20 more props
  >
    <RadiusSearch
      handleSearch={handleSearch}
      searchTerm={searchTerm}
      // ... passing down again
    />
  </SearchControls>
</GeoApplication>
```

**After** (context):
```javascript
<SearchProvider>
  <GeoApplication>
    <SearchControls>
      <RadiusSearch />  {/* Accesses context directly */}
    </SearchControls>
  </GeoApplication>
</SearchProvider>
```

## Code Organization Patterns

### Pattern 1: Feature-Based Folders

```
src/
├── components/
│   ├── Search/       # Search-related components
│   ├── Map/          # Map-related components
│   ├── Results/      # Results-related components
│   ├── Header/       # Header components
│   └── Modals/       # Modal dialogs
├── contexts/         # State management
├── services/         # Data access
├── hooks/            # Custom hooks
└── utils/            # Utilities
```

**Benefits**:
- **Clear Boundaries**: Easy to find related code
- **Independent Development**: Work on features in isolation
- **Code Splitting**: Lazy load features

### Pattern 2: Barrel Exports

```javascript
// services/index.js
export { ZipCodeService } from './zipCodeService';
export { GeocodingService } from './geocodingService';
export { supabaseService } from './supabaseService';

// Usage
import { ZipCodeService, GeocodingService } from '../services';
```

### Pattern 3: Custom Hooks for Reusable Logic

```javascript
// hooks/useDebounce.js
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  // ... debounce logic
  return debouncedValue;
}

// Usage in multiple components
const debouncedSearch = useDebounce(searchTerm, 300);
```

## Performance Considerations

### 1. Lazy Context Loading
```javascript
// Only load context when needed
const LazyMapContext = React.lazy(() => import('./contexts/MapContext'));
```

### 2. Memoization
```javascript
const memoizedResults = useMemo(() =>
  results.filter(r => r.state === selectedState),
  [results, selectedState]
);
```

### 3. Callback Stability
```javascript
const handleSearch = useCallback((params) => {
  // Search logic
}, [dependencies]);
```

### 4. Selective Re-rendering
```javascript
// Wrap expensive components
const MemoizedResultsTable = React.memo(ResultsTable);
```

## Error Handling Philosophy

### Graceful Degradation
```javascript
try {
  // Try ideal solution
  return await primaryService.fetch();
} catch (error) {
  console.warn('Primary failed:', error);
  // Degrade to secondary
  return await fallbackService.fetch();
}
```

### User-Friendly Messages
```javascript
// ❌ Bad: Technical error
throw new Error('ECONNREFUSED 503');

// ✅ Good: User-friendly error
throw new Error('Search service is temporarily unavailable. Please try again in a moment.');
```

### Toast Notifications
```javascript
setApiError('No results found. Try a different location or larger radius.');
// Shown in UI as toast notification
```

## Testing Strategy (Future)

### Unit Tests: Services
```javascript
describe('ZipCodeService', () => {
  it('should fallback to static data when API fails', async () => {
    // Mock API failure
    // Assert fallback is used
  });
});
```

### Integration Tests: Contexts
```javascript
describe('SearchContext', () => {
  it('should update results after successful search', async () => {
    // Render with context
    // Perform search
    // Assert results updated
  });
});
```

### E2E Tests: User Flows
```javascript
describe('Radius Search Flow', () => {
  it('should complete radius search end-to-end', () => {
    // Visit app
    // Enter location
    // Set radius
    // Click search
    // Assert results shown
  });
});
```

## Scalability Considerations

### 1. Code Splitting
```javascript
// Lazy load heavy components
const HeavyModal = React.lazy(() => import('./HeavyModal'));
```

### 2. Virtual Scrolling
```javascript
// For large result sets (1000+ items)
import { useVirtualScroll } from '../hooks/useVirtualScroll';
```

### 3. Progressive Enhancement
```javascript
// Load boundaries on-demand
if (viewport.zoom > 10) {
  loadZipBoundaries();
}
```

### 4. CDN for Static Assets
```javascript
// Use CDN for Leaflet CSS/JS
<link href="https://cdn.jsdelivr.net/leaflet.css" />
```

## Migration Path

### Phase 1: ✅ Complete
- Split GeoApplication into contexts
- Create component hierarchy
- Implement fallback services

### Phase 2: 🔄 In Progress
- Add comprehensive documentation
- Identify optimization opportunities
- Improve error boundaries

### Phase 3: 📋 Planned
- Add TypeScript gradually
- Implement unit tests
- Add E2E tests
- Virtual scrolling for large datasets

### Phase 4: 🔮 Future
- Backend API for quota management
- WebSocket for real-time updates
- Progressive Web App (PWA)
- Mobile app (React Native)

## Anti-Patterns to Avoid

### ❌ 1. God Components
```javascript
// Don't create components that do everything
function SuperComponent() {
  // 500 lines of mixed logic
}
```

### ❌ 2. Prop Drilling
```javascript
// Don't pass props through 5 levels
<A prop={x}>
  <B prop={x}>
    <C prop={x}>
      <D prop={x}>
        <E prop={x} />  // Finally uses it
```

### ❌ 3. Logic in Components
```javascript
// Don't put business logic in components
function SearchButton() {
  const performComplexSearch = () => {
    // 200 lines of search logic here
  }
}
```

### ❌ 4. Mixing Concerns
```javascript
// Don't mix UI and data logic
function Results() {
  const [data, setData] = useState();
  useEffect(() => {
    fetch('/api/data').then(setData);  // ❌ Use a service
  }, []);
}
```

## Best Practices Summary

1. **State**: Use contexts for global, useState for local
2. **Services**: Pure functions, no React dependencies
3. **Components**: Small, focused, composable
4. **Errors**: Graceful fallbacks, user-friendly messages
5. **Performance**: Memoize, lazy load, virtual scroll
6. **Testing**: Unit → Integration → E2E
7. **Documentation**: Keep docs updated with code

## Next Steps

- **State Management**: See `04-state-management.md`
- **Data Flow**: See `03-data-flow.md`
- **Context Details**: See `contexts/` directory
- **Service Patterns**: See `services/` directory

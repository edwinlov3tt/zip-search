# Map Performance Audit

**Date**: 2026-01-20
**Branch**: `refactor/map-performance-fixes`

## Overview

This document tracks performance and stability issues identified in the map interaction code. Issues are categorized by severity and include recommended fixes.

---

## Issues Tracker

### Completed

- [x] **BoundaryManager AbortController** - Add request cancellation to prevent stale data
- [x] **MapContext value memoization** - Wrap context value in useMemo to prevent cascading re-renders

---

### High Priority

#### 1. MapMarkers - Inline icon creation on every render
**File**: `src/components/Map/MapMarkers.jsx:89-103, 142-161, 236-262, 309-335, 404-430`

**Problem**: `L.divIcon({...})` creates new icon instances on every render for every marker.

**Fix**: Memoize icons or create factory functions:
```jsx
const createAddressIcon = (isActive, color) => L.divIcon({...});
// Use useMemo to cache per unique key
```

**Impact**: Significant performance improvement with large result sets (100+ markers).

---

#### 3. MapMarkers - Inline eventHandlers objects
**File**: `src/components/Map/MapMarkers.jsx:104-116, 162-169, 208-220`

**Problem**: New handler objects created on every render for every marker.

**Fix**: Use useCallback for handlers or create stable handler factories.

---

#### 4. GeoJSON key forcing remount on focus change
**File**: `src/components/Map/layers/ZipBoundaryLayer.jsx:154`

**Problem**:
```jsx
key={`zip-boundaries-${zipBoundariesData.features.length}-${focusedZipCode}-${showOnlyFocusedBoundary}-${showHatching}`}
```
Including `focusedZipCode` in the key forces full GeoJSON remount when clicking results, causing flicker.

**Fix**: Remove `focusedZipCode` from key, use style function to handle focus changes dynamically.

---

#### 5. ZipBoundaryLayer.handleAddZip - No loading state guard
**File**: `src/components/Map/layers/ZipBoundaryLayer.jsx:65-149`

**Problem**: No protection against double-clicks or rapid invocations.

**Fix**: Add loading state and early return:
```jsx
const [isAdding, setIsAdding] = useState(false);

const handleAddZip = async (zipCode, isExcluded) => {
  if (isAdding) return;
  setIsAdding(true);
  try {
    // ...existing logic
  } finally {
    setIsAdding(false);
  }
};
```

---

#### 6. BoundaryManager - Effect dependencies cause redundant loads
**File**: `src/components/Map/BoundaryManager.jsx:351-357`

**Problem**: Any change to result arrays triggers reload even if ZIP codes are identical.

**Fix**: Use signature-based caching (like `lastCityKeysRef`) for ZIP boundaries too:
```jsx
const lastZipCodesRef = useRef('');
// In loadZipBoundariesForResults:
const zipCodesKey = resultZipCodes.sort().join(',');
if (zipCodesKey === lastZipCodesRef.current) return;
lastZipCodesRef.current = zipCodesKey;
```

---

### Medium Priority

#### 7. MapContext - Effects clearing data on toggle off
**File**: `src/contexts/MapContext.jsx:251-280`

**Problem**: Multiple effects that just clear state when toggles turn off are essentially derived state.

**Better Pattern**:
```jsx
// Instead of effect that clears data
const effectiveZipBoundariesData = showZipBoundaries ? zipBoundariesData : null;
```

---

#### 8. ZipBoundaryLayer - Multiple setTimeout effects with magic delays
**File**: `src/components/Map/layers/ZipBoundaryLayer.jsx:41-63`

**Problem**: Magic timeouts (50ms, 100ms) are fragile and can fail on slow devices.

**Fix**: Use MutationObserver or requestAnimationFrame for more reliable timing.

---

#### 9. MapController - Many useEffects with overlapping concerns
**File**: `src/components/Map/MapController.jsx`

**Problem**: 7 separate useEffects, some could be consolidated.

**Fix**: Group related effects, consider extracting custom hooks.

---

#### 10. MapContainer - Inline object in style prop
**File**: `src/components/Map/MapContainer.jsx:103-105`

**Problem**:
```jsx
style={{
  cursor: shouldShowCrosshair ? 'crosshair' : undefined
}}
```

**Fix**: Memoize style object or use CSS classes.

---

### Lower Priority

#### 11. BoundaryLayers - Passing too many props
**File**: `src/components/Map/BoundaryLayers.jsx:11-43`

**Problem**: Component receives 26+ props passed through multiple layers.

**Fix**: Consider using context or compound component pattern.

---

#### 12. MapContext.handleResultMapInteraction - Partial race protection
**File**: `src/contexts/MapContext.jsx:87-176`

**Problem**: Uses ref to guard stale updates but request still completes.

**Fix**: Add AbortController to cancel in-flight requests when focus changes.

---

#### 13. NeighborZipsLayer.handleAddNeighborZip - No loading guard
**File**: `src/components/Map/layers/NeighborZipsLayer.jsx:22`

**Problem**: Same double-click vulnerability as ZipBoundaryLayer.

**Fix**: Add loading state guard.

---

## Async Sources Inventory

| Location | Async Source | Has Cleanup? | Has Race Protection? |
|----------|-------------|--------------|---------------------|
| `BoundaryManager.loadAllStateBoundaries` | `stateBoundariesService` | ✅ (fixed) | ✅ (fixed) |
| `BoundaryManager.loadZipBoundariesForResults` | `zipBoundariesService` | ✅ (fixed) | ✅ (fixed) |
| `BoundaryManager.loadCityBoundariesForResults` | `cityBoundariesService` | ✅ (fixed) | ✅ (fixed) |
| `BoundaryManager.loadVtdBoundariesForResults` | `vtdBoundariesService` | ✅ (fixed) | ✅ (fixed) |
| `MapContext.handleResultMapInteraction` | `zipBoundariesService` | ❌ | ✅ (partial) |
| `ZipBoundaryLayer.handleAddZip` | `ZipCodeService` | ❌ | ❌ |
| `NeighborZipsLayer.handleAddNeighborZip` | `ZipCodeService` | ❌ | ❌ |
| `SearchContext.handleMapClickSearch` | `ZipCodeService`, `Worker` | ❌ | ❌ |
| `SearchContext.handleAutocompleteSelect` | `googlePlacesService`, `Worker` | ❌ | ❌ |

---

## Testing Checklist

When implementing fixes, verify:

- [ ] Rapid toggle of boundary layers doesn't show stale data
- [ ] Clicking multiple ZIP results quickly shows correct focused boundary
- [ ] Large result sets (500+ ZIPs) render smoothly
- [ ] No console errors about unmounted component state updates
- [ ] Hatching toggle doesn't cause visible flicker
- [ ] Loading indicators show/hide correctly
- [ ] No duplicate API requests in network tab

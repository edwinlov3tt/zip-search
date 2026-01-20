# Map Performance Audit

**Date**: 2026-01-20
**Branch**: `refactor/map-performance-fixes`

## Overview

This document tracks performance and stability issues identified in the map interaction code. Issues are categorized by severity and include recommended fixes.

---

## Issues Tracker

### Completed

- [x] **BoundaryManager AbortController** - Add request cancellation to prevent stale data
- [x] **BoundaryManager deduplication** - Added signature-based caching (lastZipCodesRef) for all boundary types
- [x] **MapContext value memoization** - Wrap context value in useMemo to prevent cascading re-renders
- [x] **MapMarkers inline icon creation** - Cache icons with factory functions to prevent recreation on every render
- [x] **MapMarkers inline eventHandlers** - Cache event handler objects and use stable useCallback handlers

---

### High Priority

#### 1. GeoJSON key forcing remount on focus change
**File**: `src/components/Map/layers/ZipBoundaryLayer.jsx:154`

**Problem**:
```jsx
key={`zip-boundaries-${zipBoundariesData.features.length}-${focusedZipCode}-${showOnlyFocusedBoundary}-${showHatching}`}
```
Including `focusedZipCode` in the key forces full GeoJSON remount when clicking results, causing flicker.

**Fix**: Remove `focusedZipCode` from key, use style function to handle focus changes dynamically.

---

#### 2. ZipBoundaryLayer.handleAddZip - No loading state guard
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

### Medium Priority

#### 3. MapContext - Effects clearing data on toggle off
**File**: `src/contexts/MapContext.jsx:251-280`

**Problem**: Multiple effects that just clear state when toggles turn off are essentially derived state.

**Better Pattern**:
```jsx
// Instead of effect that clears data
const effectiveZipBoundariesData = showZipBoundaries ? zipBoundariesData : null;
```

---

#### 4. ZipBoundaryLayer - Multiple setTimeout effects with magic delays
**File**: `src/components/Map/layers/ZipBoundaryLayer.jsx:41-63`

**Problem**: Magic timeouts (50ms, 100ms) are fragile and can fail on slow devices.

**Fix**: Use MutationObserver or requestAnimationFrame for more reliable timing.

---

#### 5. MapController - Many useEffects with overlapping concerns
**File**: `src/components/Map/MapController.jsx`

**Problem**: 7 separate useEffects, some could be consolidated.

**Fix**: Group related effects, consider extracting custom hooks.

---

#### 6. MapContainer - Inline object in style prop
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

#### 7. BoundaryLayers - Passing too many props
**File**: `src/components/Map/BoundaryLayers.jsx:11-43`

**Problem**: Component receives 26+ props passed through multiple layers.

**Fix**: Consider using context or compound component pattern.

---

#### 8. MapContext.handleResultMapInteraction - Partial race protection
**File**: `src/contexts/MapContext.jsx:87-176`

**Problem**: Uses ref to guard stale updates but request still completes.

**Fix**: Add AbortController to cancel in-flight requests when focus changes.

---

#### 9. NeighborZipsLayer.handleAddNeighborZip - No loading guard
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

# Known Issues

Active bugs, edge cases, and technical debt.

---

## Active Issues

### [MEDIUM] Large Dataset Performance
- **Location**: `src/components/Map/MapMarkers.jsx`
- **Symptom**: Browser can slow down with many markers
- **Workaround**: Limited to max 5000 markers per search
- **Proper Fix**: Implement marker clustering or virtual rendering
- **Added**: 2025-01-20

### [LOW] HMR Context Refresh
- **Location**: `src/contexts/*.jsx`
- **Symptom**: Context files don't hot reload cleanly (full page refresh needed)
- **Workaround**: Refresh browser after context changes
- **Proper Fix**: Expected Vite behavior with context exports
- **Added**: 2025-01-20

### [LOW] Google Places API Rate Limit
- **Location**: `src/services/geocodingService.js`
- **Symptom**: Autocomplete may fail if 10K monthly requests exceeded
- **Workaround**: Falls back to Nominatim
- **Proper Fix**: Monitor usage and upgrade API tier if needed
- **Added**: 2025-01-20

---

## Resolved Issues

### [RESOLVED] ZIP Boundary Race Condition
- **Location**: `src/contexts/MapContext.jsx`
- **Symptom**: Old boundary remained visible when switching between ZIPs
- **Resolution**: Clear boundary immediately before loading new one, added ref tracking
- **Resolved**: 2025-01-20

### [RESOLVED] First Search Map Glitch
- **Location**: `src/components/Map/MapController.jsx`
- **Symptom**: Map competed for placement on first search
- **Resolution**: Removed searchPerformed from invalidateSize dependencies
- **Resolved**: 2025-01-20

### [RESOLVED] Hatching Applied by Default
- **Location**: `src/components/Map/layers/ZipBoundaryLayer.jsx`
- **Symptom**: Diagonal fill pattern showed even when toggle was off
- **Resolution**: Fixed to only apply when explicitly enabled
- **Resolved**: 2025-01-20

---

## Technical Debt

### Large Context Files
- **Location**: `src/contexts/SearchContext.jsx` (~3000 lines)
- **Issue**: File is very large and handles many responsibilities
- **Recommendation**: Consider splitting into smaller, focused contexts
- **Priority**: Low (works but harder to maintain)

### Missing Test Coverage
- **Location**: `@tests/` directory
- **Issue**: Limited test coverage for core functionality
- **Recommendation**: Add unit tests for services, integration tests for contexts
- **Priority**: Medium

---

## Issue Severity Guide

| Level | Description | Action |
|-------|-------------|--------|
| CRITICAL | System unusable, data loss risk | Fix immediately |
| HIGH | Major feature broken, no workaround | Fix this sprint |
| MEDIUM | Feature impaired, workaround exists | Schedule fix |
| LOW | Minor inconvenience | Backlog |

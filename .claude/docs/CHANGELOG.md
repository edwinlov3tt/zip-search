# Changelog

All notable changes to GeoSearch Pro are documented here.

---

## 2025-01-20

### ZIP Boundary Selection UX Improvements
- Fixed ZIP boundary focus: clicking results now immediately clears old boundary before loading new one
- Added race condition protection with ref tracking for rapid clicking scenarios
- Separated single-click (select/switch) from double-click (deselect) behavior
- Made ZIP boundaries toggle independent - clicking results no longer auto-enables global toggle
- Added focused boundary layer that shows when global toggle is off
- Added "Diagonal Fill Pattern" toggle in Map Settings for hatching control
- Fixed hatching to only apply when explicitly enabled
- Fixed map glitch on first search by removing searchPerformed from invalidateSize deps

---

## 2025-01-19

### Share Feature Enhancements
- Enabled sharing for Upload and Hierarchy search modes
- Fixed CSV upload modal using wrong ZIP type value

### Address Search Worker API
- Added Address Search Worker API with chunked storage
- Resolved first-search rendering glitch via map.invalidateSize()

---

## 2025-01-18

### Screenshot and Sharing
- Added shareable links with screenshot capture
- Added color customization for search overlays
- Fixed polygon search + added remove button to radius markers

### Bug Fixes
- Fixed tag search results with searchIds and searchSequences for proper export
- Resolved infinite render loop and visual glitches

---

## 2025-01-17

### Boundary Support Expansion
- Added boundary support for geocode/address modes
- Added nationwide VTD (Voting Tabulation District) boundaries with Supabase integration

### Documentation
- Added comprehensive Phase 1 architecture documentation

---

## 2025-01-16

### Autocomplete Improvements
- Added autocomplete search to Polygon Search mode
- Fixed Google Places autocomplete map navigation
- Reduced console noise and improved error messages

---

## 2025-01-15

### Boundary System Overhaul
- Implemented working boundary loading for ZIP, State, and City boundaries
- Fixed boundary system with comprehensive debugging
- Dramatically improved autocomplete relevance and ZIP code search
- Migrated boundary services to Census TIGER API

---

## 2025-01-14

### Address Search Improvements
- Auto-switch to satellite view in Address Search mode
- Improved Address Search UX with empty results handling
- Fixed Address Search polygon tool

---

## Earlier Changes

See git history for changes prior to 2025-01-14:
```bash
git log --oneline --before="2025-01-14"
```

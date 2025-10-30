Perfect! Let me show you exactly how to use the Overpass API. I'll give you working examples for both radius and polygon searches, plus how to integrate this into your Vite app on Vercel.

## How Overpass API Works

**Important caveat**: OSM address data is **crowd-sourced** and **incomplete**. You'll get what volunteers have mapped - which varies wildly by location. Florida might have decent coverage, but don't expect 100% of addresses.

## Example API Calls

### 1. **Radius Search** (Simplest)

Get all addresses within 1000 meters of a point:

```javascript
const latitude = 28.0339;  // Tampa
const longitude = -82.4587;
const radiusMeters = 1000;

const overpassQuery = `
[out:json][timeout:25];
(
  node["addr:housenumber"](around:${radiusMeters},${latitude},${longitude});
  way["addr:housenumber"](around:${radiusMeters},${latitude},${longitude});
);
out center;
`;

const url = 'https://overpass-api.de/api/interpreter';
const response = await fetch(url, {
  method: 'POST',
  body: overpassQuery
});

const data = await response.json();
```

### 2. **Polygon Search**

Get all addresses within a custom polygon:

```javascript
// Your polygon coordinates (lat lon pairs, space-separated)
const polygon = "28.0500 -82.4700 28.0500 -82.4500 28.0400 -82.4500 28.0400 -82.4700";

const overpassQuery = `
[out:json][timeout:25];
(
  node["addr:housenumber"](poly:"${polygon}");
  way["addr:housenumber"](poly:"${polygon}");
);
out center;
`;

const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: overpassQuery
});

const data = await response.json();
```

### 3. **Understanding the Response**

The response will look like this:

```json
{
  "elements": [
    {
      "type": "node",
      "id": 123456789,
      "lat": 28.0339,
      "lon": -82.4587,
      "tags": {
        "addr:housenumber": "123",
        "addr:street": "Main Street",
        "addr:city": "Tampa",
        "addr:postcode": "33602",
        "addr:state": "FL"
      }
    },
    {
      "type": "way",
      "id": 987654321,
      "center": {
        "lat": 28.0350,
        "lon": -82.4590
      },
      "tags": {
        "addr:housenumber": "456",
        "addr:street": "Second Avenue",
        "addr:city": "Tampa",
        "addr:postcode": "33602"
      }
    }
  ]
}
```

## Full React Component Example

Here's a complete component for your Vite app:

```typescript
// components/AddressSearch.tsx
import { useState } from 'react';

interface Address {
  housenumber: string;
  street: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lon: number;
}

export function AddressSearch() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  const searchByRadius = async (lat: number, lon: number, radiusMeters: number) => {
    setLoading(true);
    
    const query = `
      [out:json][timeout:60];
      (
        node["addr:housenumber"](around:${radiusMeters},${lat},${lon});
        way["addr:housenumber"](around:${radiusMeters},${lat},${lon});
      );
      out center;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query
      });

      const data = await response.json();
      const parsed = parseOverpassResponse(data);
      setAddresses(parsed);
    } catch (error) {
      console.error('Overpass API error:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchByPolygon = async (coordinates: [number, number][]) => {
    setLoading(true);
    
    // Format: "lat lon lat lon lat lon"
    const polyString = coordinates.map(([lat, lon]) => `${lat} ${lon}`).join(' ');
    
    const query = `
      [out:json][timeout:60];
      (
        node["addr:housenumber"](poly:"${polyString}");
        way["addr:housenumber"](poly:"${polyString}");
      );
      out center;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query
      });

      const data = await response.json();
      const parsed = parseOverpassResponse(data);
      setAddresses(parsed);
    } catch (error) {
      console.error('Overpass API error:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseOverpassResponse = (data: any): Address[] => {
    return data.elements.map((element: any) => {
      const tags = element.tags || {};
      
      // Get coordinates
      let lat, lon;
      if (element.type === 'node') {
        lat = element.lat;
        lon = element.lon;
      } else if (element.center) {
        // For ways, use center point
        lat = element.center.lat;
        lon = element.center.lon;
      }

      return {
        housenumber: tags['addr:housenumber'] || '',
        street: tags['addr:street'] || '',
        city: tags['addr:city'] || '',
        state: tags['addr:state'] || '',
        postcode: tags['addr:postcode'] || '',
        lat: lat || 0,
        lon: lon || 0,
      };
    }).filter((addr: Address) => addr.housenumber); // Filter out incomplete
  };

  return (
    <div>
      <button onClick={() => searchByRadius(28.0339, -82.4587, 1000)}>
        Search Tampa (1km radius)
      </button>
      
      {loading && <p>Loading addresses...</p>}
      
      <div>
        <h3>Found {addresses.length} addresses</h3>
        {addresses.map((addr, idx) => (
          <div key={idx}>
            {addr.housenumber} {addr.street}, {addr.city}, {addr.state} {addr.postcode}
            <br />
            Lat: {addr.lat.toFixed(6)}, Lon: {addr.lon.toFixed(6)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Important Limitations & Considerations

### 1. **Address Data Completeness**
- OSM addresses are **incomplete** - expect 20-80% coverage depending on area
- Not all buildings have `addr:city`, `addr:state`, or `addr:postcode` tags
- You may only get `addr:housenumber` and `addr:street`

### 2. **Rate Limits**
- Overpass has **aggressive rate limiting**
- Max 2 requests per second
- Large queries can timeout (default 25 seconds)
- You'll need to implement retry logic and caching

### 3. **Query Size Limits**
- Polygon can't be larger than ~80 square miles
- Radius searches work best under 5km
- Large areas = timeouts

### 4. **Vercel/Vite Compatibility**
✅ **Yes, this works perfectly on Vercel**
- Overpass API is external, so you're just making HTTP requests
- No special backend needed
- Can run entirely client-side in your React app
- Vercel serverless functions can also call it if needed

## Better Approach: Use Serverless Function

To avoid rate limits and implement caching:

```typescript
// api/search-addresses.ts (Vercel serverless function)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { lat, lon, radius, polygon } = req.query;

  let query;
  if (radius) {
    query = `
      [out:json][timeout:60];
      (
        node["addr:housenumber"](around:${radius},${lat},${lon});
        way["addr:housenumber"](around:${radius},${lat},${lon});
      );
      out center;
    `;
  } else if (polygon) {
    query = `
      [out:json][timeout:60];
      (
        node["addr:housenumber"](poly:"${polygon}");
        way["addr:housenumber"](poly:"${polygon}");
      );
      out center;
    `;
  }

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
      headers: {
        'Content-Type': 'text/plain',
      }
    });

    const data = await response.json();
    
    // Add caching headers
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
}
```

## Reality Check

**Here's the truth**: Overpass API will give you **some** addresses, but not all. For marketing purposes, you'll still need to:

1. Use Overpass to get the addresses OSM has
2. Build your Nominatim server to geocode additional addresses you collect
3. Consider property data APIs (ATTOM/Regrid) for complete coverage

The free Overpass API is great for **proof of concept** and light usage, but for 240K-500K addresses/day, you absolutely need your own Nominatim server with a complete dataset.

Want me to show you how to query your own Nominatim server with PostGIS for spatial queries once you have it running? That's the endgame solution.


 Address Search Feature Implementation Plan

 Overview

 Add a new "Address Search" mode that uses Overpass API to find addresses within
 radius or polygon areas, with multi-search functionality, cooldown timer, and
 validation limits.

 Phase 1: Core Infrastructure (Files: 4 new, 3 modified)

 1.1 Create Overpass API Service

 New file: src/services/overpassService.js
 - searchAddressesByRadius(lat, lng, radiusMeters) - Query addresses within radius
 - searchAddressesByPolygon(coordinates) - Query addresses within polygon
 - parseOverpassResponse(data) - Parse API response to address objects
 - Rate limiting with 5-second cooldown tracking
 - Error handling for timeouts and API limits
 - Return format: { housenumber, street, unit, city, state, postcode, lat, lon }

 1.2 Add Address Mode to Header

 Modify: src/components/Header/SearchModeToggle.jsx
 - Add { id: 'address', label: 'Address Search', shortLabel: 'Address' } to modes
 array (line 4-9)

 1.3 Extend SearchContext State

 Modify: src/contexts/SearchContext.jsx
 - Add state variables:
   - addressSearches (array) - Multi-search history
   - activeAddressSearchId (string) - Currently active search
   - addressSubMode ('radius' | 'polygon') - Which mode within Address Search
   - addressDisplaySettings (object) - { showMarkers: true, showResults: true, 
 showZipBorders: false }
   - lastOverpassCall (timestamp) - For 5-second cooldown
   - overpassCooldownRemaining (number) - Seconds remaining
 - Add functions:
   - addAddressSearch(params, results) - Add to history
   - removeAddressSearch(id) - Remove from history
   - executeAddressSearchFromHistory(id) - Re-activate search
   - updateAddressSearchSettings(id, updater) - Update display settings
   - setAddressSubMode(mode) - Switch between radius/polygon
   - checkOverpassCooldown() - Returns seconds remaining or 0 if ready

 1.4 Extend ResultsContext for Addresses

 Modify: src/contexts/ResultsContext.jsx
 - Add addressResults state (array) - Street-level address results
 - Add filteredAddressResults computed state
 - Update result normalization to handle address data structure

 Phase 2: Address Search Component (2 new files)

 2.1 Create Main Component

 New file: src/components/Search/AddressSearch.jsx

 Structure:
 - Mode Toggle (Tab-style: Radius | Polygon)
 - [If radius mode]:
   - Search input with autocomplete
   - Radius slider (1-10 miles, default 5)
   - Search/Place Point button
 - [If polygon mode]:
   - Instructions: "Draw shapes on map to search"
   - (Polygon tools appear on map)
 - Cooldown Timer (when active):
   - Progress bar filling 0→100% over 5 seconds
   - Text: "Please wait X seconds" or "Ready"
   - Disabled search button during cooldown
 - Search History Chips:
   - Display all addressSearches as chips
   - Click to activate/focus
   - X button to remove
   - Dropdown menu for settings (showMarkers, showResults, showZipBorders)
   - Active chip highlighted red
   - Label format: "Address: [location] (Radius: 5mi)" or "Address: Shape 1 (Polygon)"

 Key Features:
 - Validates radius ≤ 10 miles before search
 - Validates polygon ≤ 70 sq mi before search (shows error modal with current size +
 overage)
 - Manages cooldown timer with setInterval
 - Updates progress bar state every 100ms
 - Blocks all search actions during cooldown

 2.2 Create Error Modal Component

 New file: src/components/Modals/PolygonLimitErrorModal.jsx
 - Shows when polygon exceeds 70 sq mi
 - Displays: "Polygon too large: XX.X sq mi (XX.X sq mi over limit)"
 - Suggests reducing size
 - Close button

 Phase 3: Search Logic Integration

 3.1 Update Main Search Handler

 Modify: src/contexts/SearchContext.jsx - handleSearch() function
 - Add if (searchMode === 'address') branch:
   a. Check cooldown: if (checkOverpassCooldown() > 0) return;
   b. Validate limits:
       - Radius: if (radius > 10) { showToast('Max 10 miles'); return; }
     - Polygon: Calculate area, check ≤ 70 sq mi
   c. Call OverpassService based on addressSubMode
   d. Parse results into address objects
   e. For each address, lookup ZIP code via reverse geocoding
   f. Normalize to include: street, unit, housenumber, city, state, zip, lat, lng
   g. Create search entry with unique ID
   h. Add to addressSearches history (max 6)
   i. Store results in searchResultsById[entryId]
   j. Set lastOverpassCall = Date.now()
   k. Start cooldown timer
   l. Rebuild displayed results
   m. Update addressResults and trigger aggregation

 3.2 Add Polygon Area Calculation

 New utility: src/utils/polygonHelpers.js
 - calculatePolygonArea(coordinates) - Returns square miles
 - Uses Turf.js area() function (already installed)
 - Convert sq meters to sq miles

 3.3 Wire Up Map Callbacks

 Modify: src/GeoApplicationNew.jsx
 - Add address mode polygon callback similar to existing polygon search
 - When searchMode === 'address' && addressSubMode === 'polygon':
   - Enable drawing tools
   - On shape created → validate size → call performSingleShapeSearch
   - On shape deleted → remove from addressSearches

 Phase 4: Results Display (2 modified files)

 4.1 Add Streets Tab

 Modify: src/components/Results/DrawerTabs.jsx
 - Add to tabs array at position 0:
 {
   key: 'streets',
   label: `Streets (${addressResults.length})`,
   icon: MapPin,
   showOnlyFor: ['address'] // Custom prop to show only in address mode
 }
 - Update tab rendering logic to filter based on searchMode

 4.2 Create Streets Results Table

 New file: src/components/Results/StreetsTable.jsx
 - Columns: House #, Street, Unit, City, State, ZIP, Actions
 - Sortable by any column
 - Click row to center map on address marker
 - Double-click to zoom in
 - Filter with search input from drawer header
 - Export functionality (includes all address fields)

 4.3 Update Drawer Content

 Modify: src/components/Results/DrawerContent.jsx
 - Add {activeTab === 'streets' && <StreetsTable ... />} case

 Phase 5: Map Integration (1 modified file)

 5.1 Add Address Markers

 Modify: src/components/Map/MapMarkers.jsx
 - Add address markers rendering:
 {searchMode === 'address' && addressResults.map((address) => (
   <Marker
     position={[address.lat, address.lng]}
     icon={customAddressIcon} // House icon
   >
     <Popup>
       {address.housenumber} {address.street} {address.unit}
       <br/>{address.city}, {address.state} {address.postcode}
     </Popup>
   </Marker>
 ))}
 - Add multi-search visualization (circles/polygons for each address search)
 - Color code by search (like radius searches)

 Phase 6: Polish & Testing

 6.1 Styling

 - Match existing search component styles
 - Tab-style toggle for radius/polygon mode
 - Progress bar design (red theme, smooth animation)
 - Error modal styling (match CustomExportModal)

 6.2 Integration Points

 - Add to SearchControls rendering
 - Update drawer tabs conditional logic
 - Export functionality includes address fields
 - Search history panel supports address searches

 File Summary

 New Files (6):
 1. src/services/overpassService.js - Overpass API integration
 2. src/components/Search/AddressSearch.jsx - Main search UI
 3. src/components/Modals/PolygonLimitErrorModal.jsx - Error modal
 4. src/components/Results/StreetsTable.jsx - Address results table
 5. src/utils/polygonHelpers.js - Area calculation
 6. src/components/Map/AddressMarkerIcon.jsx - Custom marker icon

 Modified Files (7):
 1. src/components/Header/SearchModeToggle.jsx - Add address mode
 2. src/contexts/SearchContext.jsx - State + logic
 3. src/contexts/ResultsContext.jsx - Address results state
 4. src/components/Search/SearchControls.jsx - Render AddressSearch
 5. src/components/Results/DrawerTabs.jsx - Add Streets tab
 6. src/components/Results/DrawerContent.jsx - Render StreetsTable
 7. src/components/Map/MapMarkers.jsx - Address markers

 Key Features Checklist

 - ✅ Radius search (1-10 mile limit with validation)
 - ✅ Polygon search (70 sq mi limit with detailed error)
 - ✅ Mode toggle (tab-style in floating panel)
 - ✅ 5-second cooldown (progress bar + countdown text)
 - ✅ Multi-search support (chips, history, activate/remove)
 - ✅ Streets tab in drawer (shows all address fields)
 - ✅ Map markers for addresses (custom house icon)
 - ✅ Overpass API integration (radius + polygon queries)
 - ✅ ZIP aggregation (addresses grouped by ZIP/city/county/state)
 - ✅ Export support (CSV with all address fields)

 Implementation Order

 1. Core infrastructure (overpassService, state management)
 2. AddressSearch component (UI + validation)
 3. Search logic (handlers, API calls, result processing)
 4. Results display (Streets tab, table)
 5. Map integration (markers, polygons)
 6. Polish (styling, error handling, testing)
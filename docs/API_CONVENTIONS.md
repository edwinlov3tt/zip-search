# ZIP Search API Conventions and Documentation

## Service Architecture

### Primary Services

#### 1. ZipCodeService (`/src/services/zipCodeService.js`)
The main orchestrator service that manages data source selection.

**Configuration Variables:**
```javascript
const USE_SUPABASE = true;  // Primary data source (PostgreSQL)
const USE_STATIC_DATA = false;  // Fallback to local JSON
```

**Methods:**
- `search(params)` - Main search method
- `getStates()` - Returns list of states
- `getCounties(state)` - Returns counties for a state
- `getCities(state, county)` - Returns cities for state/county
- `getZipCode(zipCode)` - Get single ZIP details
- `geocodeLocation(location)` - Geocode text to coordinates

---

#### 2. SupabaseService (`/src/services/supabaseService.js`)
Handles all Supabase database interactions.

**Environment Variables:**
```bash
VITE_SUPABASE_URL=https://xpdvxliqbrctzyxmijmm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_zumI-PDghciBHp7hy4DODw_TQvZhhYT
```

**Database Table:** `zipcodes` (NOT `zip_codes`)

**Table Schema:**
```sql
CREATE TABLE zipcodes (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10) NOT NULL UNIQUE,
  city VARCHAR(100),
  state VARCHAR(50),
  state_code VARCHAR(2),
  county VARCHAR(100),
  county_code VARCHAR(10),
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6)
);
```

---

#### 3. OptimizedStaticService (`/src/services/optimizedStaticService.js`)
Local static data fallback service.

**Data Source:** `/public/zipdata.json` (2.7MB)

**Methods:**
- `loadData()` - Loads and caches JSON data
- `search(params)` - Searches cached data
- `getStates()` - Returns states from cache
- `getCounties(params)` - Returns counties
- `getCities(params)` - Returns cities
- `getZipCode(params)` - Returns single ZIP

---

#### 4. ZipBoundariesService (`/src/services/zipBoundariesService.js`)
Handles ZIP code boundary polygons (GeoJSON).

**API Endpoint:** `https://geo.edwinlovett.com`

**Methods:**
- `getZipBoundary(zipCode, simplified)` - Single ZIP boundary
- `getMultipleZipBoundaries(zipCodes, simplified)` - Multiple boundaries
- `getViewportBoundaries(bounds, limit, simplified)` - Viewport-based loading
- `checkHealth()` - API health check

---

## Data Formats

### Search Parameters Object
```javascript
{
  query: string,        // Text search (ZIP, city, county)
  lat: number,          // Center latitude for radius search
  lng: number,          // Center longitude for radius search
  radius: number,       // Radius in miles
  state: string,        // State code (e.g., "CA")
  county: string,       // County name
  city: string,         // City name
  polygon: array,       // Polygon coordinates [[lng, lat], ...]
  limit: number,        // Max results (default: 100)
  offset: number        // Pagination offset (default: 0)
}
```

### ZIP Code Response Format
```javascript
{
  zipcode: string,      // "90210"
  city: string,         // "Beverly Hills"
  state: string,        // "CA" (state code)
  stateCode: string,    // "CA" (redundant for compatibility)
  county: string,       // "Los Angeles"
  latitude: number,     // 34.0736
  longitude: number,    // -118.4004
  lat: number,          // 34.0736 (redundant for compatibility)
  lng: number           // -118.4004 (redundant for compatibility)
}
```

### Search Response Format
```javascript
{
  results: Array<ZipCode>,  // Array of ZIP code objects
  total: number,             // Total count
  offset: number,            // Current offset
  limit: number,             // Results per page
  hasMore: boolean           // More results available
}
```

### State Format
```javascript
{
  code: string,   // "CA"
  name: string    // "California" or "CA" depending on source
}
```

### County/City Format
```javascript
{
  name: string    // "Los Angeles"
}
```

### Boundary Format (GeoJSON)
```javascript
{
  type: "Feature",
  properties: {
    zipcode: string,
    city: string,
    state: string,
    county: string
  },
  geometry: {
    type: "Polygon" | "MultiPolygon",
    coordinates: array  // [[[lng, lat], ...]]
  }
}
```

---

## API Call Flow

### 1. Standard Search Flow
```
User Input → ZipCodeService.search()
              ↓
    [USE_SUPABASE=true?]
              ↓
    SupabaseService.search()
              ↓
    Supabase API (zipcodes table)
              ↓
    Transform to standard format
              ↓
    Return to UI
```

### 2. Boundary Loading Flow
```
Map Viewport Change → ZipBoundariesService.getViewportBoundaries()
                      ↓
              Check localStorage cache
                      ↓
              [Cache miss?]
                      ↓
              Fetch from geo.edwinlovett.com
                      ↓
              Store in cache
                      ↓
              Return GeoJSON FeatureCollection
```

### 3. Hierarchical Search Flow
```
State Selection → ZipCodeService.getCounties(state)
                  ↓
        SupabaseService.getCounties(state)
                  ↓
        SELECT DISTINCT county FROM zipcodes WHERE state_code = ?
                  ↓
        Return county list
```

---

## Error Handling

### Service Priority
1. **Primary:** Supabase (if USE_SUPABASE=true)
2. **Fallback:** OptimizedStaticService (if configured)
3. **Error Response:** Empty results with error message

### Common Error Scenarios

#### Supabase Connection Failed
```javascript
// Current behavior (no fallback):
throw error;  // Propagates to UI

// Previous behavior (with fallback):
console.warn('Supabase failed, falling back to static data');
return OptimizedStaticService.search(params);
```

#### Missing ZIP Boundary
```javascript
// Returns null instead of throwing error
if (response.status === 404) {
  return null;  // Silently handle missing boundaries
}
```

---

## Environment Variables

### Required for Client (Vite)
```bash
# Must start with VITE_ to be accessible in browser
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

### Server-Side Only
```bash
# Not accessible in browser (no VITE_ prefix)
SUPABASE_SERVICE_KEY=your_service_key_here
```

---

## Debugging Tips

### Check Supabase Connection
```bash
# Test with curl
curl -X GET 'https://xpdvxliqbrctzyxmijmm.supabase.co/rest/v1/zipcodes?select=*&limit=1' \
  -H 'apikey: your_key_here' \
  -H 'Authorization: Bearer your_key_here'

# Test with Node.js
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('url', 'key');
supabase.from('zipcodes').select('*').limit(1).then(console.log);
"
```

### Check Static Data Loading
```javascript
// In browser console
fetch('/zipdata.json')
  .then(r => r.json())
  .then(data => console.log('Loaded:', data.length, 'ZIPs'));
```

### Check Boundary API
```bash
curl https://geo.edwinlovett.com/zip/90210?simplified=true
```

---

## Common Issues and Solutions

### Issue: "rt.map is not a function"
**Cause:** Data format mismatch between service and UI
**Solution:** Ensure services return arrays, not objects with arrays
```javascript
// Wrong
return { states: [...] }

// Correct
return [...]
```

### Issue: Mixed Content Error (HTTPS/HTTP)
**Cause:** HTTPS page requesting HTTP resource
**Solution:** Use HTTPS endpoints only (geo.edwinlovett.com)

### Issue: Supabase 404 on table
**Cause:** Wrong table name
**Solution:** Use `zipcodes` not `zip_codes`

### Issue: Environment variables not loading
**Cause:** Missing VITE_ prefix for client-side vars
**Solution:** Prefix with VITE_ for browser access

---

## Testing Commands

### Quick Health Checks
```bash
# Test Supabase
curl https://xpdvxliqbrctzyxmijmm.supabase.co/rest/v1/

# Test Boundaries API
curl https://geo.edwinlovett.com/health

# Test local dev server
curl http://localhost:5173
```

### Build and Deploy
```bash
npm run build        # Build for production
npm run preview      # Test production build locally
```

---

## Deployment Checklist

1. ✅ Environment variables set in Vercel dashboard
2. ✅ VITE_ prefix for client-side variables
3. ✅ Supabase table name is `zipcodes`
4. ✅ All API endpoints use HTTPS
5. ✅ Static data file exists at `/public/zipdata.json`
6. ✅ Boundary API accessible at geo.edwinlovett.com

---

## Service Method Signatures

### ZipCodeService
```javascript
static async search(params: SearchParams): Promise<SearchResponse>
static async getStates(): Promise<State[]>
static async getCounties(state: string): Promise<County[]>
static async getCities(state: string, county?: string): Promise<City[]>
static async getZipCode(zipCode: string): Promise<ZipCodeResponse>
static async geocodeLocation(location: string): Promise<GeocodedLocation>
```

### SupabaseService
```javascript
async search(params: SearchParams): Promise<SearchResponse>
async getStates(): Promise<State[]>
async getCounties(state: string): Promise<County[]>
async getCities(state: string, county?: string): Promise<City[]>
async getZipCode(zipCode: string): Promise<ZipCodeResponse>
async checkHealth(): Promise<boolean>
```

### ZipBoundariesService
```javascript
async getZipBoundary(zipCode: string, simplified?: boolean): Promise<Feature>
async getMultipleZipBoundaries(zipCodes: string[], simplified?: boolean): Promise<FeatureCollection>
async getViewportBoundaries(bounds: Bounds, limit?: number, simplified?: boolean): Promise<FeatureCollection>
async checkHealth(): Promise<boolean>
```
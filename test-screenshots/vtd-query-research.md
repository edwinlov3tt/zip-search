# VTD Query Strategy Research

## Date: 2025-11-03

## Context
Research for optimal Census Tiger VTD (Voting Tabulation District) query strategy for ZIP code marketing tool.

### Current Implementation Status
- **Current approach**: Viewport/bounding box queries (lines 194-284 in BoundaryManager.jsx)
- **Problem**: Viewport queries load VTDs indiscriminately within bounds
- **Issue**: Doesn't respect the specific counties/cities in search results
- **Texas problem**: State has 8,000+ VTDs, making broad queries fail

## Data Structure Analysis

### 1. Search Results Data Available

#### ZIP Results Structure (from ResultsContext.jsx & supabaseService.js)
```javascript
{
  id: string,
  zipCode: string,
  city: string,
  county: string,           // County NAME (e.g., "Lubbock")
  state: string,            // 2-letter state code (e.g., "TX")
  stateCode: string,
  county_code: string,      // County code from database (if available)
  latitude: number,
  longitude: number,
  area: number,
  overlap: number,
  searchSequences: array,
  searchIds: array
}
```

#### County Results Structure
```javascript
{
  id: string,
  name: string,             // County name (e.g., "Lubbock")
  state: string,            // 2-letter state code
  lat/latitude: number,
  lng/longitude: number,
  searchSequences: array
}
```

#### City Results Structure
```javascript
{
  id: string,
  name: string,             // City name
  state: string,            // 2-letter state code
  county: string,           // County name
  lat/latitude: number,
  lng/longitude: number,
  searchSequences: array
}
```

### 2. Key Findings

**Available County Information:**
- ✅ County NAME available in all ZIP results
- ✅ County NAME available in all city results
- ⚠️  County FIPS code stored as `county_code` in database but not in STATE_TO_FIPS mapping
- ✅ State FIPS codes available via STATE_TO_FIPS mapping in vtdBoundariesService.js

**Missing Data:**
- ❌ County FIPS codes not readily available
- ❌ No county name → FIPS code mapping in codebase
- ❌ Would need external lookup or additional database query

## Census Tiger API Analysis

### VTD Layer Structure (from vtdBoundariesService.js)
- **Endpoint**: `https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/Legislative/MapServer/13`
- **Available Query Fields**: 
  - `STATE` (FIPS code, 2 digits)
  - `COUNTY` (FIPS code, 3 digits) 
  - `VTDST` (VTD code)
  - `GEOID`, `NAME`, `AREALAND`, `AREAWATER`, `CENTLAT`, `CENTLON`

### Query Strategies Available

#### 1. State-Based Query (CURRENT - Lines 81-159 in vtdBoundariesService.js)
```javascript
where: `STATE='48'`  // All VTDs in Texas
```
**Problem**: Texas has 8,000+ VTDs → Query fails or times out

#### 2. County-Based Query (OPTIMAL but needs FIPS codes)
```javascript
where: `STATE='48' AND COUNTY='303'`  // Lubbock County, TX only
```
**Requirements**:
- Need County FIPS codes (STATE + COUNTY = 5-digit code)
- Example: Lubbock County, TX = State 48 + County 303 = FIPS 48303

#### 3. Viewport-Based Query (CURRENT IMPLEMENTATION)
```javascript
// Lines 168-218 in vtdBoundariesService.js
geometry: { xmin, ymin, xmax, ymax }
geometryType: 'esriGeometryEnvelope'
spatialRel: 'esriSpatialRelIntersects'
resultRecordCount: 500  // Max limit
```
**Problems**:
- Loads VTDs indiscriminately within bounds
- Doesn't respect actual search result counties
- May miss VTDs if more than 500 in viewport
- Less efficient for users who filtered to specific counties

## Proposed Solutions

### Option A: County-Based Loading (RECOMMENDED)
**Approach**: Query VTDs by County FIPS codes derived from search results

**Pros**:
- Most precise - only loads VTDs for result counties
- Respects user's search filters
- Handles Texas effectively (Lubbock County ≈ 150 VTDs vs 8,000+ statewide)
- Better UX for marketing use case

**Cons**:
- Requires County FIPS code lookup
- Need to build/maintain county name → FIPS mapping

**Implementation Steps**:
1. Create county FIPS code mapping (county name + state → FIPS)
2. Extract unique counties from ZIP/city results
3. Build WHERE clause: `(STATE='48' AND COUNTY='303') OR (STATE='48' AND COUNTY='441')`
4. Query VTDs in batches if many counties

**Batch Strategy**:
- Test max counties per query (likely 10-20)
- Batch if search spans many counties
- Cache results by county for reuse

### Option B: Hybrid Viewport + State Filter
**Approach**: Use viewport but filter to states in results

**Pros**:
- Simpler implementation (no FIPS lookup needed)
- Still better than current (at least filters by state)

**Cons**:
- Still loads unnecessary VTDs in multi-county searches
- Doesn't solve the Texas problem well
- Less optimal for marketing use case

### Option C: Keep Current Viewport Approach
**Approach**: No changes, keep bounding box queries

**Pros**:
- Already implemented
- Works for small search areas

**Cons**:
- Doesn't respect search result counties
- Poor UX for filtered county searches
- May hit 500 VTD limit in dense areas

## Recommendations

### Primary Recommendation: **Option A - County-Based Loading**

**Why**:
1. Best alignment with marketing tool use case
2. Respects user's search filters (if they searched "Lubbock County", show only those VTDs)
3. Solves the Texas 8,000 VTD problem
4. More efficient API usage

**Implementation Priority**:
1. **Phase 1**: Build County FIPS lookup
   - Create mapping file or use Census API to lookup
   - Or add county_fips to database and populate

2. **Phase 2**: Update vtdBoundariesService.js
   - Add `getVtdBoundariesForCounties(countyFipsList, simplified)`
   - Build WHERE clause with county FIPS codes
   - Handle batching for many counties

3. **Phase 3**: Update BoundaryManager.jsx
   - Extract unique counties from results (zipResults + cityResults + countyResults)
   - Convert to FIPS codes
   - Call new county-based method

**Fallback Strategy**:
- If county FIPS lookup fails → fall back to viewport query
- Cache county FIPS lookups for performance

### Testing Strategy

**Test Cases**:
1. Single county (Lubbock, TX) - expect ~150 VTDs
2. Multiple counties in Texas - test batch size limits
3. Multi-state search - verify state boundaries
4. Dense urban area (NYC) - test performance
5. Large geographic area - test reasonable limits

**API Limits to Test**:
- Max counties in single WHERE clause
- Response time for different batch sizes
- Cache effectiveness

## Next Steps

1. Create County FIPS code lookup service/mapping
2. Test Census API with county-based queries
3. Implement new query method in vtdBoundariesService.js
4. Update BoundaryManager to use county-based approach
5. Add VTD tab to results drawer (optional enhancement)

## Additional Considerations

### VTD Tab in Results Drawer?
Current tabs (from DrawerTabs.jsx lines 24-37):
- ZIPs, Cities, Counties, States, Searches, Excluded

**Potential VTD Tab**:
- Would show list of VTDs in current view
- Allow filtering/exclusion like other tabs
- Display VTD metadata (code, name, area)
- **Decision**: Lower priority - focus on map visualization first

### Caching Strategy
Current cache (vtdBoundariesService.js lines 23-26):
- 5-minute cache timeout
- Separate viewport cache

**Recommended Enhancement**:
- Cache by county FIPS code for better reuse
- Longer cache (15-30 minutes) for county data
- Track cache hit rate for optimization

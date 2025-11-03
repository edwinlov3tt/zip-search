# ResultsContext - Data Storage & Management

## Overview

**File**: `src/contexts/ResultsContext.jsx` (564 lines)

**Purpose**: Manages all search result data, handles hierarchical removal, sorting, filtering, and provides result interaction handlers.

## State Variables

### Results by Type
```javascript
const [zipResults, setZipResults] = useState([]);
const [cityResults, setCityResults] = useState([]);
const [countyResults, setCountyResults] = useState([]);
const [stateResults, setStateResults] = useState([]);
const [addressResults, setAddressResults] = useState([]);  // Street addresses
const [geocodeResults, setGeocodeResults] = useState([]);  // Geocoded addresses
const [notFoundAddresses, setNotFoundAddresses] = useState([]); // Failed geocoding
```

### Pagination
```javascript
const [currentPage, setCurrentPage] = useState(0);
const [hasMoreResults, setHasMoreResults] = useState(false);
const [totalResults, setTotalResults] = useState(0);
```

### Removal & Exclusion
```javascript
const [removedItems, setRemovedItems] = useState(new Set());
// Set of removal keys for filtered items

const [excludedGeos, setExcludedGeos] = useState({
  zips: [],
  cities: [],
  counties: [],
  states: []
});
// Arrays of excluded items (hierarchical removal)
```

### Selection & Interaction
```javascript
const [selectedResult, setSelectedResult] = useState(null);
// Currently selected result: { type, id }

const [mapInteractionCallback, setMapInteractionCallback] = useState(null);
// Callback for map interactions from result clicks

const markersRef = useRef({});
// Map of marker IDs to marker objects
```

### Sorting
```javascript
const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
```

## Key Functions

### 1. removeItem() - Hierarchical Removal

**Purpose**: Remove item and all its children

```javascript
removeItem('state', stateItem)
// Removes: state + all counties + all cities + all ZIPs in state

removeItem('county', countyItem)
// Removes: county + all cities + all ZIPs in county

removeItem('city', cityItem)
// Removes: city + all ZIPs in city

removeItem('zip', zipItem)
// Removes: just the ZIP
```

**Implementation** (simplified):
```javascript
const removeItem = useCallback((type, item) => {
  const newRemovedItems = new Set(removedItems);
  const newExcludedGeos = { ...excludedGeos };

  if (type === 'state') {
    const stateName = item.state || item.name;
    newExcludedGeos.states.push(item);
    newRemovedItems.add(`state-${stateName}`);

    // Remove all children
    countyResults.forEach(county => {
      if (county.state === stateName) {
        newRemovedItems.add(getRemovalKey('county', county));
        newExcludedGeos.counties.push(county);
      }
    });
    // ... remove cities and ZIPs
  }

  setRemovedItems(newRemovedItems);
  setExcludedGeos(newExcludedGeos);
}, [removedItems, excludedGeos, ...]);
```

### 2. restoreItem() - Hierarchical Restoration

**Purpose**: Restore removed item and all its children

```javascript
const restoreItem = useCallback((type, item) => {
  // Remove from excluded lists and removedItems Set
  // Restore all children automatically
}, []);
```

### 3. handleResultSelect() - Result Click Handler

**Purpose**: Handle result row clicks with intelligent zoom and toggle behavior

**Features**:
- Toggle selection on/off (click same item twice)
- Zoom to item on first click
- Fit bounds to all results on deselect
- Open marker popup for ZIP codes

```javascript
const handleResultSelect = useCallback(async (type, result) => {
  const isAlreadySelected = selectedResult?.type === type && selectedResult?.id === result.id;

  if (isAlreadySelected) {
    // Deselect - fit bounds to all results
    setSelectedResult(null);
    fitBoundsToAllResults(type);
    closeMarkerPopup(result);
  } else {
    // Select - zoom to result
    setSelectedResult({ type, id: result.id });

    const lat = parseFloat(result.lat || result.latitude);
    const lng = parseFloat(result.lng || result.longitude);
    const zoom = getZoomForType(type); // 13 for zip, 12 for city, 9 for county, 7 for state

    mapInteractionCallback({
      type,
      result,
      center: [lat, lng],
      zoom
    });

    // Open marker popup after animation
    if (type === 'zip') {
      setTimeout(() => openMarkerPopup(result), 500);
    }
  }
}, [mapInteractionCallback, selectedResult, ...]);
```

### 4. filterResults() - Removal Filter

**Purpose**: Filter out removed items from result arrays

```javascript
const filterResults = useCallback((results, type) => {
  return results.filter(item => !removedItems.has(getRemovalKey(type, item)));
}, [removedItems, getRemovalKey]);
```

**Memoized Filtered Results**:
```javascript
const filteredZipResults = useMemo(() =>
  filterResults(zipResults, 'zip'),
  [filterResults, zipResults]
);
```

### 5. getCurrentData() - Sorted & Filtered Data

**Purpose**: Get current tab's data with sorting applied

```javascript
const getCurrentData = useCallback((activeTab) => {
  let data = [];

  // Select data based on tab
  switch (activeTab) {
    case 'zips': data = filteredZipResults; break;
    case 'cities': data = filteredCityResults; break;
    // ... other cases
  }

  // Apply sorting
  if (sortConfig.key) {
    data = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  return data;
}, [filteredZipResults, ..., sortConfig]);
```

### 6. clearResults() - Reset All Results

```javascript
const clearResults = useCallback(() => {
  setZipResults([]);
  setCityResults([]);
  setCountyResults([]);
  setStateResults([]);
  setAddressResults([]);
  setGeocodeResults([]);
  setNotFoundAddresses([]);
  setTotalResults(0);
  setHasMoreResults(false);
  setCurrentPage(0);
  setExcludedGeos({ zips: [], cities: [], counties: [], states: [] });
  setRemovedItems(new Set());
  setSelectedResult(null);
}, []);
```

## Usage Examples

### Setting Results
```javascript
import { useResults } from '../contexts/ResultsContext';

function SearchHandler() {
  const { setZipResults, setCityResults } = useResults();

  const handleSearch = async () => {
    const results = await ZipCodeService.search(params);
    setZipResults(results);
  };
}
```

### Hierarchical Removal
```javascript
function ResultsTable() {
  const { filteredZipResults, removeItem } = useResults();

  return (
    <table>
      {filteredZipResults.map(zip => (
        <tr key={zip.zipCode}>
          <td>{zip.zipCode}</td>
          <td>
            <button onClick={() => removeItem('zip', zip)}>
              Remove
            </button>
          </td>
        </tr>
      ))}
    </table>
  );
}
```

### Result Selection
```javascript
function ResultRow({ result }) {
  const { handleResultSelect, isResultSelected } = useResults();

  return (
    <tr
      onClick={() => handleResultSelect('zip', result)}
      className={isResultSelected('zip', result.id) ? 'selected' : ''}
    >
      <td>{result.zipCode}</td>
    </tr>
  );
}
```

## Context Value (60+ exports)

```javascript
{
  // Results
  zipResults, setZipResults,
  cityResults, setCityResults,
  countyResults, setCountyResults,
  stateResults, setStateResults,
  addressResults, setAddressResults,
  geocodeResults, setGeocodeResults,
  notFoundAddresses, setNotFoundAddresses,

  // Filtered results (memoized)
  filteredZipResults,
  filteredCityResults,
  filteredCountyResults,
  filteredStateResults,
  filteredAddressResults,
  filteredGeocodeResults,

  // Pagination
  currentPage, setCurrentPage,
  hasMoreResults, setHasMoreResults,
  totalResults, setTotalResults,

  // Removal/Exclusion
  removedItems, setRemovedItems,
  excludedGeos, setExcludedGeos,
  removeItem, restoreItem,
  getTotalExcludedCount,

  // Selection
  selectedResult, setSelectedResult,
  handleResultSelect,
  handleResultDoubleClick,
  isResultSelected,

  // Map interaction
  mapInteractionCallback, setMapInteractionCallback,
  markersRef,

  // Functions
  getRemovalKey, filterResults,
  clearResults, handleSort,
  getCurrentData,
  removeGeocodeResult,
  moveToNotFound,
  restoreFromNotFound,

  // Sorting
  sortConfig, setSortConfig
}
```

## Related Documentation

- **SearchContext**: `contexts/SearchContext.md`
- **MapContext**: `contexts/MapContext.md`
- **UIContext**: `contexts/UIContext.md`
- **State Management**: `04-state-management.md`

# UIContext - Presentation State

## Overview

**File**: `src/contexts/UIContext.jsx` (303 lines)

**Purpose**: Manages all UI-only state including drawer, tabs, modals, dark mode, autocomplete, toast notifications, and export functionality.

## State Variables

### Drawer State
```javascript
const [drawerState, setDrawerState] = useState('half');
// Values: 'full' | 'half' | 'collapsed'

const [drawerHeight, setDrawerHeight] = useState(50);
// Height percentage for 'half' mode (5-90%)

const [isResizing, setIsResizing] = useState(false);
// Active resize state

const [startY, setStartY] = useState(null);
const [startHeight, setStartHeight] = useState(null);
// Mouse position tracking for resize
```

### Tabs
```javascript
const [activeTab, setActiveTab] = useState('zips');
// Values: 'zips' | 'cities' | 'counties' | 'states' | 'streets' | 'geocode' | 'excluded'

const [excludedSubTab, setExcludedSubTab] = useState('zips');
// Sub-tabs within excluded tab
```

### Sorting & Filtering
```javascript
const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
const [drawerSearchTerm, setDrawerSearchTerm] = useState('');
// Search within drawer results
```

### Theme
```javascript
const [isDarkMode, setIsDarkMode] = useState(false);
```

### Notifications
```javascript
const [toastMessage, setToastMessage] = useState(null);
const [toastType, setToastType] = useState('success');
// Types: 'success' | 'error' | 'info'

const [copySuccess, setCopySuccess] = useState(false);
// Temporary feedback for copy action
```

### Modals
```javascript
const [showCustomExport, setShowCustomExport] = useState(false);
// Custom CSV export modal
```

### Search Panel
```javascript
const [isSearchPanelCollapsed, setIsSearchPanelCollapsed] = useState(false);
// Floating search panel collapse state
```

### Autocomplete
```javascript
const [autocompleteResults, setAutocompleteResults] = useState([]);
const [showAutocomplete, setShowAutocomplete] = useState(false);
const [selectedLocation, setSelectedLocation] = useState(null);
const [isSearching, setIsSearching] = useState(false);
```

### Refs
```javascript
const tableContainerRef = useRef(null);
// For scroll management
```

## Key Functions

### 1. getDrawerHeight() - Calculate Drawer Height

```javascript
const getDrawerHeight = () => {
  switch (drawerState) {
    case 'full':
      return 'calc(100% - 2rem)';
    case 'half':
      return `${drawerHeight}%`;
    case 'collapsed':
      return '3rem';
    default:
      return '50%';
  }
};
```

### 2. handleMouseDown() - Start Drawer Resize

```javascript
const handleMouseDown = useCallback((e) => {
  setIsResizing(true);
  setStartY(e.clientY);

  // Set start height based on current state
  let currentHeight;
  if (drawerState === 'full') currentHeight = 90;
  else if (drawerState === 'collapsed') currentHeight = 5;
  else currentHeight = drawerHeight;

  setStartHeight(currentHeight);
  e.preventDefault();
}, [drawerHeight, drawerState]);
```

**Resize Effect**:
```javascript
useEffect(() => {
  const handleMouseMove = (e) => {
    if (isResizing) {
      const deltaY = startY - e.clientY;
      const viewportHeight = window.innerHeight;
      const deltaPercent = (deltaY / viewportHeight) * 100;
      const newHeight = Math.max(5, Math.min(90, startHeight + deltaPercent));
      setDrawerHeight(newHeight);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);

    // Snap to states
    if (drawerHeight < 10) setDrawerState('collapsed');
    else if (drawerHeight > 85) setDrawerState('full');
    else setDrawerState('half');
  };

  if (isResizing) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
  }

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
  };
}, [isResizing, ...]);
```

### 3. cycleDrawerState() - Toggle Drawer States

```javascript
const cycleDrawerState = useCallback(() => {
  setDrawerState(prev => {
    if (prev === 'full') return 'half';
    if (prev === 'half') return 'collapsed';
    return 'full';
  });
}, []);
```

### 4. showToast() - Toast Notifications

```javascript
const showToast = (message, type = 'success') => {
  setToastMessage(message);
  setToastType(type);

  setTimeout(() => {
    setToastMessage(null);
  }, 3000);
};

// Usage
showToast('Search completed!', 'success');
showToast('No results found', 'error');
showToast('Loading boundaries...', 'info');
```

### 5. copyToClipboard() - Copy Results

**Purpose**: Copy results to clipboard in tab-specific format

```javascript
const copyToClipboard = useCallback(async (data) => {
  let text = '';

  if (activeTab === 'geocode') {
    // Copy geocoded addresses with business name + coordinates
    text = data.map(item => {
      const parts = [];
      if (item.businessName) parts.push(item.businessName);
      if (item.address) parts.push(item.address);
      if (item.lat && item.lng) parts.push(`(${item.lat}, ${item.lng})`);
      return parts.join(' - ');
    }).join('\n');

  } else if (activeTab === 'streets') {
    // Copy street addresses
    text = data.map(item =>
      `${item.housenumber || ''} ${item.street || ''}, ${item.city || ''} ${item.state || ''} ${item.postcode || ''}`
    ).join('\n');

  } else if (activeTab === 'zips') {
    // Copy only ZIP codes
    const deduped = dedupeAndSort(data, 'zips');
    text = deduped.map(item => item.zipCode).join('\n');

  } else if (activeTab === 'cities') {
    // Copy cities with state (e.g., "Dallas, TX")
    const deduped = dedupeAndSort(data, 'cities');
    text = deduped.map(item => `${item.name}, ${item.state}`).join('\n');

  } else if (activeTab === 'counties') {
    // Copy counties with state (e.g., "Dallas County, TX")
    const deduped = dedupeAndSort(data, 'counties');
    text = deduped.map(item => `${item.name} County, ${item.state}`).join('\n');

  } else if (activeTab === 'states') {
    // Copy state names with code (e.g., "Texas, TX")
    const deduped = dedupeAndSort(data, 'states');
    text = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
  }

  try {
    await navigator.clipboard.writeText(text);
    setCopySuccess(true);
    showToast('Copied to clipboard!', 'success');

    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Failed to copy', 'error');
  }
}, [activeTab]);
```

### 6. exportSimpleCsv() - CSV Export

```javascript
const exportSimpleCsv = useCallback((data) => {
  if (!data || data.length === 0) return;

  // Use helper function (includes deduping and proper filename)
  exportSimpleCsvHelper(data, activeTab);
  showToast('CSV exported successfully!', 'success');
}, [activeTab]);
```

## Context Value (40+ exports)

```javascript
{
  // Drawer
  drawerState, setDrawerState,
  drawerHeight, setDrawerHeight,
  isResizing, setIsResizing,
  startY, setStartY,
  startHeight, setStartHeight,
  getDrawerHeight,
  handleMouseDown,
  cycleDrawerState,

  // Tabs
  activeTab, setActiveTab,
  excludedSubTab, setExcludedSubTab,

  // Sorting & Filtering
  sortConfig, setSortConfig,
  drawerSearchTerm, setDrawerSearchTerm,

  // Theme
  isDarkMode, setIsDarkMode,

  // Notifications
  toastMessage, toastType,
  showToast,
  copySuccess, setCopySuccess,

  // Modals
  showCustomExport, setShowCustomExport,

  // Search Panel
  isSearchPanelCollapsed, setIsSearchPanelCollapsed,

  // Autocomplete
  autocompleteResults, setAutocompleteResults,
  showAutocomplete, setShowAutocomplete,
  selectedLocation, setSelectedLocation,
  isSearching, setIsSearching,

  // Refs
  tableContainerRef,

  // Actions
  copyToClipboard,
  exportSimpleCsv
}
```

## Usage Examples

### Drawer Control
```javascript
import { useUI } from '../contexts/UIContext';

function DrawerHeader() {
  const { drawerState, cycleDrawerState, handleMouseDown } = useUI();

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{ cursor: 'ns-resize' }}
    >
      <button onClick={cycleDrawerState}>
        {drawerState === 'full' ? 'Minimize' : 'Maximize'}
      </button>
    </div>
  );
}
```

### Toast Notifications
```javascript
function SearchButton() {
  const { showToast } = useUI();

  const handleSearch = async () => {
    try {
      const results = await search();
      showToast(`Found ${results.length} results`, 'success');
    } catch (error) {
      showToast('Search failed', 'error');
    }
  };
}
```

### Dark Mode
```javascript
function ThemeToggle() {
  const { isDarkMode, setIsDarkMode } = useUI();

  return (
    <button onClick={() => setIsDarkMode(!isDarkMode)}>
      {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}
```

### Copy to Clipboard
```javascript
function CopyButton({ data }) {
  const { copyToClipboard, copySuccess } = useUI();

  return (
    <button onClick={() => copyToClipboard(data)}>
      {copySuccess ? '✓ Copied!' : 'Copy'}
    </button>
  );
}
```

## Related Documentation

- **SearchContext**: `contexts/SearchContext.md`
- **ResultsContext**: `contexts/ResultsContext.md`
- **MapContext**: `contexts/MapContext.md`
- **State Management**: `04-state-management.md`

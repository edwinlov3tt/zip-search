import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { exportSimpleCsv as exportSimpleCsvHelper, dedupeAndSort } from '../utils/exportHelpers';

const UIContext = createContext();

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};

export const UIProvider = ({ children }) => {
  // Drawer state
  const [drawerState, setDrawerState] = useState('half'); // 'full', 'half', 'collapsed'
  const [drawerHeight, setDrawerHeight] = useState(50); // For custom resize in half mode
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(null);
  const [startHeight, setStartHeight] = useState(null);

  // Add mouse move and mouse up handlers for drawer resizing
  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const deltaY = startY - e.clientY;
        const viewportHeight = window.innerHeight;
        const deltaPercent = (deltaY / viewportHeight) * 100;
        // Allow dragging down to 5% before limiting
        const newHeight = Math.max(5, Math.min(90, startHeight + deltaPercent));
        setDrawerHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);

      // Determine final drawer state based on height
      if (drawerHeight < 10) {
        setDrawerState('collapsed');
        setDrawerHeight(50); // Store default for next half state
      } else if (drawerHeight > 85) {
        setDrawerState('full');
      } else {
        setDrawerState('half');
        // Keep the current drawerHeight as is
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, startY, startHeight, drawerHeight, setDrawerHeight, setIsResizing, setDrawerState]);

  // Tabs
  const [activeTab, setActiveTab] = useState('zips');
  const [excludedSubTab, setExcludedSubTab] = useState('zips'); // Sub-tabs within excluded tab

  // Sorting and filtering
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [drawerSearchTerm, setDrawerSearchTerm] = useState('');

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success'); // 'success', 'error', 'info'

  // Copy feedback
  const [copySuccess, setCopySuccess] = useState(false);

  // Export modal
  const [showCustomExport, setShowCustomExport] = useState(false);

  // Search controls panel
  const [isSearchPanelCollapsed, setIsSearchPanelCollapsed] = useState(false);

  // Autocomplete
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Refs
  const tableContainerRef = useRef(null);

  // Helper function to get drawer height
  const getDrawerHeight = () => {
    switch (drawerState) {
      case 'full':
        return 'calc(100% - 2rem)'; // Full height minus a small gap
      case 'half':
        return `${drawerHeight}%`;
      case 'collapsed':
        return '3rem'; // Just show the header
      default:
        return '50%';
    }
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Drawer resize handler
  const handleMouseDown = useCallback((e) => {
    // Allow resizing in all states
    setIsResizing(true);
    setStartY(e.clientY);

    // Set start height based on current drawer state
    let currentHeight;
    if (drawerState === 'full') {
      currentHeight = 90; // Full height percentage
    } else if (drawerState === 'collapsed') {
      currentHeight = 5; // Collapsed height percentage
    } else {
      currentHeight = drawerHeight; // Use current height for half state
    }

    setStartHeight(currentHeight);
    e.preventDefault();
  }, [drawerHeight, drawerState]);

  // Cycle drawer state
  const cycleDrawerState = useCallback(() => {
    setDrawerState(prev => {
      if (prev === 'full') return 'half';
      if (prev === 'half') return 'collapsed';
      return 'full';
    });
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (data) => {
    let text = '';

    if (activeTab === 'geocode') {
      // Copy geocoded addresses with business name and coordinates
      text = data.map(item => {
        const parts = [];
        if (item.businessName) parts.push(item.businessName);

        // Build full address string
        const addressParts = [
          item.address,
          item.city,
          item.state,
          item.zip
        ].filter(Boolean);
        if (addressParts.length > 0) {
          parts.push(addressParts.join(', '));
        }

        if (item.lat && item.lng) parts.push(`(${item.lat.toFixed(6)}, ${item.lng.toFixed(6)})`);
        return parts.join(' - ');
      }).join('\n');
    } else if (activeTab === 'streets') {
      // Copy street addresses
      text = data.map(item => {
        const parts = [];
        if (item.housenumber) parts.push(item.housenumber);
        if (item.street) parts.push(item.street);
        if (item.unit) parts.push(`Unit ${item.unit}`);

        const streetAddress = parts.join(' ');
        const cityStateZip = [
          item.city || '',
          item.state || '',
          item.postcode || ''
        ].filter(Boolean).join(' ');

        return `${streetAddress}, ${cityStateZip}`;
      }).join('\n');
    } else {
      // Dedupe and sort data for other tabs
      const deduped = dedupeAndSort(data, activeTab);

      if (activeTab === 'zips') {
        // Copy only ZIP codes
        text = deduped.map(item => item.zipCode).join('\n');
      } else if (activeTab === 'cities') {
        // Copy cities with state code (e.g., "Dallas, TX")
        text = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
      } else if (activeTab === 'counties') {
        // Copy counties with state code (e.g., "Dallas County, TX")
        text = deduped.map(item => `${item.name} County, ${item.state}`).join('\n');
      } else if (activeTab === 'states') {
        // Copy state names with state code (e.g., "Texas, TX")
        text = deduped.map(item => `${item.name}, ${item.state}`).join('\n');
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      // Show success feedback
      setCopySuccess(true);
      showToast('Copied to clipboard!', 'success');
      // Reset after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      showToast('Failed to copy', 'error');
    }
  }, [activeTab]);

  // Export simple CSV
  const exportSimpleCsv = useCallback((data) => {
    if (!data || data.length === 0) return;

    // Use the helper function which includes deduping and proper filename generation
    exportSimpleCsvHelper(data, activeTab);
    showToast('CSV exported successfully!', 'success');
  }, [activeTab]);

  const value = {
    // Drawer state
    drawerState,
    setDrawerState,
    drawerHeight,
    setDrawerHeight,
    isResizing,
    setIsResizing,
    startY,
    setStartY,
    startHeight,
    setStartHeight,
    getDrawerHeight,

    // Tabs
    activeTab,
    setActiveTab,
    excludedSubTab,
    setExcludedSubTab,

    // Sorting and filtering
    sortConfig,
    setSortConfig,
    drawerSearchTerm,
    setDrawerSearchTerm,

    // Dark mode
    isDarkMode,
    setIsDarkMode,

    // Toast notifications
    toastMessage,
    toastType,
    showToast,

    // Copy feedback
    copySuccess,
    setCopySuccess,

    // Export modal
    showCustomExport,
    setShowCustomExport,

    // Search controls panel
    isSearchPanelCollapsed,
    setIsSearchPanelCollapsed,

    // Autocomplete
    autocompleteResults,
    setAutocompleteResults,
    showAutocomplete,
    setShowAutocomplete,
    selectedLocation,
    setSelectedLocation,
    isSearching,
    setIsSearching,

    // Refs
    tableContainerRef,

    // Handler functions
    handleMouseDown,
    cycleDrawerState,
    copyToClipboard,
    exportSimpleCsv
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

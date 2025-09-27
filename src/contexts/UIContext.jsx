import React, { createContext, useContext, useState, useRef } from 'react';

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
    tableContainerRef
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
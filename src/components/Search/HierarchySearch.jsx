import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, X, ChevronDown, Check } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';
import { useMap } from '../../contexts/MapContext';

const HierarchySearch = ({
  handleResetSearch,
  setSelectedState,
  setSelectedCounty,
  setSelectedCity,
  hierarchyLocations,
  handleSearch
}) => {
  const {
    selectedState,
    selectedCounty,
    selectedCity,
    searchPerformed,
    isLoading,
    hierarchySearches,
    activeHierarchySearchId,
    addHierarchySearch,
    removeHierarchySearch,
    executeHierarchySearch
  } = useSearch();

  const { isDarkMode } = useUI();
  const { mapRef } = useMap();
  const [openMenuId, setOpenMenuId] = useState(null);
  const chipsContainerRef = useRef(null);

  const { states, counties, cities } = hierarchyLocations || {
    states: [],
    counties: [],
    cities: []
  };

  // Ensure arrays are defined
  const availableStates = states || [];
  const availableCounties = counties || [];
  const availableCities = cities || [];

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return undefined;

    const handleClickOutside = (event) => {
      if (chipsContainerRef.current && !chipsContainerRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  // Removed auto-search for state-only selection to prevent loading 1000+ zips
  // But we still want to zoom to the state
  useEffect(() => {
    if (selectedState && !selectedCounty && !selectedCity && mapRef.current) {
      // Get state center coordinates (approximate centers for US states)
      const stateCenters = {
        'AL': [32.806671, -86.791130], 'AK': [61.370716, -152.404419], 'AZ': [33.729759, -111.431221],
        'AR': [34.969704, -92.373123], 'CA': [36.116203, -119.681564], 'CO': [39.059811, -105.311104],
        'CT': [41.597782, -72.755371], 'DE': [39.318523, -75.507141], 'FL': [27.766279, -81.686783],
        'GA': [33.040619, -83.643074], 'HI': [21.094318, -157.498337], 'ID': [44.240459, -114.478828],
        'IL': [40.349457, -88.986137], 'IN': [39.849426, -86.258278], 'IA': [42.011539, -93.210526],
        'KS': [38.526600, -96.726486], 'KY': [37.668140, -84.670067], 'LA': [31.169546, -91.867805],
        'ME': [44.693947, -69.381927], 'MD': [39.063946, -76.802101], 'MA': [42.230171, -71.530106],
        'MI': [43.326618, -84.536095], 'MN': [45.694454, -93.900192], 'MS': [32.741646, -89.678696],
        'MO': [38.456085, -92.288368], 'MT': [46.921925, -110.454353], 'NE': [41.125370, -98.268082],
        'NV': [38.313515, -117.055374], 'NH': [43.452492, -71.563896], 'NJ': [40.298904, -74.521011],
        'NM': [34.840515, -106.248482], 'NY': [42.165726, -74.948051], 'NC': [35.630066, -79.806419],
        'ND': [47.528912, -99.784012], 'OH': [40.388783, -82.764915], 'OK': [35.565342, -96.928917],
        'OR': [44.572021, -122.070938], 'PA': [40.590752, -77.209755], 'RI': [41.680893, -71.511780],
        'SC': [33.856892, -80.945007], 'SD': [44.299782, -99.438828], 'TN': [35.747845, -86.692345],
        'TX': [31.054487, -97.563461], 'UT': [40.150032, -111.862434], 'VT': [44.045876, -72.710686],
        'VA': [37.769337, -78.169968], 'WA': [47.400902, -121.490494], 'WV': [38.491226, -80.954453],
        'WI': [44.268543, -89.616508], 'WY': [42.755966, -107.302490]
      };

      const center = stateCenters[selectedState];
      if (center) {
        // Zoom level 6 for state view
        mapRef.current.setView(center, 6, { animate: true });
      }
    }
  }, [selectedState, selectedCounty, selectedCity, mapRef]);

  // Auto-search when state + county selected (no city)
  useEffect(() => {
    if (selectedState && selectedCounty && !selectedCity) {
      const timer = setTimeout(() => {
        addHierarchySearch(selectedState, selectedCounty, null, false);
        handleSearch({
          providedParams: {
            mode: 'hierarchy',
            state: selectedState,
            county: selectedCounty
          }
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedState, selectedCounty, selectedCity, addHierarchySearch, handleSearch]);

  // Auto-search when state + city selected (no county)
  useEffect(() => {
    if (selectedState && selectedCity && !selectedCounty) {
      const timer = setTimeout(() => {
        addHierarchySearch(selectedState, null, selectedCity, true);
        handleSearch({
          providedParams: {
            mode: 'hierarchy',
            state: selectedState,
            city: selectedCity
          }
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedState, selectedCity, selectedCounty, addHierarchySearch, handleSearch]);

  // Auto-zoom when county is selected
  useEffect(() => {
    if (selectedState && selectedCounty && !selectedCity && mapRef.current) {
      // For county view, we'll zoom to level 9-10
      // We would need county coordinates from the results or geocoding
      // For now, using a reasonable zoom level
      const timer = setTimeout(() => {
        if (mapRef.current && mapRef.current._container) {
          // Get current center and just adjust zoom for county view
          const currentCenter = mapRef.current.getCenter();
          mapRef.current.setView([currentCenter.lat, currentCenter.lng], 9, { animate: true });
        }
      }, 600); // Slightly after search starts
      return () => clearTimeout(timer);
    }
  }, [selectedCounty, selectedState, selectedCity, mapRef]);

  // Auto-search when full hierarchy is selected (state + county + city)
  useEffect(() => {
    if (selectedState && selectedCounty && selectedCity) {
      const timer = setTimeout(() => {
        addHierarchySearch(selectedState, selectedCounty, selectedCity, true);
        handleSearch({
          providedParams: {
            mode: 'hierarchy',
            state: selectedState,
            county: selectedCounty,
            city: selectedCity
          }
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedState, selectedCounty, selectedCity, addHierarchySearch, handleSearch]);

  // Auto-zoom when city is selected
  useEffect(() => {
    if (selectedState && selectedCity && mapRef.current) {
      // For city view, we'll zoom to level 12-13
      const timer = setTimeout(() => {
        if (mapRef.current && mapRef.current._container) {
          // Get current center and adjust zoom for city view
          const currentCenter = mapRef.current.getCenter();
          mapRef.current.setView([currentCenter.lat, currentCenter.lng], 12, { animate: true });
        }
      }, 600); // Slightly after search starts
      return () => clearTimeout(timer);
    }
  }, [selectedCity, selectedState, mapRef]);

  const handleChipClick = async (chip) => {
    setOpenMenuId(chip.id);
    await executeHierarchySearch(chip);
  };

  const handleRemoveChip = (chip, event) => {
    event.stopPropagation();
    removeHierarchySearch(chip.id);
    if (openMenuId === chip.id) {
      setOpenMenuId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-row items-center gap-3 w-full">
        <div className="flex flex-row flex-1 gap-3 min-w-0">
          <select
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedCounty(''); // Reset county and city when state changes
              setSelectedCity('');
            }}
            disabled={false}
            className={`w-1/3 h-9 px-3 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
              isDarkMode
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            <option value="">Select State</option>
            {availableStates.map(state => (
              <option key={state.code} value={state.code}>{state.name} ({state.code})</option>
            ))}
          </select>

          <select
            value={selectedCounty}
            onChange={(e) => {
              setSelectedCounty(e.target.value);
              setSelectedCity(''); // Reset city when county changes
            }}
            disabled={!selectedState}
            className={`w-1/3 h-9 px-3 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
              !selectedState
                ? isDarkMode
                  ? 'bg-gray-800 text-gray-500 border-gray-700'
                  : 'bg-gray-100 text-gray-500 border-gray-300'
                : isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-white text-gray-900 border-gray-300'
            }`}
          >
            <option value="">Select County</option>
            {availableCounties.map(county => (
              <option key={county.name} value={county.name}>{county.name}</option>
            ))}
          </select>

          <div className="relative w-1/3">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedState}
              className={`w-full h-9 ${selectedState ? 'pr-3' : 'pr-3'} pl-3 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                !selectedState
                  ? isDarkMode
                    ? 'bg-gray-800 text-gray-500 border-gray-700'
                    : 'bg-gray-100 text-gray-500 border-gray-300'
                  : isDarkMode
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-white text-gray-900 border-gray-300'
              }`}
            >
              <option value="">
                {!selectedState
                  ? 'Select City'
                  : selectedCounty
                    ? 'Select City (optional)'
                    : `Select City (${availableCities.length} in state)`}
              </option>
              {availableCities.map(city => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
          </div>
        </div>

        {searchPerformed && (
          <button
            onClick={handleResetSearch}
            disabled={isLoading}
            className={`h-9 px-3 sm:px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors whitespace-nowrap flex-shrink-0 ${
              isDarkMode
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>

      {/* Search history chips */}
      <div className="w-full" ref={chipsContainerRef}>
        <div className={`min-h-[44px] text-xs px-3 py-2 rounded border ${
          isDarkMode
            ? 'text-gray-200 bg-gray-700/50 border-gray-600'
            : 'text-gray-600 bg-gray-50 border-gray-200'
        }`}>
          {hierarchySearches.length === 0 ? (
            <p className="text-center">
              Select a state, then search by county or city — no need to select county first
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hierarchySearches.map((chip) => {
                const isActive = chip.id === activeHierarchySearchId;
                const chipClasses = [
                  'flex items-center gap-2 pl-3 pr-7 py-1.5 rounded-full border text-xs font-medium transition-colors shadow-sm cursor-pointer',
                  isActive
                    ? (isDarkMode ? 'bg-red-500/20 border-red-400 text-red-100' : 'bg-red-50 border-red-500 text-red-700')
                    : (isDarkMode ? 'bg-gray-800/70 border-gray-600 text-gray-200 hover:border-gray-500' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300')
                ].join(' ');

                return (
                  <div key={chip.id} className="relative">
                    <button
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className={chipClasses}
                    >
                      <span className="max-w-[200px] truncate">{chip.label}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleRemoveChip(chip, event)}
                      className={`absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center border text-[10px] ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove {chip.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HierarchySearch;
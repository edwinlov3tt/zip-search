import React, { useEffect, useRef } from 'react';
import RadiusSearch from './RadiusSearch';
import PolygonSearch from './PolygonSearch';
import AddressSearch from './AddressSearch';
import HierarchySearch from './HierarchySearch';
import UploadSearch from './UploadSearch';
import GeocodeSearch from './GeocodeSearch';
import { useUI } from '../../contexts/UIContext';
import { useSearch } from '../../contexts/SearchContext';
import { ChevronUp } from 'lucide-react';

const SearchControls = ({
  handleSearch,
  handleSearchInputChange,
  handleAutocompleteBlur,
  handleAutocompleteSelect,
  handleCSVUpload,
  handleRemoveFile,
  handleGeocodeCSVUpload,
  handleRemoveGeocodeFile,
  handleResetSearch,
  setSelectedState,
  setSelectedCounty,
  setSelectedCity,
  hierarchyLocations
}) => {
  const {
    isDarkMode,
    isSearchPanelCollapsed,
    setIsSearchPanelCollapsed
  } = useUI();
  const {
    searchMode,
    isLoading,
    searchPerformed,
    selectedState,
    selectedCounty,
    selectedCity
  } = useSearch();

  const prevIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && searchPerformed) {
      // For hierarchy mode, only collapse if county or city is selected
      // Don't collapse if only state is selected
      if (searchMode === 'hierarchy') {
        if (selectedCounty || selectedCity) {
          setIsSearchPanelCollapsed(true);
        }
      } else {
        // For other modes, collapse as usual
        setIsSearchPanelCollapsed(true);
      }
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, searchPerformed, searchMode, selectedState, selectedCounty, selectedCity, setIsSearchPanelCollapsed]);

  const panelContainerClasses = `absolute top-4 left-1/2 z-[1000] transition-all duration-300 ease-out ${
    isSearchPanelCollapsed ? 'pointer-events-none' : 'pointer-events-auto'
  }`;
  const panelClasses = `rounded-xl shadow-lg border p-3 w-[calc(100%-2rem)] max-w-[95vw] sm:w-[530px] sm:max-w-[530px] lg:max-w-[33vw] flex flex-col items-center ${
    isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
  }`;
  const panelStateClasses = isSearchPanelCollapsed
    ? 'opacity-0 pointer-events-none -translate-y-[calc(100%+16px)] scale-95'
    : 'opacity-100 pointer-events-auto translate-y-0 scale-100';

  const buttonBaseClasses = `absolute left-1/2 transform -translate-x-1/2 rounded-full shadow-lg border h-9 w-9 flex items-center justify-center transition-all duration-300 ease-out pointer-events-auto ${
    isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-white border-gray-200 text-gray-600'
  } hover:bg-red-500 hover:text-white`;

  const buttonPosition = isSearchPanelCollapsed ? 'top-0' : 'top-[calc(100%+12px)]';
  const buttonRotation = isSearchPanelCollapsed ? 'rotate-180' : 'rotate-0';

  return (
    <div className={`${panelContainerClasses}`} style={{ transform: 'translate(-50%, 0)', left: '50%' }}>
      <div
        className={`${panelClasses} transition-all duration-300 ease-out origin-top ${panelStateClasses}`}
      >
        <div className="flex flex-col gap-3 w-full max-w-full items-stretch">
          {searchMode === 'radius' && (
            <RadiusSearch
              handleSearch={handleSearch}
              handleSearchInputChange={handleSearchInputChange}
              handleAutocompleteBlur={handleAutocompleteBlur}
              handleAutocompleteSelect={handleAutocompleteSelect}
              handleResetSearch={handleResetSearch}
            />
          )}

          {searchMode === 'polygon' && (
            <PolygonSearch
              handleSearchInputChange={handleSearchInputChange}
              handleAutocompleteBlur={handleAutocompleteBlur}
              handleAutocompleteSelect={handleAutocompleteSelect}
              handleResetSearch={handleResetSearch}
            />
          )}

          {searchMode === 'address' && (
            <AddressSearch
              handleSearch={handleSearch}
              handleSearchInputChange={handleSearchInputChange}
              handleAutocompleteBlur={handleAutocompleteBlur}
              handleAutocompleteSelect={handleAutocompleteSelect}
              handleResetSearch={handleResetSearch}
            />
          )}

          {searchMode === 'hierarchy' && (
            <HierarchySearch
              handleSearch={handleSearch}
              handleResetSearch={handleResetSearch}
              setSelectedState={setSelectedState}
              setSelectedCounty={setSelectedCounty}
              setSelectedCity={setSelectedCity}
              hierarchyLocations={hierarchyLocations}
            />
          )}

          {searchMode === 'upload' && (
            <UploadSearch
              handleCSVUpload={handleCSVUpload}
              handleRemoveFile={handleRemoveFile}
            />
          )}

          {searchMode === 'geocode' && (
            <GeocodeSearch
              handleCSVUpload={handleGeocodeCSVUpload}
              handleRemoveFile={handleRemoveGeocodeFile}
            />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsSearchPanelCollapsed(prev => !prev)}
        className={`${buttonBaseClasses} ${buttonPosition}`}
        aria-label={isSearchPanelCollapsed ? 'Expand search panel' : 'Collapse search panel'}
      >
        <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${buttonRotation}`} />
      </button>
    </div>
  );
};

export default SearchControls;

import React from 'react';
import RadiusSearch from './RadiusSearch';
import PolygonSearch from './PolygonSearch';
import HierarchySearch from './HierarchySearch';
import UploadSearch from './UploadSearch';
import { useUI } from '../../contexts/UIContext';
import { useSearch } from '../../contexts/SearchContext';

const SearchControls = ({
  handleSearch,
  handleSearchInputChange,
  handleAutocompleteBlur,
  handleAutocompleteSelect,
  handleCSVUpload,
  handleRemoveFile,
  handleResetSearch,
  setSelectedState,
  setSelectedCounty,
  setSelectedCity,
  hierarchyLocations
}) => {
  const { isDarkMode } = useUI();
  const { searchMode } = useSearch();

  return (
    <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} rounded-lg shadow-lg border p-3 sm:p-4 w-[calc(100%-2rem)] sm:w-auto max-w-[95vw]`}>
      <div className="flex flex-col gap-2">
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
            handleResetSearch={handleResetSearch}
          />
        )}

        {searchMode === 'hierarchy' && (
          <HierarchySearch
            handleSearch={handleSearch}
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
      </div>
    </div>
  );
};

export default SearchControls;
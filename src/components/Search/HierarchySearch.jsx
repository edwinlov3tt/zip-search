import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';

const HierarchySearch = ({
  handleResetSearch,
  setSelectedState,
  setSelectedCounty,
  setSelectedCity,
  hierarchyLocations
}) => {
  const {
    selectedState,
    selectedCounty,
    selectedCity,
    searchPerformed,
    isLoading
  } = useSearch();

  const { isDarkMode } = useUI();

  const { availableStates, availableCounties, availableCities } = hierarchyLocations || {
    availableStates: [],
    availableCounties: [],
    availableCities: []
  };

  return (
    <div className="flex flex-row items-center gap-2 sm:gap-3">
      <div className="flex flex-col sm:flex-row flex-1 gap-2 sm:gap-3">
        <select
          value={selectedState}
          onChange={(e) => {
            setSelectedState(e.target.value);
            setSelectedCounty(''); // Reset county and city when state changes
            setSelectedCity('');
          }}
          disabled={false}
          className={`p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
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
          className={`sm:w-40 p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
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

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          disabled={!selectedState}
          className={`sm:w-40 p-2 border rounded outline-none focus:ring-2 focus:ring-red-500 ${
            !selectedState
              ? isDarkMode
                ? 'bg-gray-800 text-gray-500 border-gray-700'
                : 'bg-gray-100 text-gray-500 border-gray-300'
              : isDarkMode
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-white text-gray-900 border-gray-300'
          }`}
        >
          <option value="">Select City</option>
          {availableCities.map(city => (
            <option key={city.name} value={city.name}>{city.name}</option>
          ))}
        </select>
      </div>
      {searchPerformed && (
        <button
          onClick={handleResetSearch}
          disabled={isLoading}
          className={`py-2 px-4 sm:px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors whitespace-nowrap ${
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
  );
};

export default HierarchySearch;
import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useSearch } from '../../contexts/SearchContext';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';

const PolygonSearch = ({ handleResetSearch }) => {
  const { searchPerformed, isLoading } = useSearch();
  const { drawnShapes } = useMap();
  const { isDarkMode } = useUI();

  return (
    <div className="flex flex-row items-center gap-2 sm:gap-3">
      <div className={`flex-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        Draw shapes on the map to search within them
        {drawnShapes.length > 0 && (
          <span className={`ml-2 text-xs px-2 py-1 rounded inline-block ${
            isDarkMode
              ? 'bg-red-900/30 text-red-400'
              : 'bg-red-50 text-red-600'
          }`}>
            {drawnShapes.length} shape{drawnShapes.length > 1 ? 's' : ''} drawn
          </span>
        )}
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

export default PolygonSearch;
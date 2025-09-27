import React from 'react';
import { Layers } from 'lucide-react';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';

const MapLayerSelector = () => {
  const {
    mapType,
    setMapType,
    showMapLayers,
    setShowMapLayers
  } = useMap();

  const { isDarkMode } = useUI();

  const mapTypes = [
    { id: 'street', label: 'Street', icon: '🗺️' },
    { id: 'satellite', label: 'Satellite', icon: '🛰️' },
    { id: 'terrain', label: 'Terrain', icon: '⛰️' }
  ];

  return (
    <div className="absolute top-20 left-3 z-[1000]">
      <button
        onClick={() => setShowMapLayers(!showMapLayers)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg transition-colors ${
          isDarkMode
            ? 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
        }`}
        title="Change map type"
      >
        <Layers className="h-4 w-4" />
        <span className="text-sm font-medium">Layers</span>
      </button>

      {showMapLayers && (
        <div className={`mt-2 p-2 rounded-lg shadow-lg ${
          isDarkMode
            ? 'bg-gray-800 border border-gray-600'
            : 'bg-white border border-gray-200'
        }`}>
          <div className="space-y-1">
            {mapTypes.map(type => (
              <button
                key={type.id}
                onClick={() => {
                  setMapType(type.id);
                  setShowMapLayers(false);
                }}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded transition-colors text-sm ${
                  mapType === type.id
                    ? 'bg-red-600 text-white'
                    : isDarkMode
                      ? 'hover:bg-gray-700 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLayerSelector;
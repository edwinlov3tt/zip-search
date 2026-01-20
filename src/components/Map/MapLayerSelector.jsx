import React from 'react';
import { Map as MapIcon, Globe, Layers, Move, CircleDot } from 'lucide-react';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';

const MapLayerSelector = () => {
  const {
    mapType,
    setMapType,
    showMapLayers,
    setShowMapLayers,
    cursorTool,
    setCursorTool
  } = useMap();

  const { isDarkMode } = useUI();

  const mapOptions = [
    { type: 'street', label: 'Street', icon: MapIcon },
    { type: 'satellite', label: 'Satellite', icon: Globe },
    { type: 'terrain', label: 'Terrain', icon: Layers }
  ];

  const cursorOptions = [
    { type: 'drag', label: 'Drag', icon: Move },
    { type: 'radial', label: 'Radial Point', icon: CircleDot }
  ];

  return (
    <>
      {/* Desktop version - always visible on right */}
      <div className={`hidden lg:block absolute top-4 right-4 z-[999] ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} rounded-lg shadow-lg border p-2`}>
        <div className="space-y-1">
          {/* Map type options */}
          {mapOptions.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setMapType(type)}
              className={`w-full p-2 text-left rounded flex items-center space-x-2 transition-colors ${
                mapType === type
                  ? 'bg-red-600 text-white'
                  : isDarkMode
                    ? 'hover:bg-gray-700 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </button>
          ))}

          {/* Divider */}
          <div className={`my-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`} />

          {/* Cursor tool options */}
          {cursorOptions.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setCursorTool(type)}
              className={`w-full p-2 text-left rounded flex items-center space-x-2 transition-colors ${
                cursorTool === type
                  ? 'bg-red-600 text-white'
                  : isDarkMode
                    ? 'hover:bg-gray-700 text-gray-300'
                    : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile/Tablet version - collapsible on left */}
      <div className={`lg:hidden absolute top-20 left-4 z-[999] transition-all duration-300 ${
        showMapLayers ? 'translate-x-0' : '-translate-x-[calc(100%-40px)]'
      }`}>
        <div className={`flex items-start`}>
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'} rounded-lg shadow-lg border overflow-hidden transition-all duration-300 ${
            showMapLayers ? 'w-auto p-2' : 'w-0 p-0'
          }`}>
            <div className="space-y-1">
              {/* Map type options */}
              {mapOptions.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setMapType(type)}
                  className={`w-full p-2 text-left rounded flex items-center space-x-2 transition-colors whitespace-nowrap ${
                    mapType === type
                      ? 'bg-red-600 text-white'
                      : isDarkMode
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}

              {/* Divider */}
              <div className={`my-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`} />

              {/* Cursor tool options */}
              {cursorOptions.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setCursorTool(type)}
                  className={`w-full p-2 text-left rounded flex items-center space-x-2 transition-colors whitespace-nowrap ${
                    cursorTool === type
                      ? 'bg-red-600 text-white'
                      : isDarkMode
                        ? 'hover:bg-gray-700 text-gray-300'
                        : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Tab to pull out/collapse */}
          <button
            onClick={() => setShowMapLayers(!showMapLayers)}
            className={`${isDarkMode ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-200 text-gray-700'} border border-l-0 rounded-r-lg shadow-lg p-2 hover:bg-opacity-90 transition-colors`}
            title={showMapLayers ? 'Hide map layers' : 'Show map layers'}
          >
            <Layers className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
};

export default MapLayerSelector;
import React, { useRef, useEffect } from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

const MapMarkers = ({
  zipResults,
  selectedLocation,
  radius,
  radiusCenter,
  searchMode,
  activeTab,
  setActiveTab,
  handleResultSelect,
  geocodingService,
  removedItems,
  getRemovalKey
}) => {
  const markersRef = useRef({});

  // Filter out removed ZIP results
  const filteredZipResults = zipResults.filter(result =>
    !removedItems.has(getRemovalKey('zip', result))
  );

  return (
    <>
      {/* Add markers for ZIP results */}
      {filteredZipResults
        .filter(result => (result.lat != null && result.lng != null) || (result.latitude != null && result.longitude != null))
        .map((result) => (
          <Marker
            key={result.id}
            position={[result.lat || result.latitude, result.lng || result.longitude]}
            ref={(ref) => {
              if (ref) {
                markersRef.current[`zip-${result.id}`] = ref;
              }
            }}
            eventHandlers={{
              click: async () => {
                // Auto-switch to zips tab if not already selected
                if (activeTab !== 'zips') {
                  setActiveTab('zips');
                }
                // Call the same handler as drawer click to show only this ZIP's boundary
                await handleResultSelect('zip', result);
              }
            }}
          >
            <Popup>
              <div>
                <strong>{result.zipCode}</strong><br/>
                {result.city}, {result.state}<br/>
                {result.county}
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Target marker for selected location */}
      {searchMode === 'radius' && selectedLocation && (
        <Marker
          position={[selectedLocation.lat, selectedLocation.lng]}
          icon={L.divIcon({
            html: `
              <div style="
                width: 20px;
                height: 20px;
                background: #dc2626;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 2px;
                  height: 2px;
                  background: white;
                  border-radius: 50%;
                "></div>
              </div>
            `,
            className: 'target-marker',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-gray-900">📍 Search Center</h3>
              <p className="text-sm text-gray-600 mt-1">
                {geocodingService.formatDisplayName(selectedLocation)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {radius} mile radius from this location
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Add circles for radius search */}
      {searchMode === 'radius' && radiusCenter && (
        <Circle
          center={radiusCenter}
          radius={radius * 1609.34} // Convert miles to meters
          pathOptions={{ color: '#dc2626', fillOpacity: 0.1, weight: 2 }}
        />
      )}
    </>
  );
};

export default MapMarkers;
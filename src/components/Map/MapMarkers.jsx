import React, { useEffect } from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useResults } from '../../contexts/ResultsContext';

const MapMarkers = ({
  zipResults,
  addressResults = [],
  geocodeResults = [],
  selectedLocation,
  radius,
  radiusCenter,
  searchMode,
  activeTab,
  setActiveTab,
  handleResultSelect,
  geocodingService,
  removedItems,
  getRemovalKey,
  showRadius = true,
  showMarkers = true,
  radiusSearches = [],
  activeRadiusSearchId = null,
  addressSearches = [],
  activeAddressSearchId = null,
  removeRadiusSearch = null
}) => {
  // Get markersRef from ResultsContext to allow popup control
  const { markersRef } = useResults();

  // Filter out removed ZIP results
  const filteredZipResults = zipResults.filter(result =>
    !removedItems.has(getRemovalKey('zip', result))
  );

  // Filter out removed address results
  const filteredAddressResults = addressResults.filter(result =>
    !removedItems.has(getRemovalKey('address', result))
  );

  // Filter out removed geocode results
  const filteredGeocodeResults = geocodeResults.filter(result =>
    !removedItems.has(`geocode-${result.id}`)
  );

  return (
    <>
      {/* Add markers for address results */}
      {addressSearches.map((search) => {
        const isActive = search.id === activeAddressSearchId;
        const settings = search.settings || {};
        const shouldShowMarkers = settings.showMarkers ?? true;

        if (!shouldShowMarkers) return null;

        // Get addresses for this specific search
        const searchAddresses = filteredAddressResults.filter(addr =>
          addr.searchIds && addr.searchIds.includes(search.id)
        );

        // Limit markers to prevent browser hang (max 5000 addresses shown)
        const MAX_MARKERS = 5000;
        const limitedAddresses = searchAddresses
          .filter(result => result.lat != null && result.lng != null)
          .slice(0, MAX_MARKERS);

        return limitedAddresses.map((result) => (
            <Marker
              key={`address-${result.id}`}
              position={[result.lat, result.lng]}
              ref={(ref) => {
                if (ref) {
                  markersRef.current[`address-${result.id}`] = ref;
                }
              }}
              icon={L.divIcon({
                html: `
                  <div style="
                    width: 8px;
                    height: 8px;
                    background: ${isActive ? '#3b82f6' : '#6b7280'};
                    border: 2px solid white;
                    border-radius: 50%;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                  "></div>
                `,
                className: 'address-marker-dot',
                iconSize: [8, 8],
                iconAnchor: [4, 4]
              })}
              eventHandlers={{
                click: async () => {
                  if (activeTab !== 'streets') {
                    setActiveTab('streets');
                  }
                  await handleResultSelect('address', result);
                }
              }}
            >
              <Popup>
                <div>
                  <strong>{result.housenumber || ''} {result.street || 'Unknown'}</strong><br/>
                  {result.unit && <><span className="text-xs">Unit: {result.unit}</span><br/></>}
                  {result.city && result.state && <>{result.city}, {result.state}<br/></>}
                  {result.postcode && <span className="text-xs">ZIP: {result.postcode}</span>}
                </div>
              </Popup>
            </Marker>
          ));
      })}

      {/* Add markers for geocoded addresses */}
      {filteredGeocodeResults
        .filter(result => result.lat != null && result.lng != null)
        .map((result) => (
          <Marker
            key={`geocode-${result.id}`}
            position={[result.lat, result.lng]}
            ref={(ref) => {
              if (ref) {
                markersRef.current[`geocode-${result.id}`] = ref;
              }
            }}
            icon={L.divIcon({
              html: `
                <div style="
                  width: 32px;
                  height: 32px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #3b82f6;
                  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                ">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                    <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
                  </svg>
                </div>
              `,
              className: 'geocode-marker',
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            })}
            eventHandlers={{
              click: async () => {
                if (activeTab !== 'geocode') {
                  setActiveTab('geocode');
                }
                await handleResultSelect('geocode', result);
              }
            }}
          >
            <Popup>
              <div>
                {result.businessName && <><strong>{result.businessName}</strong><br/></>}
                <div className="text-sm">{result.fullAddress || `${result.address || ''}, ${result.city || ''}, ${result.state || ''} ${result.zip || ''}`}</div>
                {result.lat && result.lng && (
                  <div className="text-xs text-gray-500 mt-1">
                    Lat: {result.lat.toFixed(6)}, Lng: {result.lng.toFixed(6)}
                  </div>
                )}
                {result.accuracy != null && (
                  <div className="text-xs mt-1">
                    <span className={`px-1.5 py-0.5 rounded ${
                      result.accuracy >= 0.9 ? 'bg-green-100 text-green-700' :
                      result.accuracy >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      Accuracy: {(result.accuracy * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

      {/* Add markers for ZIP results */}
      {showMarkers && filteredZipResults
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
                if (activeTab !== 'zips') {
                  setActiveTab('zips');
                }
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
      {showMarkers && searchMode === 'radius' && selectedLocation && (
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

      {/* Add circles for all radius searches */}
      {radiusSearches.map((search) => {
        const isActive = search.id === activeRadiusSearchId;
        const settings = search.settings || {};
        const shouldShowRadius = settings.showRadius ?? true;
        const shouldShowMarker = settings.showMarkers ?? true;

        if (!search.center) return null;

        return (
          <React.Fragment key={search.id}>
            {/* Radius circle for each search */}
            {shouldShowRadius && (
              <Circle
                center={search.center}
                radius={search.radius * 1609.34} // Convert miles to meters
                pathOptions={{
                  color: isActive ? '#dc2626' : '#6b7280',
                  fillOpacity: isActive ? 0.15 : 0.08,
                  weight: isActive ? 2.5 : 1.5,
                  dashArray: isActive ? null : '5, 5'
                }}
              />
            )}

            {/* Center marker for each search */}
            {shouldShowMarker && (
              <Marker
                position={search.center}
                icon={L.divIcon({
                  html: `
                    <div style="
                      width: ${isActive ? '20px' : '16px'};
                      height: ${isActive ? '20px' : '16px'};
                      background: ${isActive ? '#dc2626' : '#6b7280'};
                      border: 2px solid white;
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
                  className: `radius-center-marker ${isActive ? 'active' : ''}`,
                  iconSize: isActive ? [24, 24] : [20, 20],
                  iconAnchor: isActive ? [12, 12] : [10, 10]
                })}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-gray-900">📍 {search.label}</h3>
                    {search.summary && (
                      <p className="text-sm text-gray-600 mt-1">
                        {search.summary.city && search.summary.state
                          ? `${search.summary.city}, ${search.summary.state}`
                          : search.query}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {search.radius} mile radius
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(search.timestamp).toLocaleString()}
                    </p>
                    {removeRadiusSearch && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRadiusSearch(search.id);
                        }}
                        className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                      >
                        Remove Search
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </React.Fragment>
        );
      })}

      {/* Add circles for all address searches in radius mode */}
      {addressSearches.map((search) => {
        // Only render circles for radius mode address searches
        if (search.mode !== 'radius' || !search.center) return null;

        const isActive = search.id === activeAddressSearchId;
        const settings = search.settings || {};
        const shouldShowRadius = settings.showRadius ?? true;
        const shouldShowMarker = settings.showMarkers ?? true;

        return (
          <React.Fragment key={`address-radius-${search.id}`}>
            {/* Radius circle for each address search */}
            {shouldShowRadius && (
              <Circle
                center={search.center}
                radius={search.radius * 1609.34} // Convert miles to meters
                pathOptions={{
                  color: isActive ? '#3b82f6' : '#9ca3af',
                  fillOpacity: isActive ? 0.15 : 0.08,
                  weight: isActive ? 2.5 : 1.5,
                  dashArray: isActive ? null : '5, 5'
                }}
              />
            )}

            {/* Center marker for each address search */}
            {shouldShowMarker && (
              <Marker
                position={search.center}
                icon={L.divIcon({
                  html: `
                    <div style="
                      width: ${isActive ? '20px' : '16px'};
                      height: ${isActive ? '20px' : '16px'};
                      background: ${isActive ? '#3b82f6' : '#9ca3af'};
                      border: 2px solid white;
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
                  className: `address-center-marker ${isActive ? 'active' : ''}`,
                  iconSize: isActive ? [24, 24] : [20, 20],
                  iconAnchor: isActive ? [12, 12] : [10, 10]
                })}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-gray-900">📍 {search.label}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {search.radius} mile radius
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(search.timestamp).toLocaleString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </React.Fragment>
        );
      })}

      {/* Keep the current search radius for active placement */}
      {showRadius && searchMode === 'radius' && radiusCenter && !radiusSearches.some(s =>
        s.center && s.center[0] === radiusCenter[0] && s.center[1] === radiusCenter[1]
      ) && (
        <Circle
          center={radiusCenter}
          radius={radius * 1609.34} // Convert miles to meters
          pathOptions={{ color: '#dc2626', fillOpacity: 0.1, weight: 2, dashArray: '3, 3' }}
        />
      )}
    </>
  );
};

export default MapMarkers;

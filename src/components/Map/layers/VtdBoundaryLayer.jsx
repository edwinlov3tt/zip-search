import React from 'react';
import { GeoJSON } from 'react-leaflet';

const VtdBoundaryLayer = ({
  vtdBoundariesData,
  focusedVtd,
  setToastMessage,
  setToastType
}) => {
  // Generate unique colors for each state FIPS code
  const getStateColor = (stateFips) => {
    const colors = [
      '#dc2626', // Red
      '#2563eb', // Blue
      '#16a34a', // Green
      '#ca8a04', // Yellow
      '#9333ea', // Purple
      '#db2777', // Pink
      '#ea580c', // Orange
      '#0891b2', // Cyan
      '#65a30d', // Lime
      '#c026d3', // Fuchsia
    ];

    // Use state FIPS code to determine color
    const colorIndex = parseInt(stateFips || '0', 10) % colors.length;
    return colors[colorIndex];
  };

  return (
    <GeoJSON
      key={`vtd-boundaries-${vtdBoundariesData.features.length}-${focusedVtd?.vtd_code || ''}`}
      data={vtdBoundariesData}
      style={(feature) => {
        const vtdCode = feature.properties?.vtd_code;
        const stateFips = feature.properties?.state_code;
        const isFocused = focusedVtd &&
          focusedVtd.vtd_code === vtdCode &&
          focusedVtd.state_code === stateFips;

        const baseColor = getStateColor(stateFips);

        // Focused VTD gets highlighted
        if (isFocused) {
          return {
            color: baseColor,
            weight: 3,
            opacity: 1,
            fillOpacity: 0.3,
            fillColor: baseColor
          };
        }

        // Normal VTD styling
        return {
          color: baseColor,
          weight: 1.5,
          opacity: 0.7,
          fillOpacity: 0.08,
          fillColor: baseColor
        };
      }}
      onEachFeature={(feature, layer) => {
        const vtdCode = feature.properties?.vtd_code;
        const vtdName = feature.properties?.name;
        const stateFips = feature.properties?.state_code;
        const countyFips = feature.properties?.county_code;
        const geoid = feature.properties?.geoid;
        const landArea = feature.properties?.land_area;
        const waterArea = feature.properties?.water_area;

        if (vtdCode) {
          // Create popup content
          const popupContent = document.createElement('div');

          // Format area values
          const formatArea = (sqMeters) => {
            if (!sqMeters) return 'N/A';
            const sqMiles = (sqMeters / 2589988.11).toFixed(2);
            return `${sqMiles} sq mi`;
          };

          popupContent.innerHTML = `
            <div style="min-width: 200px; font-size: 13px;">
              <strong style="font-size: 14px;">Voting District</strong><br/>
              <div style="margin-top: 6px;">
                <strong>VTD Code:</strong> ${vtdCode}<br/>
                ${vtdName ? `<strong>Name:</strong> ${vtdName}<br/>` : ''}
                ${stateFips ? `<strong>State FIPS:</strong> ${stateFips}<br/>` : ''}
                ${countyFips ? `<strong>County FIPS:</strong> ${countyFips}<br/>` : ''}
                ${geoid ? `<strong>GEOID:</strong> ${geoid}<br/>` : ''}
                ${landArea ? `<strong>Land Area:</strong> ${formatArea(landArea)}<br/>` : ''}
                ${waterArea ? `<strong>Water Area:</strong> ${formatArea(waterArea)}<br/>` : ''}
              </div>
            </div>
          `;

          layer.bindPopup(popupContent);

          // Add hover effects
          layer.on({
            mouseover: (e) => {
              const isFocused = focusedVtd &&
                focusedVtd.vtd_code === vtdCode &&
                focusedVtd.state_code === stateFips;

              if (!isFocused) {
                e.target.setStyle({
                  weight: 2.5,
                  fillOpacity: 0.2,
                  opacity: 0.9
                });
              }
            },
            mouseout: (e) => {
              const isFocused = focusedVtd &&
                focusedVtd.vtd_code === vtdCode &&
                focusedVtd.state_code === stateFips;

              if (!isFocused) {
                e.target.setStyle({
                  weight: 1.5,
                  fillOpacity: 0.08,
                  opacity: 0.7
                });
              }
            },
            click: () => {
              // Show info message when VTD is clicked
              if (setToastMessage && setToastType) {
                setToastMessage(`VTD ${vtdCode}${vtdName ? ` (${vtdName})` : ''} - State FIPS: ${stateFips}`);
                setToastType('info');
                setTimeout(() => setToastMessage(null), 3000);
              }
            }
          });
        }
      }}
    />
  );
};

export default VtdBoundaryLayer;

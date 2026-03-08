import React, { useState } from 'react';
import { GeoJSON } from 'react-leaflet';

/**
 * NeighborZipsLayer - Displays neighboring ZIPs with dashed blue style
 * Users can click on a neighbor ZIP to add it to their search results
 */
const NeighborZipsLayer = ({
  neighboringZips,
  setNeighboringZips,
  setZipResults,
  zipResults,
  updateAggregatedResults,
  setToastMessage,
  setToastType,
  ZipCodeService
}) => {
  // Loading state to prevent double-clicks on Add button
  const [isAddingZip, setIsAddingZip] = useState(false);

  if (!neighboringZips || !neighboringZips.features || neighboringZips.features.length === 0) {
    return null;
  }

  const handleAddNeighborZip = async (zipCode) => {
    // Prevent double-clicks or rapid invocations
    if (isAddingZip) return;
    setIsAddingZip(true);

    try {
      // Get ZIP details from API
      const response = await ZipCodeService.search({
        zipcode: zipCode,
        limit: 1
      });

      if (response.results && response.results.length > 0) {
        const zipData = response.results[0];
        const newZip = {
          id: Date.now(),
          zipCode: zipData.zipcode,
          city: zipData.city,
          county: zipData.county,
          state: zipData.stateCode,
          lat: zipData.latitude,
          lng: zipData.longitude,
          latitude: zipData.latitude,
          longitude: zipData.longitude,
          area: 0,
          overlap: 0,
          addedManually: true,
          addedFromNeighbor: true
        };

        // Add to results
        setZipResults(prev => [...prev, newZip]);

        // Update aggregated results
        const allZips = [...zipResults, newZip];
        if (updateAggregatedResults) {
          updateAggregatedResults(allZips);
        }

        // Remove this ZIP from neighbors since it's now in results
        setNeighboringZips(prev => {
          if (!prev || !prev.features) return prev;
          return {
            ...prev,
            features: prev.features.filter(f =>
              (f.properties?.zipcode || f.properties?.ZCTA5) !== zipCode
            )
          };
        });

        // Show success message
        setToastMessage(`ZIP ${zipCode} added to results`);
        setToastType('success');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setToastMessage(`Failed to fetch details for ZIP ${zipCode}`);
        setToastType('error');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error adding neighbor ZIP:', error);
      setToastMessage(`Error adding ZIP ${zipCode}`);
      setToastType('error');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsAddingZip(false);
    }
  };

  return (
    <GeoJSON
      key={`neighbor-zips-${neighboringZips.features.length}`}
      data={neighboringZips}
      style={() => ({
        color: '#2563eb', // Blue border
        weight: 2,
        opacity: 0.9,
        fillColor: '#3b82f6', // Blue fill
        fillOpacity: 0.1,
        dashArray: '8, 4' // Dashed line pattern
      })}
      onEachFeature={(feature, layer) => {
        const zipCode = feature.properties?.zipcode || feature.properties?.ZCTA5;

        if (zipCode) {
          // Create popup content
          const popupContent = document.createElement('div');
          popupContent.innerHTML = `
            <div style="min-width: 150px;">
              <strong>ZIP: ${zipCode}</strong><br/>
              <span style="color: #2563eb; font-size: 12px;">Neighboring ZIP</span><br/>
              ${feature.properties.city ? `City: ${feature.properties.city}<br/>` : ''}
              ${feature.properties.county ? `County: ${feature.properties.county}<br/>` : ''}
              <button
                id="add-neighbor-zip-${zipCode}"
                style="margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;"
              >
                Add to Results
              </button>
            </div>
          `;

          layer.bindPopup(popupContent);

          // Add click handler for the add button
          layer.on('popupopen', () => {
            const addButton = document.getElementById(`add-neighbor-zip-${zipCode}`);
            if (addButton) {
              addButton.addEventListener('click', async () => {
                await handleAddNeighborZip(zipCode);
                layer.closePopup();
              });
            }
          });

          // Add hover effect
          layer.on({
            mouseover: (e) => {
              e.target.setStyle({
                weight: 3,
                fillOpacity: 0.2
              });
            },
            mouseout: (e) => {
              e.target.setStyle({
                weight: 2,
                fillOpacity: 0.1
              });
            }
          });
        }
      }}
    />
  );
};

export default NeighborZipsLayer;

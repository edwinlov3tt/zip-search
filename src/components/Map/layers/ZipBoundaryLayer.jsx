import React, { useEffect, useRef, useCallback } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

const ZipBoundaryLayer = ({
  zipBoundariesData,
  focusedZipCode,
  showOnlyFocusedBoundary,
  showHatching,
  removedItems,
  getRemovalKey,
  setRemovedItems,
  setZipResults,
  zipResults,
  updateAggregatedResults,
  setToastMessage,
  setToastType,
  setZipBoundariesData,
  ZipCodeService
}) => {
  const map = useMap();
  const geoJsonRef = useRef(null);
  const layersToPatternRef = useRef(new Set());

  // Function to apply or remove diagonal pattern from all tracked layers
  const applyPatternsToLayers = useCallback(() => {
    layersToPatternRef.current.forEach(layer => {
      if (layer._path) {
        if (showHatching) {
          layer._path.setAttribute('fill', 'url(#diagonal-lines)');
        } else {
          // Remove hatching - set fill to the solid color from the style
          // Use the fillColor from layer options or default to red
          const fillColor = layer.options?.fillColor || '#dc2626';
          layer._path.setAttribute('fill', fillColor);
        }
      }
    });
  }, [showHatching]);

  // Apply patterns on map events (zoom, move can recreate SVG paths)
  useEffect(() => {
    if (!map) return;

    const handleMapEvent = () => {
      // Small delay to let Leaflet finish rendering
      setTimeout(applyPatternsToLayers, 50);
    };

    map.on('zoomend', handleMapEvent);
    map.on('moveend', handleMapEvent);

    return () => {
      map.off('zoomend', handleMapEvent);
      map.off('moveend', handleMapEvent);
    };
  }, [map, applyPatternsToLayers]);

  // Reapply patterns when data or hatching toggle changes
  useEffect(() => {
    // Small delay to let GeoJSON render
    const timer = setTimeout(applyPatternsToLayers, 100);
    return () => clearTimeout(timer);
  }, [zipBoundariesData, focusedZipCode, showOnlyFocusedBoundary, showHatching, applyPatternsToLayers]);

  // Effect to update styles when focusedZipCode changes (without full remount)
  // This allows smooth focus transitions without rebuilding all GeoJSON layers
  useEffect(() => {
    if (!geoJsonRef.current || showOnlyFocusedBoundary) return;

    // Re-apply styles to all layers based on current focus
    geoJsonRef.current.eachLayer((layer) => {
      const feature = layer.feature;
      if (!feature) return;

      const zipCode = feature.properties?.zipcode;
      const isInResults = feature.properties?.inSearchResults;
      const isFocused = zipCode === focusedZipCode;
      const isExcluded = removedItems.has(getRemovalKey('zip', { zipCode }));
      const isAdditional = feature.properties?.isAdditional;

      // Apply appropriate style based on state
      if (isFocused) {
        layer.setStyle({
          color: '#ff0000',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.2,
          fillColor: '#dc2626'
        });
      } else if (isExcluded) {
        layer.setStyle({
          color: '#ef4444',
          weight: 2,
          opacity: 0.7,
          fillOpacity: 0.08,
          fillColor: '#ef4444',
          dashArray: '10, 5, 2, 5'
        });
      } else if (isInResults) {
        layer.setStyle({
          color: '#dc2626',
          weight: 1.5,
          opacity: 0.8,
          fillOpacity: 0.25,
          fillColor: '#dc2626',
          dashArray: null
        });
        // Reapply hatching pattern if enabled
        if (showHatching && layer._path) {
          layer._path.setAttribute('fill', 'url(#diagonal-lines)');
        }
      } else if (isAdditional) {
        layer.setStyle({
          color: '#2563eb',
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.08,
          fillColor: '#3b82f6',
          dashArray: '8, 3, 2, 3'
        });
      } else {
        layer.setStyle({
          color: '#9ca3af',
          weight: 1,
          opacity: 0.5,
          fillOpacity: 0.02,
          dashArray: null
        });
      }
    });
  }, [focusedZipCode, removedItems, getRemovalKey, showOnlyFocusedBoundary, showHatching]);

  const handleAddZip = async (zipCode, isExcluded) => {
    try {
      if (isExcluded) {
        // Remove from excluded items
        const key = getRemovalKey('zip', { zipCode });
        setRemovedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });

        // Show success message
        setToastMessage(`ZIP ${zipCode} added back to results`);
        setToastType('success');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        // Get ZIP details from API if not in results
        const response = await ZipCodeService.search({
          zipcode: zipCode,
          limit: 1
        });

        if (response.results && response.results.length > 0) {
          const zipData = response.results[0];
          const newZip = {
            id: Date.now(), // Use timestamp for unique ID
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
            addedManually: true
          };

          // Add to results
          setZipResults(prev => [...prev, newZip]);

          // Update aggregated results
          const allZips = [...zipResults, newZip];
          updateAggregatedResults(allZips);

          // Show success message
          setToastMessage(`ZIP ${zipCode} added to results`);
          setToastType('success');
          setTimeout(() => setToastMessage(null), 3000);
        } else {
          // Show error if ZIP not found
          setToastMessage(`Failed to fetch details for ZIP ${zipCode}`);
          setToastType('error');
          setTimeout(() => setToastMessage(null), 3000);
        }
      }

      // Update boundaries to reflect new state
      if (zipBoundariesData) {
        const updatedFeatures = zipBoundariesData.features.map(f => {
          if (f.properties?.zipcode === zipCode) {
            return {
              ...f,
              properties: {
                ...f.properties,
                inSearchResults: true,
                isAdditional: false
              }
            };
          }
          return f;
        });
        setZipBoundariesData({
          ...zipBoundariesData,
          features: updatedFeatures
        });
      }
    } catch (error) {
      console.error('Error adding ZIP:', error);
      setToastMessage(`Error adding ZIP ${zipCode}`);
      setToastType('error');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <GeoJSON
      ref={geoJsonRef}
      key={`zip-boundaries-${zipBoundariesData.features.length}-${showOnlyFocusedBoundary ? focusedZipCode : 'all'}-${showOnlyFocusedBoundary}-${showHatching}`}
      data={(() => {
        if (showOnlyFocusedBoundary && focusedZipCode) {
          const only = zipBoundariesData.features.filter(f => f.properties?.zipcode === focusedZipCode);
          if (only.length > 0) {
            return { ...zipBoundariesData, features: only };
          }
          // Fallback: keep previous features to avoid empty flash
          return zipBoundariesData;
        }
        return zipBoundariesData;
      })()}
      style={(feature) => {
        const zipCode = feature.properties?.zipcode;
        const isInResults = feature.properties?.inSearchResults;
        const isFocused = zipCode === focusedZipCode;
        const isAdditional = feature.properties?.isAdditional;

        // Check if ZIP is excluded
        const isExcluded = removedItems.has(getRemovalKey('zip', { zipCode }));

        // Different styles based on status
        if (isFocused) {
          return {
            color: '#ff0000',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.2,
            fillColor: '#dc2626'
          };
        } else if (isExcluded) {
          // Excluded ZIPs - striped red pattern
          return {
            color: '#ef4444',
            weight: 2,
            opacity: 0.7,
            fillOpacity: 0.08,
            fillColor: '#ef4444',
            dashArray: '10, 5, 2, 5' // Complex dash pattern for visibility
          };
        } else if (isInResults) {
          return {
            color: '#dc2626',
            weight: 1.5,
            opacity: 0.8,
            fillOpacity: 0.25,
            fillColor: '#dc2626',
            className: 'zip-in-results' // Mark for pattern styling
          };
        } else if (isAdditional) {
          // Available to add - blue with distinctive pattern
          return {
            color: '#2563eb', // Bright blue for visibility
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.08,
            fillColor: '#3b82f6',
            dashArray: '8, 3, 2, 3' // Distinctive dash-dot pattern
          };
        } else {
          return {
            color: '#9ca3af',
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0.02
          };
        }
      }}
      onEachFeature={(feature, layer) => {
        const zipCode = feature.properties?.zipcode;
        const isInResults = feature.properties?.inSearchResults;
        const isExcluded = removedItems.has(getRemovalKey('zip', { zipCode }));

        // Track layers that may need diagonal pattern
        if (isInResults && !isExcluded) {
          layersToPatternRef.current.add(layer);

          // Apply correct fill on 'add' event based on hatching toggle
          layer.on('add', () => {
            setTimeout(() => {
              if (layer._path) {
                if (showHatching) {
                  layer._path.setAttribute('fill', 'url(#diagonal-lines)');
                } else {
                  // Ensure solid fill color when hatching is off
                  const fillColor = layer.options?.fillColor || '#dc2626';
                  layer._path.setAttribute('fill', fillColor);
                }
              }
            }, 10);
          });

          // Also apply immediately if path exists
          if (layer._path) {
            if (showHatching) {
              layer._path.setAttribute('fill', 'url(#diagonal-lines)');
            } else {
              const fillColor = layer.options?.fillColor || '#dc2626';
              layer._path.setAttribute('fill', fillColor);
            }
          }
        }

        // Clean up tracking when layer is removed
        layer.on('remove', () => {
          layersToPatternRef.current.delete(layer);
        });

        if (zipCode) {
          // Create popup content based on status
          const popupContent = document.createElement('div');

          let buttonHtml = '';
          if (isExcluded) {
            buttonHtml = `
              <span style="color: #ef4444; font-weight: bold;">Excluded</span><br/>
              <button
                id="add-zip-${zipCode}"
                style="margin-top: 8px; padding: 4px 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;"
              >
                Add Back to Results
              </button>
            `;
          } else if (!isInResults) {
            buttonHtml = `
              <button
                id="add-zip-${zipCode}"
                style="margin-top: 8px; padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;"
              >
                Add to Results
              </button>
            `;
          } else {
            buttonHtml = '<span style="color: green;">In Results</span>';
          }

          popupContent.innerHTML = `
            <div style="min-width: 150px;">
              <strong>ZIP: ${zipCode}</strong><br/>
              ${feature.properties.city ? `City: ${feature.properties.city}<br/>` : ''}
              ${feature.properties.county ? `County: ${feature.properties.county}<br/>` : ''}
              ${buttonHtml}
            </div>
          `;

          layer.bindPopup(popupContent);

          // Add click handler for the add button
          layer.on('popupopen', () => {
            const addButton = document.getElementById(`add-zip-${zipCode}`);
            if (addButton) {
              addButton.addEventListener('click', async () => {
                await handleAddZip(zipCode, isExcluded);
                layer.closePopup();
              });
            }
          });

          // Add hover effect
          layer.on({
            mouseover: (e) => {
              if (zipCode !== focusedZipCode) {
                e.target.setStyle({
                  weight: isInResults ? 2.5 : 2,
                  fillOpacity: isInResults ? 0.2 : 0.1
                });
                // Reapply correct fill on hover if in results
                if (isInResults && !isExcluded && e.target._path) {
                  if (showHatching) {
                    e.target._path.setAttribute('fill', 'url(#diagonal-lines)');
                  } else {
                    const fillColor = e.target.options?.fillColor || '#dc2626';
                    e.target._path.setAttribute('fill', fillColor);
                  }
                }
              }
            },
            mouseout: (e) => {
              if (zipCode !== focusedZipCode) {
                e.target.setStyle({
                  weight: isInResults ? 1.5 : 1,
                  fillOpacity: isInResults ? 0.1 : 0.05
                });
                // Reapply correct fill on mouseout if in results
                if (isInResults && !isExcluded && e.target._path) {
                  if (showHatching) {
                    e.target._path.setAttribute('fill', 'url(#diagonal-lines)');
                  } else {
                    const fillColor = e.target.options?.fillColor || '#dc2626';
                    e.target._path.setAttribute('fill', fillColor);
                  }
                }
              }
            }
          });
        }
      }}
    />
  );
};

export default ZipBoundaryLayer;

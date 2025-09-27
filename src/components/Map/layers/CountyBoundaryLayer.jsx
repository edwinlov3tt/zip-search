import React from 'react';
import { GeoJSON } from 'react-leaflet';

const CountyBoundaryLayer = ({
  countyBoundaries,
  selectedCountyBoundary,
  countyResults,
  zipResults,
  removedItems,
  getRemovalKey,
  setSelectedCountyBoundary,
  loadBoundariesForSearchResults,
  ZipCodeService
}) => {
  return (
    <GeoJSON
      key={`county-boundaries-${selectedCountyBoundary?.name}-${removedItems.size}`}
      data={countyBoundaries}
      style={(feature) => {
        const countyName = feature.properties?.NAME;
        const isSelected = selectedCountyBoundary &&
          countyName === selectedCountyBoundary.name;

        // Check if county is excluded
        const countyData = countyResults.find(c => c.name === countyName);
        const isExcluded = countyData && removedItems.has(getRemovalKey('county', countyData));

        if (isExcluded) {
          return {
            color: '#6b7280',
            weight: 2,
            opacity: 0.6,
            fillOpacity: 0.05,
            fillColor: '#6b7280',
            dashArray: '10, 5'
          };
        }

        return {
          color: isSelected ? '#dc2626' : '#ff7800',
          weight: isSelected ? 3 : 2,
          opacity: isSelected ? 1 : 0.8,
          fillOpacity: isSelected ? 0.15 : 0.1,
          fillColor: isSelected ? '#dc2626' : '#ff7800'
        };
      }}
      onEachFeature={(feature, layer) => {
        if (feature.properties && feature.properties.NAME) {
          const countyName = feature.properties.NAME;
          const stateName = feature.properties.STATE;

          // Check if this county has ZIPs in results
          const countyZips = zipResults.filter(z => z.county === countyName);
          const hasResults = countyZips.length > 0;

          layer.bindPopup(`
            <strong>${countyName} County</strong><br/>
            State: ${stateName}<br/>
            ${hasResults ? `ZIPs in results: ${countyZips.length}` : 'No ZIPs in search results'}
          `);

          // Click handler to select county and load ALL its ZIPs
          layer.on('click', async () => {
            setSelectedCountyBoundary({ name: countyName, state: stateName });

            // Fetch ALL ZIPs in this county (not just from current results)
            try {
              // Use search API to get all ZIPs in county
              const countySearchParams = {
                query: `${countyName} County, ${stateName}`,
                limit: 500,
                offset: 0
              };

              const countySearchResult = await ZipCodeService.search(countySearchParams);
              const allCountyZips = countySearchResult.results
                .filter(zip => zip.county === countyName && zip.stateCode === stateName)
                .map(zip => zip.zipcode);

              // Load boundaries for all county ZIPs
              if (allCountyZips.length > 0) {
                // Get existing result ZIPs in this county
                const resultZipsInCounty = zipResults
                  .filter(z => z.county === countyName && z.state === stateName)
                  .map(z => z.zipCode);

                // Load all county ZIP boundaries, marking which are in results
                await loadBoundariesForSearchResults(allCountyZips.filter(z => !resultZipsInCounty.includes(z)));
              }
            } catch (error) {
              console.error(`Failed to fetch ZIPs for ${countyName} County:`, error);
              // Fallback to loading only result ZIPs
              if (hasResults) {
                const countyZipCodes = countyZips.map(z => z.zipCode);
                loadBoundariesForSearchResults(countyZipCodes);
              }
            }
          });
        }
      }}
    />
  );
};

export default CountyBoundaryLayer;
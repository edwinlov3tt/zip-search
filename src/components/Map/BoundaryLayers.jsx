import React, { useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import CountyBoundaryLayer from './layers/CountyBoundaryLayer';
import ZipBoundaryLayer from './layers/ZipBoundaryLayer';
import StateBoundaryLayer from './layers/StateBoundaryLayer';
import CityBoundaryLayer from './layers/CityBoundaryLayer';
import VtdBoundaryLayer from './layers/VtdBoundaryLayer';
import NeighborZipsLayer from './layers/NeighborZipsLayer';
import DiagonalPattern from './patterns/DiagonalPattern';

const BoundaryLayers = ({
  showCountyBorders,
  countyBoundaries,
  selectedCountyBoundary,
  showZipBoundaries,
  zipBoundariesData,
  focusedZipCode,
  showOnlyFocusedBoundary,
  showStateBoundaries,
  stateBoundariesData,
  showCityBoundaries,
  cityBoundariesData,
  showVtdBoundaries,
  vtdBoundariesData,
  focusedVtd,
  countyResults,
  zipResults,
  removedItems,
  getRemovalKey,
  setRemovedItems,
  setZipResults,
  setSelectedCountyBoundary,
  updateAggregatedResults,
  setToastMessage,
  setToastType,
  loadBoundariesForSearchResults,
  ZipCodeService,
  setZipBoundariesData,
  neighboringZips,
  setNeighboringZips
}) => {
  return (
    <>
      {/* SVG Pattern Definitions for boundaries */}
      <DiagonalPattern />

      {/* County Boundaries Layer */}
      {showCountyBorders && countyBoundaries && (
        <CountyBoundaryLayer
          countyBoundaries={countyBoundaries}
          selectedCountyBoundary={selectedCountyBoundary}
          countyResults={countyResults}
          zipResults={zipResults}
          removedItems={removedItems}
          getRemovalKey={getRemovalKey}
          setSelectedCountyBoundary={setSelectedCountyBoundary}
          loadBoundariesForSearchResults={loadBoundariesForSearchResults}
          ZipCodeService={ZipCodeService}
        />
      )}

      {/* ZIP Boundaries Layer */}
      {showZipBoundaries && zipBoundariesData && (
        <ZipBoundaryLayer
          zipBoundariesData={zipBoundariesData}
          focusedZipCode={focusedZipCode}
          showOnlyFocusedBoundary={showOnlyFocusedBoundary}
          removedItems={removedItems}
          getRemovalKey={getRemovalKey}
          setRemovedItems={setRemovedItems}
          setZipResults={setZipResults}
          zipResults={zipResults}
          updateAggregatedResults={updateAggregatedResults}
          setToastMessage={setToastMessage}
          setToastType={setToastType}
          setZipBoundariesData={setZipBoundariesData}
          ZipCodeService={ZipCodeService}
        />
      )}

      {/* State Boundaries Layer */}
      {showStateBoundaries && stateBoundariesData && (
        <StateBoundaryLayer
          stateBoundariesData={stateBoundariesData}
        />
      )}

      {/* City Boundaries Layer */}
      {showCityBoundaries && cityBoundariesData && (
        <CityBoundaryLayer
          cityBoundariesData={cityBoundariesData}
        />
      )}

      {/* VTD Boundaries Layer */}
      {showVtdBoundaries && vtdBoundariesData && (
        <VtdBoundaryLayer
          vtdBoundariesData={vtdBoundariesData}
          focusedVtd={focusedVtd}
          setToastMessage={setToastMessage}
          setToastType={setToastType}
        />
      )}

      {/* Neighboring ZIPs Layer - dashed blue ZIPs that border search results */}
      {neighboringZips && neighboringZips.features && neighboringZips.features.length > 0 && (
        <NeighborZipsLayer
          neighboringZips={neighboringZips}
          setNeighboringZips={setNeighboringZips}
          setZipResults={setZipResults}
          zipResults={zipResults}
          updateAggregatedResults={updateAggregatedResults}
          setToastMessage={setToastMessage}
          setToastType={setToastType}
          ZipCodeService={ZipCodeService}
        />
      )}
    </>
  );
};

export default BoundaryLayers;
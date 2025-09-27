import React from 'react';
import { GeoJSON } from 'react-leaflet';

const CityBoundaryLayer = ({ cityBoundariesData }) => {
  return (
    <GeoJSON
      key={`city-boundaries-${cityBoundariesData.features?.length || 0}`}
      data={cityBoundariesData}
      style={() => ({
        color: '#7c3aed',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.04,
        fillColor: '#c4b5fd'
      })}
      onEachFeature={(feature, layer) => {
        const props = feature.properties || {};
        const label = props.name ? `${props.name}${props.state_code ? ', ' + props.state_code : ''}` : 'City';
        layer.bindPopup(`<strong>${label}</strong>`);
      }}
    />
  );
};

export default CityBoundaryLayer;
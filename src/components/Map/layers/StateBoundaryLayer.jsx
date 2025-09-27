import React from 'react';
import { GeoJSON } from 'react-leaflet';

const StateBoundaryLayer = ({ stateBoundariesData }) => {
  return (
    <GeoJSON
      key={`state-boundaries-${stateBoundariesData.features?.length || 0}`}
      data={stateBoundariesData}
      style={() => ({
        color: '#2563eb',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.05,
        fillColor: '#93c5fd'
      })}
      onEachFeature={(feature, layer) => {
        const props = feature.properties || {};
        const label = props.name ? `${props.name} (${props.code || ''})` : (props.code || 'State');
        layer.bindPopup(`<strong>${label}</strong>`);
      }}
    />
  );
};

export default StateBoundaryLayer;
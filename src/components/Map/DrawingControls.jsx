import React from 'react';
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';

const DrawingControls = ({ featureGroupRef, onCreated, onDeleted }) => {
  return (
    <FeatureGroup ref={featureGroupRef}>
      <EditControl
        position="topleft"
        onCreated={onCreated}
        onDeleted={onDeleted}
        draw={{
          rectangle: {
            shapeOptions: {
              color: '#dc2626',
              fillOpacity: 0.1
            }
          },
          polygon: {
            allowIntersection: false,
            shapeOptions: {
              color: '#dc2626',
              fillOpacity: 0.1
            }
          },
          circle: {
            shapeOptions: {
              color: '#dc2626',
              fillOpacity: 0.1
            }
          },
          marker: false,
          circlemarker: false,
          polyline: false
        }}
        edit={{
          featureGroup: undefined,
          edit: {
            selectedPathOptions: {
              color: '#fe57a1',
              opacity: 0.6,
              dashArray: '10, 10',
              fill: true,
              fillColor: '#fe57a1',
              fillOpacity: 0.1
            }
          },
          remove: {
            selectedPathOptions: {
              color: '#fe57a1',
              opacity: 0.6,
              dashArray: '10, 10',
              fill: true,
              fillColor: '#fe57a1',
              fillOpacity: 0.1
            }
          }
        }}
      />
    </FeatureGroup>
  );
};

export default DrawingControls;
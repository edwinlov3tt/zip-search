import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const MapController = ({ center, zoom, onMapClick, crosshairCursor, onViewportChange }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (onMapClick) {
      map.on('click', onMapClick);
      return () => {
        map.off('click', onMapClick);
      };
    }
  }, [map, onMapClick]);

  // Track viewport changes for ZIP boundaries
  useEffect(() => {
    if (onViewportChange) {
      const handleViewportChange = () => {
        const bounds = map.getBounds();
        onViewportChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
      };

      map.on('moveend', handleViewportChange);
      map.on('zoomend', handleViewportChange);

      // Initial viewport
      handleViewportChange();

      return () => {
        map.off('moveend', handleViewportChange);
        map.off('zoomend', handleViewportChange);
      };
    }
  }, [map, onViewportChange]);

  // Apply crosshair cursor to all map layers
  useEffect(() => {
    const container = map.getContainer();
    if (crosshairCursor) {
      container.style.cursor = 'crosshair';
      // Also apply to all child elements to override Leaflet's default cursors
      const style = document.createElement('style');
      style.id = 'crosshair-cursor-style';
      style.textContent = `
        .leaflet-container,
        .leaflet-container * {
          cursor: crosshair !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      container.style.cursor = '';
      const existingStyle = document.getElementById('crosshair-cursor-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    }
    return () => {
      const existingStyle = document.getElementById('crosshair-cursor-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [map, crosshairCursor]);

  return null;
};

export default MapController;
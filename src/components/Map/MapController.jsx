import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';

const MapController = ({ center, zoom, onMapClick, crosshairCursor, onViewportChange }) => {
  const map = useMap();
  const [isModifierKeyPressed, setIsModifierKeyPressed] = useState(false);
  const [initialViewSet, setInitialViewSet] = useState(false);

  // Only set initial view once to avoid conflicting with programmatic updates
  useEffect(() => {
    if (center && zoom && !initialViewSet) {
      map.setView(center, zoom, { animate: false });
      setInitialViewSet(true);
    }
  }, [center, zoom, map, initialViewSet]);

  useEffect(() => {
    if (onMapClick) {
      // Wrap the click handler to check for modifier key
      const handleMapClick = (e) => {
        // Don't trigger radius placement if Command/Windows key is held
        if (!isModifierKeyPressed) {
          onMapClick(e);
        }
      };

      map.on('click', handleMapClick);
      return () => {
        map.off('click', handleMapClick);
      };
    }
  }, [map, onMapClick, isModifierKeyPressed]);

  // Track Command/Windows key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Command key (Mac) or Windows key (PC)
      if (e.metaKey || e.key === 'Meta' || e.key === 'OS') {
        setIsModifierKeyPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      // Check for Command key (Mac) or Windows key (PC)
      if (e.metaKey || e.key === 'Meta' || e.key === 'OS' || !e.metaKey) {
        setIsModifierKeyPressed(false);
      }
    };

    // Also reset on blur to handle when user switches windows
    const handleBlur = () => {
      setIsModifierKeyPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

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

      // Don't call immediately - let the map settle first
      // This prevents infinite loops when the component re-renders

      return () => {
        map.off('moveend', handleViewportChange);
        map.off('zoomend', handleViewportChange);
      };
    }
  }, [map, onViewportChange]);

  // Apply cursor based on crosshair mode and modifier key
  useEffect(() => {
    const container = map.getContainer();

    // Determine which cursor to use
    let cursorStyle = '';
    let styleContent = '';

    if (crosshairCursor && !isModifierKeyPressed) {
      // Show crosshair when in radius mode and not holding modifier
      cursorStyle = 'crosshair';
      styleContent = `
        .leaflet-container,
        .leaflet-container * {
          cursor: crosshair !important;
        }
      `;
    } else if (crosshairCursor && isModifierKeyPressed) {
      // Show grab cursor when holding Command/Windows key
      cursorStyle = 'grab';
      styleContent = `
        .leaflet-container,
        .leaflet-container * {
          cursor: grab !important;
        }
        .leaflet-container.leaflet-drag-target,
        .leaflet-container.leaflet-drag-target * {
          cursor: grabbing !important;
        }
      `;
    }

    // Apply the cursor style
    container.style.cursor = cursorStyle;

    // Remove existing style element if any
    const existingStyle = document.getElementById('map-cursor-style');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Add new style element if needed
    if (styleContent) {
      const style = document.createElement('style');
      style.id = 'map-cursor-style';
      style.textContent = styleContent;
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.getElementById('map-cursor-style');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, [map, crosshairCursor, isModifierKeyPressed]);

  // Add visual indicator when modifier key is pressed
  useEffect(() => {
    if (crosshairCursor && isModifierKeyPressed) {
      // Create a temporary notification
      const notification = document.createElement('div');
      notification.id = 'drag-mode-indicator';
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10000;
        pointer-events: none;
      `;
      notification.textContent = 'Drag mode - Release ⌘/⊞ to place radius';
      document.body.appendChild(notification);

      return () => {
        const indicator = document.getElementById('drag-mode-indicator');
        if (indicator) {
          indicator.remove();
        }
      };
    }
  }, [isModifierKeyPressed, crosshairCursor]);

  return null;
};

export default MapController;
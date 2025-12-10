import html2canvas from 'html2canvas';

/**
 * Capture a screenshot of the map viewport
 * @param {HTMLElement} mapContainer - The map container element
 * @param {Object} options - Screenshot options
 * @param {boolean} options.hideUI - Whether to hide UI elements (drawer, controls)
 * @returns {Promise<Blob>} - The screenshot as a blob
 */
export async function captureMapScreenshot(mapContainer, options = {}) {
  const { hideUI = true } = options;

  // Store original styles to restore later
  const elementsToHide = [];
  const elementsToRestore = [];

  if (hideUI) {
    // Hide the drawer
    const drawer = document.querySelector('.results-drawer');
    if (drawer) {
      elementsToHide.push({ element: drawer, originalDisplay: drawer.style.display });
      drawer.style.display = 'none';
    }

    // Hide the search controls panel
    const searchControls = document.querySelector('.search-controls-panel');
    if (searchControls) {
      elementsToHide.push({ element: searchControls, originalDisplay: searchControls.style.display });
      searchControls.style.display = 'none';
    }

    // Hide map zoom controls
    const zoomControls = document.querySelectorAll('.leaflet-control-zoom, .leaflet-control-attribution');
    zoomControls.forEach(control => {
      elementsToHide.push({ element: control, originalDisplay: control.style.display });
      control.style.display = 'none';
    });

    // Hide custom map controls (type switcher, etc.)
    const customControls = document.querySelectorAll('.map-control-button, .map-type-switcher');
    customControls.forEach(control => {
      elementsToHide.push({ element: control, originalDisplay: control.style.display });
      control.style.display = 'none';
    });

    // Hide drawing controls
    const drawControls = document.querySelectorAll('.leaflet-draw, .leaflet-draw-toolbar');
    drawControls.forEach(control => {
      elementsToHide.push({ element: control, originalDisplay: control.style.display });
      control.style.display = 'none';
    });

    // Small delay to ensure styles are applied
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  try {
    // Handle Leaflet's CSS transforms that can break html2canvas
    // Leaflet uses transform: translate3d() on overlay panes which html2canvas struggles with
    const overlayPane = mapContainer.querySelector('.leaflet-overlay-pane');
    const markerPane = mapContainer.querySelector('.leaflet-marker-pane');
    const mapPane = mapContainer.querySelector('.leaflet-map-pane');

    // Store and reset transforms temporarily
    if (mapPane) {
      const transform = mapPane.style.transform;
      elementsToRestore.push({ element: mapPane, property: 'transform', value: transform });
      // Don't remove the transform as it positions the map correctly
    }

    // Force all SVG elements to render properly by inlining computed styles
    const svgElements = mapContainer.querySelectorAll('svg');

    svgElements.forEach((svg) => {
      // Ensure SVG is visible
      elementsToRestore.push({
        element: svg,
        property: 'overflow',
        value: svg.style.overflow
      });
      svg.style.overflow = 'visible';

      // For each shape element in SVG, inline the computed styles
      svg.querySelectorAll('path, circle, polygon, polyline, rect, ellipse').forEach(el => {
        const computedStyle = window.getComputedStyle(el);

        // Store original attributes for restoration
        const originalAttrs = {};
        ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity', 'stroke-dasharray'].forEach(attr => {
          originalAttrs[attr] = el.getAttribute(attr);
        });

        // Store for restoration
        elementsToRestore.push({
          element: el,
          type: 'attributes',
          attrs: originalAttrs
        });

        // Inline styles for html2canvas
        el.setAttribute('fill', computedStyle.fill || 'none');
        el.setAttribute('stroke', computedStyle.stroke || 'none');
        el.setAttribute('stroke-width', computedStyle.strokeWidth || '1');
        el.setAttribute('stroke-opacity', computedStyle.strokeOpacity || '1');
        el.setAttribute('fill-opacity', computedStyle.fillOpacity || '1');

        if (computedStyle.strokeDasharray && computedStyle.strokeDasharray !== 'none') {
          el.setAttribute('stroke-dasharray', computedStyle.strokeDasharray);
        }
      });
    });

    // Also handle canvas elements (Leaflet sometimes uses canvas for rendering)
    const canvasElements = mapContainer.querySelectorAll('canvas');
    canvasElements.forEach(canvas => {
      elementsToRestore.push({
        element: canvas,
        property: 'visibility',
        value: canvas.style.visibility
      });
      canvas.style.visibility = 'visible';
    });

    // Small delay to ensure all style changes are applied
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture the map container
    const canvas = await html2canvas(mapContainer, {
      useCORS: true, // Enable cross-origin images (map tiles)
      allowTaint: true, // Allow tainted canvas for tiles
      backgroundColor: '#ffffff',
      scale: 2, // Higher resolution
      logging: false,
      removeContainer: true,
      // Handle cloned document
      onclone: (clonedDoc, clonedElement) => {
        // Process all SVGs in the clone
        const clonedSvgs = clonedElement.querySelectorAll('svg');
        clonedSvgs.forEach(svg => {
          svg.style.overflow = 'visible';

          // Ensure paths have inline styles
          svg.querySelectorAll('path, circle, polygon, polyline, rect, ellipse').forEach(el => {
            // Get the computed style from the cloned element
            const computedStyle = window.getComputedStyle(el);

            // Force visible fills and strokes
            if (el.getAttribute('fill') === 'none' || !el.getAttribute('fill')) {
              const fillColor = computedStyle.fill;
              if (fillColor && fillColor !== 'none' && fillColor !== 'rgba(0, 0, 0, 0)') {
                el.setAttribute('fill', fillColor);
              }
            }

            if (!el.getAttribute('stroke') || el.getAttribute('stroke') === 'none') {
              const strokeColor = computedStyle.stroke;
              if (strokeColor && strokeColor !== 'none' && strokeColor !== 'rgba(0, 0, 0, 0)') {
                el.setAttribute('stroke', strokeColor);
              }
            }
          });
        });

        // Hide attribution in clone
        const attribution = clonedElement.querySelector('.leaflet-control-attribution');
        if (attribution) {
          attribution.style.display = 'none';
        }
      }
    });

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        'image/png',
        1.0
      );
    });
  } finally {
    // Restore hidden elements
    elementsToHide.forEach(({ element, originalDisplay }) => {
      element.style.display = originalDisplay;
    });

    // Restore modified elements
    elementsToRestore.forEach(item => {
      if (item.type === 'attributes') {
        // Restore original attributes
        Object.entries(item.attrs).forEach(([attr, value]) => {
          if (value === null) {
            item.element.removeAttribute(attr);
          } else {
            item.element.setAttribute(attr, value);
          }
        });
      } else if (item.property) {
        item.element.style[item.property] = item.value;
      }
    });
  }
}

/**
 * Download the screenshot as a file
 * @param {Blob} blob - The screenshot blob
 * @param {string} filename - The filename (without extension)
 */
export function downloadScreenshot(blob, filename = 'map-screenshot') {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const fullFilename = `${filename}_${timestamp}.png`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fullFilename;
}

/**
 * Capture and download a map screenshot in one call
 * @param {HTMLElement} mapContainer - The map container element
 * @param {Object} options - Screenshot options
 * @returns {Promise<string>} - The filename of the downloaded screenshot
 */
export async function captureAndDownload(mapContainer, options = {}) {
  const blob = await captureMapScreenshot(mapContainer, options);
  return downloadScreenshot(blob, options.filename || 'geosearch-map');
}

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

    // Small delay to ensure styles are applied
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  try {
    // Capture the map container
    const canvas = await html2canvas(mapContainer, {
      useCORS: true, // Enable cross-origin images (map tiles)
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: 2, // Higher resolution
      logging: false,
      // Ignore certain elements that may cause issues
      ignoreElements: (element) => {
        return element.classList?.contains('leaflet-control-attribution');
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

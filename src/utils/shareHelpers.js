/**
 * Share URL helpers for database-backed share links
 *
 * Uses Cloudflare Worker API with D1 database for persistent short URLs
 */

// API endpoint for share links
const SHARE_API_URL = 'https://geosearch-share-api.edwin-6f1.workers.dev';

/**
 * Create a new share link via API
 * @param {Object} state - Search state to share
 * @param {string} viewMode - 'edit' or 'view'
 * @returns {Promise<{id: string, url: string}|null>} - Share ID and URL or null on error
 */
export async function createShareLink(state, viewMode = 'edit') {
  try {
    const shareData = {
      mode: state.searchMode,
      mapView: {
        center: state.mapCenter,
        zoom: state.mapZoom,
        type: state.mapType || 'street'
      },
      viewMode,

      // Radius searches - include full data for restoration
      radiusSearches: (state.radiusSearches || []).map(s => ({
        id: s.id,
        query: s.query,
        center: s.center,
        radius: s.radius,
        label: s.label,
        overlayColor: s.settings?.overlayColor,
        settings: s.settings,
        results: s.results
      })),

      // Address searches
      addressSearches: (state.addressSearches || []).map(s => ({
        id: s.id,
        query: s.query,
        center: s.center,
        radius: s.radius,
        mode: s.mode,
        label: s.label,
        coordinates: s.coordinates,
        overlayColor: s.settings?.overlayColor,
        settings: s.settings,
        results: s.results
      })),

      // Polygon searches - include all shape data for redrawing
      polygonSearches: (state.polygonSearches || []).map(s => ({
        id: s.id,
        label: s.label,
        shapeNumber: s.shapeNumber,
        coordinates: s.coordinates,
        shapeType: s.shapeType,
        circleCenter: s.circleCenter,
        circleRadius: s.circleRadius,
        bounds: s.bounds,
        overlayColor: s.settings?.overlayColor,
        settings: s.settings,
        results: s.results
      })),

      // Hierarchy selection
      hierarchySelection: state.hierarchySelection || null,

      // Boundary visibility settings
      boundarySettings: {
        showZipBoundaries: state.showZipBoundaries ?? false,
        showStateBoundaries: state.showStateBoundaries ?? false,
        showCountyBoundaries: state.showCountyBoundaries ?? false,
        showCityBoundaries: state.showCityBoundaries ?? false,
        showVtdBoundaries: state.showVtdBoundaries ?? false
      }
    };

    const response = await fetch(`${SHARE_API_URL}/api/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(shareData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create share link');
    }

    const result = await response.json();
    return {
      id: result.id,
      url: `${window.location.origin}/s/${result.id}`
    };
  } catch (error) {
    console.error('Failed to create share link:', error);
    return null;
  }
}

/**
 * Fetch share data from API by ID
 * @param {string} shareId - The share ID
 * @returns {Promise<Object|null>} - Share data or null if not found
 */
export async function fetchShareData(shareId) {
  try {
    const response = await fetch(`${SHARE_API_URL}/api/share/${shareId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Share not found');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch share data:', error);
    return null;
  }
}

/**
 * Parse share ID from current URL
 * Handles both /s/:id format and legacy ?share= format
 * @returns {string|null} - Share ID or null
 */
export function parseShareIdFromUrl() {
  const pathname = window.location.pathname;

  // Check for /s/:id format
  const shareMatch = pathname.match(/^\/s\/([a-zA-Z0-9]+)$/);
  if (shareMatch) {
    return shareMatch[1];
  }

  // Legacy: check for ?share= query parameter (base64 encoded)
  const params = new URLSearchParams(window.location.search);
  const shareParam = params.get('share');
  if (shareParam) {
    // Return special marker to indicate legacy format
    return { legacy: true, encoded: shareParam };
  }

  return null;
}

/**
 * Decode legacy base64 share state
 * @param {string} encoded - Base64 encoded string
 * @returns {Object|null} - Decoded state object or null if invalid
 */
export function decodeLegacyShareState(encoded) {
  try {
    // Restore base64 padding and characters
    let base64 = encoded
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    // Add padding
    while (base64.length % 4) {
      base64 += '=';
    }

    const json = atob(base64);
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decode legacy share state:', error);
    return null;
  }
}

/**
 * Clear share from URL without reloading
 */
export function clearShareFromUrl() {
  const pathname = window.location.pathname;

  // If we're on /s/:id, redirect to root
  if (pathname.startsWith('/s/')) {
    window.history.replaceState({}, '', '/');
    return;
  }

  // Clear query params
  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  window.history.replaceState({}, '', url.toString());
}

/**
 * Check if current URL has a share parameter
 * @returns {boolean}
 */
export function hasShareParameter() {
  const pathname = window.location.pathname;

  // Check /s/:id format
  if (pathname.match(/^\/s\/[a-zA-Z0-9]+$/)) {
    return true;
  }

  // Check legacy query parameter
  const params = new URLSearchParams(window.location.search);
  return params.has('share');
}

// Legacy functions for backward compatibility
export function generateShareUrl() {
  console.warn('generateShareUrl is deprecated. Use createShareLink instead.');
  return null;
}

export function parseShareFromUrl() {
  console.warn('parseShareFromUrl is deprecated. Use parseShareIdFromUrl and fetchShareData instead.');
  return null;
}

export function encodeShareState() {
  console.warn('encodeShareState is deprecated. Use createShareLink instead.');
  return null;
}

export function decodeShareState() {
  console.warn('decodeShareState is deprecated. Use fetchShareData instead.');
  return null;
}

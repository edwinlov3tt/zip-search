/**
 * Address API Service
 * Client for the Cloudflare Worker address search API
 */

const API_BASE = 'https://geosearch-address-api.edwin-6f1.workers.dev';

/**
 * Start a new address search job
 * @param {Object} params - Search parameters
 * @param {'polygon'|'radius'|'zips'} params.mode - Search mode
 * @param {Array<{lat: number, lng: number}>} [params.coordinates] - Polygon coordinates
 * @param {{lat: number, lng: number}} [params.center] - Center point for radius search
 * @param {number} [params.radius] - Radius in miles
 * @param {string[]} [params.zips] - ZIP codes for ZIP mode
 * @returns {Promise<{jobId: string, status: string, pollUrl: string, streamUrl: string}>}
 */
export async function startAddressSearch(params) {
  const response = await fetch(`${API_BASE}/api/address-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Poll for job status and results
 * @param {string} jobId - Job ID to poll
 * @param {string} [cursor] - Pagination cursor
 * @param {number} [limit=100] - Results per page
 * @returns {Promise<{
 *   jobId: string,
 *   status: 'pending'|'processing'|'complete'|'failed',
 *   progress: number,
 *   totalFound: number,
 *   results: Array,
 *   nextCursor: string|null,
 *   error: string|null
 * }>}
 */
export async function pollJobStatus(jobId, cursor = null, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await fetch(`${API_BASE}/api/address-search/${jobId}?${params}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Job not found');
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Stream address search results via Server-Sent Events
 * @param {string} jobId - Job ID to stream
 * @param {Object} callbacks - Event callbacks
 * @param {function({progress: number, found: number}): void} callbacks.onProgress - Progress update callback
 * @param {function(Array): void} callbacks.onBatch - Batch of addresses callback
 * @param {function({totalFound: number, duration: number}): void} callbacks.onComplete - Completion callback
 * @param {function({message: string, code: string}): void} callbacks.onError - Error callback
 * @returns {EventSource} - The EventSource instance (call .close() to stop)
 */
export function streamAddressResults(jobId, { onProgress, onBatch, onComplete, onError }) {
  const eventSource = new EventSource(`${API_BASE}/api/address-search/${jobId}/stream`);

  eventSource.addEventListener('progress', (event) => {
    if (onProgress) {
      onProgress(JSON.parse(event.data));
    }
  });

  eventSource.addEventListener('batch', (event) => {
    if (onBatch) {
      const data = JSON.parse(event.data);
      onBatch(data.addresses);
    }
  });

  eventSource.addEventListener('complete', (event) => {
    if (onComplete) {
      onComplete(JSON.parse(event.data));
    }
    eventSource.close();
  });

  eventSource.addEventListener('error', (event) => {
    // SSE error events don't have data in the same format
    if (event.data) {
      if (onError) {
        onError(JSON.parse(event.data));
      }
    } else {
      // Connection error
      if (onError) {
        onError({ message: 'Connection lost', code: 'CONNECTION_ERROR' });
      }
    }
    eventSource.close();
  });

  // Handle generic EventSource errors
  eventSource.onerror = (event) => {
    if (eventSource.readyState === EventSource.CLOSED) {
      return; // Already handled
    }
    if (onError) {
      onError({ message: 'Stream connection error', code: 'STREAM_ERROR' });
    }
    eventSource.close();
  };

  return eventSource;
}

/**
 * Execute a full address search with streaming
 * Returns a promise that resolves with all addresses when complete
 * @param {Object} params - Search parameters (same as startAddressSearch)
 * @param {function({progress: number, found: number}): void} [onProgress] - Progress callback
 * @returns {Promise<Array>} - All addresses found
 */
export async function executeAddressSearch(params, onProgress) {
  // Start the job
  const { jobId } = await startAddressSearch(params);

  return new Promise((resolve, reject) => {
    const allAddresses = [];

    const eventSource = streamAddressResults(jobId, {
      onProgress: (data) => {
        if (onProgress) {
          onProgress(data);
        }
      },
      onBatch: (addresses) => {
        allAddresses.push(...addresses);
      },
      onComplete: (result) => {
        resolve(allAddresses);
      },
      onError: (error) => {
        reject(new Error(error.message));
      }
    });

    // Cleanup on abort (if needed)
    return () => eventSource.close();
  });
}

/**
 * Execute address search with polling fallback (for browsers that don't support SSE well)
 * @param {Object} params - Search parameters
 * @param {function({progress: number, found: number}): void} [onProgress] - Progress callback
 * @returns {Promise<Array>} - All addresses found
 */
export async function executeAddressSearchPolling(params, onProgress) {
  // Start the job
  const { jobId } = await startAddressSearch(params);

  // Poll until complete
  let allAddresses = [];

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const status = await pollJobStatus(jobId);

    if (onProgress) {
      onProgress({ progress: status.progress, found: status.totalFound });
    }

    if (status.status === 'complete') {
      // Fetch all pages of results
      let cursor = null;
      do {
        const page = await pollJobStatus(jobId, cursor, 500);
        allAddresses.push(...page.results);
        cursor = page.nextCursor;
      } while (cursor);

      return allAddresses;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Search failed');
    }
  }
}

export default {
  startAddressSearch,
  pollJobStatus,
  streamAddressResults,
  executeAddressSearch,
  executeAddressSearchPolling
};

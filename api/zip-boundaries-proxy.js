/**
 * Proxy endpoint for ZIP boundaries API
 * This proxies requests to the droplet-hosted ZIP boundaries service
 */

const ZIP_API_BASE = 'http://45.55.36.108:8002';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { path, ...queryParams } = req.query;

    // Build the proxy URL
    let proxyUrl = ZIP_API_BASE;

    // Handle different endpoint paths
    if (path === 'single') {
      const { zipcode } = queryParams;
      if (!zipcode) {
        return res.status(400).json({ error: 'Missing zipcode parameter' });
      }
      proxyUrl = `${ZIP_API_BASE}/zip/${zipcode}`;
    } else if (path === 'viewport') {
      const params = new URLSearchParams(queryParams);
      proxyUrl = `${ZIP_API_BASE}/zip/boundaries/viewport?${params}`;
    } else if (path === 'stats') {
      proxyUrl = `${ZIP_API_BASE}/zip-stats`;
    } else if (path === 'health') {
      proxyUrl = `${ZIP_API_BASE}/health`;
    } else {
      // Default: show API info
      return res.status(200).json({
        api: 'ZIP Boundaries Proxy',
        version: '1.0',
        droplet_api: ZIP_API_BASE,
        endpoints: {
          single_zip: '/api/zip-boundaries-proxy?path=single&zipcode=10001',
          viewport: '/api/zip-boundaries-proxy?path=viewport&north=40.8&south=40.7&east=-73.9&west=-74.0&limit=10',
          stats: '/api/zip-boundaries-proxy?path=stats',
          health: '/api/zip-boundaries-proxy?path=health'
        },
        note: 'This is a proxy to the droplet-hosted ZIP boundaries API'
      });
    }

    // Fetch from the droplet API
    const response = await fetch(proxyUrl);
    const data = await response.json();

    // Forward the response
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch ZIP boundaries',
      details: error.message
    });
  }
}
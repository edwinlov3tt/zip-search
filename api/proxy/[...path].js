/**
 * Proxy endpoint for ZIP boundaries API
 * Routes HTTPS requests to the HTTP droplet API
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extract the path from the request
    const { path } = req.query;
    const pathString = Array.isArray(path) ? path.join('/') : path || '';

    // Build the target URL
    const targetUrl = `http://45.55.36.108:8002/${pathString}`;

    // Get query string
    const queryString = req.url.split('?')[1];
    const finalUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    console.log('Proxying to:', finalUrl);

    // Make the request to the droplet API
    const response = await fetch(finalUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    // Get the response data
    const data = await response.text();

    // Set the same status code
    res.status(response.status);

    // Try to parse as JSON, otherwise send as text
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch {
      res.send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Set up environment variables for Edge Functions
process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Helper to load and execute Edge Functions
async function executeEdgeFunction(functionPath, req, res) {
  try {
    const modulePath = join(__dirname, 'api', functionPath);

    // Check if it's a directory with index.js
    let finalPath = modulePath;
    try {
      const stats = await fs.stat(modulePath);
      if (stats.isDirectory()) {
        finalPath = join(modulePath, 'index.js');
      } else if (!modulePath.endsWith('.js')) {
        finalPath = `${modulePath}.js`;
      }
    } catch {
      if (!modulePath.endsWith('.js')) {
        finalPath = `${modulePath}.js`;
      }
    }

    // Import the module
    const module = await import(`file://${finalPath}`);
    const handler = module.default || module.handler;

    if (!handler) {
      throw new Error(`No handler found in ${finalPath}`);
    }

    // Create Edge Function compatible request/response
    const edgeReq = {
      method: req.method,
      headers: new Map(Object.entries(req.headers)),
      url: `http://localhost:${PORT}${req.originalUrl}`,
      json: async () => req.body,
      text: async () => JSON.stringify(req.body),
      query: req.query // Add query params for Edge Functions
    };

    // Create URL object for search params
    const url = new URL(edgeReq.url);
    edgeReq.url = url.toString();

    // Add nextUrl for Vercel Edge compatibility
    edgeReq.nextUrl = url;

    const edgeRes = {
      status: (code) => {
        res.status(code);
        return edgeRes;
      },
      json: (data) => {
        res.json(data);
        return edgeRes;
      },
      send: (data) => {
        res.send(data);
        return edgeRes;
      },
      setHeader: (key, value) => {
        res.setHeader(key, value);
        return edgeRes;
      },
      setHeaders: (headers) => {
        // Support both setHeader and setHeaders
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        return edgeRes;
      },
      end: () => {
        res.end();
        return edgeRes;
      }
    };

    // Execute the handler
    const result = await handler(edgeReq, edgeRes);

    // Handle Response object (for Edge Functions that return Response)
    if (result && result instanceof Response) {
      const data = await result.json();
      result.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.status(result.status).json(data);
    }
  } catch (error) {
    console.error(`Error executing edge function at ${functionPath}:`, error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      path: functionPath
    });
  }
}

// Generic middleware to handle all API v1 routes
app.use('/api/v1', async (req, res, next) => {
  // Skip if not an API method request
  if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Extract the path after /api/
  const apiPath = req.path.replace('/', 'v1/');

  // Special handling for search endpoint (directory with index.js)
  if (apiPath === 'v1/search') {
    await executeEdgeFunction('v1/search/index', req, res);
    return;
  }

  // For all other paths, try to execute the function
  await executeEdgeFunction(apiPath, req, res);
});

// Fallback for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    availableEndpoints: [
      '/api/v1/search',
      '/api/v1/search/radius',
      '/api/v1/search/hierarchy',
      '/api/v1/search/polygon',
      '/api/v1/states',
      '/api/v1/counties',
      '/api/v1/cities',
      '/api/v1/health',
      '/api/v1/boundaries/*',
      '/api/v1/geocode/*',
      '/api/v1/geocoding/*'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 API Development Server running at http://localhost:${PORT}

Available endpoints:
  - http://localhost:${PORT}/api/v1/search
  - http://localhost:${PORT}/api/v1/states
  - http://localhost:${PORT}/api/v1/counties
  - http://localhost:${PORT}/api/v1/cities
  - http://localhost:${PORT}/api/v1/health
  - http://localhost:${PORT}/api/v1/boundaries/*
  - http://localhost:${PORT}/api/v1/geocode/*

Environment:
  - SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing'}
  - SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}
  `);
});
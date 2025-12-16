import { Env } from './types';
import { handleCreateJob } from './handlers/createJob';
import { handleGetJob } from './handlers/getJob';
import { handleStreamJob } from './handlers/streamJob';

// CORS headers helper
function corsHeaders(origin: string, allowedOrigins: string): Headers {
  const headers = new Headers();
  const origins = allowedOrigins.split(',').map(o => o.trim());

  if (origins.includes(origin) || origins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}

// JSON response helper
function jsonResponse(data: unknown, status = 200, origin: string, allowedOrigins: string): Response {
  const headers = corsHeaders(origin, allowedOrigins);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(data), { status, headers });
}

// Error response helper
function errorResponse(message: string, status = 500, origin: string, allowedOrigins: string): Response {
  return jsonResponse({ error: message }, status, origin, allowedOrigins);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env.ALLOWED_ORIGINS)
      });
    }

    try {
      // Route: POST /api/address-search
      if (method === 'POST' && path === '/api/address-search') {
        const result = await handleCreateJob(request, env, ctx);
        return jsonResponse(result, 201, origin, env.ALLOWED_ORIGINS);
      }

      // Route: GET /api/address-search/:jobId/stream (SSE)
      const streamMatch = path.match(/^\/api\/address-search\/([^/]+)\/stream$/);
      if (method === 'GET' && streamMatch) {
        const jobId = streamMatch[1];
        return handleStreamJob(jobId, env, origin);
      }

      // Route: GET /api/address-search/:jobId
      const jobMatch = path.match(/^\/api\/address-search\/([^/]+)$/);
      if (method === 'GET' && jobMatch) {
        const jobId = jobMatch[1];
        const cursor = url.searchParams.get('cursor');
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const result = await handleGetJob(jobId, env, cursor, limit);

        if (!result) {
          return errorResponse('Job not found', 404, origin, env.ALLOWED_ORIGINS);
        }

        return jsonResponse(result, 200, origin, env.ALLOWED_ORIGINS);
      }

      // Health check
      if (method === 'GET' && path === '/health') {
        return jsonResponse({ status: 'ok', service: 'address-api' }, 200, origin, env.ALLOWED_ORIGINS);
      }

      // 404 for unknown routes
      return errorResponse('Not found', 404, origin, env.ALLOWED_ORIGINS);

    } catch (error) {
      console.error('Worker error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errorResponse(message, 500, origin, env.ALLOWED_ORIGINS);
    }
  }
};

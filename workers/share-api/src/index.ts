/**
 * GeoSearch Share API
 * Cloudflare Worker with D1 database for persistent share links
 */

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
}

// Generate a short alphanumeric ID (8 characters)
function generateShareId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomValues = new Uint8Array(8);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 8; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// CORS headers
function getCorsHeaders(origin: string, allowedOrigins: string): HeadersInit {
  const allowed = allowedOrigins.split(',').map(o => o.trim());
  const isAllowed = allowed.includes(origin) || allowed.includes('*');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// JSON response helper
function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// Error response helper
function errorResponse(message: string, status = 400, headers: HeadersInit = {}): Response {
  return jsonResponse({ error: message }, status, headers);
}

// Share data interface
interface ShareData {
  mode: string;
  mapView?: {
    center?: [number, number];
    zoom?: number;
    type?: string;
  };
  radiusSearches?: Array<{
    id: string;
    label: string;
    query?: string;
    center: [number, number];
    radius: number;
    overlayColor?: string;
    settings?: Record<string, unknown>;
    results?: Array<Record<string, unknown>>;
  }>;
  polygonSearches?: Array<{
    id: string;
    label: string;
    shapeNumber: number;
    coordinates: Array<{ lat: number; lng: number }>;
    shapeType: string; // 'polygon' | 'circle' | 'rectangle'
    circleCenter?: [number, number];
    circleRadius?: number;
    bounds?: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
    overlayColor?: string;
    settings?: Record<string, unknown>;
    results?: Array<Record<string, unknown>>;
  }>;
  addressSearches?: Array<{
    id: string;
    label: string;
    mode: string;
    query?: string;
    center?: [number, number];
    radius?: number;
    coordinates?: Array<{ lat: number; lng: number }>;
    overlayColor?: string;
    settings?: Record<string, unknown>;
    results?: Array<Record<string, unknown>>;
  }>;
  hierarchySelection?: {
    state?: string;
    county?: string;
    city?: string;
  };
  // Boundary visibility settings
  boundarySettings?: {
    showZipBoundaries?: boolean;
    showStateBoundaries?: boolean;
    showCountyBoundaries?: boolean;
    showCityBoundaries?: boolean;
    showVtdBoundaries?: boolean;
  };
  viewMode?: 'edit' | 'view';
  title?: string;
  description?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGINS);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Route: POST /api/share - Create a new share
      if (request.method === 'POST' && url.pathname === '/api/share') {
        const body = await request.json() as ShareData;

        // Validate required fields
        if (!body.mode) {
          return errorResponse('Missing required field: mode', 400, corsHeaders);
        }

        // Generate unique ID
        let shareId = generateShareId();

        // Ensure uniqueness (retry up to 3 times)
        for (let i = 0; i < 3; i++) {
          const existing = await env.DB.prepare('SELECT id FROM shares WHERE id = ?')
            .bind(shareId)
            .first();
          if (!existing) break;
          shareId = generateShareId();
        }

        // Insert into database
        const searchData = JSON.stringify(body);
        const mapCenter = body.mapView?.center;
        const mapZoom = body.mapView?.zoom;
        const mapType = body.mapView?.type || 'street';

        await env.DB.prepare(`
          INSERT INTO shares (id, search_mode, map_center_lat, map_center_lng, map_zoom, map_type, search_data, view_mode, title, description)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            shareId,
            body.mode,
            mapCenter?.[0] ?? null,
            mapCenter?.[1] ?? null,
            mapZoom ?? null,
            mapType,
            searchData,
            body.viewMode || 'edit',
            body.title || null,
            body.description || null
          )
          .run();

        return jsonResponse(
          {
            success: true,
            id: shareId,
            url: `https://geosearch.edwinlovett.com/s/${shareId}`,
          },
          201,
          corsHeaders
        );
      }

      // Route: GET /api/share/:id - Get a share by ID
      if (request.method === 'GET' && url.pathname.startsWith('/api/share/')) {
        const shareId = url.pathname.split('/').pop();

        if (!shareId || shareId.length < 6) {
          return errorResponse('Invalid share ID', 400, corsHeaders);
        }

        // Get share from database
        const share = await env.DB.prepare(`
          SELECT * FROM shares WHERE id = ?
        `)
          .bind(shareId)
          .first();

        if (!share) {
          return errorResponse('Share not found', 404, corsHeaders);
        }

        // Check expiration
        if (share.expires_at && new Date(share.expires_at as string) < new Date()) {
          return errorResponse('Share has expired', 410, corsHeaders);
        }

        // Update view count
        await env.DB.prepare(`
          UPDATE shares
          SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
          .bind(shareId)
          .run();

        // Parse and return search data
        const searchData = JSON.parse(share.search_data as string);

        return jsonResponse(
          {
            id: share.id,
            mode: share.search_mode,
            viewMode: share.view_mode,
            createdAt: share.created_at,
            title: share.title,
            description: share.description,
            mapView: {
              center: share.map_center_lat && share.map_center_lng
                ? [share.map_center_lat, share.map_center_lng]
                : null,
              zoom: share.map_zoom,
              type: share.map_type,
            },
            ...searchData,
          },
          200,
          corsHeaders
        );
      }

      // Route: GET /api/health - Health check
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
      }

      // 404 for unknown routes
      return errorResponse('Not found', 404, corsHeaders);

    } catch (error) {
      console.error('API Error:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500,
        corsHeaders
      );
    }
  },
} satisfies ExportedHandler<Env>;

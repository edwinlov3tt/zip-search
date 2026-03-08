# Cloudflare Workers Integration

Edge API services for GeoSearch Pro.

## Overview

| Property | Value |
|----------|-------|
| Service | Cloudflare Workers |
| Purpose | Address Search API, Share API |
| Location | `workers/` directory |

## Workers

### Address API (`workers/address-api/`)
Handles street address searches using Overpass API.

**Endpoint**: Deployed to Cloudflare Workers
**Features**:
- Chunked storage for large result sets
- Rate limiting via Upstash Redis
- CORS configured for allowed origins

### Share API (`workers/share-api/`)
Handles shareable link generation and retrieval.

**Endpoint**: Deployed to Cloudflare Workers
**Features**:
- Stores search configurations
- Generates short share URLs
- Retrieves shared search data

## Environment Variables (wrangler.toml)

```toml
[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "STORAGE"
id = "your-kv-namespace-id"
```

## Deployment

```bash
# Deploy address API
cd workers/address-api
wrangler deploy

# Deploy share API
cd workers/share-api
wrangler deploy
```

## Rate Limits

- Free tier: 100,000 requests/day
- CPU time: 10ms (free), 50ms (paid)
- KV reads: 100,000/day free
- KV writes: 1,000/day free

## CORS Configuration

Workers include CORS headers for allowed origins:
```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://your-domain.vercel.app'
];
```

## Gotchas

1. **Cold Starts**: First request after idle period may be slower
2. **CPU Limits**: Complex operations may hit CPU time limits on free tier
3. **KV Eventual Consistency**: KV storage is eventually consistent
4. **Request Size**: Max 100MB request body

## Official Documentation

- [Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [KV Storage](https://developers.cloudflare.com/workers/runtime-apis/kv/)

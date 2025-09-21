# API Setup Guide

## Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file and add your API keys:**
   ```bash
   # Edit with your preferred text editor
   nano .env
   ```

3. **Get your API keys from these providers:**

## API Providers

### High-Volume Provider Stack (Recommended)

### MapTiler (Keyed - Primary)
- **Free tier:** 100,000 requests/month
- **Docs:** https://docs.maptiler.com/cloud/api/geocoding/
- **Sign up:** https://www.maptiler.com/
- **Add to .env:** `MAPTILER_KEY=your_key_here`

### Geocod.io (Keyed - US/Canada Focus)
- **Free tier:** 2,500 requests/day
- **Docs:** https://www.geocod.io/docs/
- **Sign up:** https://www.geocod.io/
- **Add to .env:** `GEOCODIO_KEY=your_key_here`

### LocationIQ (Keyed)
- **Free tier:** 5,000 requests/day
- **Docs:** https://locationiq.com/docs
- **Sign up:** https://locationiq.com/
- **Add to .env:** `LOCATIONIQ_KEY=your_key_here`

### OpenCage (Keyed)
- **Free tier:** 2,500 requests/day
- **Docs:** https://opencagedata.com/api
- **Sign up:** https://opencagedata.com/
- **Add to .env:** `OPENCAGE_KEY=your_key_here`

### Open-Meteo (No Key - City/Postal Focus)
- **Free tier:** 10,000 requests/day
- **Docs:** https://open-meteo.com/en/docs/geocoding-api
- **Add to .env:** `ENABLE_OPEN_METEO=true`

### Maps.co (No Key - Nominatim Wrapper)
- **Free tier:** ~33,000 requests/day
- **Docs:** https://geocode.maps.co/
- **Add to .env:** `ENABLE_MAPS_CO=true`

### U.S. Census Geocoder (No Key - Authoritative US)
- **Free tier:** Unlimited (batch processing)
- **Docs:** https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
- **Add to .env:** `ENABLE_CENSUS=true`

### Legacy Providers (Still Supported)

### Geoapify
- **Free tier:** 3,000 requests/day
- **Sign up:** https://www.geoapify.com/
- **Add to .env:** `GEOAPIFY_API_KEY=your_key_here`

### PositionStack
- **Free tier:** 25,000 requests/month
- **Sign up:** https://positionstack.com/
- **Add to .env:** `POSITIONSTACK_API_KEY=your_key_here`

### Mapbox
- **Free tier:** 100,000 requests/month
- **Sign up:** https://www.mapbox.com/
- **Add to .env:** `MAPBOX_ACCESS_TOKEN=pk.your_token_here`

### HERE
- **Free tier:** 250,000 requests/month
- **Sign up:** https://developer.here.com/
- **Add to .env:** `HERE_API_KEY=your_key_here`

### TomTom
- **Free tier:** 2,500 requests/day
- **Sign up:** https://developer.tomtom.com/
- **Add to .env:** `TOMTOM_API_KEY=your_key_here`

## Configuration

### Enable/Disable Services
You can control which services are used by setting these variables in your `.env` file:

```bash
# High-volume providers
ENABLE_MAPTILER=true
ENABLE_GEOCODIO=true
ENABLE_LOCATIONIQ=true
ENABLE_OPENCAGE=true
ENABLE_OPEN_METEO=true
ENABLE_MAPS_CO=true
ENABLE_CENSUS=true

# Legacy providers
ENABLE_GEOAPIFY=true
ENABLE_POSITIONSTACK=true
ENABLE_MAPBOX=false
ENABLE_HERE=false
ENABLE_TOMTOM=false

# API Keys
MAPTILER_KEY=
GEOCODIO_KEY=
LOCATIONIQ_KEY=
OPENCAGE_KEY=

# Rate Limits (requests per second)
MAPTILER_RPS=10
GEOCODIO_RPS=10
LOCATIONIQ_RPS=2
OPENCAGE_RPS=1
OPEN_METEO_RPS=10
MAPS_CO_RPS=3

# Daily Limits
MAPTILER_DAILY=100000
GEOCODIO_DAILY=2500
LOCATIONIQ_DAILY=5000
OPENCAGE_DAILY=2500
OPEN_METEO_DAILY=10000
MAPS_CO_DAILY=33000

# Census Settings
CENSUS_BATCH_SIZE=10000
CENSUS_CONCURRENCY=1
```

### Two-Lane Priority System
The system uses a **dual-lane routing** approach:

**Lane A (Street-level / Keyed Providers):**
1. MapTiler → Geocod.io → LocationIQ → OpenCage

**Lane B (No-key / City+Postal):**
1. Open-Meteo → Maps.co

**Special (US Authoritative):**
1. Census batch (auto-used for US street addresses in bulk)

The router prefers providers with the most **daily quota remaining** in the active lane, then falls back across lanes if needed.

## Server-Side Processing & UI Streaming

- All geocoding requests run **server-side** to protect keys and maximize throughput.
- The server exposes:
  - `POST /geocode/batch` — accepts an array of addresses; dedupes and processes with a provider router.
  - `GET /geocode/stream?job_id=...` — **Server-Sent Events (SSE)** stream that sends each row's result as it completes.
- The frontend:
  - Starts a job (`/geocode/batch`) to receive `job_id`.
  - Opens an SSE connection to `/geocode/stream` and updates the lat/long column **row-by-row** as events arrive.
- Benefits:
  - Stable rate control per provider
  - Near real-time UX without waiting for the entire batch

## Rate Limits

The system enforces **per-provider rate limits** server-side using the configuration above:

| Provider | Default RPS | Daily Limit | Notes |
|----------|-------------|-------------|-------|
| MapTiler | 10 | 100,000 | Primary keyed provider |
| Geocod.io | 10 | 2,500 | US/Canada focused |
| LocationIQ | 2 | 5,000 | Global coverage |
| OpenCage | 1 | 2,500 | Conservative limits |
| Open-Meteo | 10 | 10,000 | No key required |
| Maps.co | 3 | 33,000 | Nominatim wrapper |

- **Daily counters** per provider (decrement on 2xx with usable result).
- **Retry once** per provider on 429/5xx, then failover to next.
- **Caching:** 7-day TTL, cache only non-empty top-1 results.
- **Deduplication:** Hash normalized address to prevent repeat hits.

## Testing

After setting up your `.env` file, test the configuration by uploading a small CSV file through the web interface. The system will automatically use the available APIs based on your configuration.

## Security

- Never commit your `.env` file to version control
- The `.gitignore` file is configured to exclude `.env` automatically
- Keep your API keys secure and regenerate them if compromised
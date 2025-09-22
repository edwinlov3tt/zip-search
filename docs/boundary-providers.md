# ZIP Boundary Providers Implementation

## Overview
Implemented a robust multi-provider fallback system for fetching ZIP/ZCTA boundaries. The system automatically tries multiple sources in order of preference until successful.

## Provider Chain (in order of preference)

1. **Custom Droplet API** (45.55.36.108:8002)
   - Primary source for ZIP boundaries
   - Fast, already integrated
   - Free tier

2. **US Census TIGER API**
   - Official ZCTA boundaries
   - Free, authoritative source
   - Good for spatial queries

3. **Esri Living Atlas**
   - Alternative ZCTA source
   - Free tier available
   - Good uptime

4. **Geoapify Boundaries**
   - Commercial provider with free tier
   - Global coverage
   - Clean API

5. **HERE Maps**
   - Enterprise-grade provider
   - Creates boundaries from geocoding data
   - Paid tier

6. **TomTom**
   - Alternative commercial provider
   - Creates boundaries from viewport data
   - Paid tier

## Features

- **Automatic Fallback**: If one provider fails, automatically tries the next
- **Rate Limiting**: Respects provider rate limits
- **Caching**: Multi-level caching (memory + localStorage)
- **Batch Processing**: Efficient parallel fetching with configurable batch sizes
- **Error Resilience**: Continues working even when some boundaries fail
- **Geometry Simplification**: Optional simplification using Turf.js

## API Keys Configuration

All API keys are stored in `.env` file:
```env
VITE_GEOAPIFY_API_KEY=your_key_here
VITE_HERE_API_KEY=your_key_here
VITE_TOMTOM_API_KEY=your_key_here
```

## Usage

The system is integrated into the existing `zipBoundariesService.js` and works transparently:

```javascript
// Get single ZIP boundary (tries all providers)
const boundary = await zipBoundariesService.getZipBoundary('10001');

// Get multiple boundaries
const boundaries = await zipBoundariesService.getMultipleZipBoundaries(['10001', '10002', '10003']);

// Get boundaries in viewport
const viewportBoundaries = await zipBoundariesService.getViewportBoundaries(bounds);
```

## Benefits

1. **Reliability**: Multiple fallback sources ensure ZIP boundaries are almost always available
2. **Performance**: Caching and batch processing optimize API calls
3. **Cost Efficiency**: Prioritizes free sources before commercial ones
4. **Transparency**: Console logging shows which provider was used
5. **Graceful Degradation**: App continues working even if some boundaries fail

## Files Modified

- `/src/services/boundaryProviders.js` - New multi-provider service
- `/src/services/zipBoundariesService.js` - Updated to use new provider service
- `/src/GeoApplication.jsx` - Removed error toast notifications
- `package.json` - Added @turf/turf dependency
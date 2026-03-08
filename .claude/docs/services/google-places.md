# Google Places API Integration

Location autocomplete service for GeoSearch Pro.

## Overview

| Property | Value |
|----------|-------|
| Service | Google Places API (Autocomplete) |
| Purpose | Location search suggestions |
| Fallback | Nominatim (OpenStreetMap) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key with Places enabled |

## Files Using This Service

- `src/services/geocodingService.js` - Main integration point
- `src/components/Search/RadiusSearch.jsx` - Autocomplete input
- `src/components/Search/PolygonSearch.jsx` - Autocomplete input

## API Usage

### Autocomplete Request
```javascript
const autocomplete = new google.maps.places.AutocompleteService();
autocomplete.getPlacePredictions({
  input: 'New York',
  types: ['(regions)'],
  componentRestrictions: { country: 'us' }
}, callback);
```

### Place Details
```javascript
const placesService = new google.maps.places.PlacesService(map);
placesService.getDetails({
  placeId: 'ChIJOwg_06VPwokRYv534QaPC8g',
  fields: ['geometry', 'formatted_address']
}, callback);
```

## Rate Limits

- Free tier: 10,000 requests/month
- Over limit: $0.017 per request
- Daily limit: Can be set in Google Cloud Console

## Fallback Behavior

When Google Places fails or quota exceeded:
1. Service catches error
2. Falls back to Nominatim (OpenStreetMap)
3. User sees slightly lower quality suggestions

## Gotchas

1. **API Key Restrictions**: Restrict key to specific domains/IPs
2. **Billing Alert**: Set up billing alerts to avoid surprise charges
3. **CORS**: API key must allow requests from your domain
4. **Session Tokens**: Use session tokens to reduce costs (groups autocomplete + details)

## Official Documentation

- [Places API Overview](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Autocomplete Reference](https://developers.google.com/maps/documentation/javascript/place-autocomplete)
- [Pricing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)

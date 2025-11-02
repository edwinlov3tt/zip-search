// Google Places API Service with Session Token Management and Usage Tracking
// Using AutocompleteService (still supported, though deprecated for new customers as of March 2025)
// Free tier: 10,000 selections/month (autocomplete predictions are FREE with session tokens)

const STORAGE_KEY = 'geo_api_usage';
const MONTHLY_LIMIT = 10000;
const WARNING_THRESHOLD = 9500; // Switch at 95%

class GooglePlacesService {
  constructor() {
    this.service = null;
    this.sessionToken = null;
    this.isLoaded = false;
    this.loadPromise = null;
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    this.originalConsole = { warn: console.warn, error: console.error };

    // Suppress Google Maps console warnings
    this.suppressGoogleWarnings();
  }

  suppressGoogleWarnings() {
    // Only suppress once
    if (window.__googleWarningsSuppressed) return;
    window.__googleWarningsSuppressed = true;

    // Store original console methods
    const originalWarn = console.warn;
    const originalError = console.error;

    // Override console.warn to filter Google Maps warnings
    console.warn = (...args) => {
      // Convert to string for checking
      const message = typeof args[0] === 'string' ? args[0] : String(args[0] || '');

      // Suppress known Google Maps deprecation warnings
      if (
        message.includes('AutocompleteService') ||
        message.includes('Google Maps JavaScript API has been loaded') ||
        message.includes('deprecated') && message.includes('Google') ||
        message.includes('js?key=') && message.includes('loading') ||
        message.includes('You have included the Google Maps JavaScript API')
      ) {
        return; // Suppress
      }

      // Pass through other warnings
      originalWarn.apply(console, args);
    };

    // Override console.error to filter Google Maps non-critical errors
    console.error = (...args) => {
      const message = typeof args[0] === 'string' ? args[0] : String(args[0] || '');

      // Suppress non-critical Google Maps messages
      if (
        message.includes('Google Maps JavaScript API warning') ||
        (message.includes('AutocompleteService') && message.includes('deprecated'))
      ) {
        return; // Suppress
      }

      // Pass through other errors
      originalError.apply(console, args);
    };
  }

  // Usage tracking utilities
  getUsageData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { month: new Date().getMonth(), count: 0 };

      const data = JSON.parse(stored);
      const currentMonth = new Date().getMonth();

      // Reset if new month
      if (data.month !== currentMonth) {
        return { month: currentMonth, count: 0 };
      }
      return data;
    } catch {
      return { month: new Date().getMonth(), count: 0 };
    }
  }

  incrementUsage() {
    const data = this.getUsageData();
    data.count += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Only log if close to limit
    if (data.count >= WARNING_THRESHOLD * 0.9) {
      console.log(`📊 [Google Places] Usage: ${data.count}/${MONTHLY_LIMIT} (${((data.count/MONTHLY_LIMIT)*100).toFixed(1)}%)`);
    }
    return data.count;
  }

  shouldUseGoogle() {
    const { count } = this.getUsageData();
    const shouldUse = count < WARNING_THRESHOLD;
    // Only log if approaching limit
    if (!shouldUse) {
      console.warn(`⚠️ [Google Places] Quota limit reached (${count}/${MONTHLY_LIMIT})`);
    }
    return shouldUse;
  }

  // Load Google Maps Places library with new API using dynamic import
  async loadGoogleMaps() {
    if (!this.apiKey) {
      console.warn('⚠️ [Google Places] No API key provided');
      return false;
    }

    // Return existing promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Check if already loaded
    if (this.isLoaded && window.google?.maps?.places?.AutocompleteService) {
      return true;
    }

    // Create load promise
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if the Maps JS API loader is already loaded
      if (window.google?.maps?.places?.AutocompleteService) {
        this.isLoaded = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      // Don't use loading=async - it causes timing issues with library availability
      // Standard synchronous loading ensures places library is ready when script loads
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        try {
          // Give the API a moment to initialize
          setTimeout(() => {
            if (window.google?.maps?.places) {
              this.isLoaded = true;
              resolve(true);
            } else {
              console.error('❌ [Google Places] Places library not available');
              reject(new Error('Places library not available'));
            }
          }, 100);
        } catch (error) {
          console.error('❌ [Google Places] Failed to initialize:', error);
          reject(error);
        }
      };

      script.onerror = (error) => {
        console.error('❌ [Google Places] Failed to load script:', error);
        reject(error);
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  // Get autocomplete suggestions using AutocompleteService (still supported)
  async getPlaceSuggestions(input, options = {}) {
    await this.loadGoogleMaps();

    if (!window.google?.maps?.places?.AutocompleteService) {
      console.warn('⚠️ [Google Places] AutocompleteService not available');
      return [];
    }

    // Create service and session token if not exists
    if (!this.service) {
      this.service = new window.google.maps.places.AutocompleteService();
    }
    if (!this.sessionToken) {
      this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
    }

    return new Promise((resolve) => {
      const requestOptions = {
        input,
        sessionToken: this.sessionToken,
        componentRestrictions: { country: 'us' },
        ...options
      };

      this.service.getPlacePredictions(requestOptions, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(predictions || []);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve([]);
        } else {
          console.warn('⚠️ [Google Places] Prediction error:', status);
          resolve([]);
        }
      });
    });
  }

  // Get place details (CHARGED - only called on selection)
  async getPlaceDetails(placeId) {
    await this.loadGoogleMaps();

    if (!window.google?.maps?.places) {
      console.warn('⚠️ [Google Places] Places library not available');
      return null;
    }

    return new Promise((resolve) => {
      // Create a temporary div for PlacesService (required by Google)
      const div = document.createElement('div');
      const placesService = new window.google.maps.places.PlacesService(div);

      placesService.getDetails(
        {
          placeId,
          fields: ['geometry', 'formatted_address', 'name', 'address_components', 'types'],
          sessionToken: this.sessionToken,
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            // INCREMENT USAGE - This is when Google charges
            const newCount = this.incrementUsage();

            // Create new session token for next search
            this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();

            if (newCount >= WARNING_THRESHOLD) {
              console.warn(`⚠️ [Google Places] Approaching quota limit (${newCount}/${MONTHLY_LIMIT}). Consider switching to Nominatim.`);
            }

            resolve(place);
          } else {
            console.warn('⚠️ [Google Places] Place details error:', status);
            resolve(null);
          }
        }
      );
    });
  }

  // Convert Google Place to our standard format
  formatGooglePlace(place) {
    if (!place) return null;

    // Extract location from geometry object
    const location = place.geometry?.location;
    const lat = typeof location?.lat === 'function' ? location.lat() : location?.lat;
    const lng = typeof location?.lng === 'function' ? location.lng() : location?.lng;

    // Parse address components
    const addressComponents = place.address_components || [];
    const address = this.parseAddressComponents(addressComponents);

    return {
      id: place.place_id,
      displayName: place.formatted_address || place.name || 'Unknown',
      name: place.name || place.formatted_address?.split(',')[0] || 'Unknown',
      lat: lat,
      lng: lng,
      address: address,
      type: this.determineType(place.types || []),
      importance: 0.8, // Google results are generally high quality
      source: 'google'
    };
  }

  // Parse Google address components into our format
  parseAddressComponents(components) {
    const address = {};

    components.forEach(component => {
      const types = component.types;

      if (types.includes('street_number')) address.house_number = component.long_name;
      if (types.includes('route')) address.road = component.long_name;
      if (types.includes('locality')) address.city = component.long_name;
      if (types.includes('administrative_area_level_2')) address.county = component.long_name;
      if (types.includes('administrative_area_level_1')) address.state = component.short_name;
      if (types.includes('postal_code')) address.postcode = component.long_name;
      if (types.includes('country')) address.country = component.short_name;
    });

    return address;
  }

  // Determine place type from Google types array
  determineType(types) {
    if (types.includes('locality') || types.includes('sublocality')) return 'city';
    if (types.includes('administrative_area_level_1')) return 'state';
    if (types.includes('administrative_area_level_2')) return 'county';
    if (types.includes('postal_code')) return 'zipcode';
    if (types.includes('street_address') || types.includes('premise')) return 'address';
    if (types.includes('establishment') || types.includes('point_of_interest')) return 'business';
    return 'place';
  }

  // Search for places (combines predictions for display)
  async searchPlaces(query, limit = 8) {
    if (!query || query.length < 2) {
      return [];
    }

    // Check quota before searching
    if (!this.shouldUseGoogle()) {
      return null; // Signal to use fallback
    }

    try {
      // Get predictions
      const predictions = await this.getPlaceSuggestions(query);

      // Format predictions for display (no details needed yet)
      return predictions.slice(0, limit).map(prediction => {
        return {
          id: prediction.place_id,
          displayName: prediction.description,
          name: prediction.structured_formatting?.main_text || prediction.description,
          type: this.determineType(prediction.types || []),
          importance: prediction.matched_substrings?.length || 0,
          source: 'google',
          raw: prediction
        };
      });
    } catch (error) {
      console.error('❌ [Google Places] Search error:', error);
      return null; // Signal to use fallback
    }
  }

  // Get full details for a selected place
  async selectPlace(placeId) {
    try {
      const place = await this.getPlaceDetails(placeId);
      if (place) {
        return this.formatGooglePlace(place);
      }
      return null;
    } catch (error) {
      console.error('❌ [Google Places] Selection error:', error);
      return null;
    }
  }
}

// Create singleton instance
export const googlePlacesService = new GooglePlacesService();
export default googlePlacesService;

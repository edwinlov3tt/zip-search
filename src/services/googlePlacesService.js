// Google Places API Service with Session Token Management and Usage Tracking
// Free tier: 10,000 selections/month (autocomplete is FREE with session tokens)

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
    console.log(`📊 [Google Places] Usage: ${data.count}/${MONTHLY_LIMIT} (${((data.count/MONTHLY_LIMIT)*100).toFixed(1)}%)`);
    return data.count;
  }

  shouldUseGoogle() {
    const { count } = this.getUsageData();
    return count < WARNING_THRESHOLD;
  }

  // Load Google Maps Places library
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
    if (window.google?.maps?.places) {
      this.service = new window.google.maps.places.AutocompleteService();
      this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
      this.isLoaded = true;
      return true;
    }

    // Create load promise
    this.loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        try {
          this.service = new window.google.maps.places.AutocompleteService();
          this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
          this.isLoaded = true;
          console.log('✅ [Google Places] Library loaded successfully');
          resolve(true);
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

  // Get autocomplete predictions (FREE with session token)
  async getPlacePredictions(input, options = {}) {
    await this.loadGoogleMaps();

    if (!this.service || !this.sessionToken) {
      console.warn('⚠️ [Google Places] Service not ready');
      return [];
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
    const location = place.geometry?.location;

    return {
      id: place.place_id,
      displayName: place.formatted_address || place.name,
      name: place.name,
      lat: typeof location?.lat === 'function' ? location.lat() : location?.lat,
      lng: typeof location?.lng === 'function' ? location.lng() : location?.lng,
      address: this.parseAddressComponents(place.address_components || []),
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

  // Search for places (combines predictions + details)
  async searchPlaces(query, limit = 8) {
    if (!query || query.length < 2) {
      return [];
    }

    // Check quota before searching
    if (!this.shouldUseGoogle()) {
      console.log('🔄 [Google Places] Quota exceeded, use fallback');
      return null; // Signal to use fallback
    }

    try {
      // Get predictions (FREE)
      const predictions = await this.getPlacePredictions(query);

      // Format predictions for display (no details needed yet)
      return predictions.slice(0, limit).map(prediction => ({
        id: prediction.place_id,
        displayName: prediction.description,
        name: prediction.structured_formatting?.main_text || prediction.description,
        type: this.determineType(prediction.types || []),
        importance: prediction.matched_substrings?.length || 0,
        source: 'google',
        raw: prediction
      }));
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

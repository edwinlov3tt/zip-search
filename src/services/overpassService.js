/**
 * OverpassService
 *
 * Service for querying OpenStreetMap address data via Overpass API
 * Supports both radius and polygon searches with rate limiting
 */

class OverpassService {
  constructor() {
    this.baseURL = 'https://overpass-api.de/api/interpreter';
    this.lastCallTime = 0;
    this.minInterval = 5000; // 5 seconds between calls
  }

  /**
   * Check if cooldown is active
   * @returns {number} Seconds remaining in cooldown, or 0 if ready
   */
  getCooldownRemaining() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    const remaining = this.minInterval - timeSinceLastCall;

    if (remaining > 0) {
      return Math.ceil(remaining / 1000);
    }
    return 0;
  }

  /**
   * Search for addresses within a radius
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radiusMeters - Radius in meters
   * @returns {Promise<Array>} Array of address objects
   */
  async searchAddressesByRadius(lat, lng, radiusMeters) {
    // Check cooldown
    const cooldownRemaining = this.getCooldownRemaining();
    if (cooldownRemaining > 0) {
      throw new Error(`Please wait ${cooldownRemaining} seconds before searching again`);
    }

    const query = `
[out:json][timeout:60];
(
  node["addr:housenumber"](around:${radiusMeters},${lat},${lng});
  way["addr:housenumber"](around:${radiusMeters},${lat},${lng});
);
out center;
    `.trim();

    try {
      this.lastCallTime = Date.now();

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // Provide user-friendly error messages
        if (response.status === 504) {
          throw new Error('Request timed out. The area may be too large or the server is busy. Try a smaller area.');
        } else if (response.status === 400) {
          throw new Error('Invalid search area. Please try a different location or smaller area.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a minute before trying again.');
        }
        throw new Error(`Search failed (${response.status}). Please try again.`);
      }

      const data = await response.json();
      const parsed = this.parseOverpassResponse(data);
      return parsed;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 25 seconds. Try a smaller radius or different location.');
      }
      throw error;
    }
  }

  /**
   * Search for addresses within a polygon
   * @param {Array<[number, number]>} coordinates - Array of [lat, lng] pairs
   * @returns {Promise<Array>} Array of address objects
   */
  async searchAddressesByPolygon(coordinates) {
    // Check cooldown
    const cooldownRemaining = this.getCooldownRemaining();
    if (cooldownRemaining > 0) {
      throw new Error(`Please wait ${cooldownRemaining} seconds before searching again`);
    }

    // Format: "lat lon lat lon lat lon"
    const polyString = coordinates.map(([lat, lng]) => `${lat} ${lng}`).join(' ');

    const query = `
[out:json][timeout:60];
(
  node["addr:housenumber"](poly:"${polyString}");
  way["addr:housenumber"](poly:"${polyString}");
);
out center;
    `.trim();

    try {
      this.lastCallTime = Date.now();

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: query,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // Provide user-friendly error messages
        if (response.status === 504) {
          throw new Error('Request timed out. The area may be too large or the server is busy. Try a smaller area.');
        } else if (response.status === 400) {
          throw new Error('Invalid search area. Please try a different location or smaller area.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please wait a minute before trying again.');
        }
        throw new Error(`Search failed (${response.status}). Please try again.`);
      }

      const data = await response.json();
      const parsed = this.parseOverpassResponse(data);
      return parsed;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 25 seconds. Try a smaller polygon area.');
      }
      throw error;
    }
  }

  /**
   * Parse Overpass API response into normalized address objects
   * @param {Object} data - Raw Overpass API response
   * @returns {Array} Normalized address objects
   */
  parseOverpassResponse(data) {
    if (!data || !data.elements) {
      return [];
    }

    return data.elements.map((element) => {
      const tags = element.tags || {};

      // Get coordinates
      let lat, lng;
      if (element.type === 'node') {
        lat = element.lat;
        lng = element.lon;
      } else if (element.center) {
        // For ways (buildings), use center point
        lat = element.center.lat;
        lng = element.center.lon;
      }

      // Extract address components
      return {
        id: element.id,
        type: element.type,
        housenumber: tags['addr:housenumber'] || '',
        street: tags['addr:street'] || '',
        unit: tags['addr:unit'] || tags['addr:flats'] || '',
        city: tags['addr:city'] || '',
        state: tags['addr:state'] || '',
        postcode: tags['addr:postcode'] || '',
        lat: lat || 0,
        lng: lng || 0,
        // Additional metadata
        building: tags.building || '',
        name: tags.name || '',
        // Store full tags for reference
        rawTags: tags
      };
    }).filter((addr) =>
      // Filter out addresses without required fields
      addr.housenumber && addr.lat && addr.lng
    );
  }

  /**
   * Format address for display
   * @param {Object} address - Address object
   * @returns {string} Formatted address string
   */
  formatAddress(address) {
    const parts = [];

    if (address.housenumber) {
      parts.push(address.housenumber);
    }

    if (address.street) {
      parts.push(address.street);
    }

    if (address.unit) {
      parts.push(`Unit ${address.unit}`);
    }

    const line1 = parts.join(' ');
    const line2Parts = [];

    if (address.city) {
      line2Parts.push(address.city);
    }

    if (address.state) {
      line2Parts.push(address.state);
    }

    if (address.postcode) {
      line2Parts.push(address.postcode);
    }

    const line2 = line2Parts.join(', ');

    if (line1 && line2) {
      return `${line1}, ${line2}`;
    } else if (line1) {
      return line1;
    } else if (line2) {
      return line2;
    }

    return 'Unknown address';
  }
}

// Export singleton instance
export const overpassService = new OverpassService();
export default overpassService;

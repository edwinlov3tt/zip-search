/**
 * County FIPS Code Lookup Service
 * Maps county names and state codes to 5-digit FIPS codes
 * Format: STATE(2) + COUNTY(3) = 5 digits (e.g., "48303" for Lubbock County, TX)
 */

// State code to FIPS mapping
const STATE_TO_FIPS = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09', 'DE': '10',
  'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20',
  'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36',
  'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
  'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56', 'DC': '11', 'PR': '72'
};

// County name to FIPS mapping (county code only, 3 digits)
// Format: "County Name,STATE" => "XXX" (3-digit county code)
const COUNTY_FIPS_MAP = {
  // Texas counties (commonly searched)
  'Lubbock,TX': '303',
  'Harris,TX': '201',
  'Dallas,TX': '113',
  'Tarrant,TX': '439',
  'Bexar,TX': '029',
  'Travis,TX': '453',
  'Collin,TX': '085',
  'Denton,TX': '121',
  'El Paso,TX': '141',
  'Fort Bend,TX': '157',
  'Hidalgo,TX': '215',
  'Montgomery,TX': '339',
  'Williamson,TX': '491',

  // Major US counties
  'Los Angeles,CA': '037',
  'Cook,IL': '031',
  'Maricopa,AZ': '013',
  'San Diego,CA': '073',
  'Orange,CA': '059',
  'Miami-Dade,FL': '086',
  'Kings,NY': '047',  // Brooklyn
  'Queens,NY': '081',
  'New York,NY': '061',  // Manhattan
  'Bronx,NY': '005',
  'Philadelphia,PA': '101',
  'Alameda,CA': '001',
  'Suffolk,MA': '025',  // Boston
  'Middlesex,MA': '017',
  'Clark,NV': '003',  // Las Vegas
  'Fulton,GA': '121',  // Atlanta
  'King,WA': '033',  // Seattle
  'Hennepin,MN': '053',  // Minneapolis
  'Wayne,MI': '163',  // Detroit
  'Cuyahoga,OH': '035',  // Cleveland
  'Franklin,OH': '049',  // Columbus
};

class CountyFipsService {
  constructor() {
    this.cache = new Map();
    this.censusCache = new Map();
  }

  /**
   * Get 5-digit FIPS code for a county
   * @param {string} countyName - County name (e.g., "Lubbock")
   * @param {string} stateCode - 2-letter state code (e.g., "TX")
   * @returns {string|null} 5-digit FIPS code (e.g., "48303") or null if not found
   */
  getCountyFips(countyName, stateCode) {
    if (!countyName || !stateCode) return null;

    const key = `${countyName},${stateCode.toUpperCase()}`;

    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Normalize county name (remove "County" suffix if present)
    const normalizedName = countyName.replace(/ County$/i, '').trim();
    const lookupKey = `${normalizedName},${stateCode.toUpperCase()}`;

    // Check static mapping
    const countyCode = COUNTY_FIPS_MAP[lookupKey];
    if (countyCode) {
      const stateFips = STATE_TO_FIPS[stateCode.toUpperCase()];
      if (stateFips) {
        const fullFips = stateFips + countyCode;
        this.cache.set(key, fullFips);
        return fullFips;
      }
    }

    // Not found in static map
    console.warn(`[CountyFips] County not in mapping: ${lookupKey}`);
    return null;
  }

  /**
   * Get FIPS codes for multiple counties
   * @param {Array<{county: string, state: string}>} counties - Array of county/state pairs
   * @returns {Array<string>} Array of 5-digit FIPS codes (nulls filtered out)
   */
  getMultipleCountyFips(counties) {
    if (!counties || counties.length === 0) return [];

    const fipsCodes = [];
    const notFound = [];

    for (const { county, state } of counties) {
      const fips = this.getCountyFips(county, state);
      if (fips) {
        fipsCodes.push(fips);
      } else {
        notFound.push(`${county}, ${state}`);
      }
    }

    if (notFound.length > 0) {
      console.log(`[CountyFips] Could not find FIPS for ${notFound.length} counties:`, notFound.slice(0, 5));
    }

    return [...new Set(fipsCodes)]; // Remove duplicates
  }

  /**
   * Lookup county FIPS from Census API (fallback for unmapped counties)
   * @param {string} countyName - County name
   * @param {string} stateCode - 2-letter state code
   * @returns {Promise<string|null>} 5-digit FIPS code or null
   */
  async lookupFromCensusAPI(countyName, stateCode) {
    const key = `${countyName},${stateCode.toUpperCase()}`;

    // Check Census cache
    if (this.censusCache.has(key)) {
      return this.censusCache.get(key);
    }

    try {
      const stateFips = STATE_TO_FIPS[stateCode.toUpperCase()];
      if (!stateFips) return null;

      // Query Census API for all counties in state
      const url = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`[CountyFips] Census API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Find matching county
      const normalizedSearch = countyName.replace(/ County$/i, '').trim().toLowerCase();

      for (let i = 1; i < data.length; i++) {  // Skip header row
        const [name, state, county] = data[i];
        const normalizedName = name.replace(/ County,.*$/, '').trim().toLowerCase();

        if (normalizedName === normalizedSearch) {
          const fullFips = state + county;
          this.censusCache.set(key, fullFips);
          this.cache.set(key, fullFips);

          // Add to static map for future use
          console.log(`[CountyFips] Found via Census API: ${key} => ${fullFips}`);
          return fullFips;
        }
      }

      console.warn(`[CountyFips] County not found in Census API: ${key}`);
      return null;
    } catch (error) {
      console.error(`[CountyFips] Error querying Census API:`, error);
      return null;
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    this.censusCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      staticMapSize: Object.keys(COUNTY_FIPS_MAP).length,
      cacheSize: this.cache.size,
      censusCacheSize: this.censusCache.size
    };
  }
}

// Export singleton instance
export default new CountyFipsService();

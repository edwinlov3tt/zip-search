import { useEffect, useCallback, useRef } from 'react';
import { useMap } from '../../contexts/MapContext';
import { useResults } from '../../contexts/ResultsContext';
import { useSearch } from '../../contexts/SearchContext';
import zipBoundariesService from '../../services/zipBoundariesService';
import stateBoundariesService from '../../services/stateBoundariesService';
import cityBoundariesService from '../../services/cityBoundariesService';
import vtdBoundariesService from '../../services/vtdBoundariesService';
import countyFipsService from '../../services/countyFipsService';

/**
 * BoundaryManager - Handles loading boundary data based on toggles and search results
 * This component doesn't render anything, it just manages data loading effects
 */
const BoundaryManager = () => {
  const {
    showZipBoundaries,
    setZipBoundariesData,
    setLoadingZipBoundaries,
    showStateBoundaries,
    setStateBoundariesData,
    setLoadingStateBoundaries,
    showCityBoundaries,
    setCityBoundariesData,
    setLoadingCityBoundaries,
    showVtdBoundaries,
    setVtdBoundariesData,
    setLoadingVtdBoundaries
  } = useMap();

  const { zipResults, cityResults, geocodeResults, addressResults } = useResults();
  const { searchPerformed, searchMode, radiusCenter, radius } = useSearch();

  // Refs to track loading state
  const lastStateLoadRef = useRef(false);
  const lastCityKeysRef = useRef('');
  const lastVtdStatesRef = useRef('');

  // Load ALL U.S. state boundaries (50 states + DC + PR)
  const loadAllStateBoundaries = useCallback(async () => {
    if (!showStateBoundaries) return;
    if (lastStateLoadRef.current) return; // Already loaded

    console.log('[State Boundaries] Loading all U.S. states...');
    setLoadingStateBoundaries(true);
    lastStateLoadRef.current = true;

    try {
      // All 50 states + DC + Puerto Rico (2-letter codes)
      const allStateCodes = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
        'DC', 'PR'
      ];

      const features = [];
      const batchSize = 10;

      for (let i = 0; i < allStateCodes.length; i += batchSize) {
        const batch = allStateCodes.slice(i, i + batchSize);
        console.log(`[State Boundaries] Loading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allStateCodes.length/batchSize)}`);

        const batchFeatures = await Promise.all(
          batch.map(code => stateBoundariesService.getStateBoundary(code, true))
        );

        features.push(...batchFeatures.filter(Boolean));
      }

      const geojson = {
        type: 'FeatureCollection',
        features
      };

      setStateBoundariesData(geojson);
      console.log(`[State Boundaries] Loaded ${features.length} state boundaries`);
    } catch (error) {
      console.error('[State Boundaries] Error loading:', error);
    } finally {
      setLoadingStateBoundaries(false);
    }
  }, [showStateBoundaries, setStateBoundariesData, setLoadingStateBoundaries]);

  // Load ZIP boundaries for search results
  const loadZipBoundariesForResults = useCallback(async () => {
    // Check if we should load boundaries
    const hasZipResults = zipResults && zipResults.length > 0;
    const hasGeocodeResults = searchMode === 'geocode' && geocodeResults && geocodeResults.length > 0;
    const hasAddressResults = searchMode === 'address' && addressResults && addressResults.length > 0;

    if (!showZipBoundaries) {
      return;
    }

    if (!hasZipResults && !hasGeocodeResults && !hasAddressResults) {
      console.log('[ZIP Boundaries] Skipping load:', {
        showZipBoundaries,
        zipCount: zipResults?.length || 0,
        geocodeCount: geocodeResults?.length || 0,
        addressCount: addressResults?.length || 0,
        searchMode
      });
      return;
    }

    console.log('[ZIP Boundaries] Loading boundaries for results');
    setLoadingZipBoundaries(true);

    try {
      // Extract unique ZIP codes from all available sources
      const allZipCodes = new Set();

      // From normal ZIP search results
      if (hasZipResults) {
        zipResults.forEach(result => {
          const zip = result.zipCode || result.zipcode;
          if (zip) allZipCodes.add(zip);
        });
      }

      // From geocoded addresses
      if (hasGeocodeResults) {
        geocodeResults.forEach(result => {
          if (result.zip) allZipCodes.add(result.zip);
        });
      }

      // From address search results
      if (hasAddressResults) {
        addressResults.forEach(result => {
          if (result.postcode) allZipCodes.add(result.postcode);
        });
      }

      const resultZipCodes = Array.from(allZipCodes);
      console.log('[ZIP Boundaries] Unique ZIP codes:', resultZipCodes.length);

      // Fetch boundaries from TIGER API
      const boundariesData = await zipBoundariesService.getMultipleZipBoundaries(
        resultZipCodes,
        true // simplified
      );

      console.log('[ZIP Boundaries] Received', boundariesData?.features?.length || 0, 'features');

      if (boundariesData && boundariesData.features.length > 0) {
        // Mark features as being in search results
        boundariesData.features.forEach(feature => {
          const zipCode = feature.properties?.zipcode;
          feature.properties.inSearchResults = resultZipCodes.includes(zipCode);
        });

        setZipBoundariesData(boundariesData);
        console.log('[ZIP Boundaries] Successfully set boundary data');
      } else {
        console.warn('[ZIP Boundaries] No features returned from TIGER API');
      }
    } catch (error) {
      console.error('[ZIP Boundaries] Error loading:', error);
    } finally {
      setLoadingZipBoundaries(false);
    }
  }, [showZipBoundaries, searchPerformed, searchMode, zipResults, geocodeResults, addressResults, setZipBoundariesData, setLoadingZipBoundaries]);

  // Load city boundaries for city results
  const loadCityBoundariesForResults = useCallback(async () => {
    if (!showCityBoundaries || !cityResults || cityResults.length === 0) {
      console.log('[City Boundaries] Skipping load:', {
        showCityBoundaries,
        cityCount: cityResults?.length || 0
      });
      return;
    }

    // Create unique keys for cities (name|state)
    const cityKeys = [...new Set(cityResults.map(c => `${c.name}|${c.state}`))];
    const keysStr = cityKeys.join(',');

    // Skip if we already loaded these cities
    if (keysStr === lastCityKeysRef.current) {
      console.log('[City Boundaries] Already loaded these cities');
      return;
    }
    lastCityKeysRef.current = keysStr;

    console.log(`[City Boundaries] Loading boundaries for ${cityKeys.length} cities`);
    setLoadingCityBoundaries(true);

    try {
      const features = [];
      const batchSize = 20;

      for (let i = 0; i < cityKeys.length; i += batchSize) {
        const batch = cityKeys.slice(i, i + batchSize);
        console.log(`[City Boundaries] Loading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cityKeys.length/batchSize)}`);

        const batchFeatures = await Promise.all(
          batch.map(key => {
            const [name, state] = key.split('|');
            console.log(`[City Boundaries] Fetching: ${name}, ${state}`);
            return cityBoundariesService.getCityBoundary(name, state, true);
          })
        );

        features.push(...batchFeatures.filter(Boolean));
      }

      const geojson = {
        type: 'FeatureCollection',
        features
      };

      setCityBoundariesData(geojson);
      console.log(`[City Boundaries] Loaded ${features.length} city boundaries`);
    } catch (error) {
      console.error('[City Boundaries] Error loading:', error);
    } finally {
      setLoadingCityBoundaries(false);
    }
  }, [showCityBoundaries, cityResults, setCityBoundariesData, setLoadingCityBoundaries]);

  // Load VTD boundaries for search results area (county-based approach)
  const loadVtdBoundariesForResults = useCallback(async () => {
    const hasData = (zipResults && zipResults.length > 0) ||
                    (cityResults && cityResults.length > 0) ||
                    (geocodeResults && geocodeResults.length > 0) ||
                    (addressResults && addressResults.length > 0);

    if (!showVtdBoundaries || !hasData) {
      console.log('[VTD Boundaries] Skipping load:', {
        showVtdBoundaries,
        hasData
      });
      return;
    }

    // Extract unique counties from all available result sources
    const uniqueCounties = new Map(); // Map<"County,State", {county, state}>

    // Get counties from ZIP results
    if (zipResults && zipResults.length > 0) {
      zipResults.forEach(result => {
        if (result.county && result.state) {
          const key = `${result.county},${result.state}`;
          if (!uniqueCounties.has(key)) {
            uniqueCounties.set(key, { county: result.county, state: result.state });
          }
        }
      });
    }

    // Get counties from city results
    if (cityResults && cityResults.length > 0) {
      cityResults.forEach(result => {
        if (result.county && result.state) {
          const key = `${result.county},${result.state}`;
          if (!uniqueCounties.has(key)) {
            uniqueCounties.set(key, { county: result.county, state: result.state });
          }
        }
      });
    }

    // Get counties from geocode results (if county field exists in CSV)
    if (geocodeResults && geocodeResults.length > 0) {
      geocodeResults.forEach(result => {
        if (result.county && result.state) {
          const key = `${result.county},${result.state}`;
          if (!uniqueCounties.has(key)) {
            uniqueCounties.set(key, { county: result.county, state: result.state });
          }
        }
      });
    }

    // Get counties from address search results (derive from city if available)
    if (addressResults && addressResults.length > 0) {
      addressResults.forEach(result => {
        if (result.city && result.state) {
          // We'll try to derive county from city using the FIPS service
          // For now, just skip if no direct county field
          // The FIPS service can handle city->county mapping
        }
      });
    }

    if (uniqueCounties.size === 0) {
      console.log('[VTD Boundaries] No counties found in results');
      return;
    }

    const counties = Array.from(uniqueCounties.values());
    console.log(`[VTD Boundaries] Found ${counties.length} unique counties in results:`,
      counties.map(c => `${c.county}, ${c.state}`));

    // Convert county names to FIPS codes
    const countyFipsCodes = countyFipsService.getMultipleCountyFips(counties);

    if (countyFipsCodes.length === 0) {
      console.warn('[VTD Boundaries] No FIPS codes found for counties');
      return;
    }

    // Create cache key based on county FIPS codes
    const fipsKey = countyFipsCodes.sort().join(',');

    // Skip if we already loaded VTDs for these counties
    if (fipsKey === lastVtdStatesRef.current) {
      console.log('[VTD Boundaries] Already loaded VTDs for these counties');
      return;
    }
    lastVtdStatesRef.current = fipsKey;

    console.log(`[VTD Boundaries] Loading VTDs for ${countyFipsCodes.length} counties (FIPS):`, countyFipsCodes);
    setLoadingVtdBoundaries(true);

    try {
      // Query VTDs by county FIPS codes
      const boundariesData = await vtdBoundariesService.getVtdBoundariesForCounties(
        countyFipsCodes,
        true // simplified geometry
      );

      if (boundariesData && boundariesData.features.length > 0) {
        setVtdBoundariesData(boundariesData);
        console.log(`[VTD Boundaries] Loaded ${boundariesData.features.length} VTD boundaries for ${countyFipsCodes.length} counties`);
      } else {
        console.warn('[VTD Boundaries] No VTD features returned for counties:', countyFipsCodes);
      }
    } catch (error) {
      console.error('[VTD Boundaries] Error loading:', error);
    } finally {
      setLoadingVtdBoundaries(false);
    }
  }, [showVtdBoundaries, searchPerformed, zipResults, cityResults, geocodeResults, addressResults, setVtdBoundariesData, setLoadingVtdBoundaries]);

  // Effect: Load state boundaries when toggled on
  useEffect(() => {
    if (showStateBoundaries) {
      loadAllStateBoundaries();
    } else {
      setStateBoundariesData(null);
      lastStateLoadRef.current = false; // Reset so it loads next time
    }
  }, [showStateBoundaries, loadAllStateBoundaries, setStateBoundariesData]);

  // Effect: Load ZIP boundaries when toggled on or when search results change
  useEffect(() => {
    if (showZipBoundaries) {
      loadZipBoundariesForResults();
    } else {
      setZipBoundariesData(null);
    }
  }, [showZipBoundaries, searchPerformed, searchMode, zipResults, geocodeResults, addressResults, loadZipBoundariesForResults, setZipBoundariesData]);

  // Effect: Load city boundaries when toggled on or when city results change
  useEffect(() => {
    if (showCityBoundaries) {
      loadCityBoundariesForResults();
    } else {
      setCityBoundariesData(null);
      lastCityKeysRef.current = ''; // Reset so it loads next time
    }
  }, [showCityBoundaries, cityResults, loadCityBoundariesForResults, setCityBoundariesData]);

  // Effect: Load VTD boundaries when toggled on or when results change
  useEffect(() => {
    if (showVtdBoundaries) {
      loadVtdBoundariesForResults();
    } else {
      setVtdBoundariesData(null);
      lastVtdStatesRef.current = ''; // Reset so it loads next time
    }
  }, [showVtdBoundaries, searchPerformed, zipResults, cityResults, geocodeResults, addressResults, loadVtdBoundariesForResults, setVtdBoundariesData]);

  // This component doesn't render anything
  return null;
};

export default BoundaryManager;

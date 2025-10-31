import { useEffect, useCallback, useRef } from 'react';
import { useMap } from '../../contexts/MapContext';
import { useResults } from '../../contexts/ResultsContext';
import { useSearch } from '../../contexts/SearchContext';
import zipBoundariesService from '../../services/zipBoundariesService';
import stateBoundariesService from '../../services/stateBoundariesService';
import cityBoundariesService from '../../services/cityBoundariesService';

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
    setLoadingCityBoundaries
  } = useMap();

  const { zipResults, cityResults } = useResults();
  const { searchPerformed, searchMode, radiusCenter, radius } = useSearch();

  // Refs to track loading state
  const lastStateLoadRef = useRef(false);
  const lastCityKeysRef = useRef('');

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
    if (!showZipBoundaries || !searchPerformed || !zipResults || zipResults.length === 0) {
      console.log('[ZIP Boundaries] Skipping load:', {
        showZipBoundaries,
        searchPerformed,
        zipCount: zipResults?.length || 0
      });
      return;
    }

    console.log('[ZIP Boundaries] Loading boundaries for', zipResults.length, 'ZIP results');
    setLoadingZipBoundaries(true);

    try {
      // Extract unique ZIP codes from search results
      const resultZipCodes = [...new Set(zipResults.map(result => result.zipCode || result.zipcode))];
      console.log('[ZIP Boundaries] Result ZIP codes:', resultZipCodes.length, 'unique ZIPs');

      // For radius/polygon searches, fetch boundaries for result ZIPs
      // Note: We're not fetching nearby ZIPs to keep it simple and fast
      const allZipCodes = resultZipCodes;

      // Fetch boundaries from TIGER API
      const boundariesData = await zipBoundariesService.getMultipleZipBoundaries(
        allZipCodes,
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
  }, [showZipBoundaries, searchPerformed, zipResults, setZipBoundariesData, setLoadingZipBoundaries]);

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
  }, [showZipBoundaries, searchPerformed, zipResults, loadZipBoundariesForResults, setZipBoundariesData]);

  // Effect: Load city boundaries when toggled on or when city results change
  useEffect(() => {
    if (showCityBoundaries) {
      loadCityBoundariesForResults();
    } else {
      setCityBoundariesData(null);
      lastCityKeysRef.current = ''; // Reset so it loads next time
    }
  }, [showCityBoundaries, cityResults, loadCityBoundariesForResults, setCityBoundariesData]);

  // This component doesn't render anything
  return null;
};

export default BoundaryManager;

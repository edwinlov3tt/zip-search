import { useEffect, useRef } from 'react';
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
 *
 * All async operations use AbortController to prevent:
 * - Stale data from overwriting current data on rapid toggles
 * - State updates after component unmount
 * - Race conditions when results change quickly
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
  const { searchPerformed, searchMode } = useSearch();

  // Refs to track what's already been loaded (deduplication)
  const lastStateLoadRef = useRef(false);
  const lastZipCodesRef = useRef('');
  const lastCityKeysRef = useRef('');
  const lastVtdFipsRef = useRef('');

  // Effect: Load state boundaries when toggled on
  useEffect(() => {
    if (!showStateBoundaries) {
      setStateBoundariesData(null);
      lastStateLoadRef.current = false;
      return;
    }

    // Skip if already loaded
    if (lastStateLoadRef.current) {
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const loadStateBoundaries = async () => {
      console.log('[State Boundaries] Loading all U.S. states...');
      setLoadingStateBoundaries(true);
      lastStateLoadRef.current = true;

      try {
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
          // Check if aborted before each batch
          if (signal.aborted) {
            console.log('[State Boundaries] Load aborted');
            return;
          }

          const batch = allStateCodes.slice(i, i + batchSize);
          console.log(`[State Boundaries] Loading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allStateCodes.length/batchSize)}`);

          const batchFeatures = await Promise.all(
            batch.map(code => stateBoundariesService.getStateBoundary(code, true))
          );

          features.push(...batchFeatures.filter(Boolean));
        }

        // Final abort check before setting state
        if (signal.aborted) {
          console.log('[State Boundaries] Load aborted before setState');
          return;
        }

        const geojson = {
          type: 'FeatureCollection',
          features
        };

        setStateBoundariesData(geojson);
        console.log(`[State Boundaries] Loaded ${features.length} state boundaries`);
      } catch (error) {
        if (signal.aborted) return;
        console.error('[State Boundaries] Error loading:', error);
      } finally {
        if (!signal.aborted) {
          setLoadingStateBoundaries(false);
        }
      }
    };

    loadStateBoundaries();

    return () => {
      abortController.abort();
      setLoadingStateBoundaries(false);
    };
  }, [showStateBoundaries, setStateBoundariesData, setLoadingStateBoundaries]);

  // Effect: Load ZIP boundaries when toggled on or when search results change
  useEffect(() => {
    if (!showZipBoundaries) {
      setZipBoundariesData(null);
      lastZipCodesRef.current = '';
      return;
    }

    // Check if we have any results to load boundaries for
    const hasZipResults = zipResults && zipResults.length > 0;
    const hasGeocodeResults = searchMode === 'geocode' && geocodeResults && geocodeResults.length > 0;
    const hasAddressResults = searchMode === 'address' && addressResults && addressResults.length > 0;

    if (!hasZipResults && !hasGeocodeResults && !hasAddressResults) {
      console.log('[ZIP Boundaries] Skipping load - no results');
      return;
    }

    // Extract unique ZIP codes
    const allZipCodes = new Set();

    if (hasZipResults) {
      zipResults.forEach(result => {
        const zip = result.zipCode || result.zipcode;
        if (zip) allZipCodes.add(zip);
      });
    }

    if (hasGeocodeResults) {
      geocodeResults.forEach(result => {
        if (result.zip) allZipCodes.add(result.zip);
      });
    }

    if (hasAddressResults) {
      addressResults.forEach(result => {
        if (result.postcode) allZipCodes.add(result.postcode);
      });
    }

    const resultZipCodes = Array.from(allZipCodes).sort();
    const zipCodesKey = resultZipCodes.join(',');

    // Skip if we already loaded these exact ZIP codes
    if (zipCodesKey === lastZipCodesRef.current) {
      console.log('[ZIP Boundaries] Already loaded these ZIP codes');
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const loadZipBoundaries = async () => {
      console.log('[ZIP Boundaries] Loading boundaries for', resultZipCodes.length, 'ZIP codes');
      setLoadingZipBoundaries(true);

      try {
        const boundariesData = await zipBoundariesService.getMultipleZipBoundaries(
          resultZipCodes,
          true // simplified
        );

        // Check if aborted before setting state
        if (signal.aborted) {
          console.log('[ZIP Boundaries] Load aborted before setState');
          return;
        }

        console.log('[ZIP Boundaries] Received', boundariesData?.features?.length || 0, 'features');

        if (boundariesData && boundariesData.features.length > 0) {
          // Mark features as being in search results
          boundariesData.features.forEach(feature => {
            const zipCode = feature.properties?.zipcode;
            feature.properties.inSearchResults = resultZipCodes.includes(zipCode);
          });

          lastZipCodesRef.current = zipCodesKey;
          setZipBoundariesData(boundariesData);
          console.log('[ZIP Boundaries] Successfully set boundary data');
        } else {
          console.warn('[ZIP Boundaries] No features returned from TIGER API');
        }
      } catch (error) {
        if (signal.aborted) return;
        console.error('[ZIP Boundaries] Error loading:', error);
      } finally {
        if (!signal.aborted) {
          setLoadingZipBoundaries(false);
        }
      }
    };

    loadZipBoundaries();

    return () => {
      abortController.abort();
      setLoadingZipBoundaries(false);
    };
  }, [showZipBoundaries, searchPerformed, searchMode, zipResults, geocodeResults, addressResults, setZipBoundariesData, setLoadingZipBoundaries]);

  // Effect: Load city boundaries when toggled on or when city results change
  useEffect(() => {
    if (!showCityBoundaries) {
      setCityBoundariesData(null);
      lastCityKeysRef.current = '';
      return;
    }

    if (!cityResults || cityResults.length === 0) {
      console.log('[City Boundaries] Skipping load - no city results');
      return;
    }

    // Create unique keys for cities
    const cityKeys = [...new Set(cityResults.map(c => `${c.name}|${c.state}`))].sort();
    const keysStr = cityKeys.join(',');

    // Skip if we already loaded these cities
    if (keysStr === lastCityKeysRef.current) {
      console.log('[City Boundaries] Already loaded these cities');
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const loadCityBoundaries = async () => {
      console.log(`[City Boundaries] Loading boundaries for ${cityKeys.length} cities`);
      setLoadingCityBoundaries(true);

      try {
        const features = [];
        const batchSize = 20;

        for (let i = 0; i < cityKeys.length; i += batchSize) {
          // Check if aborted before each batch
          if (signal.aborted) {
            console.log('[City Boundaries] Load aborted');
            return;
          }

          const batch = cityKeys.slice(i, i + batchSize);
          console.log(`[City Boundaries] Loading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cityKeys.length/batchSize)}`);

          const batchFeatures = await Promise.all(
            batch.map(key => {
              const [name, state] = key.split('|');
              return cityBoundariesService.getCityBoundary(name, state, true);
            })
          );

          features.push(...batchFeatures.filter(Boolean));
        }

        // Final abort check before setting state
        if (signal.aborted) {
          console.log('[City Boundaries] Load aborted before setState');
          return;
        }

        const geojson = {
          type: 'FeatureCollection',
          features
        };

        lastCityKeysRef.current = keysStr;
        setCityBoundariesData(geojson);
        console.log(`[City Boundaries] Loaded ${features.length} city boundaries`);
      } catch (error) {
        if (signal.aborted) return;
        console.error('[City Boundaries] Error loading:', error);
      } finally {
        if (!signal.aborted) {
          setLoadingCityBoundaries(false);
        }
      }
    };

    loadCityBoundaries();

    return () => {
      abortController.abort();
      setLoadingCityBoundaries(false);
    };
  }, [showCityBoundaries, cityResults, setCityBoundariesData, setLoadingCityBoundaries]);

  // Effect: Load VTD boundaries when toggled on or when results change
  useEffect(() => {
    if (!showVtdBoundaries) {
      setVtdBoundariesData(null);
      lastVtdFipsRef.current = '';
      return;
    }

    // Check if we have any data to derive counties from
    const hasData = (zipResults && zipResults.length > 0) ||
                    (cityResults && cityResults.length > 0) ||
                    (geocodeResults && geocodeResults.length > 0) ||
                    (addressResults && addressResults.length > 0);

    if (!hasData) {
      console.log('[VTD Boundaries] Skipping load - no results');
      return;
    }

    // Extract unique counties from all result sources
    const uniqueCounties = new Map();

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

    if (uniqueCounties.size === 0) {
      console.log('[VTD Boundaries] No counties found in results');
      return;
    }

    const counties = Array.from(uniqueCounties.values());
    const countyFipsCodes = countyFipsService.getMultipleCountyFips(counties);

    if (countyFipsCodes.length === 0) {
      console.warn('[VTD Boundaries] No FIPS codes found for counties');
      return;
    }

    // Create cache key based on FIPS codes
    const fipsKey = countyFipsCodes.sort().join(',');

    // Skip if we already loaded VTDs for these counties
    if (fipsKey === lastVtdFipsRef.current) {
      console.log('[VTD Boundaries] Already loaded VTDs for these counties');
      return;
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const loadVtdBoundaries = async () => {
      console.log(`[VTD Boundaries] Loading VTDs for ${countyFipsCodes.length} counties`);
      setLoadingVtdBoundaries(true);

      try {
        const boundariesData = await vtdBoundariesService.getVtdBoundariesForCounties(
          countyFipsCodes,
          true // simplified geometry
        );

        // Check if aborted before setting state
        if (signal.aborted) {
          console.log('[VTD Boundaries] Load aborted before setState');
          return;
        }

        if (boundariesData && boundariesData.features.length > 0) {
          lastVtdFipsRef.current = fipsKey;
          setVtdBoundariesData(boundariesData);
          console.log(`[VTD Boundaries] Loaded ${boundariesData.features.length} VTD boundaries`);
        } else {
          console.warn('[VTD Boundaries] No VTD features returned');
        }
      } catch (error) {
        if (signal.aborted) return;
        console.error('[VTD Boundaries] Error loading:', error);
      } finally {
        if (!signal.aborted) {
          setLoadingVtdBoundaries(false);
        }
      }
    };

    loadVtdBoundaries();

    return () => {
      abortController.abort();
      setLoadingVtdBoundaries(false);
    };
  }, [showVtdBoundaries, searchPerformed, zipResults, cityResults, geocodeResults, addressResults, setVtdBoundariesData, setLoadingVtdBoundaries]);

  // This component doesn't render anything
  return null;
};

export default BoundaryManager;

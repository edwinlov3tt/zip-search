import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for accessing browser geolocation
 * @param {Object} options - Geolocation options
 * @returns {Object} - Location data and methods
 */
export const useGeolocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp
        });
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: options.enableHighAccuracy || false,
        timeout: options.timeout || 10000,
        maximumAge: options.maximumAge || 0
      }
    );
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge]);

  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        setError(error.message);
      },
      options
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [options]);

  useEffect(() => {
    if (options.autoStart) {
      getCurrentLocation();
    }
  }, [options.autoStart, getCurrentLocation]);

  return {
    location,
    error,
    loading,
    getCurrentLocation,
    watchLocation
  };
};

export default useGeolocation;
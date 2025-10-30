import React, { useEffect, useState, useRef } from 'react';
import CSVUploadInterface from '../Modals/CSVUploadInterface';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';

const GeocodeSearch = ({ handleCSVUpload, handleRemoveFile }) => {
  const {
    geocodeFile,
    geocodeProcessing,
    geocodeError,
    geocodeProgress
  } = useSearch();

  const { isDarkMode } = useUI();

  // Artificial progress state
  const [artificialProgress, setArtificialProgress] = useState(0);
  const progressIntervalRef = useRef(null);

  // Calculate artificial progress rate based on address count
  useEffect(() => {
    if (geocodeProcessing && geocodeProgress.total > 0) {
      // Reset artificial progress when processing starts
      setArtificialProgress(0);

      // Calculate progress rate
      // Assume ~1-2 seconds per address, move to 95% over estimated time
      const estimatedTimePerAddress = 1.5; // seconds
      const totalEstimatedTime = geocodeProgress.total * estimatedTimePerAddress;
      const targetProgress = 95; // Stop at 95%
      const incrementInterval = 100; // Update every 100ms
      const incrementsNeeded = (totalEstimatedTime * 1000) / incrementInterval;
      const incrementPerStep = targetProgress / incrementsNeeded;

      // Start artificial progress
      progressIntervalRef.current = setInterval(() => {
        setArtificialProgress(prev => {
          const next = prev + incrementPerStep;
          // Cap at 95% until real results arrive
          return next >= 95 ? 95 : next;
        });
      }, incrementInterval);

      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };
    } else if (!geocodeProcessing) {
      // Processing completed, jump to 100%
      setArtificialProgress(100);

      // Clear interval if it exists
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Reset after a short delay
      setTimeout(() => {
        setArtificialProgress(0);
      }, 500);
    }
  }, [geocodeProcessing, geocodeProgress.total]);

  // Use real progress if available, otherwise use artificial
  const displayProgress = geocodeProgress.percentage > 0 ? geocodeProgress.percentage : artificialProgress;

  return (
    <>
      <CSVUploadInterface
        onFileUpload={handleCSVUpload}
        onRemoveFile={handleRemoveFile}
        uploadedFile={geocodeFile}
        isLoading={geocodeProcessing}
        error={geocodeError}
        isDarkMode={isDarkMode}
        isGeocodeMode={true}
      />
      {/* Progress Indicator */}
      {geocodeProgress.total > 0 && geocodeProcessing && (
        <div className={`px-2 pb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between text-xs mb-1">
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              Geocoding addresses...
            </span>
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              {geocodeProgress.processed > 0
                ? `${geocodeProgress.processed} / ${geocodeProgress.total}`
                : `${Math.floor(displayProgress)}%`
              }
            </span>
          </div>
          <div className={`w-full h-2 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
            <div
              className="h-2 bg-red-600 rounded transition-all duration-300"
              style={{
                width: `${geocodeProgress.processed > 0
                  ? (geocodeProgress.processed / geocodeProgress.total) * 100
                  : displayProgress}%`
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default GeocodeSearch;

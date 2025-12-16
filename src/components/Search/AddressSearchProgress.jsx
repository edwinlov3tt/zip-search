import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { streamAddressResults } from '../../services/addressApiService';

/**
 * AddressSearchProgress - Shows progress bar and status for address search jobs
 *
 * @param {Object} props
 * @param {string} props.jobId - The job ID to track
 * @param {function(Array): void} props.onBatch - Callback when a batch of addresses arrives
 * @param {function({totalFound: number, duration: number}): void} props.onComplete - Callback when search completes
 * @param {function({message: string, code: string}): void} props.onError - Callback on error
 * @param {function(): void} props.onCancel - Callback to cancel/close
 * @param {boolean} props.isDarkMode - Dark mode flag for styling
 */
const AddressSearchProgress = ({
  jobId,
  onBatch,
  onComplete,
  onError,
  onCancel,
  isDarkMode = false
}) => {
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState(0);
  const [status, setStatus] = useState('connecting'); // connecting, processing, complete, error
  const [errorMessage, setErrorMessage] = useState(null);
  const [duration, setDuration] = useState(0);
  const eventSourceRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Update duration every second while processing
  useEffect(() => {
    if (status !== 'processing' && status !== 'connecting') {
      return;
    }

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Connect to SSE stream
  useEffect(() => {
    if (!jobId) return;

    startTimeRef.current = Date.now();
    setStatus('connecting');

    const eventSource = streamAddressResults(jobId, {
      onProgress: (data) => {
        setStatus('processing');
        setProgress(data.progress);
        setFound(data.found);
      },
      onBatch: (addresses) => {
        if (onBatch) {
          onBatch(addresses);
        }
      },
      onComplete: (result) => {
        setStatus('complete');
        setProgress(100);
        setFound(result.totalFound);
        setDuration(Math.floor(result.duration / 1000));
        if (onComplete) {
          onComplete(result);
        }
      },
      onError: (error) => {
        setStatus('error');
        setErrorMessage(error.message);
        if (onError) {
          onError(error);
        }
      }
    });

    eventSourceRef.current = eventSource;

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [jobId, onBatch, onComplete, onError]);

  // Handle cancel
  const handleCancel = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (onCancel) {
      onCancel();
    }
  };

  // Format duration as mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {status === 'connecting' && (
            <Loader2 className={`h-5 w-5 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
          )}
          {status === 'processing' && (
            <Loader2 className={`h-5 w-5 animate-spin ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} />
          )}
          {status === 'complete' && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          {status === 'error' && (
            <XCircle className="h-5 w-5 text-red-500" />
          )}

          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {status === 'connecting' && 'Connecting to server...'}
            {status === 'processing' && 'Searching for addresses...'}
            {status === 'complete' && 'Search complete'}
            {status === 'error' && 'Search failed'}
          </span>
        </div>

        {(status === 'connecting' || status === 'processing') && (
          <button
            onClick={handleCancel}
            className={`text-sm px-3 py-1 rounded ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
        <div
          className={`h-full transition-all duration-300 ${
            status === 'error'
              ? 'bg-red-500'
              : status === 'complete'
                ? 'bg-green-500'
                : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <MapPin className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {found.toLocaleString()} addresses found
            </span>
          </div>

          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {formatDuration(duration)}
          </span>
        </div>

        <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {progress}%
        </span>
      </div>

      {/* Error message */}
      {status === 'error' && errorMessage && (
        <div className={`mt-3 p-2 rounded text-sm ${
          isDarkMode
            ? 'bg-red-900/30 text-red-300'
            : 'bg-red-50 text-red-700'
        }`}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default AddressSearchProgress;

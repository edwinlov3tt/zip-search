import React from 'react';
import CSVUploadInterface from '../Modals/CSVUploadInterface';
import { useSearch } from '../../contexts/SearchContext';
import { useUI } from '../../contexts/UIContext';

const UploadSearch = ({ handleCSVUpload, handleRemoveFile }) => {
  const {
    uploadedFile,
    uploadProcessing,
    uploadError,
    processingProgress
  } = useSearch();

  const { isDarkMode } = useUI();

  return (
    <>
      <CSVUploadInterface
        onFileUpload={handleCSVUpload}
        onRemoveFile={handleRemoveFile}
        uploadedFile={uploadedFile}
        isLoading={uploadProcessing}
        error={uploadError}
        isDarkMode={isDarkMode}
      />
      {/* Progress Indicator */}
      {processingProgress.total > 0 && uploadProcessing && (
        <div className={`px-2 pb-2 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between text-xs mb-1">
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              Processing locations...
            </span>
            <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
              {processingProgress.current} / {processingProgress.total}
            </span>
          </div>
          <div className={`w-full h-2 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
            <div
              className="h-2 bg-red-600 rounded transition-all duration-300"
              style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default UploadSearch;
import React, { useRef } from 'react';
import { Upload, X } from 'lucide-react';

const CSVUploadInterface = ({ onFileUpload, onRemoveFile, uploadedFile, isLoading, error, isDarkMode, isGeocodeMode = false }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    console.log('🔵 CSVUploadInterface handleFileSelect - file:', file?.name, 'type:', file?.type);
    // Check for CSV file by extension or MIME type
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
      console.log('🟢 Calling onFileUpload with CSV file');
      onFileUpload(file);
    } else {
      alert('Please select a CSV file. File type detected: ' + file?.type);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    console.log('🔵 CSVUploadInterface handleDrop - file:', file?.name, 'type:', file?.type);
    // Check for CSV file by extension or MIME type
    if (file && (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'))) {
      console.log('🟢 Calling onFileUpload with CSV file via drag-drop');
      onFileUpload(file);
    } else {
      alert('Please drop a CSV file. File type detected: ' + file?.type);
    }
  };

  return (
    <div className={`px-2 pt-1 pb-2 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
      {/* Upload Area - Full Width */}
      <div className="w-full">
        <h3 className="text-base font-medium mb-2 flex items-center">
          <Upload className="w-4 h-4 mr-2" />
          Upload CSV File
        </h3>

        {uploadedFile ? (
          // Show uploaded file with remove button
          <div className={`border-2 rounded-lg p-2 ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Upload className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  {uploadedFile.name}
                </span>
              </div>
              <button
                onClick={onRemoveFile}
                disabled={isLoading}
                className={`ml-2 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'text-gray-400 hover:text-red-400' : 'text-gray-500 hover:text-red-600'
                }`}
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          // Show upload area
          <div
            className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
              isDarkMode
                ? 'border-gray-600 hover:border-red-400 hover:bg-gray-700'
                : 'border-gray-300 hover:border-red-500 hover:bg-red-50'
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Processing CSV...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className={`w-8 h-8 mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <p className={`mb-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="font-medium">Click to upload</span> or drag and drop
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  CSV files only
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {error && (
          <div className={`mt-2 p-2 rounded-md ${isDarkMode ? 'bg-red-900/50 text-red-200' : 'bg-red-50 text-red-700'}`}>
            <p className="text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={`w-full border-t mt-3 pt-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
        {/* Notes/Tips - Below Upload */}
        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {isGeocodeMode ? (
            <>
              <span className="font-medium text-red-600">Supported:</span> Business Name, Full Address, or Address Components (Street, City, State, Zip, County) - Headers auto-detected
              <div className="mt-1">
                <span className="font-medium text-red-600">Best results:</span> CSVs with Business, Street, City, State, Zip columns
              </div>
            </>
          ) : (
            <>
              <span className="font-medium text-red-600">Supported:</span> ZIP Codes (12345, 12345-6789), Cities ("New York, NY"), Counties ("Cook County, IL") - Headers auto-detected
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CSVUploadInterface;
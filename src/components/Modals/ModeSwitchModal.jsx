import React from 'react';
import { X, Download, Trash2 } from 'lucide-react';

const ModeSwitchModal = ({
  isOpen,
  onClose,
  onClearAndSwitch,
  onDownloadAndSwitch,
  fromMode,
  toMode,
  isDarkMode
}) => {
  if (!isOpen) return null;

  const modeLabels = {
    address: 'Address Search',
    geocode: 'Geocode',
    radius: 'Radius Search',
    polygon: 'Polygon Search',
    hierarchy: 'Hierarchy Search',
    upload: 'Upload Search'
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-md rounded-lg shadow-2xl ${
          isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        }`}
        style={{ zIndex: 10000 }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className="text-lg font-semibold">
            Switch Search Mode?
          </h2>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              isDarkMode
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            You're switching from <strong>{modeLabels[fromMode]}</strong> to <strong>{modeLabels[toMode]}</strong>.
          </p>
          <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Would you like to save your current results before switching? Your results will be cleared.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {/* Download and Switch */}
            <button
              onClick={onDownloadAndSwitch}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Download className="h-4 w-4" />
              Download Results & Switch
            </button>

            {/* Clear and Switch */}
            <button
              onClick={onClearAndSwitch}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Clear Results & Switch
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSwitchModal;

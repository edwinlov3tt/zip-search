import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const PolygonLimitErrorModal = ({ isOpen, onClose, area, maxArea, isDarkMode }) => {
  if (!isOpen) return null;

  const overage = area - maxArea;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow-2xl max-w-md w-full mx-4`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-900/30' : 'bg-red-100'}`}>
                <AlertTriangle className={`h-6 w-6 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
              </div>
              <h2 className="text-xl font-semibold">Polygon Too Large</h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            The polygon you drew is too large to search for addresses. Please reduce the size and try again.
          </p>

          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Current Size:
                </span>
                <span className={`text-sm font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  {area.toFixed(1)} sq mi
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Maximum Allowed:
                </span>
                <span className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {maxArea.toFixed(1)} sq mi
                </span>
              </div>
              <div className={`pt-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Over Limit By:
                  </span>
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    {overage.toFixed(1)} sq mi
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
              <strong>Tip:</strong> Try drawing a smaller polygon or use the radius search mode for large areas.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} flex justify-end`}>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolygonLimitErrorModal;

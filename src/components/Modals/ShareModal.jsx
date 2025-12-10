import React, { useState, useEffect } from 'react';
import { X, Link2, Copy, Check, Eye, Edit3, Loader2 } from 'lucide-react';
import { useShare } from '../../contexts/ShareContext';
import { useSearch } from '../../contexts/SearchContext';
import { useMap } from '../../contexts/MapContext';
import { useUI } from '../../contexts/UIContext';

const ShareModal = () => {
  const { showShareModal, setShowShareModal, createShare, isCreatingShare } = useShare();
  const {
    searchMode,
    radiusSearches,
    addressSearches,
    polygonSearches
  } = useSearch();
  const {
    mapCenter,
    mapZoom,
    showZipBoundaries,
    showStateBoundaries,
    showCityBoundaries,
    showVtdBoundaries
  } = useMap();
  const { isDarkMode, showToast } = useUI();

  const [shareMode, setShareMode] = useState('edit');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Generate URL when modal opens or settings change
  useEffect(() => {
    if (showShareModal) {
      setShareUrl('');
      setError(null);
      setCopied(false);
    }
  }, [showShareModal, shareMode]);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const state = {
        searchMode,
        radiusSearches,
        addressSearches,
        polygonSearches,
        mapCenter,
        mapZoom,
        // Include boundary visibility settings
        showZipBoundaries,
        showStateBoundaries,
        showCityBoundaries,
        showVtdBoundaries
      };

      const result = await createShare(state, shareMode);

      if (result) {
        setShareUrl(result.url);
      } else {
        setError('Failed to create share link. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate share link:', err);
      setError('Failed to create share link. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast?.('Link copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast?.('Failed to copy link', 'error');
    }
  };

  if (!showShareModal) return null;

  const hasSearches = radiusSearches.length > 0 ||
    addressSearches.length > 0 ||
    polygonSearches.length > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setShowShareModal(false)}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-lg mx-4 rounded-lg shadow-xl ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <Link2 className={`h-5 w-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Share Map View
            </h2>
          </div>
          <button
            onClick={() => setShowShareModal(false)}
            className={`p-1 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {!hasSearches ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>No searches to share yet.</p>
              <p className="text-sm mt-2">Perform a search first to generate a shareable link.</p>
            </div>
          ) : (
            <>
              {/* Mode Toggle */}
              <div className="mb-5">
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Link Permissions
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShareMode('edit');
                      setShareUrl('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                      shareMode === 'edit'
                        ? isDarkMode
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-red-50 border-red-500 text-red-700'
                        : isDarkMode
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Can Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      setShareMode('view');
                      setShareUrl('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                      shareMode === 'view'
                        ? isDarkMode
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-red-50 border-red-500 text-red-700'
                        : isDarkMode
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Eye className="h-4 w-4" />
                    <span>View Only</span>
                  </button>
                </div>
                <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {shareMode === 'edit'
                    ? 'Recipients can add new searches and modify the view.'
                    : 'Recipients can only view results and export data.'}
                </p>
              </div>

              {/* Generate Button or URL Display */}
              <div className="mb-4">
                {!shareUrl ? (
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating || isCreatingShare}
                    className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      isGenerating || isCreatingShare
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : isDarkMode
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isGenerating || isCreatingShare ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Link...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-4 w-4" />
                        Generate Share Link
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Shareable Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-gray-50 border-gray-300 text-gray-700'
                        }`}
                      />
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                          copied
                            ? 'bg-green-500 text-white'
                            : isDarkMode
                              ? 'bg-red-600 hover:bg-red-500 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {error && (
                  <p className="text-red-500 text-sm mt-2">{error}</p>
                )}
              </div>

              {/* Info */}
              <div className={`p-3 rounded-lg text-sm ${
                isDarkMode ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-600'
              }`}>
                <p className="font-medium mb-1">What's included:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>All search results and data</li>
                  <li>Map view position and zoom</li>
                  <li>Drawn shapes and boundaries</li>
                  <li>Overlay colors and settings</li>
                  <li>Boundary layer visibility</li>
                </ul>
                <p className="text-xs mt-2 italic">
                  Links are permanent and don't expire.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={() => setShowShareModal(false)}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              isDarkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;

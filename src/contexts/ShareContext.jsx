import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createShareLink,
  fetchShareData,
  parseShareIdFromUrl,
  decodeLegacyShareState,
  clearShareFromUrl,
  hasShareParameter
} from '../utils/shareHelpers';

const ShareContext = createContext(null);

export const useShare = () => {
  const context = useContext(ShareContext);
  if (!context) {
    throw new Error('useShare must be used within a ShareProvider');
  }
  return context;
};

export const ShareProvider = ({ children }) => {
  // Whether we're viewing a shared link
  const [isSharedView, setIsSharedView] = useState(false);

  // View mode: 'edit' (full access) or 'view' (read-only)
  const [viewMode, setViewMode] = useState('edit');

  // The decoded shared state (if any)
  const [sharedState, setSharedState] = useState(null);

  // Loading state for fetching share data
  const [isLoading, setIsLoading] = useState(false);

  // Error state
  const [shareError, setShareError] = useState(null);

  // Whether share modal is open
  const [showShareModal, setShowShareModal] = useState(false);

  // Share creation loading state
  const [isCreatingShare, setIsCreatingShare] = useState(false);

  // Check for share parameter on mount
  useEffect(() => {
    const loadShareData = async () => {
      const shareId = parseShareIdFromUrl();

      if (!shareId) return;

      setIsLoading(true);
      setShareError(null);

      try {
        let data;

        // Check if it's a legacy base64 encoded share
        if (shareId.legacy) {
          data = decodeLegacyShareState(shareId.encoded);
          if (!data) {
            throw new Error('Invalid legacy share link');
          }
        } else {
          // Fetch from API
          data = await fetchShareData(shareId);
          if (!data) {
            throw new Error('Share not found or has expired');
          }
        }

        setIsSharedView(true);
        setViewMode(data.viewMode || 'edit');
        setSharedState(data);
      } catch (error) {
        console.error('Failed to load share:', error);
        setShareError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadShareData();
  }, []);

  // Create share URL via API
  const createShare = useCallback(async (state, mode = 'edit') => {
    setIsCreatingShare(true);
    try {
      const result = await createShareLink(state, mode);
      return result;
    } finally {
      setIsCreatingShare(false);
    }
  }, []);

  // Clear shared view state
  const exitSharedView = useCallback(() => {
    setIsSharedView(false);
    setViewMode('edit');
    setSharedState(null);
    setShareError(null);
    clearShareFromUrl();
  }, []);

  // Check if user can edit (in edit mode or not a shared view)
  const canEdit = !isSharedView || viewMode === 'edit';

  // Check if certain actions are restricted in view mode
  const isViewOnly = isSharedView && viewMode === 'view';

  const value = {
    // State
    isSharedView,
    viewMode,
    sharedState,
    canEdit,
    isViewOnly,
    showShareModal,
    isLoading,
    isCreatingShare,
    shareError,

    // Actions
    setShowShareModal,
    createShare,
    exitSharedView,
    setViewMode,
    clearShareFromUrl
  };

  return (
    <ShareContext.Provider value={value}>
      {children}
    </ShareContext.Provider>
  );
};

export default ShareContext;

import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing drawer resize functionality
 * @param {number} initialHeight - Initial drawer height percentage
 * @returns {Object} - Resize state and handlers
 */
export const useDrawerResize = (initialHeight = 50) => {
  const [drawerHeight, setDrawerHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(null);
  const [startHeight, setStartHeight] = useState(null);

  const handleMouseDown = useCallback((e) => {
    // Only allow resize in half mode
    if (e.target === e.currentTarget) {
      setIsResizing(true);
      setStartY(e.clientY);
      setStartHeight(drawerHeight);
    }
  }, [drawerHeight]);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || startY === null || startHeight === null) return;

    const windowHeight = window.innerHeight;
    const deltaY = startY - e.clientY;
    const deltaPercentage = (deltaY / windowHeight) * 100;
    const newHeight = Math.min(Math.max(20, startHeight + deltaPercentage), 80);

    setDrawerHeight(newHeight);
  }, [isResizing, startY, startHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setStartY(null);
    setStartHeight(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    drawerHeight,
    setDrawerHeight,
    isResizing,
    handleMouseDown
  };
};

export default useDrawerResize;
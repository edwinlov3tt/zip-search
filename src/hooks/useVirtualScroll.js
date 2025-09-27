import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for virtual scrolling in large lists
 * @param {Array} items - The full array of items
 * @param {number} itemHeight - Height of each item
 * @param {number} containerHeight - Height of the container
 * @param {number} overscan - Number of items to render outside visible area
 * @returns {Object} - Virtual scrolling state and handlers
 */
export const useVirtualScroll = (items, itemHeight, containerHeight, overscan = 3) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef(null);

  const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleEnd = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleStart * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  useEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    offsetY,
    visibleStart,
    visibleEnd
  };
};

export default useVirtualScroll;
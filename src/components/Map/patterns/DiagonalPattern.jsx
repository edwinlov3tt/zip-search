import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

/**
 * DiagonalPattern - Injects SVG pattern definitions into the Leaflet map container
 * for use with GeoJSON fills. The pattern can be referenced via fill="url(#diagonal-lines)"
 * Also watches for SVG changes and reapplies patterns to paths with the correct class.
 */
const DiagonalPattern = ({
  patternId = 'diagonal-lines',
  lineColor = '#dc2626',
  lineWidth = 2,
  spacing = 8,
  angle = 45
}) => {
  const map = useMap();
  const observerRef = useRef(null);
  const patternAppliedRef = useRef(new WeakSet());

  useEffect(() => {
    if (!map) return;

    // Get the map's SVG container
    const container = map.getContainer();
    let svgElement = container.querySelector('.leaflet-overlay-pane svg');

    const injectPattern = (svg) => {
      // Check if defs already exists
      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }

      // Check if pattern already exists
      if (!defs.querySelector(`#${patternId}`)) {
        // Create the diagonal line pattern
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', String(spacing));
        pattern.setAttribute('height', String(spacing));
        pattern.setAttribute('patternTransform', `rotate(${angle})`);

        // Create the line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '0');
        line.setAttribute('x2', '0');
        line.setAttribute('y2', String(spacing));
        line.setAttribute('stroke', lineColor);
        line.setAttribute('stroke-width', String(lineWidth));

        pattern.appendChild(line);
        defs.appendChild(pattern);
      }

      // Also create a second pattern for excluded items with different color
      if (!defs.querySelector(`#${patternId}-excluded`)) {
        const excludedPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        excludedPattern.setAttribute('id', `${patternId}-excluded`);
        excludedPattern.setAttribute('patternUnits', 'userSpaceOnUse');
        excludedPattern.setAttribute('width', String(spacing));
        excludedPattern.setAttribute('height', String(spacing));
        excludedPattern.setAttribute('patternTransform', `rotate(${angle})`);

        const excludedLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        excludedLine.setAttribute('x1', '0');
        excludedLine.setAttribute('y1', '0');
        excludedLine.setAttribute('x2', '0');
        excludedLine.setAttribute('y2', String(spacing));
        excludedLine.setAttribute('stroke', '#ef4444');
        excludedLine.setAttribute('stroke-width', String(lineWidth));

        excludedPattern.appendChild(excludedLine);
        defs.appendChild(excludedPattern);
      }
    };

    // Apply pattern fill to paths with the zip-in-results class
    const applyPatternToResultPaths = () => {
      const paths = container.querySelectorAll('.leaflet-interactive.zip-in-results');
      paths.forEach(path => {
        if (!patternAppliedRef.current.has(path)) {
          path.setAttribute('fill', `url(#${patternId})`);
          patternAppliedRef.current.add(path);
        }
      });
    };

    // Wait for SVG to be available (it may not exist initially)
    const checkForSvg = () => {
      svgElement = container.querySelector('.leaflet-overlay-pane svg');
      if (svgElement) {
        injectPattern(svgElement);
        applyPatternToResultPaths();
        setupObserver();
      } else {
        // Retry after a short delay
        setTimeout(checkForSvg, 100);
      }
    };

    // MutationObserver to watch for new paths being added
    const setupObserver = () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      const overlayPane = container.querySelector('.leaflet-overlay-pane');
      if (!overlayPane) return;

      observerRef.current = new MutationObserver((mutations) => {
        let needsPatternReapply = false;
        let needsPatternInjection = false;

        mutations.forEach((mutation) => {
          // Check if SVG was replaced/recreated
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'svg') {
                needsPatternInjection = true;
              }
              if (node.nodeName === 'path' || (node.querySelector && node.querySelector('path'))) {
                needsPatternReapply = true;
              }
            });
          }
          // Check for attribute changes on paths
          if (mutation.type === 'attributes' && mutation.target.nodeName === 'path') {
            if (mutation.target.classList.contains('zip-in-results')) {
              needsPatternReapply = true;
            }
          }
        });

        if (needsPatternInjection) {
          svgElement = container.querySelector('.leaflet-overlay-pane svg');
          if (svgElement) {
            injectPattern(svgElement);
          }
        }

        if (needsPatternReapply || needsPatternInjection) {
          // Clear tracked paths since they may have been replaced
          patternAppliedRef.current = new WeakSet();
          applyPatternToResultPaths();
        }
      });

      observerRef.current.observe(overlayPane, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    };

    checkForSvg();

    // Re-inject pattern when map re-renders (e.g., zoom changes)
    const handleMapEvent = () => {
      setTimeout(() => {
        svgElement = container.querySelector('.leaflet-overlay-pane svg');
        if (svgElement) {
          injectPattern(svgElement);
          // Clear tracked paths and reapply
          patternAppliedRef.current = new WeakSet();
          applyPatternToResultPaths();
        }
      }, 50);
    };

    map.on('zoomend', handleMapEvent);
    map.on('moveend', handleMapEvent);
    map.on('layeradd', handleMapEvent);

    return () => {
      map.off('zoomend', handleMapEvent);
      map.off('moveend', handleMapEvent);
      map.off('layeradd', handleMapEvent);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [map, patternId, lineColor, lineWidth, spacing, angle]);

  return null; // This component doesn't render anything visible
};

export default DiagonalPattern;

import React from 'react';
import GeoApplication from './GeoApplication';
import GeoApplicationNew from './GeoApplicationNew';
import './index.css';

/**
 * Test App to compare old and new implementations
 * You can toggle between them to test functionality
 */
function App() {
  // Toggle this to test the refactored version
  const useRefactored = true;

  return (
    <div className="App">
      {useRefactored ? <GeoApplicationNew /> : <GeoApplication />}
    </div>
  );
}

export default App;
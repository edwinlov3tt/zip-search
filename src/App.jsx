import React from 'react';
import GeoApplication from './GeoApplication';
import GeoApplicationNew from './GeoApplicationNew';
import './index.css';

const App = React.memo(() => {
  // Toggle this to test the refactored version
  const useRefactored = true;

  return (
    <div className="App">
      {useRefactored ? <GeoApplicationNew /> : <GeoApplication />}
    </div>
  );
});

App.displayName = 'App';

export default App;
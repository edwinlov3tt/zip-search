import React from 'react';
import ResultsTable from './ResultsTable';
import StreetsTable from './StreetsTable';
import GeocodeResultsTable from './GeocodeResultsTable';
import ExcludedItems from './ExcludedItems';
import SearchHistoryPanel from './SearchHistoryPanel';
import { useUI } from '../../contexts/UIContext';

const DrawerContent = ({
  tableContainerRef,
  getCurrentData,
  handleSort,
  handleResultSelect,
  handleResultDoubleClick,
  isResultSelected
}) => {
  const { activeTab } = useUI();

  return (
    <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-auto" style={{ maxHeight: 'calc(100% - 48px)' }}>
      {activeTab === 'searches' ? (
        <SearchHistoryPanel />
      ) : activeTab === 'excluded' ? (
        <ExcludedItems />
      ) : activeTab === 'streets' ? (
        <StreetsTable
          data={getCurrentData(activeTab)}
          handleSort={handleSort}
          handleResultSelect={handleResultSelect}
          handleResultDoubleClick={handleResultDoubleClick}
          isResultSelected={isResultSelected}
        />
      ) : activeTab === 'geocode' ? (
        <GeocodeResultsTable
          data={getCurrentData(activeTab)}
          handleSort={handleSort}
          handleResultSelect={handleResultSelect}
          handleResultDoubleClick={handleResultDoubleClick}
          isResultSelected={isResultSelected}
        />
      ) : (
        <ResultsTable
          activeTab={activeTab}
          data={getCurrentData(activeTab)}
          handleSort={handleSort}
          handleResultSelect={handleResultSelect}
          handleResultDoubleClick={handleResultDoubleClick}
          isResultSelected={isResultSelected}
        />
      )}
    </div>
  );
};

export default DrawerContent;
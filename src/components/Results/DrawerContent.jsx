import React from 'react';
import ResultsTable from './ResultsTable';
import ExcludedItems from './ExcludedItems';
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
      {activeTab === 'excluded' ? (
        <ExcludedItems />
      ) : (
        <ResultsTable
          activeTab={activeTab}
          data={getCurrentData()}
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
import React from 'react';
import { Plus, Copy, FileDown } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useResults } from '../../contexts/ResultsContext';

const ExcludedItems = () => {
  const { excludedSubTab, setExcludedSubTab, isDarkMode } = useUI();
  const { excludedGeos, restoreItem } = useResults();

  // Copy excluded items to clipboard
  const copyExcludedItems = () => {
    const lines = [];

    if (excludedGeos.states.length > 0) {
      lines.push('STATES:');
      excludedGeos.states.forEach(state => {
        lines.push(`  ${state.name || state.state}`);
      });
      lines.push('');
    }

    if (excludedGeos.counties.length > 0) {
      lines.push('COUNTIES:');
      excludedGeos.counties.forEach(county => {
        lines.push(`  ${county.name}, ${county.state}`);
      });
      lines.push('');
    }

    if (excludedGeos.cities.length > 0) {
      lines.push('CITIES:');
      excludedGeos.cities.forEach(city => {
        lines.push(`  ${city.name}, ${city.state}`);
      });
      lines.push('');
    }

    if (excludedGeos.zips.length > 0) {
      lines.push('ZIP CODES:');
      excludedGeos.zips.forEach(zip => {
        lines.push(`  ${zip.zipCode} - ${zip.city}, ${zip.state}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
  };

  // Export excluded items as CSV
  const exportExcludedAsCSV = () => {
    const rows = [];
    rows.push(['Type', 'Name', 'State', 'County', 'ZIP Code']);

    excludedGeos.states.forEach(state => {
      rows.push(['State', state.name || state.state, state.name || state.state, '', '']);
    });

    excludedGeos.counties.forEach(county => {
      rows.push(['County', county.name, county.state, county.name, '']);
    });

    excludedGeos.cities.forEach(city => {
      rows.push(['City', city.name, city.state, city.county || '', '']);
    });

    excludedGeos.zips.forEach(zip => {
      rows.push(['ZIP', zip.zipCode, zip.state, zip.county, zip.zipCode]);
    });

    const csv = rows.map(row =>
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'excluded-geos.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSubTabs = () => {
    const tabs = [];
    if (excludedGeos.zips.length > 0) {
      tabs.push({ key: 'zips', label: `ZIPs (${excludedGeos.zips.length})` });
    }
    if (excludedGeos.cities.length > 0) {
      tabs.push({ key: 'cities', label: `Cities (${excludedGeos.cities.length})` });
    }
    if (excludedGeos.counties.length > 0) {
      tabs.push({ key: 'counties', label: `Counties (${excludedGeos.counties.length})` });
    }
    if (excludedGeos.states.length > 0) {
      tabs.push({ key: 'states', label: `States (${excludedGeos.states.length})` });
    }
    return tabs;
  };

  const renderTable = () => {
    if (excludedSubTab === 'zips' && excludedGeos.zips.length > 0) {
      return (
        <table className="w-full text-sm">
          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>ZIP Code</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>City</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>County</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>State</th>
            </tr>
          </thead>
          <tbody>
            {excludedGeos.zips.map((zip, index) => (
              <tr
                key={`excluded-zip-${index}`}
                className={`transition-colors ${
                  isDarkMode
                    ? 'border-b border-gray-600 hover:bg-gray-700'
                    : 'border-b border-gray-100 hover:bg-gray-50'
                }`}
              >
                <td className="px-2 py-2">
                  <button
                    onClick={() => restoreItem('zip', zip)}
                    className="text-green-500 hover:text-green-700 p-1"
                    title="Restore ZIP"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </td>
                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{zip.zipCode}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{zip.city}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{zip.county}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{zip.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (excludedSubTab === 'cities' && excludedGeos.cities.length > 0) {
      return (
        <table className="w-full text-sm">
          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>City Name</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>County</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>State</th>
            </tr>
          </thead>
          <tbody>
            {excludedGeos.cities.map((city, index) => (
              <tr
                key={`excluded-city-${index}`}
                className={`transition-colors ${
                  isDarkMode
                    ? 'border-b border-gray-600 hover:bg-gray-700'
                    : 'border-b border-gray-100 hover:bg-gray-50'
                }`}
              >
                <td className="px-2 py-2">
                  <button
                    onClick={() => restoreItem('city', city)}
                    className="text-green-500 hover:text-green-700 p-1"
                    title="Restore City"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </td>
                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{city.name}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{city.county || ''}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{city.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (excludedSubTab === 'counties' && excludedGeos.counties.length > 0) {
      return (
        <table className="w-full text-sm">
          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>County Name</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>State</th>
            </tr>
          </thead>
          <tbody>
            {excludedGeos.counties.map((county, index) => (
              <tr
                key={`excluded-county-${index}`}
                className={`transition-colors ${
                  isDarkMode
                    ? 'border-b border-gray-600 hover:bg-gray-700'
                    : 'border-b border-gray-100 hover:bg-gray-50'
                }`}
              >
                <td className="px-2 py-2">
                  <button
                    onClick={() => restoreItem('county', county)}
                    className="text-green-500 hover:text-green-700 p-1"
                    title="Restore County"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </td>
                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{county.name}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{county.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (excludedSubTab === 'states' && excludedGeos.states.length > 0) {
      return (
        <table className="w-full text-sm">
          <thead className={`sticky top-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <tr>
              <th className="px-2 py-2 w-8"></th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>State Name</th>
              <th className={`px-4 py-2 text-left font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>State Code</th>
            </tr>
          </thead>
          <tbody>
            {excludedGeos.states.map((state, index) => (
              <tr
                key={`excluded-state-${index}`}
                className={`transition-colors ${
                  isDarkMode
                    ? 'border-b border-gray-600 hover:bg-gray-700'
                    : 'border-b border-gray-100 hover:bg-gray-50'
                }`}
              >
                <td className="px-2 py-2">
                  <button
                    onClick={() => restoreItem('state', state)}
                    className="text-green-500 hover:text-green-700 p-1"
                    title="Restore State"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </td>
                <td className={`px-4 py-2 font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{state.name || ''}</td>
                <td className={`px-4 py-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{state.state || state.code || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Actions and Sub-tabs Header */}
      <div className={`flex items-center px-4 py-2 ${isDarkMode ? 'bg-gray-750' : 'bg-gray-50'}`}>
        {/* Copy and CSV Export Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={copyExcludedItems}
            className={`px-3 py-1 text-sm rounded flex items-center space-x-1.5 transition-colors ${
              isDarkMode
                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </button>
          <button
            onClick={exportExcludedAsCSV}
            className={`px-3 py-1 text-sm rounded flex items-center space-x-1.5 transition-colors ${
              isDarkMode
                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Sub-tabs for Excluded Items */}
        <div className="ml-auto">
          <div className="flex space-x-1">
            {getSubTabs().map(subTab => (
              <button
                key={subTab.key}
                onClick={() => setExcludedSubTab(subTab.key)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  excludedSubTab === subTab.key
                    ? 'bg-red-600 text-white'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                      : 'bg-white hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {subTab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Content Container */}
      <div className="flex-1 overflow-y-auto mt-1">
        {renderTable()}
      </div>
    </div>
  );
};

export default ExcludedItems;
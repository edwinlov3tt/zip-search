import React from 'react';
import { Globe, Sun, Moon } from 'lucide-react';
import SearchModeToggle from './SearchModeToggle';
import DarkModeToggle from './DarkModeToggle';
import { useUI } from '../../contexts/UIContext';

const Header = ({ searchMode, handleSearchModeChange }) => {
  const { isDarkMode, setIsDarkMode } = useUI();

  return (
    <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b px-3 lg:px-6 py-3 lg:py-4 z-20`}>
      <div className="flex flex-col lg:flex-row items-center gap-3 lg:gap-0">
        {/* Logo and Title */}
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <Globe className="h-6 lg:h-8 w-6 lg:w-8 text-red-600" />
            <h1 className={`text-lg lg:text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              <span className="hidden lg:inline">GeoSearch Pro</span>
              <span className="lg:hidden">GeoSearch</span>
            </h1>
          </div>

          {/* Mobile and Tablet Dark Mode Toggle */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-lg ${isDarkMode ? 'text-yellow-400' : 'text-gray-600'}`}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search Mode Toggle */}
        <SearchModeToggle
          searchMode={searchMode}
          handleSearchModeChange={handleSearchModeChange}
          isDarkMode={isDarkMode}
        />

        {/* Desktop Controls */}
        <div className="hidden lg:flex items-center space-x-4 ml-auto">
          <DarkModeToggle />
          <button className={`${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
            Help
          </button>
          <div className="h-8 w-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            U
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
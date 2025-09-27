import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';

const DarkModeToggle = () => {
  const { isDarkMode, setIsDarkMode } = useUI();

  return (
    <div className={`flex items-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full p-1`}>
      <button
        onClick={() => setIsDarkMode(false)}
        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-colors ${
          !isDarkMode
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-400 hover:text-gray-300'
        }`}
      >
        <Sun className="h-3 w-3" />
        <span>Light</span>
      </button>
      <button
        onClick={() => setIsDarkMode(true)}
        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm transition-colors ${
          isDarkMode
            ? 'bg-gray-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-700'
        }`}
      >
        <Moon className="h-3 w-3" />
        <span>Dark</span>
      </button>
    </div>
  );
};

export default DarkModeToggle;
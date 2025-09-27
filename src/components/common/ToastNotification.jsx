import React from 'react';
import { Check, X } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';

const ToastNotification = () => {
  const { toastMessage, toastType } = useUI();

  if (!toastMessage) return null;

  return (
    <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 ${
      toastType === 'success'
        ? 'bg-green-600 text-white'
        : toastType === 'error'
        ? 'bg-red-600 text-white'
        : 'bg-blue-600 text-white'
    }`}>
      {toastType === 'success' && <Check className="h-5 w-5" />}
      {toastType === 'error' && <X className="h-5 w-5" />}
      <span className="font-medium">{toastMessage}</span>
    </div>
  );
};

export default ToastNotification;
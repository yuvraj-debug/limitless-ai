import React from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
}

export const Toast: React.FC<ToastProps> = ({ toasts, setToasts }) => {
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(toast => {
        let Icon = Info;
        let colorClasses = 'border-blue-500/20 bg-blue-950/80 text-blue-300';
        if (toast.type === 'success') {
          Icon = CheckCircle;
          colorClasses = 'border-emerald-500/20 bg-emerald-950/80 text-emerald-300';
        } else if (toast.type === 'error') {
          Icon = AlertTriangle;
          colorClasses = 'border-rose-500/20 bg-rose-950/80 text-rose-300';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-4 ${colorClasses}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm font-medium flex-grow">{toast.text}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

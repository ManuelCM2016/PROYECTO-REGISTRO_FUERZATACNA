'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Toast as ToastType, ToastType as TType } from '@/types';

interface ToastContextType {
  toasts: ToastType[];
  addToast: (type: TType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: TType, message: string, duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: ToastType[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  const icons: Record<TType, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  const colors: Record<TType, string> = {
    success: 'border-l-emerald-500 bg-emerald-500/10',
    error: 'border-l-red-500 bg-red-500/10',
    info: 'border-l-blue-500 bg-blue-500/10',
    warning: 'border-l-amber-500 bg-amber-500/10',
  };

  const iconColors: Record<TType, string> = {
    success: 'text-emerald-400 bg-emerald-500/20',
    error: 'text-red-400 bg-red-500/20',
    info: 'text-blue-400 bg-blue-500/20',
    warning: 'text-amber-400 bg-amber-500/20',
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            glass border-l-4 ${colors[toast.type]} rounded-xl p-4
            flex items-start gap-3 shadow-2xl toast-enter pointer-events-auto
          `}
        >
          <span
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${iconColors[toast.type]}`}
          >
            {icons[toast.type]}
          </span>
          <p className="text-sm text-slate-200 flex-1">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

let idCounter = 0;

function ToastItem({ toast, onRemove }) {
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl',
        'max-w-sm w-full pointer-events-auto',
        'bg-gray-900',
        STYLES[toast.type]
      )}
    >
      <Icon size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-medium text-gray-100 leading-snug">{toast.title}</p>
        )}
        {toast.message && (
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((toast) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
    return id;
  }, []);

  const toast = useMemo(
    () => ({
      success: (title, message, opts) => add({ type: 'success', title, message, ...opts }),
      error: (title, message, opts) => add({ type: 'error', title, message, ...opts }),
      warning: (title, message, opts) => add({ type: 'warning', title, message, ...opts }),
      info: (title, message, opts) => add({ type: 'info', title, message, ...opts }),
    }),
    [add]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

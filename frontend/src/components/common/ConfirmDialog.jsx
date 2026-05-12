import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        role="presentation"
      />

      <div className="relative card p-5 w-full max-w-sm shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-400 transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div
            className={clsx(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              danger ? 'bg-red-500/15' : 'bg-yellow-500/15'
            )}
          >
            <AlertTriangle
              size={17}
              className={danger ? 'text-red-400' : 'text-yellow-400'}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            {message && (
              <p className="mt-1 break-words text-xs leading-relaxed text-gray-600 dark:text-gray-400">{message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary w-full py-1.5 px-3 text-sm sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={onConfirm}
            className={clsx(
              'inline-flex w-full items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors sm:w-auto',
              danger
                ? 'rounded-lg bg-red-600 text-white hover:bg-red-700'
                : 'rounded-lg bg-brand-600 text-white hover:bg-brand-700'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { ToastContext, type Toast, type ToastPosition, type ToastType } from './ToastContext';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
  warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
  info: 'bg-blue-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700 text-primary-800 dark:text-primary-200',
};

/** Map each toast position to its flex container alignment. */
const POSITION_CLASSES: Record<ToastPosition, string> = {
  top: 'top-4 left-0 right-0 items-center',
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  bottom: 'bottom-4 left-0 right-0 items-center',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
};

export const ToastProvider: React.FC<{ children: ReactNode; position?: ToastPosition; defaultDuration?: number }> = ({
  children,
  position = 'top-right',
  defaultDuration = 4000,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration?: number, toastPosition?: ToastPosition) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = { id, type, message, duration, position: toastPosition };
    setToasts((prev) => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-remove toasts after duration.
  // Track pending timers in a ref so we never recreate timers for toasts
  // that already have one, and so we can clean them all up on unmount.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    // Schedule a timer for any toast that doesn't have one yet.
    toasts.forEach((toast) => {
      if (timers.has(toast.id)) return;
      const duration = toast.duration ?? 4000;
      const timer = setTimeout(() => {
        removeToast(toast.id);
        timers.delete(toast.id);
      }, duration ?? defaultDuration);
      timers.set(toast.id, timer);
    });
    // Remove timers for toasts that have disappeared (manual dismiss).
    const activeIds = new Set(toasts.map((t) => t.id));
    timers.forEach((timer, id) => {
      if (!activeIds.has(id)) {
        clearTimeout(timer);
        timers.delete(id);
      }
    });
  }, [toasts, removeToast]);

  // Clean up all pending timers on unmount to avoid leaks.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        className="fixed inset-0 z-[1000] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          const resolvedPosition = toast.position ?? position;
          const styles = STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto absolute max-w-sm ${POSITION_CLASSES[resolvedPosition]}`}
              style={{ width: 'min(16rem, 90vw)' }}
            >
              <div
                className={`pointer-events-auto border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in ${styles}`}
                role="alert"
              >
                <span className="text-lg flex-shrink-0">{ICONS[toast.type]}</span>
                <p className="text-sm flex-1">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-current opacity-60 hover:opacity-100 flex-shrink-0"
                  aria-label="Dismiss notification"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

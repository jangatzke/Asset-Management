import { useContext } from 'react';
import { ToastContext, type ToastContextType } from './ToastContext';

/**
 * Hook to consume the toast context.
 *
 * Lives in its own file so that `ToastProvider.tsx` only exports components,
 * which keeps React Fast Refresh working for the provider component.
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

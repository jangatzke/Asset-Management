import { createContext } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Where toasts anchor on screen. Defaults to 'top-right'. */
export type ToastPosition =
  | 'top'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  /** Optional per-toast position override; falls back to the provider default. */
  position?: ToastPosition;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number, position?: ToastPosition) => string;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

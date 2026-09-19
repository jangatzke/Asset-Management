import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  /** When true the confirm action is destructive (danger styling). */
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional i18n keys used when title/message are not provided. */
  titleKey?: string;
  messageKey?: string;
}

/**
 * Accessible Tailwind confirmation dialog that replaces the native window.confirm().
 * Supports a danger variant for destructive actions such as deletions.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  danger = false,
  confirmLabel,
  cancelLabel,
  titleKey,
  messageKey,
}) => {
  const { t } = useI18n();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [justClosed, setJustClosed] = useState(false);

  useEffect(() => {
    if (justClosed) {
      return;
    }
    if (isOpen) {
      const previouslyFocused = document.activeElement as HTMLElement | null;
      const focusTarget = confirmButtonRef.current ?? previouslyFocused;
      focusTarget?.focus?.();

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      };
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isOpen, onClose, justClosed]);

  const handleClose = useCallback(() => {
    setJustClosed(false);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    setJustClosed(true);
    onConfirm();
  }, [onConfirm]);

  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby="confirm-dialog-description"
        className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger
                ? 'bg-red-100 dark:bg-red-900/50'
                : 'bg-primary-100 dark:bg-primary-900/50'
            }`}
          >
            <ExclamationTriangleIcon
              aria-hidden="true"
              className={`h-6 w-6 ${
                danger ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'
              }`}
            />
          </div>
          <div className="flex-1">
            <h3
              id={titleId}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {title ?? t(titleKey ?? 'common.confirm')}
            </h3>
            {message || messageKey ? (
              <p
                id="confirm-dialog-description"
                className="mt-2 text-sm text-gray-600 dark:text-gray-300"
              >
                {message ?? t(messageKey ?? '')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('common.close')}
            className="ml-4 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:hover:text-gray-200 dark:focus:ring-gray-600"
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
          >
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            ref={confirmButtonRef}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
              danger
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
            }`}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

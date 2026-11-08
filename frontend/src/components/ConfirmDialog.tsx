import { useCallback, useEffect, useRef, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Dialog } from './Dialog';
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
 * Accessible Tailwind confirmation dialog (Stage 7 / MT-4): thin wrapper over
 * the unified `Dialog` base, replacing the native window.confirm(). Supports a
 * danger variant for destructive actions such as deletions. Initial focus goes
 * to "Cancel" so an accidental Enter never triggers the destructive action.
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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [justClosed, setJustClosed] = useState(false);

  useEffect(() => {
    if (justClosed) {
      return;
    }
    if (isOpen) {
      // Intercept Escape in the capture phase and stop it from reaching a
      // surrounding Modal so only the confirmation closes (nested-guard parity).
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopImmediatePropagation();
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

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title={title ?? t(titleKey ?? 'common.confirm')}
      size="sm"
      initialFocusRef={cancelButtonRef}
      closeOnEscape={false}
      footer={
        <>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-[2.25rem] items-center justify-center gap-2 rounded-md border border-border-strong bg-transparent px-4 py-2 text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-hover outline-focus-ring"
          >
            {cancelLabel ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`inline-flex min-h-[2.25rem] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-fast outline-focus-ring ${
              danger
                ? 'border border-status-critical-fg text-status-critical-fg hover:bg-status-critical-bg'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            danger ? 'bg-status-critical-bg' : 'bg-surface-hover'
          }`}
        >
          <ExclamationTriangleIcon
            aria-hidden="true"
            className={`h-6 w-6 ${danger ? 'text-status-critical-fg' : 'text-primary-600 dark:text-primary-300'}`}
          />
        </div>
        {message || messageKey ? (
          <p className="flex-1 text-body2 text-text-secondary">
            {message ?? t(messageKey ?? '')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
};

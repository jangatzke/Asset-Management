import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { DiscardConfirmationDialog } from './DiscardConfirmationDialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
  maxHeightClassName?: string;
  /** When true, backdrop/Escape triggers the discard confirmation dialog instead of closing immediately. */
  isDirty?: boolean;
  /** Called when the user explicitly confirms discarding dirty changes. */
  onDiscardConfirm?: () => void;
  /** i18n key for the discard dialog title (default: 'common.discardChangesTitle'). */
  discardTitleKey?: string;
  /** i18n key for the discard dialog message (default: 'common.discardChangesMessage'). */
  discardMessageKey?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-2xl',
  maxHeightClassName = 'max-h-[90vh]',
  isDirty = false,
  onDiscardConfirm,
  discardTitleKey = 'common.discardChangesTitle',
  discardMessageKey = 'common.discardChangesMessage',
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const backdropPointerDownRef = useRef(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const titleId = useId();

  // When isDirty changes and we were showing the confirm dialog, hide it
  useEffect(() => {
    if (!isDirty) {
      setShowDiscardConfirm(false);
    }
  }, [isDirty]);

  const handleDismissal = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    if (onDiscardConfirm) {
      onDiscardConfirm();
    } else {
      onClose();
    }
  }, [onDiscardConfirm, onClose]);

  const handleCancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismissal();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleDismissal]);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const elements = Array.from(focusable).filter((element) => !element.hasAttribute('hidden'));
      if (!elements.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keepFocusInDialog);
    return () => {
      document.removeEventListener('keydown', keepFocusInDialog);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onMouseDown={(e) => {
          backdropPointerDownRef.current = e.target === overlayRef.current;
        }}
        onClick={(e) => {
          const startedOnBackdrop = backdropPointerDownRef.current;
          backdropPointerDownRef.current = false;
          if (startedOnBackdrop && e.target === overlayRef.current) handleDismissal();
        }}
      >
        <div
          ref={dialogRef}
          className={`bg-white dark:bg-card rounded-lg shadow-xl w-full ${maxWidthClassName} ${maxHeightClassName} overflow-y-auto border border-transparent dark:border-gray-700`}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleDismissal}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>

      {/* Discard confirmation overlay */}
      <DiscardConfirmationDialog
        open={showDiscardConfirm}
        onClose={handleCancelDiscard}
        onDiscard={handleConfirmDiscard}
        titleKey={discardTitleKey}
        messageKey={discardMessageKey}
      />
    </>
  );
};

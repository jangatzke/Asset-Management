import { useState, useEffect, useCallback } from 'react';
import { Dialog } from './Dialog';
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

/**
 * Legacy edit-modal API — thin wrapper over the unified `Dialog` base (Stage 7 / MT-4).
 *
 * All existing consumers keep their props unchanged. The dirty-form guard
 * semantics are preserved: while `isDirty` is set, backdrop/Escape/close route
 * through the DiscardConfirmationDialog instead of closing immediately.
 * `disablePortal` keeps the overlay inside the React tree so the established
 * Modal.guard tests (which query the render container) keep passing.
 */
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

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

  // Legacy semantics: a closed Modal renders nothing at all — including the
  // discard dialog, so its exit transition never lingers after closing.
  if (!isOpen) return null;

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={handleDismissal}
        title={title}
        size="lg"
        disablePortal
        panelClassName={`${maxWidthClassName} ${maxHeightClassName}`}
      >
        {children}
      </Dialog>

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

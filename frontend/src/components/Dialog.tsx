import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';
import { useOverlayBehavior } from '../hooks/useOverlayBehavior';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

/** Width ladder for the unified dialog system (Stage 7 / MT-4). */
const SIZE_CLASS: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean;
  /** When true, all dismissal paths are blocked and a spinner is shown. */
  isLoading?: boolean;
  /** Extra classes for the panel (e.g. custom max-w/max-h from legacy Modal). */
  panelClassName?: string;
  /**
   * Render in place instead of portaling to `document.body`. Kept for the
   * legacy `Modal` wrapper whose existing consumers (and guard tests) rely on
   * the overlay being part of the React tree at the call site.
   */
  disablePortal?: boolean;
  'aria-label'?: string;
}

/**
 * The single Tailwind dialog base (Stage 7 / MT-4).
 *
 * Portal-rendered with a focus trap, focus restore, scroll lock and the token
 * motion recipe (fade + 4px shift, `duration-normal ease-standard`; the global
 * prefers-reduced-motion override in index.css neutralises the transition).
 * `Modal`, `ConfirmDialog` and future dialogs build on this component so every
 * dialog shares identical backdrop, focus and timing semantics. MUI dialogs
 * (admin pages) stay MUI but inherit the same look from the MUI theme.
 */
export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEscape = true,
  isLoading = false,
  panelClassName,
  disablePortal = false,
  'aria-label': ariaLabel,
}) => {
  const { t } = useI18n();
  const {
    overlayRef,
    dialogRef,
    closeButtonRef,
    entered,
    requestClose,
    titleId,
    descriptionId,
    onBackdropPointerDown,
    onBackdropClick,
  } = useOverlayBehavior({ open, onClose, closeOnEscape, isLoading, initialFocusRef });

  if (!open) return null;

  const widthClass = panelClassName ? '' : SIZE_CLASS[size];

  const overlay = (
    <div
      ref={overlayRef}
      data-dialog-state={entered ? 'open' : 'closed'}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-opacity duration-normal ease-standard ${entered ? 'opacity-100' : 'opacity-0'}`}
      onMouseDown={onBackdropPointerDown}
      onClick={onBackdropClick(closeOnBackdrop)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!title && ariaLabel ? ariaLabel : undefined}
        className={`relative w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface-default text-text-primary shadow-e3 transition duration-normal ease-standard ${widthClass} ${entered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'} ${panelClassName ?? ''}`}
      >
        {(title || isLoading) && (
          <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-4">
            {title ? (
              <h2 id={titleId} className="text-h3 text-text-primary">{title}</h2>
            ) : <span />}
            <div className="flex items-center gap-2">
              {isLoading && (
                <svg className="h-5 w-5 animate-spin text-text-secondary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={requestClose}
                disabled={isLoading}
                aria-label={t('common.close')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring outline-focus-ring"
              >
                <XMarkIcon aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <div className="px-6 py-4">
          {description ? (
            <p id={descriptionId} className="mb-3 text-body2 text-text-secondary">{description}</p>
          ) : null}
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return disablePortal ? overlay : createPortal(overlay, document.body);
};

export default Dialog;

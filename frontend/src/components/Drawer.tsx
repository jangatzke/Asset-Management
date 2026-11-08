/**
 * Drawer — slide-in side panel for detail sub-views (Stage 10c / LT-5).
 *
 * Same behavior contract as `Dialog` (focus trap, focus restore, scroll lock,
 * Escape/backdrop dismissal, `role="dialog"` + `aria-modal`, token motion with
 * global prefers-reduced-motion support) but anchored to the viewport edge and
 * animated horizontally instead of vertically. Both components share the single
 * `useOverlayBehavior` hook — there is no duplicated focus/scroll logic.
 *
 * Visuals use semantic tokens only (`bg-surface-default`, `border-border-subtle`,
 * `text-text-*`, `shadow-e3`, `duration-normal ease-standard`).
 */
import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';
import { useOverlayBehavior } from '../hooks/useOverlayBehavior';

export type DrawerSide = 'right' | 'left';
export type DrawerWidth = 'sm' | 'md' | 'lg';

/** Width ladder for the drawer panel (mobile: full width). */
const WIDTH_CLASS: Record<DrawerWidth, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Which viewport edge the drawer slides in from. Default 'right'. */
  side?: DrawerSide;
  /** Width ladder. Default 'md'. */
  width?: DrawerWidth;
  footer?: ReactNode;
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean;
  /** When true, all dismissal paths are blocked and a spinner is shown. */
  isLoading?: boolean;
  'aria-label'?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  side = 'right',
  width = 'md',
  footer,
  closeOnBackdrop = true,
  closeOnEscape = true,
  isLoading = false,
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
  } = useOverlayBehavior({ open, onClose, closeOnEscape, isLoading });

  if (!open) return null;

  const sideClass = side === 'right' ? 'justify-end' : 'justify-start';
  // Slide in from the anchored edge; reduced-motion is neutralised globally.
  const slideClosed = side === 'right' ? 'translate-x-full' : '-translate-x-full';

  const overlay = (
    <div
      ref={overlayRef}
      data-drawer-state={entered ? 'open' : 'closed'}
      className={`fixed inset-0 z-50 flex items-stretch ${sideClass} bg-black/40 backdrop-blur-sm transition-opacity duration-normal ease-standard ${entered ? 'opacity-100' : 'opacity-0'}`}
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
        className={`relative flex h-full w-full flex-col overflow-y-auto border-border-subtle bg-surface-default text-text-primary shadow-e3 transition-transform duration-normal ease-standard ${side === 'right' ? 'border-l' : 'border-r'} ${WIDTH_CLASS[width]} ${entered ? 'translate-x-0' : slideClosed}`}
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

        <div className="flex-1 px-6 py-4">
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

  return createPortal(overlay, document.body);
};

export default Drawer;

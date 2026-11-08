/**
 * Shared overlay behavior (Stage 10c / LT-5).
 *
 * Single source of truth for the focus/scroll/dismissal semantics that every
 * modal surface (`Dialog`, `Drawer`, …) must implement identically:
 *   - entrance transition state (`entered`) so CSS slide/fade plays on mount,
 *   - Escape dismissal (guarded by `isLoading`),
 *   - body scroll lock while open (restores the previous value),
 *   - focus move-in on open, Tab focus trap, focus restore to the trigger,
 *   - backdrop pointer-down/click pairing so a drag that starts inside the
 *     panel never closes the overlay.
 *
 * Extracted from `Dialog` without behavior changes (16 existing dialog tests
 * keep passing); `Drawer` builds on the same hook so there is exactly one
 * focus/scroll implementation in the codebase.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';

/** Focusable-element selector shared by all overlay focus traps. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface OverlayBehaviorOptions {
  /** Whether the overlay is currently mounted/open. */
  open: boolean;
  /** Close request from any dismissal path (Escape, backdrop, close button). */
  onClose: () => void;
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean;
  /** When true, all dismissal paths are blocked. Default false. */
  isLoading?: boolean;
  /** Optional explicit initial focus target (wins over the close button). */
  initialFocusRef?: React.RefObject<HTMLElement>;
}

export interface OverlayBehavior {
  /** Attach to the outer backdrop element. */
  overlayRef: React.RefObject<HTMLDivElement>;
  /** Attach to the panel element that receives `role="dialog"`. */
  dialogRef: React.RefObject<HTMLDivElement>;
  /** Attach to the close button (default focus target). */
  closeButtonRef: React.RefObject<HTMLButtonElement>;
  /** True after the first animation frame while open — drives enter classes. */
  entered: boolean;
  /** Guarded close request (no-op while `isLoading`). */
  requestClose: () => void;
  /** Stable ids for `aria-labelledby` / `aria-describedby`. */
  titleId: string;
  descriptionId: string;
  /** Backdrop `onMouseDown` handler (records whether the press started outside). */
  onBackdropPointerDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Backdrop `onClick` handler — closes only for a full backdrop click. */
  onBackdropClick: (closeOnBackdrop: boolean) => (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function useOverlayBehavior({
  open,
  onClose,
  closeOnEscape = true,
  isLoading = false,
  initialFocusRef,
}: OverlayBehaviorOptions): OverlayBehavior {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const backdropPointerDownRef = useRef(false);
  const [entered, setEntered] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  // Entrance transition: flip the state after mount so CSS enter classes play;
  // prefers-reduced-motion is neutralised globally in index.css.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const requestClose = useCallback(() => {
    if (isLoading) return;
    onClose();
  }, [isLoading, onClose]);

  // Escape handling + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) requestClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeOnEscape, requestClose]);

  // Focus management: move focus in on open, trap Tab, restore on close.
  useEffect(() => {
    if (!open) return;

    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTarget =
      initialFocusRef?.current ?? closeButtonRef.current ?? dialogRef.current;
    focusTarget?.focus();

    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
    // Re-attaching on isLoading flips would steal focus; dismissal is guarded separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onBackdropPointerDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    backdropPointerDownRef.current = event.target === overlayRef.current;
  }, []);

  const onBackdropClick = useCallback(
    (closeOnBackdrop: boolean) => (event: React.MouseEvent<HTMLDivElement>) => {
      const startedOnBackdrop = backdropPointerDownRef.current;
      backdropPointerDownRef.current = false;
      if (closeOnBackdrop && startedOnBackdrop && event.target === overlayRef.current) requestClose();
    },
    [requestClose],
  );

  return {
    overlayRef,
    dialogRef,
    closeButtonRef,
    entered,
    requestClose,
    titleId,
    descriptionId,
    onBackdropPointerDown,
    onBackdropClick,
  };
}

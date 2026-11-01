import { useCallback, useEffect, useRef } from 'react';
import type { ToastType } from '../components/ToastContext';
import { useToast } from '../components/useToast';
import { useI18n } from '../context/I18nContext';
import { extractApiError, formatToastMessage } from '../utils/apiError';

/** Default undo window in milliseconds (Phase 2.2 decision). */
export const DEFAULT_UNDO_WINDOW_MS = 5000;

export interface UndoableActionOptions {
  /** Toast text shown right after the destructive action succeeded. */
  successMessage: string;
  /** Fallback text used when the restore (undo) call itself fails. */
  undoFailureMessage: string;
  /** Permission gate: only render the Undo button when this is true. */
  canUndo: boolean;
  /** Restore operation executed when the user clicks Undo. */
  restore: () => Promise<unknown>;
  /** Optional post-restore callback (typically a list refresh). */
  onUndone?: () => unknown | Promise<unknown>;
  /** Toast type for the success/partial message; defaults to 'success'. */
  toastType?: ToastType;
  /** Optional toast duration; defaults to the undo window. */
  toastDurationMs?: number;
}

export interface UndoableActionHandle {
  /** Render the undo toast after a successful destructive operation. */
  offerUndo: (options: UndoableActionOptions) => void;
  /** Close the undo window early and drop the pending timer. */
  cancelUndo: () => void;
  /** Whether the undo window is still open (not expired / not used). */
  isUndoAvailable: () => boolean;
}

/**
 * Centralized undo affordance for destructive operations (Phase 2.2).
 *
 * Contract:
 *  - A successful action is announced through the existing toast provider.
 *  - The `action` slot (already present on `Toast`/`ToastAction`, reserved for
 *    Phase 2.2 in Phase 1.4) is filled with an Undo button only when the caller
 *    reports `canUndo === true`; otherwise the toast carries text only.
 *  - The undo window is exactly `undoWindowMs` (default 5 s). When it expires,
 *    the `onClick` closure is disarmed even if the toast itself is still visible
 *    for another render tick.
 *  - Clicking Undo runs `restore`, announces `undo.done`, and surfaces restore
 *    failures through `formatToastMessage` (with the correlation reference).
 *
 * No new toast framework is introduced and no existing `ToastContext` caller is
 * broken: the hook only uses the already-public `addToast` signature.
 */
export function useUndoableAction(undoWindowMs: number = DEFAULT_UNDO_WINDOW_MS): UndoableActionHandle {
  const { addToast } = useToast();
  const { t } = useI18n();

  const undoWindowOpenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWindowTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Always clean the pending timer on unmount.
  useEffect(() => clearWindowTimer, [clearWindowTimer]);

  const cancelUndo = useCallback(() => {
    undoWindowOpenRef.current = false;
    clearWindowTimer();
  }, [clearWindowTimer]);

  const offerUndo = useCallback(
    (options: UndoableActionOptions) => {
      clearWindowTimer();
      const { canUndo, restore, onUndone, undoFailureMessage } = options;
      undoWindowOpenRef.current = canUndo;

      // The click handler re-checks the ref so an expired window can never
      // restore anything, even if a stale toast button is still on screen.
      const handleUndo = () => {
        if (!undoWindowOpenRef.current) return;
        undoWindowOpenRef.current = false;
        clearWindowTimer();
        void (async () => {
          try {
            await restore();
            addToast('success', t('undo.done'));
            if (onUndone) await onUndone();
          } catch (err: unknown) {
            addToast(
              'error',
              formatToastMessage(extractApiError(err, undoFailureMessage), t('common.referenceId')),
            );
          }
        })();
      };

      const duration = options.toastDurationMs ?? undoWindowMs;
      addToast(
        options.toastType ?? 'success',
        options.successMessage,
        duration,
        undefined,
        canUndo ? { label: t('undo.label'), onClick: handleUndo } : undefined,
      );

      if (canUndo) {
        timerRef.current = setTimeout(() => {
          undoWindowOpenRef.current = false;
          timerRef.current = null;
        }, undoWindowMs);
      }
    },
    [addToast, clearWindowTimer, t, undoWindowMs],
  );

  return {
    offerUndo,
    cancelUndo,
    isUndoAvailable: () => undoWindowOpenRef.current,
  };
}

/** Structural subset of `BulkOperationResult` needed for undo. */
export interface BulkArchiveUndoSource {
  succeeded: Array<{ id: string }>;
}

/**
 * Restore only the IDs that the bulk operation actually archived.
 *
 * `failed` entries are intentionally skipped: they were never archived, so an
 * undo would either be a no-op or surface a spurious error. The returned list
 * contains the IDs that were restored successfully; if any restore fails, the
 * aggregated error is re-thrown so the caller can show a single toast.
 */
export async function restoreSucceededIds(
  result: BulkArchiveUndoSource,
  restoreOne: (id: string) => Promise<unknown>,
): Promise<string[]> {
  const restored: string[] = [];
  const failures: string[] = [];

  for (const entry of result.succeeded) {
    try {
      await restoreOne(entry.id);
      restored.push(entry.id);
    } catch (err: unknown) {
      failures.push(entry.id);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Restore failed for ${failures.length} of ${result.succeeded.length} archived item(s)`);
  }

  return restored;
}

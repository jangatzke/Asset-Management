/**
 * useUndoableAction hook tests (Phase 2.2).
 *
 * Proves:
 *  a. A successful action renders a toast carrying the `undo.label` action.
 *  b. After the 5-second undo window expires the toast is no longer undo-able
 *     (the action click is disarmed even if the button is still on screen).
 *  c. Clicking the action calls the supplied restore function and announces
 *     `undo.done`.
 *  d. Without permission (`canUndo=false`) the toast has no action button.
 *  e. A failing restore surfaces `formatToastMessage` output.
 */
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { useUndoableAction, DEFAULT_UNDO_WINDOW_MS, restoreSucceededIds } from './useUndoableAction';

// Capture every toast emitted by the hook so assertions stay independent of the
// real ToastProvider implementation.
const addToastMock = vi.fn();
vi.mock('../components/useToast', () => ({
  useToast: () => ({ addToast: addToastMock, removeToast: vi.fn(), toasts: [] }),
}));

// Keep i18n deterministic and avoid pulling the provider tree into the test.
vi.mock('../context/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: vi.fn(),
    tObject: () => ({}),
  }),
}));

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastCall {
  type: string;
  message: string;
  duration?: number;
  action?: ToastAction;
}

/** Read the last toast emitted by the hook. */
function lastToast(): ToastCall {
  const call = addToastMock.mock.calls.at(-1);
  return { type: call?.[0], message: call?.[1], duration: call?.[2], action: call?.[4] };
}

describe('useUndoableAction', () => {
  beforeEach(() => {
    addToastMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Flush pending microtasks without relying on fake timers. */
  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };

  it('offers an undo action when the action succeeds', () => {
    const { result } = renderHook(() => useUndoableAction());
    const restore = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.offerUndo({
        successMessage: 'Archived',
        undoFailureMessage: 'Undo failed',
        canUndo: true,
        restore,
      });
    });

    const toast = lastToast();
    expect(toast.message).toBe('Archived');
    expect(toast.action).toBeDefined();
    expect(toast.action?.label).toBe('undo.label');
    expect(result.current.isUndoAvailable()).toBe(true);
  });

  it('does not offer an action button when the user cannot restore', () => {
    const { result } = renderHook(() => useUndoableAction());

    act(() => {
      result.current.offerUndo({
        successMessage: 'Archived',
        undoFailureMessage: 'Undo failed',
        canUndo: false,
        restore: vi.fn(),
      });
    });

    const toast = lastToast();
    expect(toast.message).toBe('Archived');
    expect(toast.action).toBeUndefined();
    expect(result.current.isUndoAvailable()).toBe(false);
  });

  it('disarms undo after the 5-second window expires', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useUndoableAction());
    const restore = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.offerUndo({
        successMessage: 'Archived',
        undoFailureMessage: 'Undo failed',
        canUndo: true,
        restore,
      });
    });

    const action = lastToast().action;
    expect(action).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(DEFAULT_UNDO_WINDOW_MS);
    });

    expect(result.current.isUndoAvailable()).toBe(false);

    // Even a stale reference to the still-visible button cannot restore.
    act(() => {
      action?.onClick();
    });
    expect(restore).not.toHaveBeenCalled();
    expect(result.current.isUndoAvailable()).toBe(false);
  });

  it('calls the restore function and announces undo.done when clicked', async () => {
    // A long window keeps the timer from expiring during the assertion.
    const { result } = renderHook(() => useUndoableAction(60_000));
    const restore = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.offerUndo({
        successMessage: 'Archived',
        undoFailureMessage: 'Undo failed',
        canUndo: true,
        restore,
        onUndone: vi.fn(),
      });
    });

    const action = lastToast().action;
    expect(action).toBeDefined();

    act(() => {
      action?.onClick();
    });
    await flushMicrotasks();

    expect(restore).toHaveBeenCalledTimes(1);
    expect(addToastMock).toHaveBeenCalledWith('success', 'undo.done');
    expect(result.current.isUndoAvailable()).toBe(false);
  });

  it('surfaces restore failures through formatToastMessage', async () => {
    const { result } = renderHook(() => useUndoableAction(60_000));
    const failure = Object.assign(new Error('boom'), {
      response: {
        data: { error: { message: 'Restore rejected' } },
        headers: { 'x-correlation-id': 'corr-123' },
      },
    });

    act(() => {
      result.current.offerUndo({
        successMessage: 'Archived',
        undoFailureMessage: 'Undo failed',
        canUndo: true,
        restore: vi.fn().mockRejectedValue(failure),
      });
    });

    const action = lastToast().action;

    act(() => {
      action?.onClick();
    });
    await flushMicrotasks();

    const call = addToastMock.mock.calls.at(-1);
    expect(call?.[0]).toBe('error');
    expect(call?.[1]).toContain('Restore rejected');
    expect(call?.[1]).toContain('corr-123');
  });
});

describe('restoreSucceededIds', () => {
  it('restores only succeeded ids and skips failed entries', async () => {
    const restoreOne = vi.fn().mockResolvedValue(undefined);
    const result = {
      succeeded: [{ id: 's-1', status: 200 }, { id: 's-2', status: 200 }],
      failed: [{ id: 'f-1', error: 'locked', status: 409 }],
      total: 3,
      succeededCount: 2,
      failedCount: 1,
    };

    const restored = await restoreSucceededIds(result, restoreOne);

    expect(restored).toEqual(['s-1', 's-2']);
    expect(restoreOne).toHaveBeenCalledTimes(2);
    expect(restoreOne).toHaveBeenCalledWith('s-1');
    expect(restoreOne).toHaveBeenCalledWith('s-2');
    expect(restoreOne).not.toHaveBeenCalledWith('f-1');
  });

  it('throws an aggregated error when any restore fails', async () => {
    const restoreOne = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('nope'));

    await expect(
      restoreSucceededIds({ succeeded: [{ id: 'a' }, { id: 'b' }] }, restoreOne),
    ).rejects.toThrow('Restore failed for 1 of 2 archived item(s)');
  });
});

/**
 * useDraftForm tests (Phase 2.3).
 *
 * Proves:
 *  a. save -> load returns the same value.
 *  b. a schemaVersion mismatch yields null and the record is removed.
 *  c. an expired TTL yields null and the key is deleted.
 *  d. corrupted JSON yields null and never throws.
 *  e. clear removes the key.
 *  f. quota/storage errors during save do not throw (degrade to false).
 *  g. restoring a draft into useDirtyForm does not fabricate dirty state.
 *
 * All tests clean up `localStorage` so no cross-test pollution can occur.
 */
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { useDraftForm, draftStorageKey, DEFAULT_DRAFT_TTL_MS } from './useDraftForm';
import { useDirtyForm } from './useDirtyForm';

const FORM_KEY = 'incidents.create';
const VERSION = 3;

function clearDraftStorage() {
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
}

beforeEach(() => {
  clearDraftStorage();
});

afterEach(() => {
  clearDraftStorage();
});

describe('useDraftForm storage contract', () => {
  it('builds a versioned key containing formKey and schemaVersion', () => {
    expect(draftStorageKey('incidents.create', 1)).toBe('draft:incidents.create:v1');
    expect(draftStorageKey('risks.create', 2)).toBe('draft:risks.create:v2');
  });

  it('save -> load returns the same value', () => {
    const value = { title: 'Firewall outage', severity: 'high' };
    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value }));

    let saved = false;
    act(() => {
      saved = result.current.save(value);
    });

    expect(saved).toBe(true);
    expect(result.current.load()).toEqual(value);
    expect(result.current.hasDraft()).toBe(true);
    expect(result.current.isRestorable()).toBe(true);
    expect(window.localStorage.getItem(draftStorageKey(FORM_KEY, VERSION))).not.toBeNull();
  });

  it('load returns the envelope value and savedAt', () => {
    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: { a: 1 } }));
    act(() => {
      result.current.save({ a: 1 });
    });
    const record = result.current.loadRecord();
    expect(record?.value).toEqual({ a: 1 });
    expect(typeof record?.savedAt).toBe('number');
  });

  it('a schemaVersion mismatch yields null and removes the old-key record', () => {
    // Simulate a record written by an older schema version in its own slot.
    const oldKey = draftStorageKey(FORM_KEY, VERSION - 1);
    window.localStorage.setItem(oldKey, JSON.stringify({ schemaVersion: VERSION - 1, savedAt: Date.now(), value: { stale: true } }));

    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: { fresh: true } }));

    // The versioned key does not even point at the old slot.
    expect(result.current.load()).toBeNull();
    expect(window.localStorage.getItem(oldKey)).not.toBeNull(); // untouched slot
    expect(window.localStorage.getItem(draftStorageKey(FORM_KEY, VERSION))).toBeNull();

    // A record in the *current* slot carrying a wrong envelope version is deleted.
    const currentKey = draftStorageKey(FORM_KEY, VERSION);
    window.localStorage.setItem(currentKey, JSON.stringify({ schemaVersion: VERSION - 1, savedAt: Date.now(), value: { stale: true } }));
    expect(result.current.load()).toBeNull();
    expect(window.localStorage.getItem(currentKey)).toBeNull();
  });

  it('an expired TTL yields null and deletes the key', () => {
    const ttlMs = 1000;
    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: { a: 1 }, ttlMs }));
    act(() => {
      result.current.save({ a: 1 });
    });
    const key = draftStorageKey(FORM_KEY, VERSION);

    // Rewind the timestamp past the TTL instead of waiting on real time.
    const current = JSON.parse(window.localStorage.getItem(key)!);
    window.localStorage.setItem(key, JSON.stringify({ ...current, savedAt: Date.now() - (ttlMs + 50) }));

    expect(result.current.load()).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(result.current.hasDraft()).toBe(false);
    expect(result.current.isRestorable()).toBe(false);
  });

  it('corrupted JSON yields null without throwing', () => {
    const key = draftStorageKey(FORM_KEY, VERSION);
    window.localStorage.setItem(key, '{not valid json');

    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: { a: 1 } }));

    expect(() => result.current.load()).not.toThrow();
    expect(result.current.load()).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('clear removes the key', () => {
    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: { a: 1 } }));
    act(() => {
      result.current.save({ a: 1 });
    });
    expect(result.current.hasDraft()).toBe(true);

    act(() => {
      result.current.clear();
    });
    expect(result.current.hasDraft()).toBe(false);
    expect(window.localStorage.getItem(draftStorageKey(FORM_KEY, VERSION))).toBeNull();
  });

  it('quota/storage errors during save do not throw (degrade to false)', () => {
    const { result } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: { a: 1 } }));

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    let saved: boolean | undefined;
    expect(() => {
      act(() => {
        saved = result.current.save({ a: 1 });
      });
    }).not.toThrow();
    expect(saved).toBe(false);
    expect(result.current.load()).toBeNull();

    setItemSpy.mockRestore();
  });

  it('exposes a sane default TTL of seven days', () => {
    expect(DEFAULT_DRAFT_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('does not auto-save an untouched form', () => {
    vi.useFakeTimers();
    const value = { title: 'unchanged' };
    renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(window.localStorage.getItem(draftStorageKey(FORM_KEY, VERSION))).toBeNull();
    vi.useRealTimers();
  });

  it('debounces auto-save instead of writing on every change', () => {
    vi.useFakeTimers();
    let value = { title: 'a' };
    const { rerender } = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value, debounceMs: 500 }));

    value = { title: 'ab' };
    rerender();
    value = { title: 'abc' };
    rerender();

    expect(window.localStorage.getItem(draftStorageKey(FORM_KEY, VERSION))).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    const stored = JSON.parse(window.localStorage.getItem(draftStorageKey(FORM_KEY, VERSION))!);
    expect(stored.value).toEqual({ title: 'abc' });
    vi.useRealTimers();
  });
});

describe('draft restore and dirty state', () => {
  it('restoring a valid draft does not make a matching form dirty', () => {
    const initial = { title: '', severity: 'medium' };
    const draftValue = { title: 'Restored incident', severity: 'high' };

    const draftHook = renderHook(() => useDraftForm({ formKey: FORM_KEY, schemaVersion: VERSION, value: draftValue }));
    act(() => {
      draftHook.result.current.save(draftValue);
    });

    const dirtyHook = renderHook(() => useDirtyForm(initial));

    // Restore via setFormValues — the draft becomes the new snapshot.
    act(() => {
      dirtyHook.result.current.setFormValues(draftValue);
    });

    expect(dirtyHook.result.current.values).toEqual(draftValue);
    expect(dirtyHook.result.current.isDirty).toBe(false);

    // A subsequent edit is genuinely dirty.
    act(() => {
      dirtyHook.result.current.handleChange({ title: 'Edited' });
    });
    expect(dirtyHook.result.current.isDirty).toBe(true);
  });
});

import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * localStorage-backed draft persistence for long forms (Phase 2.3).
 *
 * Key contract (versioned, mirrors the `usePersistedView` convention of a
 * namespaced prefix + explicit fields):
 *
 *   draft:<formKey>:v<schemaVersion>
 *
 * Because the version is part of the key, a schema change makes the old
 * record unreachable — it can never be restored into the new form shape.
 * The envelope also carries `schemaVersion`, so a record written into the
 * wrong slot is rejected and deleted (defence in depth).
 *
 * Robustness: every storage access is wrapped in try/catch. Missing
 * `window`/`localStorage`, Safari private mode, quota errors, corrupted
 * JSON, invalid envelopes and expired records all degrade instead of
 * throwing. There is deliberately no module-level storage cache, so tests
 * running against jsdom get an isolated `localStorage` per test.
 */

const DRAFT_KEY_PREFIX = 'draft';

/** Default TTL: 7 days — long enough to survive a weekend, short enough to avoid stale data. */
export const DEFAULT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Default debounce: 750 ms. Chosen over per-keystroke writes (quota churn,
 * thrashing) and over blur/submit-only saving (a closed tab loses work).
 * A single `setTimeout` per value change coalesces fast typing without
 * needing any external scheduler.
 */
export const DEFAULT_DRAFT_DEBOUNCE_MS = 750;

export interface DraftRecord<T> {
  /** The persisted form value. */
  value: T;
  /** Epoch milliseconds of the last save; used for TTL and the restore message. */
  savedAt: number;
}

export interface UseDraftFormOptions<T> {
  /** Namespace of the form, e.g. `incidents.create`. Part of the storage key. */
  formKey: string;
  /** Schema version. Part of the storage key and validated inside the envelope. */
  schemaVersion: number;
  /** Current form value; observed for debounced auto-save. */
  value: T;
  /** Optional TTL in ms (defaults to {@link DEFAULT_DRAFT_TTL_MS}). */
  ttlMs?: number;
  /** Optional debounce in ms (defaults to {@link DEFAULT_DRAFT_DEBOUNCE_MS}). */
  debounceMs?: number;
  /** Set to false to disable auto-save (manual `save()` calls still work). */
  autoSave?: boolean;
}

export interface UseDraftFormReturn<T> {
  /** Persist `value` (or the latest observed value) immediately. Returns false when storage is unavailable. */
  save: (value?: T) => boolean;
  /** Read a valid, unexpired draft value or `null`. Expired/invalid records are deleted. */
  load: () => T | null;
  /** Read the full record (`value` + `savedAt`) or `null`. */
  loadRecord: () => DraftRecord<T> | null;
  /** Delete the draft for this key/version. */
  clear: () => void;
  /** True when a valid, unexpired draft exists. */
  hasDraft: () => boolean;
  /** Alias of `hasDraft()` — a draft is restorable only when it is valid and unexpired. */
  isRestorable: () => boolean;
}

/** Build the versioned localStorage key. */
export function draftStorageKey(formKey: string, schemaVersion: number): string {
  return `${DRAFT_KEY_PREFIX}:${formKey}:v${schemaVersion}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    /* Private mode / disabled storage — degrade to no persistence. */
    return null;
  }
}

function removeKey(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    /* best-effort cleanup */
  }
}

interface StoredEnvelope<T> {
  schemaVersion: number;
  savedAt: number;
  value: T;
}

/**
 * Read + validate a draft. Any malformed/expired/mismatched record is
 * removed and treated as absent — never thrown.
 */
function readRecord<T>(
  formKey: string,
  schemaVersion: number,
  ttlMs: number,
): DraftRecord<T> | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = draftStorageKey(formKey, schemaVersion);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: Partial<StoredEnvelope<T>>;
  try {
    parsed = JSON.parse(raw) as Partial<StoredEnvelope<T>>;
  } catch {
    removeKey(key); // corrupted JSON cannot ever be restored
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.savedAt !== 'number' ||
    parsed.schemaVersion !== schemaVersion ||
    parsed.value === undefined ||
    parsed.value === null ||
    typeof parsed.value !== 'object'
  ) {
    removeKey(key); // unknown schema / invalid envelope
    return null;
  }

  const age = Date.now() - parsed.savedAt;
  if (age > ttlMs || age < 0) {
    removeKey(key); // expired (or clock-skewed future record)
    return null;
  }

  return { value: parsed.value as T, savedAt: parsed.savedAt };
}

function writeRecord<T>(
  formKey: string,
  schemaVersion: number,
  value: T,
): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    // Note: the TTL is applied at read time, not stored, so a shorter TTL in a
    // newer build also invalidates records written by an older build.
    const envelope: StoredEnvelope<T> = { schemaVersion, savedAt: Date.now(), value };
    const serialized = JSON.stringify(envelope);
    if (typeof serialized !== 'string') return false;
    storage.setItem(draftStorageKey(formKey, schemaVersion), serialized);
    return true;
  } catch {
    /* Quota / privacy mode — saving silently fails, the form keeps working. */
    return false;
  }
}

function readSignature(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export function useDraftForm<T>(options: UseDraftFormOptions<T>): UseDraftFormReturn<T> {
  const {
    formKey,
    schemaVersion,
    value,
    ttlMs = DEFAULT_DRAFT_TTL_MS,
    debounceMs = DEFAULT_DRAFT_DEBOUNCE_MS,
    autoSave = true,
  } = options;

  // The latest value is kept in a ref so the debounced writer always persists
  // the value that existed when the timer fires, not a stale closure copy.
  const latestValueRef = useRef<T>(value);
  latestValueRef.current = value;

  const signature = useMemo(() => readSignature(value), [value]);

  // The value present when the form opened. Comparing against it prevents
  // writing a draft for an untouched form (there is nothing to resume).
  const initialSignatureRef = useRef<string | undefined>(undefined);
  if (initialSignatureRef.current === undefined) {
    initialSignatureRef.current = signature;
  }

  const save = useCallback(
    (override?: T) => writeRecord(formKey, schemaVersion, override ?? latestValueRef.current),
    [formKey, schemaVersion],
  );

  const loadRecord = useCallback(
    () => readRecord<T>(formKey, schemaVersion, ttlMs),
    [formKey, schemaVersion, ttlMs],
  );

  const load = useCallback(() => {
    const record = readRecord<T>(formKey, schemaVersion, ttlMs);
    return record ? record.value : null;
  }, [formKey, schemaVersion, ttlMs]);

  const clear = useCallback(() => {
    removeKey(draftStorageKey(formKey, schemaVersion));
  }, [formKey, schemaVersion]);

  const hasDraft = useCallback(
    () => readRecord<T>(formKey, schemaVersion, ttlMs) !== null,
    [formKey, schemaVersion, ttlMs],
  );

  const isRestorable = useCallback(
    () => readRecord<T>(formKey, schemaVersion, ttlMs) !== null,
    [formKey, schemaVersion, ttlMs],
  );

  useEffect(() => {
    if (!autoSave) return undefined;
    // Unchanged from the initial form snapshot: nothing worth resuming.
    if (signature === initialSignatureRef.current) return undefined;

    const timer = setTimeout(() => {
      writeRecord(formKey, schemaVersion, latestValueRef.current);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [signature, autoSave, debounceMs, formKey, schemaVersion, ttlMs]);

  return { save, load, loadRecord, clear, hasDraft, isRestorable };
}

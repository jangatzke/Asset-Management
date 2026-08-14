import { useState, useCallback, useRef } from 'react';

/**
 * Deep-compare helper: returns true when a and b are structurally equal.
 * Handles primitives, arrays, plain objects (including Date/JSON as strings).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a as object).sort();
    const keysB = Object.keys(b as object).sort();
    if (keysA.length !== keysB.length) return false;
    if (!keysA.every((k, i) => keysB[i] === k)) return false;
    return keysA.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }

  return false;
}

export interface UseDirtyFormReturn<T> {
  /** Current form values */
  values: T;
  /** Set values directly (bypasses dirty tracking for programmatic updates) */
  setValues: (fn: (prev: T) => T) => void;
  /** Whether the form has been modified from the initial/open snapshot */
  isDirty: boolean;
  /** Single-field change handler — call as `handleChange({ name: value })` */
  handleChange: (partial: Partial<T>) => void;
  /** Reset form back to the original snapshot and clear dirty flag */
  resetForm: () => void;
  /** Called when the dialog opens — freezes the snapshot for comparison */
  setFormValues: (newValues: T) => void;
  /** The frozen snapshot used for dirty comparison */
  snapshot: T;
}

export function useDirtyForm<T>(initialValues: T): UseDirtyFormReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [isDirty, setIsDirty] = useState(false);
  // Use a ref so the snapshot survives re-renders but can be updated via setFormValues
  const snapshotRef = useRef<T>(initialValues);

  // Persist the initial values ref so resetForm always goes back to the original open snapshot
  const initialValuesRef = useRef<T>(initialValues);

  const setFormValues = useCallback((newValues: T) => {
    setValues(newValues);
    snapshotRef.current = newValues;
    initialValuesRef.current = newValues;
    setIsDirty(false);
  }, []);

  const handleChange = useCallback((partial: Partial<T>) => {
    setValues((prev) => {
      const next = { ...prev, ...partial };
      if (!deepEqual(next, snapshotRef.current)) {
        setIsDirty(true);
      }
      return next;
    });
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValuesRef.current);
    snapshotRef.current = initialValuesRef.current;
    setIsDirty(false);
  }, []);

  // Internal setValues wrapper that also triggers dirty detection
  const setValuesWrapper = useCallback((fn: (prev: T) => T) => {
    setValues((prev) => {
      const next = fn(prev);
      if (!deepEqual(next, snapshotRef.current)) {
        setIsDirty(true);
      }
      return next;
    });
  }, []);

  return {
    values,
    setValues: setValuesWrapper,
    isDirty,
    handleChange,
    resetForm,
    setFormValues,
    get snapshot() { return snapshotRef.current; },
  };
}

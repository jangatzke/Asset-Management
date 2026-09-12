import { useCallback, useEffect, useState } from 'react';

/** Sort descriptor persisted per list view. */
export interface LocalSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UseLocalSortOptions {
  /**
   * Route/key used to namespace the `localStorage` view so different lists do
   * not collide with their sort preferences.
   */
  routeKey: string;
  /** Default sort applied when no persisted sort exists. */
  defaultSort?: LocalSort;
}

export interface UseLocalSortReturn {
  /** Persisted sort descriptor (empty column = unsorted). */
  sort: LocalSort;
  /** Toggle the sort direction for a column (or start sorting it). */
  toggleSort: (column: string) => void;
}

const STORAGE_PREFIX = 'am.view';

function readStorage<T>(routeKey: string, field: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${routeKey}.${field}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(routeKey: string, field: string, value: unknown): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${routeKey}.${field}`, JSON.stringify(value));
  } catch {
    /* localStorage may be unavailable (private mode, quota) — persistence is best-effort. */
  }
}

/**
 * Client-side sort state for a single list that does not already manage its
 * view through `usePersistedView`.
 *
 * Sort direction is stored per `routeKey` in `localStorage` so a user's
 * preferred order survives reload/revisit. Sorting is a purely client-side view
 * preference: callers apply it to the rows they already have in memory.
 */
export function useLocalSort(options: UseLocalSortOptions): UseLocalSortReturn {
  const { routeKey, defaultSort } = options;
  const [sort, setSort] = useState<LocalSort>(
    () => readStorage<LocalSort | null>(routeKey, 'sort', null) ?? defaultSort ?? { column: '', direction: 'asc' },
  );

  // If no persisted sort exists yet, fall back to the default on first render.
  useEffect(() => {
    if (!sort.column && defaultSort) {
      setSort(defaultSort);
      writeStorage(routeKey, 'sort', defaultSort);
    }
  }, [routeKey, defaultSort, sort.column]);

  const toggleSort = useCallback((column: string) => {
    setSort((prev) => {
      const direction = prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc';
      const next: LocalSort = { column, direction };
      writeStorage(routeKey, 'sort', next);
      return next;
    });
  }, [routeKey]);

  return { sort, toggleSort };
}

export default useLocalSort;

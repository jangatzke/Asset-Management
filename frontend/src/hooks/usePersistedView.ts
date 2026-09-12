import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Sort descriptor persisted per list view. */
export interface ViewSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface UsePersistedViewOptions {
  /**
   * Route/key used to namespace the `localStorage` view (sort + column order).
   * Different lists should pass different values so their preferences do not
   * collide.
   */
  routeKey: string;
  /**
   * URL query keys that represent the filters this view manages. These are
   * serialized into the query string so links are shareable and state survives
   * reload/revisit.
   */
  filterKeys: string[];
  /** URL query key that represents the current page. Defaults to `page`. */
  pageKey?: string;
  /** Default sort applied when no persisted sort exists. */
  defaultSort?: ViewSort;
  /** Default column order persisted for the view. */
  defaultColumns?: string[];
}

export interface PersistedViewReturn {
  /** Current filter values keyed by `filterKeys` (empty string = unset). */
  filters: Record<string, string>;
  /** Current page number (>= 1). */
  page: number;
  /** Persisted sort descriptor. */
  sort: ViewSort;
  /** Persisted column order. */
  columns: string[];
  /** Update a single filter value. Clears the value when `value` is empty. */
  setFilter: (key: string, value: string) => void;
  /** Jump to a page. */
  setPage: (page: number) => void;
  /** Toggle the sort direction for a column (or start sorting it). */
  toggleSort: (column: string) => void;
  /** Reset filters, page, sort and column order to their defaults. */
  clearView: () => void;
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

function readUrlView(search: string, filterKeys: string[], pageKey: string): { filters: Record<string, string>; page: number } {
  const params = new URLSearchParams(search);
  const filters: Record<string, string> = {};
  filterKeys.forEach((key) => {
    const value = params.get(key);
    if (value) filters[key] = value;
  });
  const rawPage = params.get(pageKey);
  const parsedPage = rawPage ? parseInt(rawPage, 10) : NaN;
  return {
    filters,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

function filtersEqual(left: Record<string, string>, right: Record<string, string>, filterKeys: string[]): boolean {
  return filterKeys.every((key) => (left[key] ?? '') === (right[key] ?? ''));
}

/**
 * Persistent, resumable list state.
 *
 * - Filters and the current page are serialized into the URL query string, so a
 *   filtered link is shareable and the state survives reload/revisit.
 * - Sort direction and column order are stored per `routeKey` in `localStorage`,
 *   so a user's preferred view is remembered across sessions.
 *
 * The URL is the single source of truth for filters + page; the component reads
 * it on mount and on every `location.search` change, while filter/page actions
 * update it directly (guarded against redundant navigation).
 */
export function usePersistedView(options: UsePersistedViewOptions): PersistedViewReturn {
  const { routeKey, filterKeys, pageKey = 'page', defaultSort, defaultColumns } = options;
  const location = useLocation();
  const navigate = useNavigate();
  // List pages pass inline arrays. Use their values, rather than their render-time
  // identity, as the URL-sync dependency.
  const filterKeysSignature = JSON.stringify(filterKeys);
  const managedFilterKeys = useMemo<string[]>(() => JSON.parse(filterKeysSignature), [filterKeysSignature]);
  const pendingSearch = useRef(location.search);

  const [filters, setFilters] = useState<Record<string, string>>(
    () => readUrlView(location.search, managedFilterKeys, pageKey).filters,
  );
  const [page, setPage] = useState(
    () => readUrlView(location.search, managedFilterKeys, pageKey).page,
  );
  const [sort, setSort] = useState<ViewSort>(
    () => readStorage<ViewSort | null>(routeKey, 'sort', null) ?? defaultSort ?? { column: '', direction: 'asc' },
  );
  const [columns, setColumns] = useState<string[]>(
    () => readStorage<string[] | null>(routeKey, 'columns', null) ?? defaultColumns ?? [],
  );

  // Read filters + page from the URL whenever the query string changes so that
  // external navigation (links, share URLs, browser back/forward) is respected.
  useEffect(() => {
    pendingSearch.current = location.search;
    const nextView = readUrlView(location.search, managedFilterKeys, pageKey);
    setFilters((current) => filtersEqual(current, nextView.filters, managedFilterKeys) ? current : nextView.filters);
    setPage((current) => current === nextView.page ? current : nextView.page);
  }, [location.search, managedFilterKeys, pageKey]);

  // Apply URL changes at the time of the user action. Keeping the URL as the
  // only source of truth prevents a stale state-to-URL write from undoing a
  // filter removal or external navigation.
  const replaceSearch = useCallback((update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(pendingSearch.current);
    update(params);
    const rawSearch = params.toString();
    const newSearch = rawSearch ? `?${rawSearch}` : '';
    if (newSearch !== pendingSearch.current) {
      pendingSearch.current = newSearch;
      navigate({ search: newSearch }, { replace: true });
    }
  }, [navigate]);

  const setFilter = useCallback((key: string, value: string) => {
    replaceSearch((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
      // Reset to the first page whenever a filter changes.
      params.delete(pageKey);
    });
  }, [pageKey, replaceSearch]);

  const setCurrentPage = useCallback((nextPage: number) => {
    const normalizedPage = Number.isFinite(nextPage) && nextPage > 0 ? Math.floor(nextPage) : 1;
    replaceSearch((params) => {
      if (normalizedPage > 1) params.set(pageKey, String(normalizedPage));
      else params.delete(pageKey);
    });
  }, [pageKey, replaceSearch]);

  const toggleSort = useCallback((column: string) => {
    setSort((prev) => {
      const direction = prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc';
      const next: ViewSort = { column, direction };
      writeStorage(routeKey, 'sort', next);
      return next;
    });
  }, [routeKey]);

  const clearView = useCallback(() => {
    replaceSearch((params) => {
      managedFilterKeys.forEach((key) => params.delete(key));
      params.delete(pageKey);
    });
    const nextSort = defaultSort ?? { column: '', direction: 'asc' };
    setSort(nextSort);
    writeStorage(routeKey, 'sort', nextSort);
    const nextColumns = defaultColumns ?? [];
    setColumns(nextColumns);
    writeStorage(routeKey, 'columns', nextColumns);
  }, [routeKey, defaultSort, defaultColumns, managedFilterKeys, pageKey, replaceSearch]);

  return { filters, page, setPage: setCurrentPage, setFilter, sort, toggleSort, columns, clearView };
}

import { useCallback, useState } from 'react';

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
}

export interface UseSavedViewsReturn {
  views: SavedView[];
  /** Persist a named snapshot of the current filter values. Returns false when the name is empty or duplicated. */
  saveView: (name: string, filters: Record<string, string>) => boolean;
  /** Delete a saved view by id. */
  deleteView: (id: string) => void;
}

const STORAGE_PREFIX = 'am.savedViews';

function readViews(routeKey: string): SavedView[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${routeKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeViews(routeKey: string, views: SavedView[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${routeKey}`, JSON.stringify(views));
  } catch {
    /* localStorage may be unavailable (private mode, quota) — persistence is best-effort. */
  }
}

/**
 * Named saved views per list page (localStorage).
 *
 * Lets users store frequently used filter combinations (e.g. "critical assets
 * without owner") and re-apply them with one click. Views are namespaced by
 * `routeKey` so each list keeps its own set.
 */
export function useSavedViews(routeKey: string): UseSavedViewsReturn {
  const [views, setViews] = useState<SavedView[]>(() => readViews(routeKey));

  const saveView = useCallback((name: string, filters: Record<string, string>): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    setViews((current) => {
      const withoutDuplicate = current.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase());
      const next: SavedView[] = [
        ...withoutDuplicate,
        { id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: trimmed, filters, createdAt: new Date().toISOString() },
      ].slice(-20); // keep at most 20 saved views per list
      writeViews(routeKey, next);
      return next;
    });
    return true;
  }, [routeKey]);

  const deleteView = useCallback((id: string) => {
    setViews((current) => {
      const next = current.filter((view) => view.id !== id);
      writeViews(routeKey, next);
      return next;
    });
  }, [routeKey]);

  return { views, saveView, deleteView };
}

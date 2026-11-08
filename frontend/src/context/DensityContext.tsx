/**
 * Global table/list density preference (Stage 10b / LT-3).
 *
 * One user-level setting ('comfortable' | 'compact') persisted in
 * `localStorage` under the `am.density` key — the same namespacing pattern as
 * `am.view.*` (usePersistedView) and `am.sidebar.collapsed`. The value is read
 * by `DataTableShell` / `useTableDensity()` so every list responds to the
 * top-bar toggle, while an explicit `density` prop on a single shell still wins.
 *
 * SSR-safety: `window`/`localStorage` are only touched behind guards, so the
 * module can be imported in non-browser environments without throwing.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type DensityPreference = 'comfortable' | 'compact';

const STORAGE_KEY = 'am.density';

/** Fallback when no provider is mounted or nothing was persisted yet. */
export const DEFAULT_DENSITY: DensityPreference = 'comfortable';

interface DensityContextValue {
  density: DensityPreference;
  setDensity: (density: DensityPreference) => void;
  toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

function readStoredDensity(): DensityPreference {
  try {
    if (typeof window === 'undefined') return DEFAULT_DENSITY;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'compact' || stored === 'comfortable' ? stored : DEFAULT_DENSITY;
  } catch {
    // localStorage may be unavailable (private mode, quota) — best-effort only.
    return DEFAULT_DENSITY;
  }
}

function persistDensity(density: DensityPreference): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    /* persistence is best-effort */
  }
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DensityPreference>(readStoredDensity);

  // Keep other tabs/windows in sync with the stored preference.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setDensityState(event.newValue === 'compact' ? 'compact' : DEFAULT_DENSITY);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setDensity = useCallback((next: DensityPreference) => {
    setDensityState(next);
    persistDensity(next);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensityState((current) => {
      const next: DensityPreference = current === 'compact' ? 'comfortable' : 'compact';
      persistDensity(next);
      return next;
    });
  }, []);

  return (
    <DensityContext.Provider value={{ density, setDensity, toggleDensity }}>
      {children}
    </DensityContext.Provider>
  );
}

/**
 * Read the global density preference. Outside a `DensityProvider` this safely
 * falls back to the `comfortable` default with no-op setters, so components
 * (and tests) that render without the provider keep working.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Context hook must remain exported with its provider for stable imports.
export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);
  if (context) return context;
  return {
    density: DEFAULT_DENSITY,
    setDensity: () => undefined,
    toggleDensity: () => undefined,
  };
}

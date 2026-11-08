import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { authApi } from '../services/api';

interface DarkModeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
  /** Stage 10c / LT-6: local high-contrast preference ('am.contrast'). */
  highContrast: boolean;
  toggleHighContrast: () => void;
  setHighContrast: (value: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

function getSystemDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Stage 10c: high contrast is a device-local preference (like density). */
const CONTRAST_STORAGE_KEY = 'am.contrast';

function readStoredHighContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_STORAGE_KEY) === 'high';
  } catch {
    return false;
  }
}

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const { user, updateUserPreferences } = useAuthStore();

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    // Fallback to localStorage or system preference while loading
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return getSystemDarkMode();
  });

  const [highContrast, setHighContrastState] = useState<boolean>(readStoredHighContrast);

  // Keep other tabs in sync with the local high-contrast preference.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONTRAST_STORAGE_KEY) {
        setHighContrastState(event.newValue === 'high');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Apply the .contrast-high class (mirrors the .dark handling above).
  useEffect(() => {
    try {
      localStorage.setItem(CONTRAST_STORAGE_KEY, highContrast ? 'high' : 'normal');
    } catch {
      // Storage unavailable (private mode etc.) — preference stays session-only.
    }
    if (highContrast) {
      document.documentElement.classList.add('contrast-high');
    } else {
      document.documentElement.classList.remove('contrast-high');
    }
  }, [highContrast]);

  // Sync from user profile when loaded
  useEffect(() => {
    if (!user) return;
    if (user.darkMode !== null && user.darkMode !== undefined) {
      setDarkModeState(user.darkMode);
    } else {
      // No DB value yet - fall back to system preference and persist
      const systemPref = getSystemDarkMode();
      setDarkModeState(systemPref);
      void authApi.updatePreferences({ darkMode: systemPref }).catch(() => undefined);
    }
  }, [user]);

  // Apply to DOM and localStorage on change
  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const setDarkMode = useCallback(async (value: boolean) => {
    setDarkModeState(value);
    localStorage.setItem('darkMode', String(value));
    updateUserPreferences({ darkMode: value });
    try {
      const response = await authApi.updatePreferences({ darkMode: value });
      if (typeof response.data?.darkMode === 'boolean') {
        updateUserPreferences({ darkMode: response.data.darkMode });
      }
    } catch (err) {
      console.error('Failed to save dark mode preference:', err);
    }
  }, [updateUserPreferences]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(!darkMode);
  }, [darkMode, setDarkMode]);

  const setHighContrast = useCallback((value: boolean) => {
    setHighContrastState(value);
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrastState((current) => !current);
  }, []);

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode, highContrast, toggleHighContrast, setHighContrast }}>
      {children}
    </DarkModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Context hook must remain exported with its provider for stable imports.
export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}

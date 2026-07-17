import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../store/auth';
import { authApi } from '../services/api';

interface DarkModeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

function getSystemDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();

  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    // Fallback to localStorage or system preference while loading
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return getSystemDarkMode();
  });

  // Sync from user profile when loaded
  useEffect(() => {
    if (!user) return;
    if (user.darkMode !== null && user.darkMode !== undefined) {
      setDarkModeState(user.darkMode);
    } else {
      // No DB value yet - fall back to system preference and persist
      const systemPref = getSystemDarkMode();
      setDarkModeState(systemPref);
      void authApi.updatePreferences({ darkMode: systemPref }).catch(() => {});
    }
  }, [user?.id, user?.darkMode]);

  // Apply to DOM and localStorage on change
  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const setDarkMode = async (value: boolean) => {
    setDarkModeState(value);
    try {
      await authApi.updatePreferences({ darkMode: value });
    } catch (err) {
      console.error('Failed to save dark mode preference:', err);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}

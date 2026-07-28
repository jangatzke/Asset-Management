import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { authApi } from '../services/api';
import en from '../locales/en.json';
import de from '../locales/de.json';

type Language = 'en' | 'de';

const translations: Record<Language, any> = {
  en,
  de
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getBrowserLocale(): Language {
  const locale = navigator.language.toLowerCase();
  if (locale.startsWith('de')) return 'de';
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, updateUserPreferences } = useAuthStore();

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved && (saved === 'en' || saved === 'de')) {
      return saved as Language;
    }
    return getBrowserLocale();
  });

  // Sync from user profile when loaded, without overwriting an explicit local choice
  useEffect(() => {
    if (!user) return;
    if (user.language && (user.language === 'en' || user.language === 'de')) {
      setLanguageState(user.language as Language);
    } else {
      // No DB value yet - keep saved/local language and persist that preference
      void authApi.updatePreferences({ language }).catch(() => undefined);
    }
  }, [user, language]);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    updateUserPreferences({ language: lang });
    try {
      const response = await authApi.updatePreferences({ language: lang });
      if (response.data?.language === 'en' || response.data?.language === 'de') {
        updateUserPreferences({ language: response.data.language });
      }
    } catch (err) {
      console.error('Failed to save language preference:', err);
    }
  }, [updateUserPreferences]);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Context hook must remain exported with its provider for stable imports.
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  const { user } = useAuthStore();

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved && (saved === 'en' || saved === 'de')) {
      return saved as Language;
    }
    return getBrowserLocale();
  });

  // Sync from user profile when loaded
  useEffect(() => {
    if (!user) return;
    if (user.language && (user.language === 'en' || user.language === 'de')) {
      setLanguageState(user.language as Language);
    } else {
      // No DB value yet - fall back to browser locale and persist
      const browserLocale = getBrowserLocale();
      setLanguageState(browserLocale);
      void authApi.updatePreferences({ language: browserLocale }).catch(() => {});
    }
  }, [user?.id, user?.language]);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    try {
      await authApi.updatePreferences({ language: lang });
    } catch (err) {
      console.error('Failed to save language preference:', err);
    }
  };

  const t = (key: string): string => {
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
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

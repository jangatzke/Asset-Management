/**
 * Locale-aware date/time formatting.
 *
 * Uses the language currently selected by I18nContext (persisted to
 * localStorage under the `language` key) so dates render in the user's
 * locale instead of the browser default or a hard-coded 'de-DE'.
 */

type Language = 'en' | 'de' | 'es' | 'fr';

const isLanguage = (value: string | null): value is Language =>
  value === 'en' || value === 'de' || value === 'es' || value === 'fr';

/** Resolve the active locale without requiring React context. */
export const getLocaleTag = (): string => {
  try {
    const saved = localStorage.getItem('language');
    if (isLanguage(saved)) return saved;
  } catch {
    // localStorage may be unavailable (SSR / privacy mode); fall through.
  }
  return typeof navigator !== 'undefined' ? navigator.language : 'en';
};

/** Format a date as a short locale-aware date, or '' for empty input. */
export const formatDate = (value?: string | number | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(getLocaleTag());
};

/** Format a date as a locale-aware date+time, or '' for empty input. */
export const formatDateTime = (value?: string | number | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(getLocaleTag());
};

import { FormEvent, useState } from 'react';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';
import type { SavedView } from '../hooks/useSavedViews';

interface SavedViewsBarProps {
  views: SavedView[];
  onSave: (name: string) => boolean;
  onApply: (filters: Record<string, string>) => void;
  onDelete: (id: string) => void;
  /** Current filter values — used to disable "save" when no filter is active. */
  hasActiveFilters: boolean;
}

/**
 * Toolbar for named saved views on list pages.
 *
 * Shows chips for stored filter combinations (apply/delete) plus a compact
 * "save current view" form. The caller owns the storage (useSavedViews) and
 * the filter application logic, so this component stays presentational.
 */
export const SavedViewsBar: React.FC<SavedViewsBarProps> = ({ views, onSave, onApply, onDelete, hasActiveFilters }) => {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (!onSave(name)) {
      setError(t('savedViews.nameRequired'));
      return;
    }
    setName('');
    setError('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-5">
      <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
        {t('savedViews.title')}
      </span>
      {views.map((view) => (
        <span
          key={view.id}
          className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-3 pr-1 py-0.5 text-sm text-gray-700 dark:text-gray-200"
        >
          <button type="button" onClick={() => onApply(view.filters)} className="hover:text-primary-600 dark:hover:text-primary-300">
            {view.name}
          </button>
          <button
            type="button"
            onClick={() => onDelete(view.id)}
            aria-label={`${t('common.delete')}: ${view.name}`}
            className="rounded-full p-0.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            ×
          </button>
        </span>
      ))}
      <form onSubmit={handleSave} className="ml-auto flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('savedViews.namePlaceholder')}
          aria-label={t('savedViews.namePlaceholder')}
          disabled={!hasActiveFilters}
          className="w-44 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={!hasActiveFilters}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('savedViews.save')}
        </button>
        {error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </form>
    </div>
  );
};

export default SavedViewsBar;

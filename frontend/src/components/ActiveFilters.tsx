import { XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';

export interface FilterChip {
  /** Stable identifier for the filter value. */
  value: string;
  /** i18n key or label for the chip text. */
  label: string;
  /** Called when the user removes this chip. */
  onRemove: () => void;
}

interface ActiveFiltersProps {
  chips: FilterChip[];
  /** i18n key for the section heading (optional). */
  labelKey?: string;
  /** i18n key for the "clear all" action (optional). */
  clearAllKey?: string;
  /**
   * Called when the user wants to reset the whole view (filters + sort + column
   * order). Renders a secondary "clear view" control next to "clear all".
   */
  onClearView?: () => void;
}

/**
 * Renders active filters as removable chips with an optional "clear all" action.
 */
export const ActiveFilters: React.FC<ActiveFiltersProps> = ({
  chips,
  labelKey,
  clearAllKey,
  onClearView,
}) => {
  const { t } = useI18n();

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {labelKey ? (
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t(labelKey)}
        </span>
      ) : null}
      {chips.map((chip) => (
        <span
          key={chip.value}
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={t(clearAllKey ?? 'common.dismiss')}
            className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            <XMarkIcon aria-hidden="true" className="h-3 w-3" />
          </button>
        </span>
      ))}
      {clearAllKey ? (
        <button
          type="button"
          onClick={() => chips.forEach((chip) => chip.onRemove())}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none dark:text-gray-400 dark:hover:text-gray-200"
        >
          {t(clearAllKey)}
        </button>
      ) : null}
      {onClearView ? (
        <button
          type="button"
          onClick={onClearView}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none dark:text-gray-400 dark:hover:text-gray-200"
        >
          {t('common.clearView')}
        </button>
      ) : null}
    </div>
  );
};

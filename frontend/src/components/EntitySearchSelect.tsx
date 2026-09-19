import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../context/I18nContext';

interface EntityOption {
  id: string;
  label: string;
}

interface SearchResponse {
  data?: any[];
  items?: any[];
  results?: any[];
  [key: string]: any;
}

interface EntitySearchSelectProps {
  label: string;
  searchEndpoint: (query: string) => Promise<SearchResponse | any[]>;
  value?: EntityOption | null;
  values?: EntityOption[];
  onChange?: (value: EntityOption) => void;
  onValuesChange?: (values: EntityOption[]) => void;
  multiple?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Optional error message surfaced to assistive technology via aria-describedby. */
  errorMessage?: string;
}
const EntitySearchSelect: React.FC<EntitySearchSelectProps> = ({
  label,
  searchEndpoint,
  value,
  values = [],
  onChange,
  onValuesChange,
  multiple = false,
  placeholder = 'Search...',
  emptyMessage = 'No results found',
  disabled = false,
  errorMessage,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 20;
  const DEBOUNCE_MS = 300;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset active index when options or open state change
  useEffect(() => {
    setActiveIndex(null);
  }, [options, isOpen]);

  // Load options based on query
  const loadOptions = useCallback(async (searchQuery: string, pageNum: number) => {
    setLoading(true);
    try {
      const rawResults = await searchEndpoint(searchQuery);
      const dataArray = Array.isArray(rawResults) ? rawResults : (rawResults?.data ?? rawResults?.items ?? rawResults?.results ?? []);
      const items: EntityOption[] = dataArray.map((item: any) => ({
        id: item.id,
        label: item.displayId ? `${item.displayId} - ${item.name || item.title || ''}` : (item.name || item.title || item.email || String(item)),
      }));

      if (pageNum === 1) {
        setOptions(items);
      } else {
        setOptions(prev => [...prev, ...items]);
      }
      setHasMore(items.length >= PAGE_SIZE);
    } catch {
      if (pageNum === 1) setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [searchEndpoint]);

  // Debounced search
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setPage(1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadOptions(newQuery, 1);
    }, DEBOUNCE_MS);
  }, [loadOptions]);

  // Load more on scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 100 && hasMore && !loading) {
      setPage(prev => {
        const nextPage = prev + 1;
        loadOptions(query, nextPage);
        return nextPage;
      });
    }
  }, [query, loading, hasMore, loadOptions]);

  const closeAndFocus = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(null);
    inputRef.current?.focus();
  }, []);

  // Select option
  const handleSelect = useCallback((option: EntityOption) => {
    if (multiple && onValuesChange) {
      const newValues = values.some(v => v.id === option.id)
        ? values.filter(v => v.id !== option.id)
        : [...values, option];
      onValuesChange(newValues);
    } else if (!multiple && onChange) {
      onChange(option);
      closeAndFocus();
      setQuery('');
    }
  }, [multiple, onChange, onValuesChange, values, closeAndFocus]);

  // Remove selected value (multi-select)
  const handleRemove = useCallback((id: string) => {
    if (onValuesChange) {
      onValuesChange(values.filter(v => v.id !== id));
    }
  }, [onValuesChange, values]);

  // Filter available options (exclude already selected in multi mode)
  const availableOptions = multiple
    ? options.filter(o => !values.some(v => v.id === o.id))
    : options;

  // Keyboard navigation for the combobox
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev === null ? 0 : Math.min(prev + 1, availableOptions.length - 1);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => {
          const next = prev === null ? (availableOptions.length - 1) : Math.max(prev - 1, 0);
          return next;
        });
        break;
      case 'Enter':
        if (activeIndex !== null && activeIndex >= 0 && activeIndex < availableOptions.length) {
          e.preventDefault();
          handleSelect(availableOptions[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeAndFocus();
        break;
      case 'Tab':
        closeAndFocus();
        break;
      default:
        break;
    }
  }, [isOpen, activeIndex, availableOptions, handleSelect, closeAndFocus]);

  // Focus the active option when it changes
  useEffect(() => {
    if (!listRef.current) return;
    if (activeIndex === null) return;
    const optionEl = listRef.current.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`);
    optionEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>

      {/* Selected values display for multi-select */}
      {multiple && values.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2" role="list" aria-label={label}>
          {values.map(v => (
            <span
              key={v.id}
              role="listitem"
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200"
            >
              {v.label}
              <button
                type="button"
                role="listitem"
                onClick={() => handleRemove(v.id)}
                aria-label={`${v.label} ${t('common.removeFilter')}`}
                className="ml-1 hover:text-red-600 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-full"
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="es-listbox"
          aria-activedescendant={activeIndex !== null ? `es-option-${activeIndex}` : undefined}
          aria-describedby={errorMessage ? 'es-error' : undefined}
          value={query}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={multiple ? placeholder : (value?.label || placeholder)}
          className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 ${errorMessage ? 'border-danger-500 dark:border-danger-600' : ''}`}
          disabled={disabled}
        />

        {/* Loading spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          </div>
        )}
      </div>

      {errorMessage && (
        <p id="es-error" className="mt-1 text-xs text-danger-600 dark:text-danger-400" aria-hidden="true">{errorMessage}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listboxRef}
          id="es-listbox"
          role="listbox"
          aria-label={label}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden"
        >
          <div ref={listRef} onScroll={handleScroll} className="overflow-y-auto max-h-52">
            {availableOptions.length === 0 && !loading ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400" role="option" aria-selected={false}>{emptyMessage}</div>
            ) : (
              availableOptions.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  id={`es-option-${index}`}
                  data-option-index={index}
                  aria-selected={activeIndex === index}
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 ${
                    activeIndex === index
                      ? 'bg-primary-600 text-white'
                      : (!multiple && value?.id === option.id) || (multiple && values.some(v => v.id === option.id))
                        ? 'bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-200'
                        : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
          {hasMore && !loading && (
            <div className="px-3 py-1 text-xs text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700" aria-hidden="true">
              {t('common.scrollForMore')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EntitySearchSelect;

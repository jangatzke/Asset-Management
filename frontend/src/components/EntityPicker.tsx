import { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '../context/I18nContext';
import { fetchEntities, type EntityType, type EntityPickerResult } from '../services/entityPickerApi';

interface EntityPickerProps {
  label?: string;
  labelKey: string;                    // i18n key for the label (e.g., "ismsOperations.fields.ownerId")
  entityType: EntityType;              // Type of entity to search
  value?: EntityPickerResult | null;   // Single select value
  values?: EntityPickerResult[];       // Multi-select values
  onChange?: (value: EntityPickerResult) => void;   // Single select handler
  onValuesChange?: (values: EntityPickerResult[]) => void; // Multi-select handler
  multiple?: boolean;                  // Enable multi-select
  placeholderKey?: string;             // i18n key for placeholder
  required?: boolean;                  // Show required indicator
  disabled?: boolean;                  // Disable picker
  className?: string;                  // Additional CSS classes
}

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/**
 * EntityPicker - Reusable component for entity selection with search, pagination, multi-select.
 * Replaces raw UUID inputs in normal user workflows.
 */
const EntityPicker: React.FC<EntityPickerProps> = ({
  labelKey,
  label,
  entityType,
  value,
  values = [],
  onChange,
  onValuesChange,
  multiple = false,
  placeholderKey,
  required = false,
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<EntityPickerResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load options based on query
  const loadOptions = useCallback(async (searchQuery: string, pageNum: number) => {
    if (!searchQuery || searchQuery.length < 1) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchEntities(entityType, searchQuery, pageNum, PAGE_SIZE);

      if (pageNum === 1) {
        setOptions(result.items);
      } else {
        setOptions(prev => [...prev, ...result.items]);
      }
      setHasMore(result.hasMore);
    } catch {
      if (pageNum === 1) setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

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

  // Select option
  const handleSelect = useCallback((option: EntityPickerResult) => {
    if (multiple && onValuesChange) {
      const newValues = values.some(v => v.id === option.id)
        ? values.filter(v => v.id !== option.id)
        : [...values, option];
      onValuesChange(newValues);
    } else if (!multiple && onChange) {
      onChange(option);
      setIsOpen(false);
      setQuery('');
    }
  }, [multiple, onChange, onValuesChange, values]);

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

  // Keyboard navigation: keep the highlighted index in range and reset it
  // whenever the option list or open state changes.
  useEffect(() => {
    setActiveIndex((current) => (current >= availableOptions.length ? availableOptions.length - 1 : current));
  }, [availableOptions.length]);

  useEffect(() => {
    if (!isOpen) setActiveIndex(-1);
  }, [isOpen]);

  const keepActiveVisible = useCallback((nextIndex: number) => {
    const optionEl = listRef.current?.querySelector(`[data-option-index="${nextIndex}"]`) as HTMLElement | null;
    optionEl?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (availableOptions.length === 0) return;
        const next = activeIndex < 0 ? 0 : (activeIndex + 1) % availableOptions.length;
        setActiveIndex(next);
        keepActiveVisible(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (availableOptions.length === 0) return;
        const next = activeIndex <= 0 ? availableOptions.length - 1 : activeIndex - 1;
        setActiveIndex(next);
        keepActiveVisible(next);
        break;
      }
      case 'Enter': {
        if (isOpen && activeIndex >= 0 && availableOptions[activeIndex]) {
          e.preventDefault();
          handleSelect(availableOptions[activeIndex]);
          setActiveIndex(-1);
        }
        break;
      }
      case 'Escape': {
        if (isOpen) {
          e.stopPropagation();
          setIsOpen(false);
          setActiveIndex(-1);
        }
        break;
      }
      default:
        break;
    }
  }, [activeIndex, availableOptions, handleSelect, isOpen, keepActiveVisible]);

  const resolvedLabel = label ?? t(labelKey);
  const placeholder = placeholderKey ? t(placeholderKey) : t('entityPicker.searchPlaceholder');

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {resolvedLabel}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Selected values display for multi-select */}
      {multiple && values.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {values.map(v => (
            <span
              key={v.id}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200"
            >
              {v.label}
              <button
                type="button"
                onClick={() => handleRemove(v.id)}
                className="ml-1 hover:text-red-600 dark:hover:text-red-400 focus:outline-none"
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
          value={query}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={multiple ? placeholder : (value?.label || placeholder)}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 && availableOptions[activeIndex] ? `entity-picker-option-${availableOptions[activeIndex].id}` : undefined}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          disabled={disabled}
        />

        {/* Loading spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div ref={listRef} onScroll={handleScroll} role="listbox" className="overflow-y-auto max-h-52">
            {availableOptions.length === 0 && !loading ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('entityPicker.empty')}</div>
            ) : (
              availableOptions.map((option, index) => (
                <button
                  key={option.id}
                  id={`entity-picker-option-${option.id}`}
                  data-option-index={index}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    index === activeIndex
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${
                    (!multiple && value?.id === option.id) || (multiple && values.some(v => v.id === option.id))
                      ? 'bg-blue-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
          {hasMore && !loading && (
            <div className="px-3 py-1 text-xs text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              {t('entityPicker.scrollForMore')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EntityPicker;

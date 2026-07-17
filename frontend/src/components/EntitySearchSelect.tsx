import { useState, useRef, useEffect, useCallback } from 'react';

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
}) => {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAGE_SIZE = 20;
  const DEBOUNCE_MS = 300;

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

  // Select option
  const handleSelect = useCallback((option: EntityOption) => {
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

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>

      {/* Selected values display for multi-select */}
      {multiple && values.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {values.map(v => (
            <span
              key={v.id}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
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
          type="text"
          value={query}
          onChange={handleSearch}
          onFocus={() => setIsOpen(true)}
          placeholder={multiple ? placeholder : (value?.label || placeholder)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={disabled}
        />

        {/* Loading spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div ref={listRef} onScroll={handleScroll} className="overflow-y-auto max-h-52">
            {availableOptions.length === 0 && !loading ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</div>
            ) : (
              availableOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    (!multiple && value?.id === option.id) || (multiple && values.some(v => v.id === option.id))
                      ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
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
              Scroll for more...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EntitySearchSelect;

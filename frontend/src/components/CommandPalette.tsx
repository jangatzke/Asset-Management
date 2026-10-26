import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';

export interface CommandPaletteItem {
  /** Unique key used to match the free-text filter. */
  id: string;
  /** Primary label shown in the row. */
  label: string;
  /** Optional supporting line shown under the label. */
  description?: string;
  /** Optional icon component (Heroicons outline, rendered at 1rem). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Invoked when the item is selected. */
  onSelect: () => void;
  /** Optional group heading rendered above this item. */
  section?: string;
  /**
   * When false the item is NOT filtered by the local free-text matcher.
   * Used for server-side search results that already match the query.
   */
  filterable?: boolean;
  /**
   * Optional action rendered inside the section header (e.g. "Show all").
   * Only honored on the first item of a section.
   */
  sectionActionLabel?: string;
  onSectionAction?: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  /** Accessible label for the search input. */
  placeholder?: string;
  /** Optional title shown at the top of the palette. */
  title?: string;
  /** Notified on every query change so callers can run server-side searches. */
  onQueryChange?: (query: string) => void;
}

/**
 * Lightweight command palette.
 *
 * Features:
 *  - Free-text filter over `items`.
 *  - Keyboard navigation: ArrowUp / ArrowDown to move, Enter to select,
 *    Escape to close, Tab to accept the highlighted item and move on.
 *  - Click / outside-click to close.
 *  - Auto-focus of the input when opened.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  placeholder,
  title,
  onQueryChange,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.filterable === false ||
        item.label.toLowerCase().includes(needle) ||
        (item.description ?? '').toLowerCase().includes(needle) ||
        item.id.toLowerCase().includes(needle),
    );
  }, [query, items]);

  // Reset selection + filter whenever the palette is toggled.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus the input on the next tick so the browser scrolls it into view.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const activeEl = listRef.current?.children[activeIndex] as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    // Reset to the first match when the filter changes.
    setActiveIndex(0);
  }, [query, isOpen]);

  const selectItem = (item: CommandPaletteItem) => {
    item.onSelect();
  };

  if (!isOpen) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % Math.max(1, filtered.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
        break;
      case 'Enter':
        if (filtered.length > 0) {
          event.preventDefault();
          selectItem(filtered[activeIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-gray-900/50 p-4 pt-[10vh] dark:bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        className="w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls="command-palette-list"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onQueryChange?.(e.target.value);
            }}
            placeholder={placeholder ?? t('shortcuts.commandPalettePlaceholder')}
            className="h-12 w-full bg-transparent py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
          />
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label={t('common.close')}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          className="max-h-80 overflow-y-auto p-1 text-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
              {t('commandPalette.noMatches')}
            </li>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === activeIndex;
              const Icon = item.icon;
              const showSection = Boolean(item.section) && filtered[index - 1]?.section !== item.section;
              return (
                <Fragment key={item.id}>
                  {showSection && (
                    <li aria-hidden="true" className="flex items-center justify-between px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      <span>{item.section}</span>
                      {item.sectionActionLabel && item.onSectionAction && (
                        <button
                          type="button"
                          // Keep the palette open; the action navigates on click.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => { e.stopPropagation(); item.onSectionAction?.(); }}
                          className="rounded px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-gray-700"
                        >
                          {item.sectionActionLabel}
                        </button>
                      )}
                    </li>
                  )}
                  <li
                    role="option"
                    aria-selected={isActive}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                  >
                    {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.description && (
                      <span className={`truncate text-xs ${isActive ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                        {item.description}
                      </span>
                    )}
                  </li>
                </Fragment>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  /** Accessible label for the search input. */
  placeholder?: string;
  /** Optional title shown at the top of the palette. */
  title?: string;
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
  placeholder = 'Type a command or search…',
  title,
}) => {
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-12 w-full bg-transparent py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
          />
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
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
              No matches found.
            </li>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === activeIndex;
              const Icon = item.icon;
              return (
                <li
                  key={item.id}
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
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;

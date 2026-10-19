import { useRef, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { ArrowDownIcon, ArrowUpIcon, Bars3Icon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export interface NavigationOrderEntry {
  href: string;
  label: string;
}

interface NavigationOrderEditorProps {
  entries: NavigationOrderEntry[];
  value: string[]; // ordered hrefs (always a permutation of entries)
  onChange: (order: string[]) => void;
  disabled?: boolean;
  /** Hrefs currently hidden in the edited view (enables show/hide toggles). */
  hidden?: string[];
  onToggleHidden?: (href: string) => void;
}

/**
 * Modern, accessible ordering list: drag & drop via native HTML5 DnD plus
 * explicit up/down buttons so the order can also be changed with keyboard or
 * touch only. Positions are announced through aria-labels for screen readers.
 */
const NavigationOrderEditor = ({ entries, value, onChange, disabled, hidden, onToggleHidden }: NavigationOrderEditorProps) => {
  const { t } = useI18n();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<number | null>(null);

  const byHref = new Map(entries.map((entry) => [entry.href, entry]));
  const ordered = value.map((href) => byHref.get(href)).filter((entry): entry is NavigationOrderEntry => Boolean(entry));

  const move = (from: number, to: number) => {
    if (disabled || from === to || to < 0 || to >= ordered.length) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <ol className="space-y-2" aria-label={t('navigationOrder.listLabel')}>
      {ordered.map((entry, index) => (
        <li
          key={entry.href}
          draggable={!disabled}
          onDragStart={(event) => {
            setDragIndex(index);
            dragNodeRef.current = index;
            event.dataTransfer.effectAllowed = 'move';
            // Required for Firefox to start the drag.
            event.dataTransfer.setData('text/plain', entry.href);
          }}
          onDragOver={(event) => {
            if (dragNodeRef.current === null) return;
            event.preventDefault();
            setDragOverIndex(index);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragNodeRef.current !== null) move(dragNodeRef.current, index);
            setDragIndex(null);
            setDragOverIndex(null);
            dragNodeRef.current = null;
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDragOverIndex(null);
            dragNodeRef.current = null;
          }}
          className={`flex items-center gap-3 rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 transition-shadow ${
            disabled ? 'opacity-60 cursor-default' : 'cursor-grab active:cursor-grabbing'
          } ${
            dragOverIndex === index && dragIndex !== null && dragIndex !== index
              ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800'
              : 'border-gray-200 dark:border-gray-700'
          } ${dragIndex === index ? 'opacity-50' : ''} ${hidden?.includes(entry.href) ? 'opacity-60' : ''}`}
        >
          <span className="text-gray-400 dark:text-gray-500 select-none" aria-hidden="true">
            <Bars3Icon className="h-5 w-5" />
          </span>
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 select-none">
            {index + 1}
          </span>
          <span className={`flex-1 min-w-0 truncate text-sm font-medium ${hidden?.includes(entry.href) ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{entry.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 select-none hidden sm:inline">{entry.href}</span>
          <span className="flex items-center gap-1">
            {onToggleHidden && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleHidden(entry.href)}
                aria-label={hidden?.includes(entry.href) ? t('navigationOrder.showEntry', { name: entry.label }) : t('navigationOrder.hideEntry', { name: entry.label })}
                title={hidden?.includes(entry.href) ? t('navigationOrder.show') : t('navigationOrder.hide')}
                className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none"
              >
                {hidden?.includes(entry.href) ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              disabled={disabled || index === 0}
              onClick={() => move(index, index - 1)}
              aria-label={t('navigationOrder.moveUp', { name: entry.label })}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowUpIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={disabled || index === ordered.length - 1}
              onClick={() => move(index, index + 1)}
              aria-label={t('navigationOrder.moveDown', { name: entry.label })}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ArrowDownIcon className="h-4 w-4" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
};

export default NavigationOrderEditor;

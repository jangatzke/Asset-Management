import { ReactNode, useEffect, useState } from 'react';
import { AdjustmentsHorizontalIcon, ArrowDownTrayIcon, ChevronDownIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';

export type TableDensity = 'comfortable' | 'compact';

export interface DataTableColumn {
  key: string;
  label: string;
  hideable?: boolean;
}

interface DataTableShellProps {
  children: ReactNode;
  toolbar?: ReactNode;
  filters?: ReactNode;
  defaultFiltersOpen?: boolean;
  filterLabel?: string;
  exportLabel?: string;
  onExport?: () => void;
  columns?: DataTableColumn[];
  visibleColumns?: string[];
  onVisibleColumnsChange?: (columns: string[]) => void;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  className?: string;
}

/**
 * Canonical Tailwind data-table container.
 *
 * The parent owns filtering, exports, and persisted view preferences; this
 * component only provides a consistent, accessible toolbar and rounded table
 * surface for all non-MUI list views.
 */
export const DataTableShell: React.FC<DataTableShellProps> = ({
  children,
  toolbar,
  filters,
  defaultFiltersOpen = false,
  filterLabel = 'Filters',
  exportLabel = 'Export CSV',
  onExport,
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  density,
  onDensityChange,
  className = '',
}) => {
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);

  useEffect(() => {
    if (!filters) setFiltersOpen(false);
  }, [filters]);

  const toggleColumn = (key: string) => {
    if (!visibleColumns || !onVisibleColumnsChange) return;
    onVisibleColumnsChange(visibleColumns.includes(key)
      ? visibleColumns.filter((column) => column !== key)
      : [...visibleColumns, key]);
  };

  return (
    <section data-table-density={density} className={`data-table-shell overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800 ${className}`}>
      {(toolbar || filters || onExport || (columns && visibleColumns && onVisibleColumnsChange) || (density && onDensityChange)) && (
        <div className="border-b border-gray-200 px-4 py-2.5 dark:border-gray-700 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {toolbar && <div className="min-w-0 flex-1">{toolbar}</div>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {filters && <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />{filterLabel}<ChevronDownIcon className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></button>}
              {columns && visibleColumns && onVisibleColumnsChange && <div className="relative"><button type="button" onClick={() => setColumnsOpen((open) => !open)} aria-expanded={columnsOpen} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><ViewColumnsIcon className="h-4 w-4" aria-hidden="true" />Columns</button>{columnsOpen && <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">{columns.filter((column) => column.hideable !== false).map((column) => <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"><input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />{column.label}</label>)}</div>}</div>}
              {density && onDensityChange && <div className="relative"><button type="button" onClick={() => setDensityOpen((open) => !open)} aria-expanded={densityOpen} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">{density === 'compact' ? 'Compact' : 'Comfortable'}</button>{densityOpen && <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">{(['comfortable', 'compact'] as const).map((option) => <button type="button" key={option} onClick={() => { onDensityChange(option); setDensityOpen(false); }} className="block w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">{option === 'compact' ? 'Compact' : 'Comfortable'}</button>)}</div>}</div>}
              {onExport && <button type="button" onClick={onExport} className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"><ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />{exportLabel}</button>}
            </div>
          </div>
          {filtersOpen && filters && <div className="mt-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900/40">{filters}</div>}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
};

export default DataTableShell;

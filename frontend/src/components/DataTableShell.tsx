import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AdjustmentsHorizontalIcon, ArrowDownTrayIcon, ChevronDownIcon, ViewColumnsIcon } from '@heroicons/react/24/outline';
import { SkeletonTable } from './SkeletonTable';
import { useDensity } from '../context/DensityContext';

export type TableDensity = 'comfortable' | 'compact';

/* --- Density/a11y helpers (Stage 7 / MT-3, global scope Stage 10b / LT-3) --
 * The shell owns the effective density; pages render their own <table> and
 * need the matching cell classes without threading props through every layer.
 * Resolution order: explicit `density` prop on the shell > local toolbar
 * override > global DensityProvider preference (LT-3) > comfortable default.
 * Both paths (hook + pure helpers) return identical class strings. */

/** Cell padding per density: comfortable = px-4 py-3, compact = px-4 py-2. */
// eslint-disable-next-line react-refresh/only-export-components -- Shared class helper must stay colocated with the table shell helpers.
export const tableCellClass = (density: TableDensity): string =>
  `px-4 ${density === 'compact' ? 'py-2' : 'py-3'} text-body2`;

/** Head-cell classes: caption typography on the sunken header surface. */
// eslint-disable-next-line react-refresh/only-export-components -- Shared class helper must stay colocated with the table shell helpers.
export const tableHeadCellClass = (options?: { sticky?: boolean }): string =>
  `px-4 py-2.5 text-left text-caption font-semibold text-text-muted${
    options?.sticky ? ' sticky top-0 z-10 bg-surface-sunken' : ''
  }`;

/**
 * Row/list-item padding per density (Stage 10b / LT-3). Use on list rows,
 * panel list items or similar repeated surfaces so the global density toggle
 * has a subtle effect outside of tables too — horizontal padding stays stable.
 */
// eslint-disable-next-line react-refresh/only-export-components -- Shared class helper must stay colocated with the table shell helpers.
export const densityRowClass = (density: TableDensity): string =>
  `px-4 ${density === 'compact' ? 'py-2' : 'py-3'}`;

interface TableShellContextValue {
  density: TableDensity;
  stickyHeader: boolean;
  caption?: ReactNode;
}

const TableShellContext = createContext<TableShellContextValue | null>(null);

/** Read the density/sticky/caption configuration of the surrounding DataTableShell. */
// eslint-disable-next-line react-refresh/only-export-components -- Context hook must remain exported with its provider for stable imports.
export const useTableShell = (): TableShellContextValue =>
  useContext(TableShellContext) ?? { density: 'comfortable', stickyHeader: false };

/**
 * Convenience hook: effective density. Inside a DataTableShell this is the
 * shell's resolved value (explicit prop > local override > global preference);
 * outside any shell it falls back to the global DensityProvider preference,
 * which itself defaults to `comfortable` without a provider (LT-3).
 */
// eslint-disable-next-line react-refresh/only-export-components -- Context hook must remain exported with its provider for stable imports.
export const useTableDensity = (): TableDensity => {
  const shell = useContext(TableShellContext);
  const global = useDensity();
  return shell?.density ?? global.density;
};

/**
 * Render inside a page's <table> (first child) to surface the shell's sr-only
 * caption for screen readers. Returns null when no caption was configured.
 */
export const TableCaption: React.FC = () => {
  const { caption } = useTableShell();
  if (!caption) return null;
  return <caption className="sr-only">{caption}</caption>;
};

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
  rowCount?: number;
  densityLabel?: string;
  compactLabel?: string;
  comfortableLabel?: string;
  columnsLabel?: string;
  className?: string;
  /** Show the SkeletonTable loader (same column count) instead of children. */
  loading?: boolean;
  /** Rows rendered by the skeleton while `loading` is true. Default 8. */
  skeletonRows?: number;
  /** Placeholder when there is no data (e.g. an EmptyState). */
  empty?: ReactNode;
  /** Sticky table header (`sticky top-0 z-10 bg-surface-sunken`) for pages using the helpers. */
  stickyHeader?: boolean;
  /** Styling hint that the last column holds row actions. */
  actionsColumn?: boolean;
  /** Screen-reader caption for the enclosed table (rendered via TableCaption). */
  caption?: ReactNode;
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
  rowCount = 0,
  densityLabel = 'Density',
  compactLabel = 'Compact',
  comfortableLabel = 'Comfortable',
  columnsLabel = 'Columns',
  className = '',
  loading = false,
  skeletonRows = 8,
  empty,
  stickyHeader = false,
  actionsColumn = false,
  caption,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [densityOpen, setDensityOpen] = useState(false);
  const [selectedDensity, setSelectedDensity] = useState<TableDensity | null>(null);
  // LT-3: an explicit prop or the shell's own toolbar choice wins; otherwise
  // follow the user's globally persisted density preference.
  const globalDensity = useDensity().density;
  const effectiveDensity = density ?? selectedDensity ?? globalDensity;

  useEffect(() => {
    if (!filters) setFiltersOpen(false);
  }, [filters]);

  const toggleColumn = (key: string) => {
    if (!visibleColumns || !onVisibleColumnsChange) return;
    onVisibleColumnsChange(visibleColumns.includes(key)
      ? visibleColumns.filter((column) => column !== key)
      : [...visibleColumns, key]);
  };

  const contextValue: TableShellContextValue = {
    density: effectiveDensity,
    stickyHeader,
    caption,
  };

  return (
    <TableShellContext.Provider value={contextValue}>
    <section data-table-density={effectiveDensity} data-actions-column={actionsColumn || undefined} className={`data-table-shell overflow-hidden rounded-lg border border-border-subtle bg-surface-default shadow-e1 ${className}`}>
      {(toolbar || filters || onExport || (columns && visibleColumns && onVisibleColumnsChange) || rowCount > 0 || (density && onDensityChange)) && (
        <div className="border-b border-border-subtle bg-surface-sunken px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {toolbar && <div className="min-w-0 flex-1">{toolbar}</div>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {filters && <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-hover outline-focus-ring"><AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />{filterLabel}<ChevronDownIcon className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden="true" /></button>}
              {columns && visibleColumns && onVisibleColumnsChange && <div className="relative"><button type="button" onClick={() => setColumnsOpen((open) => !open)} aria-expanded={columnsOpen} className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-hover outline-focus-ring"><ViewColumnsIcon className="h-4 w-4" aria-hidden="true" />{columnsLabel}</button>{columnsOpen && <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border-subtle bg-surface-raised p-2 shadow-e3">{columns.filter((column) => column.hideable !== false).map((column) => <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary transition-colors duration-fast hover:bg-surface-hover"><input type="checkbox" checked={visibleColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />{column.label}</label>)}</div>}</div>}
              <div className="relative"><button type="button" onClick={() => setDensityOpen((open) => !open)} aria-expanded={densityOpen} className="inline-flex min-h-[2rem] items-center rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors duration-fast hover:bg-surface-hover outline-focus-ring">{densityLabel}: {effectiveDensity === 'compact' ? compactLabel : comfortableLabel}</button>{densityOpen && <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-border-subtle bg-surface-raised p-1 shadow-e3">{(['comfortable', 'compact'] as const).map((option) => <button type="button" key={option} onClick={() => { if (onDensityChange) onDensityChange(option); else setSelectedDensity(option); setDensityOpen(false); }} className="block w-full rounded px-2 py-1.5 text-left text-sm text-text-secondary transition-colors duration-fast hover:bg-surface-hover">{option === 'compact' ? compactLabel : comfortableLabel}</button>)}</div>}</div>
              {onExport && <button type="button" onClick={onExport} className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-md bg-primary-600 px-2.5 py-1.5 text-sm font-medium text-white transition-colors duration-fast hover:bg-primary-700 outline-focus-ring"><ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />{exportLabel}</button>}
            </div>
          </div>
          {filtersOpen && filters && <div className="mt-2 rounded-md bg-surface-sunken p-3">{filters}</div>}
        </div>
      )}
      <div className="overflow-x-auto">
        {loading ? (
          <table className="min-w-full divide-y divide-border-subtle" aria-busy="true">
            <SkeletonTable columns={columns?.length ?? 5} rows={skeletonRows} />
          </table>
        ) : empty ? (
          <div className="p-4">{empty}</div>
        ) : (
          children
        )}
      </div>
    </section>
    </TableShellContext.Provider>
  );
};

export default DataTableShell;

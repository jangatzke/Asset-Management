import { ReactNode } from 'react';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';

/**
 * Shared sortable data-table column header.
 *
 * Renders the canonical ticket-list header style (small uppercase label with a
 * chevron sort indicator) so every data table in the app looks identical. The
 * header is a `<button>` for keyboard/pointer accessibility and exposes the
 * standard sort affordances:
 *
 * - Clicking toggles asc -> desc -> asc (no sort) when the column already has a
 *   direction, or starts sorting a fresh column in ascending order.
 * - The active column is highlighted and shows the chevron; inactive columns
 *   show no indicator.
 *
 * The component is intentionally presentational: callers own the sort state via
 * `usePersistedView` (URL + localStorage) or `useLocalSort` (localStorage only).
 */
export interface SortableThProps {
  /** Sort key for this column. */
  column: string;
  /** Accessible label rendered in the header. */
  label: string;
  /** Column currently being sorted (empty string = unsorted). */
  activeColumn: string;
  /** Sort direction of the active column. */
  direction?: 'asc' | 'desc' | '';
  /** Called when the header is activated. */
  onSort: (column: string) => void;
  /**
   * Optional extra content rendered before the sort indicator (e.g. a value or a
   * custom icon such as the StatusBadge pill). Rendered only when the column is
   * active so it stays aligned with the arrow; pass the same value for every
   * call to keep column widths stable.
   */
  children?: ReactNode;
  /**
   * Optional content rendered after the label and before the sort indicator.
   * Used to inject a pill/badge (e.g. StatusBadge) so its sort arrow sits inside
   * the badge. Rendered only when the column is active.
   */
  indicator?: ReactNode;
  /** Optional extra class applied to the header. */
  className?: string;
}

const activeClass = 'text-blue-700 dark:text-blue-300';
const arrowClass = 'inline h-4 w-4';

export const SortableTh: React.FC<SortableThProps> = ({
  column,
  label,
  activeColumn,
  direction = '',
  onSort,
  children,
  indicator,
  className = '',
}) => {
  const isActive = activeColumn === column && column !== '';
  const arrowVisible = isActive && direction !== '';

  return (
    <th
      scope="col"
      className={[
        'cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white',
        isActive ? activeClass : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex w-full items-center gap-1 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1 -ml-1"
        aria-current={isActive ? true : undefined}
        aria-sort={
          isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {children}
          {indicator}
        </span>
        {arrowVisible && (
          <ChevronUpDownIcon
            className={`${arrowClass} transition-transform ${direction === 'asc' ? 'rotate-180' : ''}`}
            aria-hidden
          />
        )}
      </button>
    </th>
  );
};

export default SortableTh;

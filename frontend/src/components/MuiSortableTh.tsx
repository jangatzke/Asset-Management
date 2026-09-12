import { ReactNode } from 'react';
import { TableCell, TableSortLabel } from '@mui/material';

/**
 * MUI-compatible sortable data-table column header.
 *
 * Mirrors the plain-HTML `SortableTh` component but renders MUI's
 * `TableSortLabel` so it works inside MUI `<Table>`/`<TableCell>` rows
 * (Intune, Proxmox, VMware admin pages). It exposes the same canonical header
 * style and affordances:
 *
 * - Clicking toggles asc -> desc -> asc (no sort) when the column already has a
 *   direction, or starts sorting a fresh column in ascending order.
 * - The active column is highlighted and shows the sort arrow; inactive columns
 *   show no indicator.
 *
 * Presentational: callers own the sort state via `useLocalSort`.
 */
export interface MuiSortableThProps {
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
  /** Optional extra content rendered before the label. */
  children?: ReactNode;
  /** Optional extra class applied to the header cell. */
  className?: string;
}

export const MuiSortableTh: React.FC<MuiSortableThProps> = ({
  column,
  label,
  activeColumn,
  direction = '',
  onSort,
  children,
  className = '',
}) => {
  const isActive = activeColumn === column && column !== '';

  return (
    <TableCell
      className={[
        'cursor-pointer select-none text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white',
        className,
      ].filter(Boolean).join(' ')}
      onClick={() => onSort(column)}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <TableSortLabel
        active={isActive}
        direction={isActive && direction !== '' ? direction : 'asc'}
        onClick={(e) => {
          e.stopPropagation();
          onSort(column);
        }}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {label}
        </span>
      </TableSortLabel>
    </TableCell>
  );
};

export default MuiSortableTh;

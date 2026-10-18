interface SkeletonTableProps {
  /** Number of columns to render skeleton cells for. */
  columns: number;
  /** Number of skeleton rows. Defaults to 8. */
  rows?: number;
}

/**
 * Accessible table skeleton for list pages while data is loading.
 * Rendered inside an existing <table> so column widths stay stable and the
 * layout does not shift when real data arrives.
 */
export const SkeletonTable: React.FC<SkeletonTableProps> = ({ columns, rows = 8 }) => (
  <tbody className="divide-y divide-gray-200 dark:divide-gray-700" aria-hidden="true">
    {Array.from({ length: rows }, (_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: columns }, (_, columnIndex) => (
          <td key={columnIndex} className="px-4 py-4">
            <span
              className={`block h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${
                columnIndex === 0 ? 'w-16' : columnIndex === columns - 1 ? 'w-20' : 'w-32'
              }`}
            />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

export default SkeletonTable;

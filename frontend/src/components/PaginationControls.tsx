import { FormEvent, useState } from 'react';
import { useI18n } from '../context/I18nContext';

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Render page numbers around the current page with ellipsis for long ranges. */
function pageWindow(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: Array<number | 'ellipsis'> = [1];
  if (page > 3) pages.push('ellipsis');
  for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
  if (page < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

/**
 * Shared pagination footer for list pages: previous/next, a compact page
 * window, and a "jump to page" input so users of large lists do not have to
 * click through dozens of pages.
 */
export const PaginationControls: React.FC<PaginationControlsProps> = ({ page, totalPages, onPageChange }) => {
  const { t } = useI18n();
  const [jumpValue, setJumpValue] = useState('');

  if (totalPages <= 1) return null;

  const goTo = (target: number) => {
    const normalized = Math.min(Math.max(1, Math.floor(target)), totalPages);
    if (normalized !== page) onPageChange(normalized);
  };

  const handleJump = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseInt(jumpValue, 10);
    if (Number.isFinite(parsed)) goTo(parsed);
    setJumpValue('');
  };

  const navButton = 'px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <button onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label={t('common.back')} className={navButton}>
        {t('common.back')}
      </button>
      <nav aria-label={t('pagination.title')} className="flex items-center gap-1">
        <ul className="flex flex-wrap items-center gap-1">
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === 'ellipsis' ? (
              <li key={`ellipsis-${index}`} aria-hidden="true">
                <span className="px-2 py-1 text-sm text-gray-400">…</span>
              </li>
            ) : (
              <li key={entry}>
                <button
                  type="button"
                  onClick={() => goTo(entry)}
                  aria-current={entry === page ? 'page' : undefined}
                  aria-label={t('pagination.pageNumber', { page: String(entry) })}
                  className={`min-w-[2rem] px-3 py-1 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    entry === page
                      ? 'bg-primary-600 text-white border-primary-600 font-medium'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {entry}
                </button>
              </li>
            ),
          )}
        </ul>
        <span className="text-sm text-gray-500 dark:text-gray-400 px-2" aria-hidden="true">{page} / {totalPages}</span>
        <form onSubmit={handleJump} className="flex items-center gap-1 ml-2">
          <label htmlFor={`pagination-jump-${totalPages}`} className="text-sm text-gray-500 dark:text-gray-400">
            {t('pagination.goTo')}
          </label>
          <input
            id={`pagination-jump-${totalPages}`}
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={(e) => setJumpValue(e.target.value)}
            aria-label={t('pagination.jumpAriaLabel')}
            className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>
      </nav>
      <button onClick={() => goTo(page + 1)} disabled={page >= totalPages} aria-label={t('common.next')} className={navButton}>
        {t('common.next')}
      </button>
    </div>
  );
};

export default PaginationControls;

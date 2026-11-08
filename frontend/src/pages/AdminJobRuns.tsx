/**
 * Admin job-run history.
 *
 * Read-only view over the `JobRun` records written by `executeTrackedJob`. The
 * backend returns the locked `{ data, pagination }` envelope (and
 * `X-Total-Count`) and never exposes the raw job payload (`data` column); the
 * `error` text is already sanitized/truncated server-side. This page therefore
 * only renders what the API hands out and additionally shows the correlation
 * reference ID on failures via `formatApiError` + `ErrorAlert`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { jobRunsAdminApi, type JobRunListItem, type JobRunSummary, type JobRunListParams } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useAuthStore } from '../store/auth';
import { PaginationControls } from '../components/PaginationControls';
import { ErrorAlert } from '../components/ErrorAlert';
import { formatApiError } from '../utils/apiError';
import { ADMIN_ACCESS_PERMISSION } from '../utils/permissions';

const STATUS_OPTIONS = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
const WINDOW_OPTIONS = [6, 24, 72, 168, 720];
const LIMIT_OPTIONS = [10, 20, 50, 100];

interface FilterState {
  jobId: string;
  jobType: string;
  status: string;
  from: string;
  to: string;
  order: 'asc' | 'desc';
}

const EMPTY_FILTERS: FilterState = { jobId: '', jobType: '', status: '', from: '', to: '', order: 'desc' };

const statusClasses: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  skipped: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

const formatTimestamp = (value?: string | null, locale?: string) =>
  value ? new Date(value).toLocaleString(locale ?? 'en') : '—';

const durationLabel = (job: JobRunListItem) => {
  if (!job.startedAt || !job.finishedAt) return '—';
  const ms = new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
};

/** Normalize the filter form into the query params understood by the backend. */
function toQuery(filters: FilterState, page: number, limit: number): JobRunListParams {
  const params: JobRunListParams = { page, limit, order: filters.order };
  if (filters.jobId.trim()) params.jobId = filters.jobId.trim();
  if (filters.jobType.trim()) params.jobType = filters.jobType.trim();
  if (filters.status) params.status = filters.status;
  if (filters.from) params.from = new Date(filters.from).toISOString();
  if (filters.to) params.to = new Date(filters.to).toISOString();
  return params;
}

export default function AdminJobRuns() {
  const { t, language } = useI18n();
  const user = useAuthStore((state) => state.user);
  // Mirrors the Layout/KnowledgeBase fallback: sessions without a permission
  // list keep the UI open until the session refreshes. The backend still
  // enforces `requireAdminAccess` on every job-run route.
  const canAccessAdmin = !user?.permissions
    ? Boolean(user?.roles?.includes('system_admin'))
    : user.permissions.includes(ADMIN_ACCESS_PERMISSION);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<JobRunListItem[]>([]);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<JobRunSummary | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeFilters: FilterState, activePage: number, activeLimit: number, activeWindow: number) => {
    setLoading(true);
    setError(null);
    try {
      const [listResponse, summaryResponse] = await Promise.all([
        jobRunsAdminApi.list(toQuery(activeFilters, activePage, activeLimit)),
        jobRunsAdminApi.summary(activeWindow),
      ]);
      setRows(listResponse.data?.data ?? []);
      setPagination({
        total: listResponse.data?.pagination?.total ?? listResponse.data?.data?.length ?? 0,
        totalPages: Math.max(1, listResponse.data?.pagination?.totalPages ?? 1),
      });
      setSummary(summaryResponse.data ?? null);
    } catch (err: unknown) {
      setError(formatApiError(err, t('jobRuns.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // Hooks must run unconditionally, so the gate lives inside the effect:
    // unauthorized sessions must not call the admin-only endpoints at all.
    if (!canAccessAdmin) {
      setLoading(false);
      return;
    }
    void load(filters, page, limit, windowHours);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reload when the applied filters, pagination, summary window or access change.
  }, [filters, page, limit, windowHours, load, canAccessAdmin]);

  const applyFilters = () => {
    setPage(1);
    setFilters(draft);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setPage(1);
    setFilters(EMPTY_FILTERS);
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load(filters, page, limit, windowHours);
    } finally {
      setRefreshing(false);
    }
  };

  const summaryEntries = useMemo(
    () => STATUS_OPTIONS.map((status) => ({ status, count: summary?.statusCounts?.[status] ?? 0 })).filter((entry) => entry.count > 0),
    [summary],
  );

  if (!canAccessAdmin) {
    return (
      <div className="space-y-4" data-testid="admin-job-runs-page">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('jobRuns.title')}</h1>
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {t('jobRuns.noAccess')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-job-runs-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('jobRuns.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('jobRuns.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || loading}
          className="px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {refreshing ? t('jobRuns.refreshing') : t('jobRuns.refresh')}
        </button>
      </header>

      <ErrorAlert message={error} />

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800" aria-label={t('jobRuns.summaryTitle')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('jobRuns.summaryTitle')}</h2>
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.windowHours')}
            <select
              className="ml-2 rounded border p-1.5 bg-white dark:bg-gray-900 dark:border-gray-600"
              value={windowHours}
              onChange={(event) => { setWindowHours(Number(event.target.value)); setPage(1); }}
              aria-label={t('jobRuns.windowHours')}
            >
              {WINDOW_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>{t('jobRuns.hoursOption', { hours: String(hours) })}</option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {t('jobRuns.totalRecentRuns')}: <span className="font-semibold">{summary?.totalRecentRuns ?? 0}</span>
          {' · '}
          {t('jobRuns.generatedAt')}: {formatTimestamp(summary?.generatedAt, language)}
        </p>

        <div className="mt-3 flex flex-wrap gap-2" data-testid="job-runs-status-counts">
          {summaryEntries.length === 0 ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('jobRuns.noSummary')}</span>
          ) : (
            summaryEntries.map((entry) => (
              <span key={entry.status} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusClasses[entry.status] ?? statusClasses.pending}`}>
                {entry.status}: {entry.count}
              </span>
            ))
          )}
        </div>

        {summary && summary.jobs.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs" aria-label={t('jobRuns.latestRuns')}>
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-2 py-1.5 text-left">{t('jobRuns.columns.job')}</th>
                  <th className="px-2 py-1.5 text-left">{t('jobRuns.columns.type')}</th>
                  <th className="px-2 py-1.5 text-left">{t('jobRuns.columns.status')}</th>
                  <th className="px-2 py-1.5 text-left">{t('jobRuns.columns.lastSeen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.jobs.map((job) => (
                  <tr key={`summary-${job.id}`}>
                    <td className="px-2 py-1.5 font-mono">{job.jobId}</td>
                    <td className="px-2 py-1.5">{job.jobType}</td>
                    <td className="px-2 py-1.5">{job.status}</td>
                    <td className="px-2 py-1.5">{formatTimestamp(job.createdAt, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800" aria-label={t('jobRuns.filtersTitle')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.jobId')}
            <input
              className="mt-1 w-full rounded border p-2 dark:bg-gray-900 dark:border-gray-600"
              value={draft.jobId}
              onChange={(event) => setDraft((current) => ({ ...current, jobId: event.target.value }))}
              aria-label={t('jobRuns.jobId')}
              placeholder={t('jobRuns.jobIdPlaceholder')}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.jobType')}
            <input
              className="mt-1 w-full rounded border p-2 dark:bg-gray-900 dark:border-gray-600"
              value={draft.jobType}
              onChange={(event) => setDraft((current) => ({ ...current, jobType: event.target.value }))}
              aria-label={t('jobRuns.jobType')}
              placeholder={t('jobRuns.jobTypePlaceholder')}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.status')}
            <select
              className="mt-1 w-full rounded border p-2 bg-white dark:bg-gray-900 dark:border-gray-600"
              value={draft.status}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
              aria-label={t('jobRuns.status')}
            >
              <option value="">{t('common.allStatuses')}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.from')}
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border p-2 dark:bg-gray-900 dark:border-gray-600"
              value={draft.from}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
              aria-label={t('jobRuns.from')}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.to')}
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border p-2 dark:bg-gray-900 dark:border-gray-600"
              value={draft.to}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
              aria-label={t('jobRuns.to')}
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.order')}
            <select
              className="mt-1 w-full rounded border p-2 bg-white dark:bg-gray-900 dark:border-gray-600"
              value={draft.order}
              onChange={(event) => setDraft((current) => ({ ...current, order: event.target.value === 'asc' ? 'asc' : 'desc' }))}
              aria-label={t('jobRuns.order')}
            >
              <option value="desc">{t('jobRuns.orderNewestFirst')}</option>
              <option value="asc">{t('jobRuns.orderOldestFirst')}</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
          >
            {t('jobRuns.applyFilters')}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t('jobRuns.resetFilters')}
          </button>
          <label className="ml-auto text-sm text-gray-700 dark:text-gray-200">
            {t('jobRuns.pageSize')}
            <select
              className="ml-2 rounded border p-1.5 bg-white dark:bg-gray-900 dark:border-gray-600"
              value={limit}
              onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}
              aria-label={t('jobRuns.pageSize')}
            >
              {LIMIT_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg bg-white shadow dark:bg-gray-800" aria-label={t('jobRuns.historyTitle')}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">{t('jobRuns.historyTitle')}</h2>
          <span className="text-sm text-gray-600 dark:text-gray-300">{t('jobRuns.resultCount', { count: String(pagination.total) })}</span>
        </div>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.job')}</th>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.type')}</th>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.status')}</th>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.attempt')}</th>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.started')}</th>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.duration')}</th>
                <th scope="col" className="px-3 py-2 text-left">{t('jobRuns.columns.error')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">{t('jobRuns.loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">{t('jobRuns.empty')}</td></tr>
              ) : (
                rows.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/60">
                    <td className="px-3 py-2 font-mono text-xs">{job.jobId}</td>
                    <td className="px-3 py-2 text-xs">{job.jobType}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses[job.status] ?? statusClasses.pending}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{job.attempt}</td>
                    <td className="px-3 py-2 text-xs">{formatTimestamp(job.startedAt ?? job.scheduledAt ?? job.createdAt, language)}</td>
                    <td className="px-3 py-2 text-xs">{durationLabel(job)}</td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate" title={job.error ?? ''}>{job.error ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <PaginationControls page={page} totalPages={pagination.totalPages} onPageChange={setPage} />
        </div>
      </section>
    </div>
  );
}

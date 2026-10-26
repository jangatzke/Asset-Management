import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { actionCenterApi, type ActionCenterItem, type ActionCenterParams, type ActionCenterResponse } from '../services/api';
import { ACTION_CENTER_SOURCE_OPTIONS } from './actionCenterHelpers';
import { useI18n } from '../context/I18nContext';

const urgencyClasses: Record<ActionCenterItem['urgency'], string> = {
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  critical: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  upcoming: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  planned: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200',
};

export default function ActionCenter() {
  const { t } = useI18n();
  const [filters, setFilters] = useState<ActionCenterParams>({ scope: 'all', page: 1, limit: 25 });
  const [result, setResult] = useState<ActionCenterResponse>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    actionCenterApi.list(filters)
      .then(({ data }) => active && setResult(data))
      .catch(() => active && setError(t('actionCenter.loadError')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  const update = (next: Partial<ActionCenterParams>) => setFilters((current) => ({ ...current, ...next, page: 1 }));
  return <section className="space-y-6">
    <div data-testid="action-center-page">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('navigation.actionCenter')}</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('actionCenter.description')}</p>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(['overdue', 'critical', 'upcoming', 'planned'] as const).map((urgency) => <button key={urgency} onClick={() => update({ urgency: filters.urgency === urgency ? undefined : urgency })} className={`rounded-lg p-4 text-left ${urgencyClasses[urgency]} ${filters.urgency === urgency ? 'ring-2 ring-offset-2 ring-primary-500' : ''}`}>
        <div className="text-2xl font-semibold">{result?.summary[urgency] ?? 0}</div><div className="text-sm capitalize">{t(`actionCenter.urgency.${urgency}`)}</div>
      </button>)}
    </div>
    <div className="flex flex-wrap gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <label className="text-sm text-gray-700 dark:text-gray-200">{t('actionCenter.scopeLabel')} <select value={filters.scope} onChange={(e) => update({ scope: e.target.value as ActionCenterParams['scope'] })} className="ml-2 rounded border p-1 dark:bg-gray-700"><option value="all">{t('actionCenter.allAvailable')}</option><option value="mine">{t('actionCenter.assignedToMe')}</option><option value="authorized">{t('actionCenter.authorizedItems')}</option></select></label>
      <label className="text-sm text-gray-700 dark:text-gray-200">{t('actionCenter.sourceLabel')} <select value={filters.sourceType ?? ''} onChange={(e) => update({ sourceType: (e.target.value || undefined) as ActionCenterParams['sourceType'] })} className="ml-2 rounded border p-1 dark:bg-gray-700"><option value="">{t('actionCenter.allSources')}</option>{ACTION_CENTER_SOURCE_OPTIONS.map(({ value }) => <option key={value} value={value}>{t(`actionCenter.sources.${value}`)}</option>)}</select></label>
      <label className="text-sm text-gray-700 dark:text-gray-200">{t('actionCenter.dueBeforeLabel')} <input type="date" value={filters.dueBefore?.slice(0, 10) ?? ''} onChange={(e) => update({ dueBefore: e.target.value ? new Date(`${e.target.value}T23:59:59.999Z`).toISOString() : undefined })} className="ml-2 rounded border p-1 dark:bg-gray-700" /></label>
    </div>
    {error && <div role="alert" className="rounded bg-red-50 p-4 text-red-800 dark:bg-red-900/30 dark:text-red-100">{error}</div>}
    {loading ? <p className="text-gray-600 dark:text-gray-300">{t('actionCenter.loading')}</p> : <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800">
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">{result?.data.map((entry) => <li key={`${entry.sourceType}-${entry.id}`} data-testid={`action-center-item-${entry.id}`} className="flex flex-wrap items-center gap-3 p-4">
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${urgencyClasses[entry.urgency]}`}>{t(`actionCenter.urgency.${entry.urgency}`)}</span>
        <div className="min-w-[14rem] flex-1"><div className="font-medium text-gray-900 dark:text-white">{entry.title}</div><div className="text-sm text-gray-500 dark:text-gray-400">{t(`actionCenter.sources.${entry.sourceType}`)} · {entry.assignment} · {t('actionCenter.due', { date: new Date(entry.dueDate).toLocaleString() })}</div></div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{entry.status}</span>{entry.href && <Link to={entry.href} data-testid={`action-center-open-${entry.id}`} className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">{t('actionCenter.open')}</Link>}
      </li>)}</ul>
      {!result?.data.length && <p className="p-6 text-center text-gray-500 dark:text-gray-400">{t('actionCenter.noMatches')}</p>}
    </div>}
    {!!result && result.pagination.totalPages > 1 && <div className="flex justify-end gap-3"><button disabled={result.pagination.page === 1} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))} className="rounded border px-3 py-1 disabled:opacity-50">{t('common.previous')}</button><span className="py-1 text-sm">{t('pagination.pageOf', { page: result.pagination.page, total: result.pagination.totalPages })}</span><button disabled={result.pagination.page === result.pagination.totalPages} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))} className="rounded border px-3 py-1 disabled:opacity-50">{t('common.next')}</button></div>}
  </section>;
}

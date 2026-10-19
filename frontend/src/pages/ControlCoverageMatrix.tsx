import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { controlApi, type CoverageMatrixResponse, type CoverageMatrixRow } from '../services/api';
import { extractApiError } from '../utils/apiError';

const card = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800';
const input = 'mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const CRITICALITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function ControlCoverageMatrix() {
  const { t } = useI18n();

  const [matrix, setMatrix] = useState<CoverageMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [criticality, setCriticality] = useState('');
  const [uncoveredOnly, setUncoveredOnly] = useState(false);
  const [detail, setDetail] = useState<CoverageMatrixRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await controlApi.coverageMatrix({
        search: search.trim() || undefined,
        criticality: criticality || undefined,
      });
      setMatrix(res.data);
    } catch (caught) {
      setError(extractApiError(caught, t('controlCoverage.loadError')).message);
    } finally {
      setLoading(false);
    }
  }, [search, criticality, t]);

  useEffect(() => { void load(); }, [load]);

  const summaryCards: Array<{ key: keyof CoverageMatrixResponse['summary']; label: string; tone: string }> = [
    { key: 'totalAssets', label: t('controlCoverage.summary.total'), tone: 'text-gray-900 dark:text-white' },
    { key: 'coveredAssets', label: t('controlCoverage.summary.covered'), tone: 'text-green-700 dark:text-green-300' },
    { key: 'uncoveredAssets', label: t('controlCoverage.summary.uncovered'), tone: 'text-red-700 dark:text-red-300' },
    { key: 'criticalUncovered', label: t('controlCoverage.summary.criticalUncovered'), tone: 'text-red-700 dark:text-red-300' },
  ];

  const rows = (matrix?.rows ?? []).filter((row) => !uncoveredOnly || row.uncovered);

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('controlCoverage.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('controlCoverage.description')}</p>
      </header>

      {error && <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <section className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('controlCoverage.searchLabel')}
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('controlCoverage.searchPlaceholder')} className={input} />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('controlCoverage.fields.criticality')}
          <select value={criticality} onChange={(event) => setCriticality(event.target.value)} className={input}>
            <option value="">{t('common.all')}</option>
            {CRITICALITIES.map((value) => <option key={value} value={value}>{t(`assets.criticality.${value}`)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={uncoveredOnly} onChange={(event) => setUncoveredOnly(event.target.checked)} />
          {t('controlCoverage.filters.uncoveredOnly')}
        </label>
      </section>

      {matrix && (
        <section aria-label={t('controlCoverage.summaryLabel')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((entry) => (
            <div key={entry.key} className={card}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{entry.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${entry.tone}`}>{matrix.summary[entry.key]}</p>
            </div>
          ))}
        </section>
      )}

      <section className={card}>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('controlCoverage.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('controlCoverage.columns.asset')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('controlCoverage.fields.criticality')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('controlCoverage.columns.coverage')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('controlCoverage.columns.effective')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm">
                      <button type="button" onClick={() => setDetail(row)} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                        {row.name}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{row.displayId} · {t(`assets.lifecycleStatus.${row.lifecycleStatus}`)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {t(`assets.criticality.${row.criticality}`)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm ${row.uncovered ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>
                      {row.coverageCount === 0 ? t('controlCoverage.uncoveredBadge') : row.coverageCount}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{row.effectiveCoverageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{detail.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{detail.displayId} · {t(`assets.criticality.${detail.criticality}`)}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="font-medium">{t('controlCoverage.fields.complianceRelevance')}:</span> {detail.complianceRelevance ? t('common.yes') : t('common.no')}</p>
              <p><span className="font-medium">{t('controlCoverage.fields.dataProtection')}:</span> {detail.dataProtectionRelevance ? t('common.yes') : t('common.no')}</p>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-white">{t('controlCoverage.sections.controls')}</h3>
            {detail.controls.length === 0 ? (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{t('controlCoverage.noControls')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {detail.controls.map((control) => (
                  <li key={control.id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                    <Link to="/controls" className="font-medium text-primary-700 hover:underline dark:text-primary-300">{control.title}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {control.catalogId} · {t(`controls.implementationStatus.${control.implementationStatus}`)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Link to={`/assets/${detail.id}`} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                {t('controlCoverage.openAsset')}
              </Link>
              <button type="button" onClick={() => setDetail(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

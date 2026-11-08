import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../context/I18nContext';
import { controlApi, type CoverageMatrixResponse, type CoverageMatrixRow } from '../services/api';
import { formatApiError } from '../utils/apiError';
import PageShell from '../components/PageShell';
import { MetricCard, type MetricTone } from '../components/MetricCard';
// Stage 10b (LT-4): shared chart language — consistent axis/legend labels.
import { chartAxisLabelClass } from '../styles/chartLanguage';

const card = 'rounded-lg border border-border-subtle bg-surface-default p-5 shadow-sm dark:border-border-subtle dark:bg-surface-sunken';
const input = 'mt-1 block w-full rounded border border-border-strong bg-surface-default px-3 py-2 dark:border-border-strong dark:bg-surface-sunken dark:text-white';

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
      setError(formatApiError(caught, t('controlCoverage.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  }, [search, criticality, t]);

  useEffect(() => { void load(); }, [load]);

  // Stage 8 (MT-6): KPI strip uses the shared MetricCard with semantic tones.
  const summaryCards: Array<{ key: keyof CoverageMatrixResponse['summary']; label: string; tone: MetricTone }> = [
    { key: 'totalAssets', label: t('controlCoverage.summary.total'), tone: 'neutral' },
    { key: 'coveredAssets', label: t('controlCoverage.summary.covered'), tone: 'ok' },
    { key: 'uncoveredAssets', label: t('controlCoverage.summary.uncovered'), tone: 'warn' },
    { key: 'criticalUncovered', label: t('controlCoverage.summary.criticalUncovered'), tone: 'critical' },
  ];

  const rows = (matrix?.rows ?? []).filter((row) => !uncoveredOnly || row.uncovered);

  return (
    <PageShell>
      <header>
        <h1 className="text-2xl font-semibold text-text-primary dark:text-white">{t('controlCoverage.title')}</h1>
        <p className="mt-1 text-sm text-text-muted dark:text-text-muted">{t('controlCoverage.description')}</p>
      </header>

      {error && <div role="alert" className="rounded-md bg-status-critical-bg p-4 text-sm text-status-critical-fg dark:bg-status-critical-bg dark:text-status-critical-fg">{error}</div>}

      <section className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-text-secondary dark:text-text-muted">
          {t('controlCoverage.searchLabel')}
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('controlCoverage.searchPlaceholder')} className={input} />
        </label>
        <label className="block text-sm font-medium text-text-secondary dark:text-text-muted">
          {t('controlCoverage.fields.criticality')}
          <select value={criticality} onChange={(event) => setCriticality(event.target.value)} className={input}>
            <option value="">{t('common.all')}</option>
            {CRITICALITIES.map((value) => <option key={value} value={value}>{t(`assets.criticality.${value}`)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-muted">
          <input type="checkbox" checked={uncoveredOnly} onChange={(event) => setUncoveredOnly(event.target.checked)} />
          {t('controlCoverage.filters.uncoveredOnly')}
        </label>
      </section>

      {matrix && (
        <section aria-label={t('controlCoverage.summaryLabel')} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((entry) => (
            <MetricCard key={entry.key} label={entry.label} value={matrix.summary[entry.key]} tone={entry.tone} />
          ))}
        </section>
      )}

      <section className={card} aria-label={t('controlCoverage.summaryLabel')}>
        {/* Chart language (LT-4): this matrix has no bar chart; the numeric
            columns are the data display, so axis/legend labels use the shared
            caption style and all values render with tabular-nums. */}
        {loading ? (
          <p className="text-sm text-text-muted dark:text-text-muted">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-muted dark:text-text-muted">{t('controlCoverage.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle dark:divide-border-subtle">
              <thead className="bg-surface-sunken dark:bg-surface-sunken">
                <tr>
                  <th scope="col" className={`px-4 py-3 text-left font-medium uppercase ${chartAxisLabelClass}`}>{t('controlCoverage.columns.asset')}</th>
                  <th scope="col" className={`px-4 py-3 text-left font-medium uppercase ${chartAxisLabelClass}`}>{t('controlCoverage.fields.criticality')}</th>
                  <th scope="col" className={`px-4 py-3 text-right font-medium uppercase ${chartAxisLabelClass}`}>{t('controlCoverage.columns.coverage')}</th>
                  <th scope="col" className={`px-4 py-3 text-right font-medium uppercase ${chartAxisLabelClass}`}>{t('controlCoverage.columns.effective')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface-default dark:divide-border-subtle dark:bg-surface-sunken">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-sunken dark:hover:bg-surface-sunken">
                    <td className="px-4 py-3 text-sm">
                      <button type="button" onClick={() => setDetail(row)} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                        {row.name}
                      </button>
                      <p className="text-xs text-text-muted dark:text-text-muted">{row.displayId} Â· {t(`assets.lifecycleStatus.${row.lifecycleStatus}`)}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-secondary dark:bg-surface-sunken dark:text-text-muted">
                        {t(`assets.criticality.${row.criticality}`)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm tabular-nums ${row.uncovered ? 'font-semibold text-status-critical-fg' : ''}`}>
                      {row.coverageCount === 0 ? t('controlCoverage.uncoveredBadge') : row.coverageCount}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{row.effectiveCoverageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="w-full max-w-2xl rounded-lg bg-surface-default p-6 shadow-xl dark:bg-surface-sunken" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary dark:text-white">{detail.name}</h2>
                <p className="text-sm text-text-muted dark:text-text-muted">{detail.displayId} Â· {t(`assets.criticality.${detail.criticality}`)}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label={t('common.close')} className="rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"><XMarkIcon aria-hidden="true" className="h-5 w-5" /></button>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="font-medium">{t('controlCoverage.fields.complianceRelevance')}:</span> {detail.complianceRelevance ? t('common.yes') : t('common.no')}</p>
              <p><span className="font-medium">{t('controlCoverage.fields.dataProtection')}:</span> {detail.dataProtectionRelevance ? t('common.yes') : t('common.no')}</p>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-text-primary dark:text-white">{t('controlCoverage.sections.controls')}</h3>
            {detail.controls.length === 0 ? (
              <p className="mt-1 text-sm text-status-warn-fg dark:text-status-warn-fg">{t('controlCoverage.noControls')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {detail.controls.map((control) => (
                  <li key={control.id} className="rounded border border-border-subtle p-3 text-sm dark:border-border-subtle">
                    <Link to="/controls" className="font-medium text-primary-700 hover:underline dark:text-primary-300">{control.title}</Link>
                    <p className="text-xs text-text-muted dark:text-text-muted">
                      {control.catalogId} Â· {t(`controls.implementationStatus.${control.implementationStatus}`)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Link to={`/assets/${detail.id}`} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                {t('controlCoverage.openAsset')}
              </Link>
              <button type="button" onClick={() => setDetail(null)} className="rounded-md border border-border-strong px-4 py-2 text-sm dark:border-border-strong">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

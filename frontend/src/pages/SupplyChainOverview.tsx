import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { supplierApi, type SupplyChainOverviewResponse, type SupplyChainOverviewSupplier } from '../services/api';
import { extractApiError } from '../utils/apiError';
import { formatDate } from '../utils/formatDate';

const card = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800';
const input = 'mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const CRITICALITIES = ['low', 'medium', 'high', 'critical'] as const;

export default function SupplyChainOverview() {
  const { t } = useI18n();

  const [overview, setOverview] = useState<SupplyChainOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Seed from ?search= so the global search "show all" deep-link works.
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [criticality, setCriticality] = useState('');
  const [nis2Only, setNis2Only] = useState(false);
  const [detail, setDetail] = useState<SupplyChainOverviewSupplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierApi.overview({
        search: search.trim() || undefined,
        criticality: criticality || undefined,
        nis2Relevant: nis2Only ? 'true' : undefined,
      });
      setOverview(res.data);
    } catch (caught) {
      setError(extractApiError(caught, t('supplyChain.loadError')).message);
    } finally {
      setLoading(false);
    }
  }, [search, criticality, nis2Only, t]);

  useEffect(() => { void load(); }, [load]);

  const summaryCards: Array<{ key: keyof SupplyChainOverviewResponse['summary']; label: string; tone: string }> = [
    { key: 'totalSuppliers', label: t('supplyChain.summary.total'), tone: 'text-gray-900 dark:text-white' },
    { key: 'nis2Relevant', label: t('supplyChain.summary.nis2Relevant'), tone: 'text-blue-700 dark:text-blue-300' },
    { key: 'criticalHigh', label: t('supplyChain.summary.criticalHigh'), tone: 'text-red-700 dark:text-red-300' },
    { key: 'missingExitStrategy', label: t('supplyChain.summary.missingExitStrategy'), tone: 'text-amber-700 dark:text-amber-300' },
    { key: 'reviewOverdue', label: t('supplyChain.summary.reviewOverdue'), tone: 'text-red-700 dark:text-red-300' },
  ];

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('supplyChain.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('supplyChain.description')}</p>
      </header>

      {error && <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <section className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('supplyChain.searchLabel')}
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('supplyChain.searchPlaceholder')} className={input} />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('supplyChain.fields.criticality')}
          <select value={criticality} onChange={(event) => setCriticality(event.target.value)} className={input}>
            <option value="">{t('common.all')}</option>
            {CRITICALITIES.map((value) => <option key={value} value={value}>{t(`assets.criticality.${value}`)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={nis2Only} onChange={(event) => setNis2Only(event.target.checked)} />
          {t('supplyChain.filters.nis2Only')}
        </label>
      </section>

      {overview && (
        <section aria-label={t('supplyChain.summaryLabel')} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {summaryCards.map((entry) => (
            <div key={entry.key} className={card}>
              <p className="text-sm text-gray-500 dark:text-gray-400">{entry.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${entry.tone}`}>{overview.summary[entry.key]}</p>
            </div>
          ))}
        </section>
      )}

      <section className={card}>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : !overview || overview.suppliers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('supplyChain.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('supplyChain.columns.supplier')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('supplyChain.fields.criticality')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('supplyChain.columns.contracts')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('supplyChain.columns.openRisks')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('supplyChain.columns.latestAssessment')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">{t('supplyChain.columns.nextReview')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                {overview.suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm">
                      <button type="button" onClick={() => setDetail(supplier)} className="font-medium text-primary-700 hover:underline dark:text-primary-300">
                        {supplier.legalName}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{supplier.displayId}{supplier.nis2Relevant ? ` · ${t('supplyChain.nis2Badge')}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {t(`assets.criticality.${supplier.criticality}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">{supplier.contractCount}</td>
                    <td className={`px-4 py-3 text-right text-sm ${supplier.openRiskCount > 0 ? 'font-semibold text-red-700 dark:text-red-300' : ''}`}>{supplier.openRiskCount}</td>
                    <td className="px-4 py-3 text-sm">
                      {supplier.latestAssessment ? (
                        <span>{formatDate(supplier.latestAssessment.assessmentDate)} · {supplier.latestAssessment.rating}</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">{t('supplyChain.noAssessment')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {supplier.nextReviewDate ? (
                        <span className={supplier.reviewOverdue ? 'font-semibold text-red-700 dark:text-red-300' : ''}>{formatDate(supplier.nextReviewDate)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      {supplier.missingExitStrategy && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t('supplyChain.missingExitStrategy')}</p>}
                    </td>
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{detail.legalName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{detail.displayId} · {detail.servicesProvided || t('supplyChain.noServices')}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <p><span className="font-medium">{t('supplyChain.fields.exitStrategy')}:</span> {detail.exitStrategy || <span className="text-amber-700 dark:text-amber-300">{t('supplyChain.missingExitStrategy')}</span>}</p>
              <p><span className="font-medium">{t('supplyChain.fields.dataProtection')}:</span> {detail.dataProtectionRelevant ? t('common.yes') : t('common.no')}</p>
            </div>

            <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-white">{t('supplyChain.sections.contracts')}</h3>
            {detail.contracts.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('supplyChain.noContracts')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {detail.contracts.map((contract) => (
                  <li key={contract.id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                    <Link to="/contracts" className="font-medium text-primary-700 hover:underline dark:text-primary-300">{contract.title}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {contract.displayId} · {t(`contracts.types.${contract.contractType}`)}
                      {contract.renewalDate ? ` · ${t('supplyChain.renewsOn')} ${formatDate(contract.renewalDate)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-white">{t('supplyChain.sections.risks')}</h3>
            {detail.risks.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('supplyChain.noRisks')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {detail.risks.map((risk) => (
                  <li key={risk.id} className="rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                    <Link to={`/risks/${risk.id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">{risk.title}</Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{risk.displayId} · {t(`risks.riskLevel.${risk.residualRisk}`)}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Link to={`/isms-operations/suppliers/${detail.id}`} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                {t('supplyChain.openSupplier')}
              </Link>
              <button type="button" onClick={() => setDetail(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-600">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

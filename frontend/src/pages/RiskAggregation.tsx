
import { useState, useEffect, useCallback, useMemo } from 'react';
import { riskAggregationApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell, tableCellClass, useTableDensity } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';
import { formatApiError } from '../utils/apiError';
import { statusBadgeClass, type StatusKind } from '../utils/statusHelpers';
import { MetricCard } from '../components/MetricCard';
// Stage 10b (LT-4): shared chart language — semantic series tones + track.
import { chartSeriesTone, chartTrackClass } from '../styles/chartLanguage';

interface AggregationGroup {
  name: string;
  id?: string;
  totalRisks: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  veryHigh: number;
  risks?: any[];
}

type TabKey = 'location' | 'orgUnit' | 'process' | 'assetType' | 'scope';

const RiskAggregation = () => {
  const { t } = useI18n();
  // Stage 10b (LT-3): cells follow the globally persisted density preference.
  const cellClass = tableCellClass(useTableDensity());
  const [activeTab, setActiveTab] = useState<TabKey>('location');
  const [data, setData] = useState<Record<TabKey, AggregationGroup[]>>({ location: [], orgUnit: [], process: [], assetType: [], scope: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        riskAggregationApi.byLocation(),
        riskAggregationApi.byOrgUnit(),
        riskAggregationApi.byProcess(),
        riskAggregationApi.byAssetType(),
        riskAggregationApi.byScope(),
      ]);

      const parseGroups = (result: PromiseSettledResult<any>): AggregationGroup[] => {
        if (result.status === 'fulfilled') {
          const d = result.value.data;
          return Array.isArray(d?.groups) ? d.groups : (Array.isArray(d) ? d : []);
        }
        return [];
      };

      setData({
        location: parseGroups(results[0]),
        orgUnit: parseGroups(results[1]),
        process: parseGroups(results[2]),
        assetType: parseGroups(results[3]),
        scope: parseGroups(results[4]),
      });
    } catch (err: unknown) {
      setError(formatApiError(err, t('riskAggregation.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initial load
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'location', label: t('riskAggregation.tabs.location') },
    { key: 'orgUnit', label: t('riskAggregation.tabs.orgUnit') },
    { key: 'process', label: t('riskAggregation.tabs.process') },
    { key: 'assetType', label: t('riskAggregation.tabs.assetType') },
    { key: 'scope', label: t('riskAggregation.tabs.scope') },
  ];

  const currentData = useMemo(() => data[activeTab] || [], [data, activeTab]);

  const { sort, toggleSort } = useLocalSort({ routeKey: `risk-aggregation-${activeTab}`, defaultSort: { column: 'group', direction: 'asc' } });

  const sortedData = useMemo(() => {
    if (!sort.column) return currentData;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (g: AggregationGroup) => {
      if (sort.column === 'group') return (g.name ?? '').toLowerCase();
      if (sort.column === 'total') return String(g.totalRisks ?? 0);
      if (sort.column === 'critical') return String(g.critical ?? g.veryHigh ?? 0);
      if (sort.column === 'high') return String(g.high ?? 0);
      if (sort.column === 'medium') return String(g.medium ?? 0);
      if (sort.column === 'low') return String(g.low ?? 0);
      return '';
    };
    return [...currentData].sort((a, b) => { const av = get(a); const bv = get(b); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; });
  }, [currentData, sort]);

  const exportVisibleAggregation = () => exportCsv(`risk-aggregation-${activeTab}`, [
    t('riskAggregation.table.group'),
    t('riskAggregation.table.total'),
    t('riskAggregation.table.critical'),
    t('riskAggregation.table.high'),
    t('riskAggregation.table.medium'),
    t('riskAggregation.table.low'),
  ], sortedData.map((group) => [
    group.name,
    group.totalRisks || 0,
    group.critical || group.veryHigh || 0,
    group.high || 0,
    group.medium || 0,
    group.low || 0,
  ]));

  // Stage 8 (MT-6): severity colors go through the semantic status tokens.
  const severityKind = (level: string): StatusKind => {
    switch (level?.toLowerCase()) {
      case 'very_high':
      case 'critical': return 'critical';
      case 'high': return 'warn';
      case 'medium': return 'info';
      default: return 'ok';
    }
  };
  const severityBg = (level: string) => statusBadgeClass(severityKind(level));

  // Calculate totals for summary cards
  const totals = currentData.reduce((acc, g) => ({
    totalRisks: acc.totalRisks + (g.totalRisks || 0),
    critical: acc.critical + (g.critical || g.veryHigh || 0),
    high: acc.high + (g.high || 0),
    medium: acc.medium + (g.medium || 0),
    low: acc.low + (g.low || 0),
  }), { totalRisks: 0, critical: 0, high: 0, medium: 0, low: 0 });

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary dark:text-white mb-6">{t('riskAggregation.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary dark:text-white mb-6">{t('riskAggregation.title')}</h1>

      {error && (
        <div className="bg-status-critical-bg dark:bg-status-critical-bg text-status-critical-fg dark:text-status-critical-fg p-3 rounded mb-4">{error}</div>
      )}

      {/* Summary Cards â€” shared MetricCard with semantic tones (MT-6) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-section-gap mb-6">
        <MetricCard label={t('riskAggregation.summary.totalRisks')} value={totals.totalRisks} tone="neutral" />
        <MetricCard label={t('riskAggregation.summary.critical')} value={totals.critical} tone="critical" />
        <MetricCard label={t('riskAggregation.summary.high')} value={totals.high} tone="warn" />
        <MetricCard label={t('riskAggregation.summary.medium')} value={totals.medium} tone="info" />
        <MetricCard label={t('riskAggregation.summary.low')} value={totals.low} tone="ok" />
      </div>

      {/* Tabs */}
      <div className="border-b border-border-subtle dark:border-border-subtle mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-text-muted hover:text-text-secondary dark:hover:text-text-muted hover:border-border-strong'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Heatmap / Bar Chart — chart language (LT-4): max. 3 semantic series
          (critical → warn → info; "low" folds into the info series) on a sunken
          track. The detailed table below remains the text alternative. */}
      <div className="bg-surface-default border border-border-subtle rounded-lg shadow-e1 p-card-pad mb-6">
        <h2 className="text-h3 text-text-primary mb-4">{t('riskAggregation.distribution')}</h2>
        {currentData.length === 0 ? (
          <p className="text-center py-8 text-body2 text-text-muted">{t('riskAggregation.noData')}</p>
        ) : (
          <div className="space-y-3">
            {currentData.map((group, i) => {
              const max = Math.max(group.critical || 0, group.high || 0, group.medium || 0, group.low || 0, group.veryHigh || 0, 1);
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-40 text-body2 font-medium text-text-secondary truncate">{group.name}</div>
                  {/* Track = sunken surface; series use the chartLanguage tones. */}
                  <div className={`flex-1 flex h-6 rounded overflow-hidden ${chartTrackClass}`} role="img" aria-label={`${group.name}: ${t('riskAggregation.table.critical')} ${group.critical || group.veryHigh || 0}, ${t('riskAggregation.table.high')} ${group.high || 0}, ${t('riskAggregation.table.medium')} ${(group.medium || 0) + (group.low || 0)}`}>
                    {((group.veryHigh || group.critical) || 0) > 0 && (
                      <div className={`${chartSeriesTone('critical')} flex items-center justify-center text-caption tabular-nums text-surface-default`} style={{ width: `${(((group.veryHigh || 0) + (group.critical || 0)) / max) * 25}%` }}>
                        {group.veryHigh || group.critical}
                      </div>
                    )}
                    {(group.high || 0) > 0 && (
                      <div className={`${chartSeriesTone('warn')} flex items-center justify-center text-caption tabular-nums text-surface-default`} style={{ width: `${(group.high / max) * 25}%` }}>
                        {group.high}
                      </div>
                    )}
                    {((group.medium || 0) + (group.low || 0)) > 0 && (
                      <div className={`${chartSeriesTone('info')} flex items-center justify-center text-caption tabular-nums text-surface-default`} style={{ width: `${(((group.medium || 0) + (group.low || 0)) / max) * 25}%` }}>
                        {(group.medium || 0) + (group.low || 0)}
                      </div>
                    )}
                  </div>
                  <div className="w-16 text-body2 tabular-nums text-text-muted text-right">{group.totalRisks || 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Detailed Table */}
      <DataTableShell onExport={exportVisibleAggregation} exportLabel="Export CSV" rowCount={sortedData.length} densityLabel={t('dataTable.density')} compactLabel={t('dataTable.compact')} comfortableLabel={t('dataTable.comfortable')}>
        <table className="min-w-full divide-y divide-border-subtle">
          <thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted">
            <tr>
              <SortableTh column="group" label={t('riskAggregation.table.group')} activeColumn={sort.column} direction={sort.column === 'group' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="total" label={t('riskAggregation.table.total')} activeColumn={sort.column} direction={sort.column === 'total' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="critical" label={t('riskAggregation.table.critical')} activeColumn={sort.column} direction={sort.column === 'critical' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
              <SortableTh column="high" label={t('riskAggregation.table.high')} activeColumn={sort.column} direction={sort.column === 'high' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
              <SortableTh column="medium" label={t('riskAggregation.table.medium')} activeColumn={sort.column} direction={sort.column === 'medium' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
              <SortableTh column="low" label={t('riskAggregation.table.low')} activeColumn={sort.column} direction={sort.column === 'low' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
            </tr>
          </thead>
          <tbody className="bg-surface-default divide-y divide-border-subtle">
            {sortedData.map((group, i) => (
              <tr key={i} className="transition-colors duration-fast hover:bg-surface-hover">
                <td className={`${cellClass} text-body2 font-medium text-text-primary`}>{group.name}</td>
                <td className={`${cellClass} text-body2 tabular-nums text-center text-text-primary`}>{group.totalRisks || 0}</td>
                <td className={`${cellClass} text-body2 tabular-nums text-center`}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('critical')}`}>{group.critical || group.veryHigh || 0}</span></td>
                <td className={`${cellClass} text-body2 tabular-nums text-center`}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('high')}`}>{group.high || 0}</span></td>
                <td className={`${cellClass} text-body2 tabular-nums text-center`}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('medium')}`}>{group.medium || 0}</span></td>
                <td className={`${cellClass} text-body2 tabular-nums text-center`}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('low')}`}>{group.low || 0}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {/* Top Risks per Group */}
      {currentData.some(g => g.risks && g.risks.length > 0) && (
        <div className="mt-6 bg-surface-default border border-border-subtle rounded-lg shadow-e1 p-card-pad">
          <h2 className="text-h3 text-text-primary mb-4">{t('riskAggregation.topRisks')}</h2>
          <div className="space-y-6">
            {currentData.filter(g => g.risks && g.risks.length > 0).map((group, i) => (
              <div key={i}>
                <h3 className="text-body1 font-medium text-text-secondary mb-2">{group.name}</h3>
                <ul className="space-y-1">
                  {(group.risks || []).slice(0, 5).map((risk: any) => (
                    <li key={risk.id} className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${severityBg(risk.inherentRisk || 'medium')}`}>
                        {risk.inherentRisk}
                      </span>
                      <span className="text-text-secondary">{risk.displayId}: {risk.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAggregation;


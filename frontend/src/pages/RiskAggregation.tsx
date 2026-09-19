
import { useState, useEffect, useCallback, useMemo } from 'react';
import { riskAggregationApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';

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
    } catch (err: any) {
      setError(err.message || t('riskAggregation.loadError'));
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

  const currentData = data[activeTab] || [];

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

  const severityBg = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'very_high': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'critical': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'high': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default: return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('riskAggregation.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('riskAggregation.title')}</h1>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totals.totalRisks}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('riskAggregation.summary.totalRisks')}</div>
        </div>
        <div className={`rounded-lg shadow p-4 text-center ${severityBg('critical')}`}>
          <div className="text-2xl font-bold">{totals.critical}</div>
          <div className="text-sm">{t('riskAggregation.summary.critical')}</div>
        </div>
        <div className={`rounded-lg shadow p-4 text-center ${severityBg('high')}`}>
          <div className="text-2xl font-bold">{totals.high}</div>
          <div className="text-sm">{t('riskAggregation.summary.high')}</div>
        </div>
        <div className={`rounded-lg shadow p-4 text-center ${severityBg('medium')}`}>
          <div className="text-2xl font-bold">{totals.medium}</div>
          <div className="text-sm">{t('riskAggregation.summary.medium')}</div>
        </div>
        <div className={`rounded-lg shadow p-4 text-center ${severityBg('low')}`}>
          <div className="text-2xl font-bold">{totals.low}</div>
          <div className="text-sm">{t('riskAggregation.summary.low')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Heatmap / Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('riskAggregation.distribution')}</h2>
        {currentData.length === 0 ? (
          <p className="text-center py-8 text-gray-500 dark:text-gray-400">{t('riskAggregation.noData')}</p>
        ) : (
          <div className="space-y-3">
            {currentData.map((group, i) => {
              const max = Math.max(group.critical || 0, group.high || 0, group.medium || 0, group.low || 0, group.veryHigh || 0, 1);
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{group.name}</div>
                  <div className="flex-1 flex h-6 rounded overflow-hidden bg-gray-100 dark:bg-gray-900">
                    {((group.veryHigh || group.critical) || 0) > 0 && (
                      <div className="bg-red-500 flex items-center justify-center text-xs text-white" style={{ width: `${(((group.veryHigh || 0) + (group.critical || 0)) / max) * 25}%` }}>
                        {group.veryHigh || group.critical}
                      </div>
                    )}
                    {(group.high || 0) > 0 && (
                      <div className="bg-orange-500 flex items-center justify-center text-xs text-white" style={{ width: `${(group.high / max) * 25}%` }}>
                        {group.high}
                      </div>
                    )}
                    {(group.medium || 0) > 0 && (
                      <div className="bg-yellow-500 flex items-center justify-center text-xs text-white" style={{ width: `${(group.medium / max) * 25}%` }}>
                        {group.medium}
                      </div>
                    )}
                    {(group.low || 0) > 0 && (
                      <div className="bg-green-500 flex items-center justify-center text-xs text-white" style={{ width: `${(group.low / max) * 25}%` }}>
                        {group.low}
                      </div>
                    )}
                  </div>
                  <div className="w-16 text-sm text-gray-500 dark:text-gray-400 text-right">{group.totalRisks || 0}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Table */}
      <DataTableShell onExport={exportVisibleAggregation} exportLabel="Export CSV" rowCount={sortedData.length} densityLabel={t('dataTable.density')} compactLabel={t('dataTable.compact')} comfortableLabel={t('dataTable.comfortable')}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <SortableTh column="group" label={t('riskAggregation.table.group')} activeColumn={sort.column} direction={sort.column === 'group' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="total" label={t('riskAggregation.table.total')} activeColumn={sort.column} direction={sort.column === 'total' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="critical" label={t('riskAggregation.table.critical')} activeColumn={sort.column} direction={sort.column === 'critical' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
              <SortableTh column="high" label={t('riskAggregation.table.high')} activeColumn={sort.column} direction={sort.column === 'high' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
              <SortableTh column="medium" label={t('riskAggregation.table.medium')} activeColumn={sort.column} direction={sort.column === 'medium' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
              <SortableTh column="low" label={t('riskAggregation.table.low')} activeColumn={sort.column} direction={sort.column === 'low' ? sort.direction : ''} onSort={toggleSort} className="text-center" />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map((group, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{group.name}</td>
                <td className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white">{group.totalRisks || 0}</td>
                <td className="px-6 py-4 text-sm text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('critical')}`}>{group.critical || group.veryHigh || 0}</span></td>
                <td className="px-6 py-4 text-sm text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('high')}`}>{group.high || 0}</span></td>
                <td className="px-6 py-4 text-sm text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('medium')}`}>{group.medium || 0}</span></td>
                <td className="px-6 py-4 text-sm text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityBg('low')}`}>{group.low || 0}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {/* Top Risks per Group */}
      {currentData.some(g => g.risks && g.risks.length > 0) && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('riskAggregation.topRisks')}</h2>
          <div className="space-y-6">
            {currentData.filter(g => g.risks && g.risks.length > 0).map((group, i) => (
              <div key={i}>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">{group.name}</h3>
                <ul className="space-y-1">
                  {(group.risks || []).slice(0, 5).map((risk: any) => (
                    <li key={risk.id} className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${severityBg(risk.inherentRisk || 'medium')}`}>
                        {risk.inherentRisk}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{risk.displayId}: {risk.title}</span>
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


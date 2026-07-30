import { useEffect, useState } from 'react';
import { assetApi, controlApi, costPlanningApi, incidentApi, riskApi } from '../services/api';

const money = (value: string | number | undefined) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

type DashboardMetrics = {
  totalAssets: number;
  openRisks: number;
  activeIncidents: number;
  controls: number;
};

export const emptyDashboardMetrics: DashboardMetrics = {
  totalAssets: 0,
  openRisks: 0,
  activeIncidents: 0,
  controls: 0,
};

export const paginatedTotal = (payload: any): number => {
  const total = payload?.pagination?.total ?? payload?.total;
  if (typeof total === 'number') return total;
  if (typeof total === 'string') return Number(total) || 0;
  return Array.isArray(payload?.data) ? payload.data.length : 0;
};

const Dashboard = () => {
  const [costReport, setCostReport] = useState<any>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyDashboardMetrics);

  useEffect(() => {
    let ignore = false;

    costPlanningApi.dashboardReport().then((response) => {
      if (!ignore) setCostReport(response.data);
    }).catch(() => {
      if (!ignore) setCostReport(null);
    });

    Promise.all([
      assetApi.list({ page: 1, limit: 1 }),
      riskApi.list({ page: 1, limit: 1 }),
      incidentApi.list({ page: 1, limit: 1 }),
      controlApi.list({ page: 1, limit: 1 }),
    ]).then(([assets, risks, incidents, controls]) => {
      if (ignore) return;
      setMetrics({
        totalAssets: paginatedTotal(assets.data),
        openRisks: paginatedTotal(risks.data),
        activeIncidents: paginatedTotal(incidents.data),
        controls: paginatedTotal(controls.data),
      });
    }).catch(() => {
      if (!ignore) setMetrics(emptyDashboardMetrics);
    });

    return () => { ignore = true; };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Assets</h3>
          <p className="text-3xl font-bold text-primary-600 mt-2">{metrics.totalAssets}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Open Risks</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.openRisks}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Incidents</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{metrics.activeIncidents}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Controls</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{metrics.controls}</p>
        </div>
      </div>
      {costReport && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Cost report</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><h3 className="text-sm text-gray-500">Current fiscal year {costReport.currentFiscalYear.label}</h3><p className="text-2xl font-bold text-blue-600">{money(costReport.currentFiscalYear.plannedAmount)}</p></div>
            <div><h3 className="text-sm text-gray-500">Known costs next FY</h3><p className="text-2xl font-bold text-purple-600">{money(costReport.nextFiscalYearKnownCosts.knownAmount)}</p></div>
            <div><h3 className="text-sm text-gray-500">Acquired current FY</h3><p className="text-2xl font-bold text-green-600">{money(costReport.currentFiscalYear.acquiredAmount)}</p></div>
          </div>
          <div className="mt-6 space-y-2">
            {costReport.historicalDevelopment.map((year: any) => <div key={year.fiscalYearLabel} className="flex items-center gap-3"><span className="w-16 text-sm dark:text-gray-200">{year.fiscalYearLabel}</span><div className="h-3 bg-blue-200 rounded flex-1"><div className="h-3 bg-blue-600 rounded" style={{ width: `${Math.min(100, Number(year.plannedAmount) / Math.max(1, Number(costReport.currentFiscalYear.plannedAmount)) * 100)}%` }} /></div><span className="text-sm dark:text-gray-200">{money(year.plannedAmount)}</span></div>)}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;

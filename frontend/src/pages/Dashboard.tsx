import { useEffect, useState } from 'react';
import { costPlanningApi } from '../services/api';

const money = (value: string | number | undefined) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

const Dashboard = () => {
  const [costReport, setCostReport] = useState<any>(null);

  useEffect(() => {
    costPlanningApi.dashboardReport().then((response) => setCostReport(response.data)).catch(() => setCostReport(null));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Assets</h3>
          <p className="text-3xl font-bold text-primary-600 mt-2">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Open Risks</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Incidents</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Controls</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">0</p>
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

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { assetApi, controlApi, costPlanningApi, incidentApi, riskApi, ticketApi } from '../services/api';
import { DashboardMetrics, emptyDashboardMetrics, paginatedTotal } from './dashboardHelpers';

const money = (value: string | number | undefined) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

const openRiskStatuses = ['identified', 'assessed', 'treatment_planned', 'treatment_in_progress'];
const activeIncidentStatuses = ['new', 'under_investigation', 'contained'];

interface DashboardTicket {
  id: string;
  displayId: string;
  title: string;
  priority: string;
  status: string;
  assignee?: { firstName?: string | null; lastName?: string | null } | null;
  requester?: { firstName?: string | null; lastName?: string | null } | null;
  updatedAt: string;
}

const emptyTicketMetrics = { openTickets: 0, assignedToMe: 0, recentTickets: [] as DashboardTicket[] };

const ticketPriorityClasses: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
};

const metricCardClasses = 'block bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';

const Dashboard = () => {
  const { t } = useI18n();
  const [costReport, setCostReport] = useState<any>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyDashboardMetrics);
  const [ticketMetrics, setTicketMetrics] = useState<{ openTickets: number; assignedToMe: number; recentTickets: DashboardTicket[] }>(emptyTicketMetrics);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let ignore = false;

    costPlanningApi.dashboardReport().then((response) => {
      if (!ignore) setCostReport(response.data);
    }).catch(() => {
      if (!ignore) {
        setCostReport(null);
        setLoadError(true);
      }
    });

    Promise.all([
      assetApi.list({ page: 1, limit: 1 }),
      Promise.all(openRiskStatuses.map((status) => riskApi.list({ page: 1, limit: 1, status }))),
      Promise.all(activeIncidentStatuses.map((status) => incidentApi.list({ page: 1, limit: 1, status }))),
      controlApi.list({ page: 1, limit: 1 }),
    ]).then(([assets, riskResponses, incidentResponses, controls]) => {
      if (ignore) return;
      setMetrics({
        totalAssets: paginatedTotal(assets.data),
        openRisks: riskResponses.reduce((total, response) => total + paginatedTotal(response.data), 0),
        activeIncidents: incidentResponses.reduce((total, response) => total + paginatedTotal(response.data), 0),
        controls: paginatedTotal(controls.data),
      });
    }).catch(() => {
      if (!ignore) {
        setMetrics(emptyDashboardMetrics);
        setLoadError(true);
      }
    }).finally(() => {
      if (!ignore) setLoading(false);
    });

    Promise.all([
      ticketApi.list({ page: 1, limit: 1, statusGroup: 'open' }),
      ticketApi.list({ page: 1, limit: 1, statusGroup: 'assigned' }),
      ticketApi.list({ page: 1, limit: 5 }),
    ]).then(([openResponse, assignedResponse, recentResponse]) => {
      if (ignore) return;
      const recent = Array.isArray(recentResponse.data?.data) ? recentResponse.data.data.slice(0, 5) : [];
      setTicketMetrics({
        openTickets: paginatedTotal(openResponse.data),
        assignedToMe: paginatedTotal(assignedResponse.data),
        recentTickets: recent as DashboardTicket[],
      });
    }).catch(() => {
      if (!ignore) setTicketMetrics(emptyTicketMetrics);
    });

    return () => { ignore = true; };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('dashboard.title')}</h1>
      {loadError && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">Some dashboard metrics could not be loaded. Displayed values may be incomplete.</p>}
      {loading && <p role="status" className="text-sm text-gray-600 dark:text-gray-300">Loading dashboard metrics…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/assets" className={metricCardClasses} aria-label={t('dashboard.totalAssets')}>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.totalAssets')}</h3>
          <p className="text-3xl font-bold text-primary-600 mt-2">{metrics.totalAssets}</p>
        </Link>
        <Link to="/risks?status=open" className={metricCardClasses} aria-label={t('dashboard.openRisks')}>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.openRisks')}</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.openRisks}</p>
        </Link>
        <Link to="/incidents?status=open" className={metricCardClasses} aria-label={t('dashboard.activeIncidents')}>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.activeIncidents')}</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{metrics.activeIncidents}</p>
        </Link>
        <Link to="/controls" className={metricCardClasses} aria-label={t('dashboard.controls')}>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.controls')}</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{metrics.controls}</p>
        </Link>
      </div>
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" aria-label={t('dashboard.tickets')}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboard.tickets')}</h2>
          <Link to="/tickets" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">{t('dashboard.recentTickets')}</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          <Link to="/tickets?statusGroup=open" className={metricCardClasses} aria-label={t('dashboard.openTickets')}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.openTickets')}</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">{ticketMetrics.openTickets}</p>
          </Link>
          <Link to="/tickets?statusGroup=assigned" className={metricCardClasses} aria-label={t('dashboard.assignedToMe')}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.assignedToMe')}</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{ticketMetrics.assignedToMe}</p>
          </Link>
          <Link to="/tickets" className={metricCardClasses} aria-label={t('dashboard.tickets')}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('dashboard.tickets')}</h3>
            <p className="text-3xl font-bold text-primary-600 mt-2">{ticketMetrics.recentTickets.length}</p>
          </Link>
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('dashboard.recentTickets')}</h3>
        {ticketMetrics.recentTickets.length === 0 ? (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.noTickets')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {ticketMetrics.recentTickets.map((ticket) => (
              <li key={ticket.id} className="py-2">
                <Link to={`/tickets/${ticket.id}`} className="flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-1 rounded">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{ticket.displayId}</span>
                    <span className="truncate text-sm text-gray-600 dark:text-gray-300">{ticket.title}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ticketPriorityClasses[ticket.priority] ?? ticketPriorityClasses.medium}`}>{t(`tickets.priorities.${ticket.priority}`)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">{t(`tickets.status.${ticket.status}`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {costReport && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.costReport')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><h3 className="text-sm text-gray-500">{t('dashboard.currentFiscalYear').replace('{fiscalYear}', costReport.currentFiscalYear.label)}</h3><p className="text-2xl font-bold text-blue-600">{money(costReport.currentFiscalYear.plannedAmount)}</p></div>
            <div><h3 className="text-sm text-gray-500">{t('dashboard.knownCostsNextFiscalYear')}</h3><p className="text-2xl font-bold text-purple-600">{money(costReport.nextFiscalYearKnownCosts.knownAmount)}</p></div>
            <div><h3 className="text-sm text-gray-500">{t('dashboard.acquiredCurrentFiscalYear')}</h3><p className="text-2xl font-bold text-green-600">{money(costReport.currentFiscalYear.acquiredAmount)}</p></div>
          </div>
          <div className="mt-6 space-y-2" aria-label="Historical planned costs">
            {costReport.historicalDevelopment.map((year: any) => {
              const percentage = Math.min(100, Number(year.plannedAmount) / Math.max(1, Number(costReport.currentFiscalYear.plannedAmount)) * 100);
              return <div key={year.fiscalYearLabel} className="flex items-center gap-3"><span className="w-16 text-sm dark:text-gray-200">{year.fiscalYearLabel}</span><div className="h-3 bg-blue-200 rounded flex-1" role="progressbar" aria-label={`${year.fiscalYearLabel}: ${money(year.plannedAmount)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}><div className="h-3 bg-blue-600 rounded" style={{ width: `${percentage}%` }} /></div><span className="text-sm dark:text-gray-200">{money(year.plannedAmount)}</span></div>;
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;

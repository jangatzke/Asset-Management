import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { assetApi, controlApi, costPlanningApi, incidentApi, riskApi, ticketApi, type TicketWorkloadEntry } from '../services/api';
import { DashboardMetrics, emptyDashboardMetrics, paginatedTotal } from './dashboardHelpers';
import { metricCard } from '../styles/tokens';

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
  medium: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
};

const metricCardClasses = metricCard;

function nextIsoWeek(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - start.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const Dashboard = () => {
  const { t } = useI18n();
  const [costReport, setCostReport] = useState<any>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyDashboardMetrics);
  const [ticketMetrics, setTicketMetrics] = useState<{ openTickets: number; assignedToMe: number; recentTickets: DashboardTicket[] }>(emptyTicketMetrics);
  const [workload, setWorkload] = useState<{ current: TicketWorkloadEntry[]; next: TicketWorkloadEntry[] }>({ current: [], next: [] });
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
      ticketApi.workload({ ticketsOnly: true }),
      ticketApi.workload({ week: nextIsoWeek(), ticketsOnly: true }),
    ]).then(([current, next]) => {
      if (!ignore) setWorkload({ current: current.data.data, next: next.data.data });
    }).catch(() => { if (!ignore) setWorkload({ current: [], next: [] }); });

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
      {loadError && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">{t('dashboard.loadError')}</p>}
      {loading && <div role="status" aria-label={t('dashboard.loading')} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"><div className="h-28 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" /><div className="h-28 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" /><div className="h-28 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" /><div className="h-28 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" /></div>}
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
          <Link to="/tickets" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">{t('dashboard.recentTickets')}</Link>
        </div>
        <div className="mb-5 grid grid-cols-1 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900/40 md:grid-cols-3 md:divide-x md:divide-gray-200 dark:md:divide-gray-700">
          <Link to="/tickets?statusGroup=open" className="p-4 transition hover:bg-gray-100 dark:hover:bg-gray-700/50" aria-label={t('dashboard.openTickets')}>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('dashboard.openTickets')}</h3>
            <p className="mt-1 text-3xl font-bold text-orange-600">{ticketMetrics.openTickets}</p>
          </Link>
          <Link to="/tickets?statusGroup=assigned" className="p-4 transition hover:bg-gray-100 dark:hover:bg-gray-700/50" aria-label={t('dashboard.assignedToMe')}>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('dashboard.assignedToMe')}</h3>
            <p className="mt-1 text-3xl font-bold text-green-600">{ticketMetrics.assignedToMe}</p>
          </Link>
          <Link to="/tickets" className="p-4 transition hover:bg-gray-100 dark:hover:bg-gray-700/50" aria-label={t('dashboard.tickets')}>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('dashboard.recentTickets')}</h3>
            <p className="mt-1 text-3xl font-bold text-primary-600">{ticketMetrics.recentTickets.length}</p>
          </Link>
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('dashboard.recentTickets')}</h3>
        {ticketMetrics.recentTickets.length === 0 ? (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.noTickets')}</p>
        ) : (
          <ul className="space-y-2">
            {ticketMetrics.recentTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/tickets/${ticket.id}`} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-3 transition hover:bg-gray-100 dark:bg-gray-900/40 dark:hover:bg-gray-700/70">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{ticket.displayId} – {ticket.title}</span>
                    <span className="mt-1 block text-xs text-gray-500">{new Date(ticket.updatedAt).toLocaleString()}</span>
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
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900 dark:bg-amber-950/30" aria-label={t('dashboard.needsAttention')}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-amber-950 dark:text-amber-100">{t('dashboard.needsAttention')}</h2><p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{t('dashboard.needsAttentionDescription')}</p></div><Link to="/action-center" className="rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900">{t('dashboard.openActionCenter')}</Link></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><Link to="/incidents?status=open" className="rounded-md bg-white p-4 text-sm shadow-sm hover:ring-2 hover:ring-amber-400 dark:bg-gray-800"><span className="block font-semibold text-gray-900 dark:text-white">{t('dashboard.activeIncidents')}</span><span className="mt-1 block text-2xl font-bold text-red-600">{metrics.activeIncidents}</span></Link><Link to="/risks?status=open" className="rounded-md bg-white p-4 text-sm shadow-sm hover:ring-2 hover:ring-amber-400 dark:bg-gray-800"><span className="block font-semibold text-gray-900 dark:text-white">{t('dashboard.openRisks')}</span><span className="mt-1 block text-2xl font-bold text-orange-600">{metrics.openRisks}</span></Link><Link to="/tickets?statusGroup=open" className="rounded-md bg-white p-4 text-sm shadow-sm hover:ring-2 hover:ring-amber-400 dark:bg-gray-800"><span className="block font-semibold text-gray-900 dark:text-white">{t('dashboard.openTickets')}</span><span className="mt-1 block text-2xl font-bold text-primary-600">{ticketMetrics.openTickets}</span></Link></div>
      </section>
      <section className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboard.workload')}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('dashboard.workloadDescription')}</p></div><Link to="/ticket-workload" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">{t('dashboard.viewWorkload')}</Link></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">{([{ key: 'current', label: t('dashboard.currentWeek') }, { key: 'next', label: t('dashboard.nextWeek') }] as const).map(({ key, label }) => <div key={key}><h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</h3><div className="mt-3 space-y-3">{workload[key].slice(0, 10).map((entry) => <div key={entry.user.id}><div className="flex justify-between gap-2 text-sm"><span className="truncate">{entry.user.firstName || entry.user.lastName ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() : entry.user.email}</span><span className="font-semibold">{entry.utilizationPercent}%</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-gray-200 dark:bg-gray-700"><div className="h-full rounded bg-primary-600" style={{ width: `${Math.min(entry.utilizationPercent, 100)}%` }} /></div></div>)}{workload[key].length === 0 && <p className="text-sm text-gray-500">{t('dashboard.noWorkload')}</p>}</div></div>)}</div>
      </section>
      {costReport && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('dashboard.costReport')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><h3 className="text-sm text-gray-500">{t('dashboard.currentFiscalYear').replace('{fiscalYear}', costReport.currentFiscalYear.label)}</h3><p className="text-2xl font-bold text-primary-600">{money(costReport.currentFiscalYear.plannedAmount)}</p></div>
            <div><h3 className="text-sm text-gray-500">{t('dashboard.knownCostsNextFiscalYear')}</h3><p className="text-2xl font-bold text-purple-600">{money(costReport.nextFiscalYearKnownCosts.knownAmount)}</p></div>
            <div><h3 className="text-sm text-gray-500">{t('dashboard.acquiredCurrentFiscalYear')}</h3><p className="text-2xl font-bold text-green-600">{money(costReport.currentFiscalYear.acquiredAmount)}</p></div>
          </div>
          <div className="mt-6 space-y-2" aria-label={t('dashboard.historicalDevelopment')}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.historicalDevelopmentDescription')}</p>
            {costReport.historicalDevelopment.map((year: any) => {
              const percentage = Math.min(100, Number(year.plannedAmount) / Math.max(1, Number(costReport.currentFiscalYear.plannedAmount)) * 100);
              return <div key={year.fiscalYearLabel} className="flex items-center gap-3"><span className="w-20 text-sm dark:text-gray-200">{year.fiscalYearLabel}</span><div className="h-3 flex-1 rounded bg-primary-200 dark:bg-blue-950" role="progressbar" aria-label={`${year.fiscalYearLabel}: ${money(year.plannedAmount)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}><div className="h-3 rounded bg-primary-600" style={{ width: `${percentage}%` }} /></div><span className="w-14 text-right text-xs text-gray-500 dark:text-gray-400">{Math.round(percentage)}%</span><span className="w-28 text-right text-sm dark:text-gray-200">{money(year.plannedAmount)}</span></div>;
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;

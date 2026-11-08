import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { assetApi, controlApi, costPlanningApi, incidentApi, riskApi, ticketApi, type TicketWorkloadEntry } from '../services/api';
import { DashboardMetrics, emptyDashboardMetrics, paginatedTotal } from './dashboardHelpers';
import { PageHeader } from '../components/PageHeader';
import PageShell from '../components/PageShell';
import { Panel } from '../components/Panel';
import { MetricCard } from '../components/MetricCard';
import { EmptyState } from '../components/EmptyState';
import { statusBadgeClass, type StatusKind } from '../utils/statusHelpers';
import { formatDateTime } from '../utils/formatDate';
// Stage 10b (LT-4): shared chart language — track/series/axis/value classes.
import { chartAxisLabelClass, chartSeriesTone, chartTrackClass, chartValueClass } from '../styles/chartLanguage';

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

const ticketPriorityKind: Record<string, StatusKind> = {
  low: 'idle',
  medium: 'info',
  high: 'warn',
  critical: 'critical',
};

/** Unified "needs attention" row shape (Stage 8 / MT-6). */
interface AttentionRow {
  kind: string;
  title: string;
  status: StatusKind;
  statusLabel: string;
  href: string;
  meta?: string;
}

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

  // ONE consolidated attention list (Stage 8 / MT-6): the three former repeated
  // count cards collapse into rows of a single shape. No new API calls — only
  // existing state slices are mapped. Uses only pre-existing i18n keys.
  const attentionRows = useMemo<AttentionRow[]>(() => {
    const rows: AttentionRow[] = [];
    if (metrics.activeIncidents > 0) {
      rows.push({
        kind: t('dashboard.openIncidents'),
        title: t('dashboard.activeIncidents'),
        status: 'critical',
        statusLabel: String(metrics.activeIncidents),
        href: '/incidents?status=open',
      });
    }
    if (metrics.openRisks > 0) {
      rows.push({
        kind: t('dashboard.openRisks'),
        title: t('dashboard.openRisks'),
        status: 'warn',
        statusLabel: String(metrics.openRisks),
        href: '/risks?status=open',
      });
    }
    if (ticketMetrics.openTickets > 0) {
      rows.push({
        kind: t('dashboard.openTickets'),
        title: t('dashboard.openTickets'),
        status: 'info',
        statusLabel: String(ticketMetrics.openTickets),
        href: '/tickets?statusGroup=open',
      });
    }
    for (const ticket of ticketMetrics.recentTickets) {
      rows.push({
        kind: t('dashboard.tickets'),
        title: `${ticket.displayId} – ${ticket.title}`,
        status: ticketPriorityKind[ticket.priority] ?? 'info',
        statusLabel: t(`tickets.priorities.${ticket.priority}`),
        href: `/tickets/${ticket.id}`,
        meta: formatDateTime(ticket.updatedAt),
      });
    }
    return rows.slice(0, 8);
  }, [metrics.activeIncidents, metrics.openRisks, ticketMetrics.openTickets, ticketMetrics.recentTickets, t]);

  return (
    <PageShell className="flex flex-col gap-section-gap">
      <PageHeader title={t('dashboard.title')} />
      {loadError && <p role="alert" className={`rounded-md border border-border-subtle px-4 py-3 text-sm ${statusBadgeClass('warn')}`}>{t('dashboard.loadError')}</p>}

      {/* Overview — 4 KPI cards */}
      <Panel title={t('dashboard.overview')} as="div">
        {loading ? (
          <div role="status" aria-label={t('dashboard.loading')} className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-28 animate-pulse rounded-lg bg-surface-sunken" />
            <div className="h-28 animate-pulse rounded-lg bg-surface-sunken" />
            <div className="h-28 animate-pulse rounded-lg bg-surface-sunken" />
            <div className="h-28 animate-pulse rounded-lg bg-surface-sunken" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-section-gap sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t('dashboard.totalAssets')} value={metrics.totalAssets} href="/assets" tone="neutral" />
            <MetricCard label={t('dashboard.openRisks')} value={metrics.openRisks} href="/risks?status=open" tone="warn" />
            <MetricCard label={t('dashboard.activeIncidents')} value={metrics.activeIncidents} href="/incidents?status=open" tone="critical" />
            <MetricCard label={t('dashboard.controls')} value={metrics.controls} href="/controls" tone="ok" />
          </div>
        )}
      </Panel>

      {/* Needs attention — ONE list instead of three repeated cards */}
      <Panel
        title={t('dashboard.needsAttention')}
        description={t('dashboard.needsAttentionDescription')}
        actions={<Link to="/action-center" className="rounded-md border border-border-subtle px-3 py-2 text-body2 font-medium text-text-secondary hover:bg-surface-hover">{t('dashboard.openActionCenter')}</Link>}
      >
        {attentionRows.length === 0 ? (
          <EmptyState titleKey="dashboard.noTickets" />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {attentionRows.map((row, index) => (
              <li key={`${row.kind}-${index}`}>
                <Link to={row.href} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-caption tabular-nums ${statusBadgeClass(row.status)}`}>{row.statusLabel}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body1 font-medium text-text-primary">{row.title}</span>
                    <span className="mt-0.5 block truncate text-caption text-text-muted">{row.kind}{row.meta ? ` · ${row.meta}` : ''}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Workload */}
      <Panel
        title={t('dashboard.workload')}
        description={t('dashboard.workloadDescription')}
        actions={<Link to="/ticket-workload" className="text-body2 font-medium text-primary-700 hover:underline dark:text-primary-300">{t('dashboard.viewWorkload')}</Link>}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {([{ key: 'current', label: t('dashboard.currentWeek') }, { key: 'next', label: t('dashboard.nextWeek') }] as const).map(({ key, label }) => (
            <div key={key}>
              <h3 className="text-h3 text-text-primary">{label}</h3>
              <div className="mt-3 space-y-3">
                {workload[key].slice(0, 10).map((entry) => (
                  <div key={entry.user.id}>
                    <div className="flex justify-between gap-2 text-body2">
                      <span className="truncate text-text-secondary">{entry.user.firstName || entry.user.lastName ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim() : entry.user.email}</span>
                      <span className={`font-semibold ${chartValueClass}`}>{entry.utilizationPercent}%</span>
                    </div>
                    {/* Chart language (LT-4): track = sunken surface, series = primary tone. */}
                    <div className={`mt-1 h-2 overflow-hidden rounded ${chartTrackClass}`} role="img" aria-label={`${entry.user.email}: ${entry.utilizationPercent}%`}>
                      <div className={`h-full rounded ${chartSeriesTone('primary')}`} style={{ width: `${Math.min(entry.utilizationPercent, 100)}%` }} />
                    </div>
                  </div>
                ))}
                {workload[key].length === 0 && <p className="text-body2 text-text-muted">{t('dashboard.noWorkload')}</p>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Cost report */}
      {costReport && (
        <Panel title={t('dashboard.costReport')}>
          <div className="grid grid-cols-1 gap-section-gap md:grid-cols-3">
            <MetricCard label={t('dashboard.currentFiscalYear').replace('{fiscalYear}', costReport.currentFiscalYear.label)} value={money(costReport.currentFiscalYear.plannedAmount)} tone="neutral" />
            <MetricCard label={t('dashboard.knownCostsNextFiscalYear')} value={money(costReport.nextFiscalYearKnownCosts.knownAmount)} tone="info" />
            <MetricCard label={t('dashboard.acquiredCurrentFiscalYear')} value={money(costReport.currentFiscalYear.acquiredAmount)} tone="ok" />
          </div>
          <div className="mt-6 space-y-2" aria-label={t('dashboard.historicalDevelopment')}>
            <p className="text-body2 text-text-muted">{t('dashboard.historicalDevelopmentDescription')}</p>
            {costReport.historicalDevelopment.map((year: any) => {
              const percentage = Math.min(100, Number(year.plannedAmount) / Math.max(1, Number(costReport.currentFiscalYear.plannedAmount)) * 100);
              return (
                <div key={year.fiscalYearLabel} className="flex items-center gap-3">
                  <span className={`w-20 ${chartAxisLabelClass}`}>{year.fiscalYearLabel}</span>
                  {/* Chart language (LT-4): track = sunken surface, series = primary tone. */}
                  <div className={`h-3 flex-1 rounded ${chartTrackClass}`} role="progressbar" aria-label={`${year.fiscalYearLabel}: ${money(year.plannedAmount)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}>
                    <div className={`h-3 rounded ${chartSeriesTone('primary')}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <span className={`w-14 text-right ${chartAxisLabelClass}`}>{Math.round(percentage)}%</span>
                  <span className={`w-28 text-right ${chartValueClass}`}>{money(year.plannedAmount)}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </PageShell>
  );
};

export default Dashboard;

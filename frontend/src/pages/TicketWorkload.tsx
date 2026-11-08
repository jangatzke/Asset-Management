import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTableShell from '../components/DataTableShell';
import { useI18n } from '../context/I18nContext';
import { ticketApi, type TicketWorkloadEntry } from '../services/api';
import { exportCsv } from '../utils/csvExport';
import { formatApiError } from '../utils/apiError';
import PageShell from '../components/PageShell';

function currentIsoWeek(): string {
  const date = new Date();
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - start.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const userName = (entry: TicketWorkloadEntry) => entry.user.firstName || entry.user.lastName
  ? `${entry.user.firstName || ''} ${entry.user.lastName || ''}`.trim()
  : entry.user.email;

export default function TicketWorkload() {
  const { t } = useI18n();
  const [week, setWeek] = useState(currentIsoWeek());
  const [search, setSearch] = useState('');
  const [ticketsOnly, setTicketsOnly] = useState(false);
  const [entries, setEntries] = useState<TicketWorkloadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    ticketApi.workload({ week, search: search || undefined, ticketsOnly }).then((response) => {
      setEntries(response.data.data);
      setError(null);
    }).catch((caught: unknown) => setError(formatApiError(caught, t('ticketWorkload.loadError'), t('common.referenceId')))).finally(() => setLoading(false));
  }, [search, t, ticketsOnly, week]);

  const visibleEntries = useMemo(() => entries.filter((entry) => !ticketsOnly || entry.ticketCount > 0), [entries, ticketsOnly]);
  const exportVisible = () => exportCsv(`ticket-workload-${week}`, [
    t('ticketWorkload.employee'), t('ticketWorkload.email'), t('ticketWorkload.utilization'), t('ticketWorkload.effortUnits'), t('ticketWorkload.ticketCount'), t('ticketWorkload.unestimated'),
  ], visibleEntries.map((entry) => [userName(entry), entry.user.email, `${entry.utilizationPercent}%`, entry.effortUnits, entry.ticketCount, entry.unestimatedTicketCount]));

  return <PageShell>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ticketWorkload.title')}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('ticketWorkload.description')}</p></div>
      <Link to="/" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">← {t('navigation.dashboard')}</Link>
    </div>
    <DataTableShell toolbar={<div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('ticketWorkload.week')}<input type="week" value={week} onChange={(event) => setWeek(event.target.value)} className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label><label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('common.search')}<input value={search} onChange={(event) => setSearch(event.target.value)} className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label><label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={ticketsOnly} onChange={(event) => setTicketsOnly(event.target.checked)} />{t('ticketWorkload.ticketsOnly')}</label></div>} onExport={exportVisible} exportLabel={t('common.exportCsv')}>
      {error ? <p role="alert" className="p-5 text-status-critical-fg">{error}</p> : loading ? <p className="p-5 text-text-muted">{t('common.loading')}</p> : <table className="min-w-full divide-y divide-border-subtle"><thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted text-left"><tr><th scope="col" className="px-4 py-2.5 text-caption text-text-muted">{t('ticketWorkload.employee')}</th><th scope="col" className="px-4 py-2.5 text-caption text-text-muted">{t('ticketWorkload.utilization')}</th><th scope="col" className="px-4 py-2.5 text-caption text-text-muted">{t('ticketWorkload.effortUnits')}</th><th scope="col" className="px-4 py-2.5 text-caption text-text-muted">{t('ticketWorkload.ticketCount')}</th><th scope="col" className="px-4 py-2.5 text-caption text-text-muted">{t('ticketWorkload.unestimated')}</th></tr></thead><tbody className="bg-surface-default divide-y divide-border-subtle">{visibleEntries.map((entry) => <tr key={entry.user.id} className="transition-colors duration-fast hover:bg-surface-hover"><td className="px-4 py-3 text-body2"><span className="font-medium text-text-primary">{userName(entry)}</span><span className="block text-caption text-text-muted">{entry.user.email}</span></td><td className="px-4 py-3 text-body2"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded bg-surface-hover"><div className="h-full bg-primary-600" style={{ width: `${Math.min(entry.utilizationPercent, 100)}%` }} /></div><span className="font-semibold tabular-nums text-text-primary">{entry.utilizationPercent}%</span></div></td><td className="px-4 py-3 text-body2 tabular-nums text-text-secondary">{entry.effortUnits}</td><td className="px-4 py-3 text-body2 tabular-nums text-text-secondary">{entry.ticketCount}</td><td className="px-4 py-3 text-body2 tabular-nums text-text-secondary">{entry.unestimatedTicketCount}</td></tr>)}{visibleEntries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-body2 text-text-muted">{t('ticketWorkload.empty')}</td></tr>}</tbody></table>}
    </DataTableShell>
  </PageShell>;
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTableShell from '../components/DataTableShell';
import { useI18n } from '../context/I18nContext';
import { ticketApi, type TicketWorkloadEntry } from '../services/api';
import { exportCsv } from '../utils/csvExport';

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
    }).catch(() => setError(t('ticketWorkload.loadError'))).finally(() => setLoading(false));
  }, [search, t, ticketsOnly, week]);

  const visibleEntries = useMemo(() => entries.filter((entry) => !ticketsOnly || entry.ticketCount > 0), [entries, ticketsOnly]);
  const exportVisible = () => exportCsv(`ticket-workload-${week}`, [
    t('ticketWorkload.employee'), t('ticketWorkload.email'), t('ticketWorkload.utilization'), t('ticketWorkload.effortUnits'), t('ticketWorkload.ticketCount'), t('ticketWorkload.unestimated'),
  ], visibleEntries.map((entry) => [userName(entry), entry.user.email, `${entry.utilizationPercent}%`, entry.effortUnits, entry.ticketCount, entry.unestimatedTicketCount]));

  return <main id="main-content" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ticketWorkload.title')}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('ticketWorkload.description')}</p></div>
      <Link to="/" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">← {t('navigation.dashboard')}</Link>
    </div>
    <DataTableShell toolbar={<div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('ticketWorkload.week')}<input type="week" value={week} onChange={(event) => setWeek(event.target.value)} className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label><label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('common.search')}<input value={search} onChange={(event) => setSearch(event.target.value)} className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></label><label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={ticketsOnly} onChange={(event) => setTicketsOnly(event.target.checked)} />{t('ticketWorkload.ticketsOnly')}</label></div>} onExport={exportVisible} exportLabel={t('common.exportCsv')}>
      {error ? <p role="alert" className="p-5 text-red-700 dark:text-red-300">{error}</p> : loading ? <p className="p-5 text-gray-500">{t('common.loading')}</p> : <table className="min-w-full text-sm"><thead className="bg-gray-50 text-left dark:bg-gray-700"><tr><th className="px-4 py-3">{t('ticketWorkload.employee')}</th><th className="px-4 py-3">{t('ticketWorkload.utilization')}</th><th className="px-4 py-3">{t('ticketWorkload.effortUnits')}</th><th className="px-4 py-3">{t('ticketWorkload.ticketCount')}</th><th className="px-4 py-3">{t('ticketWorkload.unestimated')}</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{visibleEntries.map((entry) => <tr key={entry.user.id}><td className="px-4 py-3"><span className="font-medium">{userName(entry)}</span><span className="block text-xs text-gray-500">{entry.user.email}</span></td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded bg-gray-200 dark:bg-gray-700"><div className="h-full bg-blue-600" style={{ width: `${Math.min(entry.utilizationPercent, 100)}%` }} /></div><span className="font-semibold">{entry.utilizationPercent}%</span></div></td><td className="px-4 py-3">{entry.effortUnits}</td><td className="px-4 py-3">{entry.ticketCount}</td><td className="px-4 py-3">{entry.unestimatedTicketCount}</td></tr>)}{visibleEntries.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">{t('ticketWorkload.empty')}</td></tr>}</tbody></table>}
    </DataTableShell>
  </main>;
}

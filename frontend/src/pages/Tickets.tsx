import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import { ticketApi, type TicketResponse } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';

const ticketTypes = ['incident', 'service_request', 'problem', 'change'];
const badge = (value: string) => `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${value === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : value === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' : value === 'closed' || value === 'fulfilled' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'}`;

export default function Tickets() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const canWrite = Boolean(user?.roles?.some((role) => ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager'].includes(role)));
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [statusGroup, setStatusGroup] = useState('');
  const [scope, setScope] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'service_request', title: '', description: '', urgency: 'medium', impact: 'medium' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ticketApi.list({ search: query || undefined, type: type || undefined, statusGroup: statusGroup || undefined, scope: scope || undefined });
      setTickets(response.data.data ?? []);
      setError(null);
    } catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.loadError')); } finally { setLoading(false); }
  }, [query, scope, statusGroup, t, type]);

  useEffect(() => { void load(); }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      const data: any = { ...form, requesterId: user?.id };
      if (form.type === 'problem') data.problem = {};
      if (form.type === 'change') data.change = { changeType: 'normal', riskLevel: 'medium' };
      if (form.type === 'service_request') data.serviceRequest = {};
      if (form.type === 'incident') { setError(t('tickets.incidentCreateError')); return; }
      await ticketApi.create(data); setModalOpen(false); setForm({ type: 'service_request', title: '', description: '', urgency: 'medium', impact: 'medium' }); await load();
    } catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.createError')); } finally { setSaving(false); }
  };

  return <main id="main-content" className="mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tickets.title')}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('tickets.description')}</p></div>{canWrite && <button onClick={() => setModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"><PlusIcon className="h-5 w-5" />{t('tickets.newTicket')}</button>}</div>
    {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    <section className="mb-4 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_12rem_auto]"><input aria-label={t('tickets.searchLabel')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load()} placeholder={t('tickets.searchPlaceholder')} className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"/><select aria-label={t('tickets.typeLabel')} value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"><option value="">{t('tickets.allTypes')}</option>{ticketTypes.map((value) => <option key={value} value={value}>{t(`tickets.types.${value}`)}</option>)}</select><select aria-label={t('tickets.statusLabel')} value={statusGroup} onChange={(e) => setStatusGroup(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"><option value="">{t('tickets.allStatuses')}</option><option value="open">{t('tickets.open')}</option><option value="assigned">{t('tickets.assigned')}</option><option value="closed">{t('tickets.closed')}</option></select><select aria-label={t('tickets.scopeLabel')} value={scope} onChange={(e) => setScope(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"><option value="">{t('tickets.allTickets')}</option><option value="created">{t('tickets.createdByMe')}</option><option value="assigned">{t('tickets.assignedToMe')}</option></select><button onClick={() => void load()} className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">{t('tickets.filter')}</button></div></section>
    <section className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{['ticket', 'type', 'priority', 'status', 'slaTarget', 'updated'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-200">{t(`tickets.headings.${heading}`)}</th>)}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{loading ? <tr><td colSpan={6} className="p-8 text-center text-gray-500">{t('tickets.loading')}</td></tr> : tickets.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-500">{t('tickets.empty')}</td></tr> : tickets.map((ticket) => <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700"><td className="px-4 py-3"><Link to={`/tickets/${ticket.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{ticket.displayId}</Link><div className="max-w-sm truncate text-sm text-gray-700 dark:text-gray-200">{ticket.title}</div></td><td className="px-4 py-3 text-sm">{t(`tickets.types.${ticket.type}`)}</td><td className="px-4 py-3"><span className={badge(ticket.priority)}>{t(`tickets.priorities.${ticket.priority}`)}</span></td><td className="px-4 py-3"><span className={badge(ticket.status)}>{ticket.status.replace(/_/g, ' ')}</span></td><td className="px-4 py-3 text-sm">{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : '—'}</td><td className="px-4 py-3 text-sm">{new Date(ticket.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>
    <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('tickets.newTicket')}><form onSubmit={submit} className="space-y-4"><label className="block text-sm font-medium">{t('tickets.typeLabel')}<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700">{ticketTypes.filter((value) => value !== 'incident').map((value) => <option key={value} value={value}>{t(`tickets.types.${value}`)}</option>)}</select></label><label className="block text-sm font-medium">{t('common.title')}<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700" /></label><label className="block text-sm font-medium">{t('common.description')}<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700" rows={4}/></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">{t('tickets.headings.priority')}<select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700">{['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{t(`tickets.priorities.${value}`)}</option>)}</select></label><label className="text-sm font-medium">{t('tickets.detail.priority')}<select value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700">{['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{t(`tickets.priorities.${value}`)}</option>)}</select></label></div><div className="flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded-md px-4 py-2">{t('common.cancel')}</button><button disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{saving ? t('common.saving') : t('common.create')}</button></div></form></Modal>
  </main>;
}

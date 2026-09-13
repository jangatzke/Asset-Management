import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import { ticketApi, type TicketResponse } from '../services/api';
import { Modal } from '../components/Modal';
import { EmptyState } from '../components/EmptyState';
import { ActiveFilters } from '../components/ActiveFilters';
import { StatusBadge } from '../components/StatusBadge';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import { usePersistedView } from '../hooks/usePersistedView';
import { buttonPrimary, inputField, selectField } from '../styles/tokens';

const ticketTypes = ['incident', 'service_request', 'problem', 'change'];

export default function Tickets() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const canWrite = Boolean(user?.roles?.some((role) => ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager'].includes(role)));

  // Filters, page and sort are owned by the URL (filters + page) and localStorage
  // (sort + column order) via usePersistedView, so a filtered link is shareable
  // and the view survives reload/revisit.
  const { filters, page, setPage, setFilter, sort, toggleSort, clearView } = usePersistedView({
    routeKey: 'tickets',
    filterKeys: ['type', 'statusGroup', 'scope'],
    defaultSort: { column: 'created', direction: 'desc' },
    defaultColumns: ['ticket', 'type', 'priority', 'status', 'slaTarget', 'reportedBy', 'created', 'updated'],
  });

  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'service_request', title: '', description: '', urgency: 'medium', impact: 'medium' });
  const [pagination, setPagination] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 1 });

  const type = filters.type ?? '';
  const statusGroup = filters.statusGroup ?? '';
  const scope = filters.scope ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ticketApi.list({ page, limit: 20, search: query || undefined, type: type || undefined, statusGroup: statusGroup || undefined, scope: scope || undefined });
      setTickets(response.data.data ?? []);
      if (response.data.pagination) {
        setPagination({ total: response.data.pagination.total ?? response.data.data?.length ?? 0, totalPages: response.data.pagination.totalPages ?? 1 });
      }
      setError(null);
    } catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.loadError')); } finally { setLoading(false); }
  }, [page, query, scope, statusGroup, t, type]);

  useEffect(() => { void load(); }, [load]);

  // Client-side sort of the already-loaded page. Sorting is a view preference
  // persisted in localStorage, so the direction survives reload/revisit.
  const sortedTickets = useMemo(() => {
    if (!sort.column) return tickets;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (ticket: TicketResponse) => {
      if (sort.column === 'ticket') return `${ticket.displayId} ${ticket.title}`.toLowerCase();
      if (sort.column === 'type') return ticket.type;
      if (sort.column === 'priority') return ticket.priority;
      if (sort.column === 'status') return ticket.status;
      if (sort.column === 'slaTarget') return ticket.resolutionDueAt ?? '';
      if (sort.column === 'reportedBy') return (ticket.requester?.firstName ?? '') + ' ' + (ticket.requester?.lastName ?? '') + ' ' + (ticket.requester?.email ?? '');
      if (sort.column === 'created') return ticket.openedAt ?? ticket.createdAt ?? '';
      if (sort.column === 'updated') return ticket.updatedAt ?? '';
      return '';
    };
    return [...tickets].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [tickets, sort]);

  const exportVisibleTickets = () => exportCsv('tickets', [
    t('tickets.headings.ticket'), t('tickets.headings.type'), t('tickets.headings.priority'), t('tickets.headings.status'), t('tickets.headings.slaTarget'), t('tickets.headings.reportedBy'), t('tickets.headings.created'), t('tickets.headings.updated'),
  ], sortedTickets.map((ticket) => [
    `${ticket.displayId} — ${ticket.title}`, t(`tickets.types.${ticket.type}`), t(`tickets.priorities.${ticket.priority}`), ticket.status, ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : '', ticket.requester ? `${ticket.requester.firstName ?? ''} ${ticket.requester.lastName ?? ''}`.trim() || ticket.requester.email : '', ticket.openedAt ?? ticket.createdAt ?? '', ticket.updatedAt ?? '',
  ]));

  const handleClearView = useCallback(() => {
    clearView();
    setQuery('');
  }, [clearView]);

  // Listen for the global "create ticket" request dispatched by Layout when the
  // `n` shortcut fires on this list page.
  useEffect(() => {
    const handleNewEvent = () => setModalOpen(true);
    document.addEventListener('am:new-ticket', handleNewEvent);
    return () => document.removeEventListener('am:new-ticket', handleNewEvent);
  }, []);

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

  const chips = [
    type ? { value: 'type', label: t(`tickets.types.${type}`), onRemove: () => setFilter('type', '') } : null,
    statusGroup ? { value: 'statusGroup', label: t(`tickets.${statusGroup}`), onRemove: () => setFilter('statusGroup', '') } : null,
    scope ? { value: 'scope', label: t(`tickets.${scope}`), onRemove: () => setFilter('scope', '') } : null,
  ].filter((chip): chip is Exclude<typeof chip, null> => chip !== null);

  return <main id="main-content" className="mx-auto max-w-screen-2xl p-4 sm:p-6 lg:p-8">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('tickets.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('tickets.description')}</p>
      </div>
      {canWrite && <button onClick={() => setModalOpen(true)} className={buttonPrimary}><PlusIcon className="h-5 w-5" />{t('tickets.newTicket')}</button>}
    </div>
    {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    <DataTableShell
      onExport={exportVisibleTickets}
      exportLabel="Export CSV"
      filters={<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_12rem_auto]">
        <input aria-label={t('tickets.searchLabel')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void load()} placeholder={t('tickets.searchPlaceholder')} className={inputField} />
        <select aria-label={t('tickets.typeLabel')} value={type} onChange={(e) => setFilter('type', e.target.value)} className={selectField}>
          <option value="">{t('tickets.allTypes')}</option>
          {ticketTypes.map((value) => <option key={value} value={value}>{t(`tickets.types.${value}`)}</option>)}
        </select>
        <select aria-label={t('tickets.statusLabel')} value={statusGroup} onChange={(e) => setFilter('statusGroup', e.target.value)} className={selectField}>
          <option value="">{t('tickets.allStatuses')}</option>
          <option value="open">{t('tickets.open')}</option>
          <option value="assigned">{t('tickets.assigned')}</option>
          <option value="closed">{t('tickets.closed')}</option>
        </select>
        <select aria-label={t('tickets.scopeLabel')} value={scope} onChange={(e) => setFilter('scope', e.target.value)} className={selectField}>
          <option value="">{t('tickets.allTickets')}</option>
          <option value="created">{t('tickets.createdByMe')}</option>
          <option value="assigned">{t('tickets.assignedToMe')}</option>
        </select>
        <button onClick={() => void load()} className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700">{t('tickets.filter')}</button>
      </div>}
    >
      {chips.length > 0 && (
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-5">
          <ActiveFilters labelKey="tickets.filterTitle" clearAllKey="common.clearAll" onClearView={handleClearView} chips={chips} />
        </div>
      )}
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <SortableTh column="ticket" label={t('tickets.headings.ticket')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="type" label={t('tickets.headings.type')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="priority" label={t('tickets.headings.priority')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="status" label={t('tickets.headings.status')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="slaTarget" label={t('tickets.headings.slaTarget')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="reportedBy" label={t('tickets.headings.reportedBy')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="created" label={t('tickets.headings.created')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
              <SortableTh column="updated" label={t('tickets.headings.updated')} activeColumn={sort.column} direction={sort.direction} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">{t('tickets.loading')}</td></tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8">
                  <EmptyState
                    titleKey="tickets.emptyTitle"
                    descriptionKey="tickets.emptyDescription"
                    action={canWrite ? (
                      <button onClick={() => setModalOpen(true)} className={buttonPrimary}><PlusIcon className="h-5 w-5" />{t('tickets.emptyAction')}</button>
                    ) : undefined}
                  />
                </td>
              </tr>
            ) : sortedTickets.map((ticket) => (
               <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-3">
                  <Link to={`/tickets/${ticket.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{ticket.displayId}</Link>
                  <div className="max-w-sm truncate text-sm text-gray-900 dark:text-gray-100">{ticket.title}</div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{t(`tickets.types.${ticket.type}`)}</td>
                <td className="px-4 py-3"><StatusBadge kind="priority" value={ticket.priority} label={t(`tickets.priorities.${ticket.priority}`)} ariaLabel={t('tickets.headings.priority')} /></td>
                <td className="px-4 py-3"><StatusBadge kind="state" value={ticket.status} label={ticket.status.replace(/_/g, ' ')} ariaLabel={t('tickets.headings.status')} /></td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{ticket.requester ? `${ticket.requester.firstName ?? ''} ${ticket.requester.lastName ?? ''}`.trim() || ticket.requester.email : '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{ticket.openedAt ? new Date(ticket.openedAt).toLocaleString() : ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 border-t border-gray-200 p-4 dark:border-gray-700">
          <button onClick={() => setPage(page - 1)} disabled={page <= 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {t('common.back')}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {pagination.totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {t('common.next')}
          </button>
        </div>
      )}
    </DataTableShell>
    <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('tickets.newTicket')}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">{t('tickets.typeLabel')}
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700">
            {ticketTypes.filter((value) => value !== 'incident').map((value) => <option key={value} value={value}>{t(`tickets.types.${value}`)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t('common.title')}<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700" /></label>
        <label className="block text-sm font-medium">{t('common.description')}<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700" rows={4}/></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">{t('tickets.headings.priority')}
            <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700">{['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{t(`tickets.priorities.${value}`)}</option>)}</select>
          </label>
          <label className="text-sm font-medium">{t('tickets.detail.priority')}
            <select value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} className="mt-1 w-full rounded-md border p-2 dark:bg-gray-700">{['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{t(`tickets.priorities.${value}`)}</option>)}</select>
          </label>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setModalOpen(false)} className="rounded-md px-4 py-2">{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? t('common.saving') : t('common.create')}</button>
        </div>
      </form>
    </Modal>
  </main>;
}

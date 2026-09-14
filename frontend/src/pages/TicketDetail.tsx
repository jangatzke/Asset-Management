import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ticketApi, type AssetContextResponse, type TicketResponse } from '../services/api';
import { getAllowedTicketTransitions, isTerminalTicketStatus, REOPEN_TARGET_STATUS } from '../../../shared/src/ticketTransitions';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import EntityPicker from '../components/EntityPicker';
import { Modal } from '../components/Modal';
import type { EntityPickerResult } from '../services/entityPickerApi';

/** Human-readable label for an assignee (name when available, else email). */
function assigneeLabel(assignee: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!assignee) return '';
  return assignee.firstName || assignee.lastName ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : assignee.email;
}

export default function TicketDetail() {
  const { t } = useI18n();
  const { ticketId } = useParams();
  const user = useAuthStore((state) => state.user);
  const ITIL_ROLES = ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager', 'ticket_coordinator'];
  const canWrite = Boolean(user?.roles?.some((role) => ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager'].includes(role)));
  const canClose = Boolean(user?.roles?.some((role) => ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager'].includes(role)));
  const canAssign = Boolean(user?.roles?.some((role) => ITIL_ROLES.includes(role)));
  const canContext = Boolean(user?.roles?.some((role) => ITIL_ROLES.includes(role)));
  const [ticket, setTicket] = useState<TicketResponse | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [requesterCommentText, setRequesterCommentText] = useState('');
  const [internal, setInternal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [assignee, setAssignee] = useState<{ id: string; email: string; firstName?: string | null; lastName?: string | null } | null>(null);
  const [assigneePicker, setAssigneePicker] = useState<EntityPickerResult | null>(null);
  const [assetContext, setAssetContext] = useState<AssetContextResponse | null>(null);
  const [assetPickerValues, setAssetPickerValues] = useState<EntityPickerResult[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [ticketResponse, assetContextResponse] = await Promise.all([
        ticketApi.getById(ticketId),
        ticketApi.getAssets(ticketId).catch(() => ({ data: { ticketId, assets: [] } })) as any,
      ]);
      setTicket(ticketResponse.data);
      setAssetContext(assetContextResponse.data);
      setAssetPickerValues([]);
      const assignee = ticketResponse.data.assignee;
      setAssignee(assignee ?? null);
      // Do NOT pre-fill the assignee picker with the current assignee: the input
      // is only used to assign a NEW assignee, so it must start empty. The current
      // assignee is displayed separately in the <dd> below the label.
      setAssigneePicker(null);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('tickets.detail.loadError'));
    }
  }, [t, ticketId]);

  useEffect(() => { void load(); }, [load]);

  const openHistory = async () => {
    if (!ticketId) return;
    setHistoryOpen(true);
    if (historyLoaded) return;
    try {
      const response = await ticketApi.history(ticketId);
      setHistory(response.data.data ?? []);
      setHistoryLoaded(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('tickets.detail.loadError'));
    }
  };

  const transition = async (status: string) => {
    if (!ticketId) return;
    setWorking(true);
    try { await ticketApi.changeStatus(ticketId, { status }); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.detail.statusError')); }
    finally { setWorking(false); }
  };
  const updateEstimatedEffort = async (value: string) => {
    if (!ticketId || value === '') return;
    const estimatedEffortUnits = Number(value);
    if (!Number.isInteger(estimatedEffortUnits) || estimatedEffortUnits < 0) return;
    setWorking(true);
    try { await ticketApi.update(ticketId, { estimatedEffortUnits }); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('common.saveError')); }
    finally { setWorking(false); }
  };
  const updatePriority = async (priority: string) => {
    if (!ticketId || !ticket || priority === ticket.priority) return;
    setWorking(true);
    try { await ticketApi.update(ticketId, { priority }); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('common.saveError')); }
    finally { setWorking(false); }
  };
const addComment = async (event: FormEvent) => {
  event.preventDefault();
  if (!ticketId || !comment.trim()) return;
  setWorking(true);
  try { await ticketApi.comment(ticketId, { body: comment, isInternal: internal }); setComment(''); await load(); }
  catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.detail.commentError')); }
  finally { setWorking(false); }
};

  const requesterCommentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticketId || !requesterCommentText.trim()) return;
    setWorking(true);
    try { await ticketApi.requesterComment(ticketId, { body: requesterCommentText }); setRequesterCommentText(''); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.detail.commentError')); }
    finally { setWorking(false); }
  };

  const close = async () => {
    const summary = window.prompt(t('tickets.detail.closurePrompt'));
    if (!summary?.trim() || !ticketId) return;
    setWorking(true);
    try { await ticketApi.close(ticketId, { summary }); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.detail.closeError')); }
    finally { setWorking(false); }
  };

  const assignAssignee = async () => {
    if (!ticketId) return;
    setWorking(true);
    try {
      await ticketApi.assign(ticketId, { assigneeId: assigneePicker?.id ?? null });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('tickets.detail.assignError'));
    } finally { setWorking(false); }
  };

  const addAssets = async () => {
    if (!assetPickerValues.length || !ticketId) return;
    setWorking(true);
    try {
      await ticketApi.addAssets(ticketId, { assetIds: assetPickerValues.map((v) => v.id) });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('tickets.detail.attachError'));
    } finally { setWorking(false); }
  };

  const removeAsset = async (assetId: string) => {
    if (!ticketId) return;
    setWorking(true);
    try {
      await ticketApi.removeAssets(ticketId, { assetIds: [assetId] });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('tickets.detail.detachError'));
    } finally { setWorking(false); }
  };

  if (!ticket && !error) return <main className="p-8 text-gray-600 dark:text-gray-300">{t('tickets.detail.loading')}</main>;
  if (!ticket) return <main className="p-8"><Link to="/tickets" className="text-blue-700 hover:underline">← {t('navigation.tickets')}</Link><p role="alert" className="mt-4 text-red-700">{error}</p></main>;

  const targets = getAllowedTicketTransitions(ticket.type as any, ticket.status);
  const selectableStatuses = isTerminalTicketStatus(ticket.type as any, ticket.status)
    ? [ticket.status, REOPEN_TARGET_STATUS[ticket.type]]
    : [ticket.status, ...targets];
  return <main id="main-content" className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
    <Link to="/tickets" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">← {t('tickets.detail.allTickets')}</Link>
    {error && <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    <header className="mt-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{ticket.displayId} – {ticket.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-gray-700 dark:text-gray-200">{ticket.description || t('tickets.detail.noDescription')}</p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-gray-500">{t('common.type')}</dt><dd className="font-semibold">{t(`tickets.types.${ticket.type}`)}</dd></div>
          <div><dt className="text-gray-500">{t('tickets.detail.status')}</dt><dd>{canWrite ? <select value={ticket.status} disabled={working} onChange={(event) => { if (event.target.value !== ticket.status) void transition(event.target.value); }} aria-label={t('tickets.detail.status')} className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 font-semibold text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white">{selectableStatuses.filter((status, index, values) => values.indexOf(status) === index).map((status) => <option key={status} value={status}>{t(`tickets.status.${status}`)}</option>)}</select> : <span className="font-semibold">{t(`tickets.status.${ticket.status}`)}</span>}</dd></div>
          <div><dt className="text-gray-500">{t('tickets.detail.priority')}</dt><dd>{canWrite ? <select value={ticket.priority} disabled={working} onChange={(event) => void updatePriority(event.target.value)} aria-label={t('tickets.detail.priority')} className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 font-semibold text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white">{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{t(`tickets.priorities.${priority}`)}</option>)}</select> : <span className="font-semibold">{t(`tickets.priorities.${ticket.priority}`)}</span>}</dd></div>
          <div><dt className="text-gray-500">{t('tickets.detail.slaTarget')}</dt><dd>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : t('tickets.detail.notConfigured')}</dd></div>
          <div><dt className="text-gray-500" title={t('tickets.detail.estimatedEffortHint')}>{t('tickets.detail.estimatedEffort')}</dt><dd>{canWrite ? <input type="number" min="0" step="1" defaultValue={ticket.estimatedEffortUnits ?? ''} onBlur={(event) => void updateEstimatedEffort(event.target.value)} disabled={working} aria-label={t('tickets.detail.estimatedEffortHint')} className="w-20 rounded-md border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /> : ticket.estimatedEffortUnits ?? '–'}</dd></div>
        </dl>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
        <button onClick={() => void openHistory()} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">{t('tickets.detail.historyButton')}</button>
        {canClose && !isTerminalTicketStatus(ticket.type as any, ticket.status) && <button disabled={working} onClick={() => void close()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">{t('tickets.detail.closeTicket')}</button>}
      </div>
    </header>
    <section className="mt-6 rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-bold">{t('tickets.detail.assignmentTitle')}</h2>
          <dl className="mt-3 text-sm">
            <div><dt className="text-gray-500">{t('tickets.detail.assignee')}</dt><dd className="font-semibold">{assignee ? assigneeLabel(assignee) : t('tickets.detail.unassigned')}</dd></div>
          </dl>
          {canAssign && <div className="mt-3">
            <EntityPicker labelKey="tickets.detail.assignee" entityType="user" value={assigneePicker} onChange={setAssigneePicker} />
            <div className="mt-2 flex gap-2">
              <button disabled={working} onClick={() => void assignAssignee()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{t('tickets.detail.assign')}</button>
              {assignee && <button disabled={working} onClick={() => void assignAssignee()} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">{t('tickets.detail.unassign')}</button>}
            </div>
          </div>}
        </div>
        <div>
          <h2 className="text-lg font-bold">{t('tickets.detail.assetContextTitle')}</h2>
          <div className="mt-3">
            {assetContext?.assets?.length ? (
              <ul className="space-y-2">
                {assetContext.assets.map((entry) => {
                  const a = entry.asset;
                  return <li key={entry.id} className="flex items-center justify-between rounded border p-2 dark:border-gray-700">
                    <Link to={`/assets/${a?.id}`} className="group flex flex-1 items-center gap-2 text-blue-700 hover:underline dark:text-blue-300">
                      <span className="font-semibold">{a?.displayId}</span> · {a?.name}
                      <div className="text-xs text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300">{a?.assetType?.name} · {a?.manufacturer || t('tickets.detail.noManufacturer')} · {a?.status || ''}</div>
                    </Link>
                    {canContext && <button onClick={() => void removeAsset(a!.id)} className="text-sm text-red-700 hover:underline dark:text-red-300">{t('tickets.detail.detach')}</button>}
                  </li>;
                })}
              </ul>
            ) : <p className="text-sm text-gray-500">{t('tickets.detail.noAssets')}</p>}
          </div>
          {canContext && <div className="mt-3">
            <EntityPicker labelKey="tickets.detail.attachAsset" entityType="asset" multiple values={assetPickerValues} onValuesChange={setAssetPickerValues} />
            <div className="mt-2">
              <button disabled={working || !assetPickerValues.length} onClick={() => void addAssets()} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{t('tickets.detail.attachAssets')}</button>
            </div>
          </div>}
        </div>
      </div>
    </section>
    <section className="mt-6 rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-bold">{t('tickets.detail.commentsTitle')}</h2>
        <div className="mt-4 space-y-3">
          {ticket.comments?.length ? ticket.comments.map((entry) => (
            <article key={entry.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-1 text-xs font-semibold text-gray-500">
                {entry.isInternal ? t('tickets.detail.internalWorkNote') : t('tickets.detail.requesterComment')}
                · {entry.authorName ? `${t('tickets.detail.by')} ${entry.authorName}` : t('tickets.detail.anonymous')}
                · {new Date(entry.createdAt).toLocaleString()}
              </div>
              <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
            </article>
          )) : <p className="text-sm text-gray-500">{t('tickets.detail.noComments')}</p>}
        </div>
        {canWrite && <form onSubmit={addComment} className="mt-4 border-t pt-4 dark:border-gray-700">
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} required rows={3} placeholder={t('tickets.detail.updatePlaceholder')} className="w-full rounded-md border p-2 dark:bg-gray-700" />
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> {t('tickets.detail.internalWorkNote')}</label>
          <button disabled={working} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('tickets.detail.addUpdate')}</button>
        </form>}
        {!canWrite && user?.id === ticket.requester?.id && <form onSubmit={requesterCommentSubmit} className="mt-4 border-t pt-4 dark:border-gray-700">
          <textarea value={requesterCommentText} onChange={(event) => setRequesterCommentText(event.target.value)} required rows={3} placeholder={t('tickets.detail.requesterCommentPlaceholder')} className="w-full rounded-md border p-2 dark:bg-gray-700" />
          <button disabled={working} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('tickets.detail.submitComment')}</button>
        </form>}
    </section>
    <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title={t('tickets.detail.historyTitle')} maxWidthClassName="max-w-2xl">
        <ol className="mt-4 space-y-3">
          {history.length ? history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-blue-500 pl-3">
              <p className="text-sm font-semibold">{entry.action}</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{entry.summary}</p>
              <time className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</time>
            </li>
          )) : <li className="text-sm text-gray-500">{t('tickets.detail.noHistory')}</li>}
        </ol>
    </Modal>
  </main>;
}

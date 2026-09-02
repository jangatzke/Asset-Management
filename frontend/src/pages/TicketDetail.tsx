import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ticketApi, type TicketResponse } from '../services/api';
import { getAllowedTicketTransitions } from '../../../shared/src/ticketTransitions';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';

export default function TicketDetail() {
  const { t } = useI18n();
  const { ticketId } = useParams();
  const user = useAuthStore((state) => state.user);
  const canWrite = Boolean(user?.roles?.some((role) => ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager'].includes(role)));
  const canClose = Boolean(user?.roles?.some((role) => ['system_admin', 'ism_manager', 'service_desk_agent', 'it_manager'].includes(role)));
  const [ticket, setTicket] = useState<TicketResponse | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [ticketResponse, historyResponse] = await Promise.all([ticketApi.getById(ticketId), ticketApi.history(ticketId)]);
      setTicket(ticketResponse.data);
      setHistory(historyResponse.data.data ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? t('tickets.detail.loadError'));
    }
  }, [t, ticketId]);

  useEffect(() => { void load(); }, [load]);

  const transition = async (status: string) => {
    if (!ticketId) return;
    setWorking(true);
    try { await ticketApi.changeStatus(ticketId, { status }); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.detail.statusError')); }
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

  const close = async () => {
    const summary = window.prompt(t('tickets.detail.closurePrompt'));
    if (!summary?.trim() || !ticketId) return;
    setWorking(true);
    try { await ticketApi.close(ticketId, { summary }); await load(); }
    catch (err: any) { setError(err.response?.data?.error?.message ?? t('tickets.detail.closeError')); }
    finally { setWorking(false); }
  };

  if (!ticket && !error) return <main className="p-8 text-gray-600 dark:text-gray-300">{t('tickets.detail.loading')}</main>;
  if (!ticket) return <main className="p-8"><Link to="/tickets" className="text-blue-700 hover:underline">← {t('navigation.tickets')}</Link><p role="alert" className="mt-4 text-red-700">{error}</p></main>;

  const targets = getAllowedTicketTransitions(ticket.type as any, ticket.status);
  return <main id="main-content" className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
    <Link to="/tickets" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">← {t('tickets.detail.allTickets')}</Link>
    {error && <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}
    <header className="mt-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800">
      <div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{ticket.displayId} · {t(`tickets.types.${ticket.type}`)}</p><h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{ticket.title}</h1><p className="mt-3 whitespace-pre-wrap text-gray-700 dark:text-gray-200">{ticket.description || t('tickets.detail.noDescription')}</p></div><dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm"><div><dt className="text-gray-500">{t('tickets.detail.status')}</dt><dd className="font-semibold">{ticket.status}</dd></div><div><dt className="text-gray-500">{t('tickets.detail.priority')}</dt><dd className="font-semibold">{t(`tickets.priorities.${ticket.priority}`)}</dd></div><div><dt className="text-gray-500">{t('tickets.detail.slaTarget')}</dt><dd>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : t('tickets.detail.notConfigured')}</dd></div></dl></div>
      {canWrite && <div className="mt-5 flex flex-wrap gap-2">{targets.map((status) => <button disabled={working} key={status} onClick={() => void transition(status)} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-200">{t('tickets.detail.moveTo').replace('{status}', status.replace(/_/g, ' '))}</button>)}{canClose && !['closed', 'cancelled', 'rejected'].includes(ticket.status) && <button disabled={working} onClick={() => void close()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">{t('tickets.detail.closeTicket')}</button>}</div>}
    </header>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"><h2 className="text-lg font-bold">{t('tickets.detail.commentsTitle')}</h2><div className="mt-4 space-y-3">{ticket.comments?.length ? ticket.comments.map((entry) => <article key={entry.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700"><div className="mb-1 text-xs font-semibold text-gray-500">{entry.isInternal ? t('tickets.detail.internalWorkNote') : t('tickets.detail.requesterComment')} · {new Date(entry.createdAt).toLocaleString()}</div><p className="whitespace-pre-wrap text-sm">{entry.body}</p></article>) : <p className="text-sm text-gray-500">{t('tickets.detail.noComments')}</p>}</div>{canWrite && <form onSubmit={addComment} className="mt-4 border-t pt-4 dark:border-gray-700"><textarea value={comment} onChange={(event) => setComment(event.target.value)} required rows={3} placeholder={t('tickets.detail.updatePlaceholder')} className="w-full rounded-md border p-2 dark:bg-gray-700"/><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)}/> {t('tickets.detail.internalWorkNote')}</label><button disabled={working} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('tickets.detail.addUpdate')}</button></form>}</section><section className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"><h2 className="text-lg font-bold">{t('tickets.detail.historyTitle')}</h2><ol className="mt-4 space-y-3">{history.length ? history.map((entry) => <li key={entry.id} className="border-l-2 border-blue-500 pl-3"><p className="text-sm font-semibold">{entry.action}</p><p className="text-sm text-gray-700 dark:text-gray-200">{entry.summary}</p><time className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</time></li>) : <li className="text-sm text-gray-500">{t('tickets.detail.noHistory')}</li>}</ol></section></div>
  </main>;
}

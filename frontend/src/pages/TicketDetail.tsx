import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ticketApi, type TicketResponse } from '../services/api';
import { getAllowedTicketTransitions } from '../../../shared/src/ticketTransitions';
import { useAuthStore } from '../store/auth';

export default function TicketDetail() {
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
      setTicket(ticketResponse.data); setHistory(historyResponse.data.data ?? []); setError(null);
    } catch (err: any) { setError(err.response?.data?.error?.message ?? 'Ticket could not be loaded.'); }
  }, [ticketId]);
  useEffect(() => { void load(); }, [load]);
  const transition = async (status: string) => { if (!ticketId) return; setWorking(true); try { await ticketApi.changeStatus(ticketId, { status }); await load(); } catch (err: any) { setError(err.response?.data?.error?.message ?? 'Status change failed.'); } finally { setWorking(false); } };
  const addComment = async (event: FormEvent) => { event.preventDefault(); if (!ticketId || !comment.trim()) return; setWorking(true); try { await ticketApi.comment(ticketId, { body: comment, isInternal: internal }); setComment(''); await load(); } catch (err: any) { setError(err.response?.data?.error?.message ?? 'Comment could not be added.'); } finally { setWorking(false); } };
  const close = async () => { const summary = window.prompt('Closure summary (required for the audit trail):'); if (!summary?.trim() || !ticketId) return; setWorking(true); try { await ticketApi.close(ticketId, { summary }); await load(); } catch (err: any) { setError(err.response?.data?.error?.message ?? 'Ticket could not be closed.'); } finally { setWorking(false); } };
  if (!ticket && !error) return <main className="p-8 text-gray-600 dark:text-gray-300">Loading ticket…</main>;
  if (!ticket) return <main className="p-8"><Link to="/tickets" className="text-blue-700 hover:underline">← Tickets</Link><p role="alert" className="mt-4 text-red-700">{error}</p></main>;
  const targets = getAllowedTicketTransitions(ticket.type as any, ticket.status);
  return <main id="main-content" className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><Link to="/tickets" className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">← All tickets</Link>{error && <div role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-100">{error}</div>}<header className="mt-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{ticket.displayId} · {ticket.type.replace(/_/g, ' ')}</p><h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{ticket.title}</h1><p className="mt-3 whitespace-pre-wrap text-gray-700 dark:text-gray-200">{ticket.description || 'No description provided.'}</p></div><dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm"><div><dt className="text-gray-500">Status</dt><dd className="font-semibold">{ticket.status}</dd></div><div><dt className="text-gray-500">Priority</dt><dd className="font-semibold">{ticket.priority}</dd></div><div><dt className="text-gray-500">SLA target</dt><dd>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : 'Not configured'}</dd></div></dl></div>{canWrite && <div className="mt-5 flex flex-wrap gap-2">{targets.map((status) => <button disabled={working} key={status} onClick={() => void transition(status)} className="rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:text-blue-200">Move to {status.replace(/_/g, ' ')}</button>)}{canClose && ['resolved','fulfilled','implemented'].includes(ticket.status) && <button disabled={working} onClick={() => void close()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">Close ticket</button>}</div>}</header><div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"><h2 className="text-lg font-bold">Comments and work notes</h2><div className="mt-4 space-y-3">{ticket.comments?.length ? ticket.comments.map((entry) => <article key={entry.id} className="rounded-md border border-gray-200 p-3 dark:border-gray-700"><div className="mb-1 text-xs font-semibold text-gray-500">{entry.isInternal ? 'Internal work note' : 'Requester-visible comment'} · {new Date(entry.createdAt).toLocaleString()}</div><p className="whitespace-pre-wrap text-sm">{entry.body}</p></article>) : <p className="text-sm text-gray-500">No comments yet.</p>}</div>{canWrite && <form onSubmit={addComment} className="mt-4 border-t pt-4 dark:border-gray-700"><textarea value={comment} onChange={(e) => setComment(e.target.value)} required rows={3} placeholder="Record an update…" className="w-full rounded-md border p-2 dark:bg-gray-700"/><label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)}/> Internal work note</label><button disabled={working} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add update</button></form>}</section><section className="rounded-lg bg-white p-5 shadow-sm dark:bg-gray-800"><h2 className="text-lg font-bold">Auditable ticket history</h2><ol className="mt-4 space-y-3">{history.length ? history.map((entry) => <li key={entry.id} className="border-l-2 border-blue-500 pl-3"><p className="text-sm font-semibold">{entry.action}</p><p className="text-sm text-gray-700 dark:text-gray-200">{entry.summary}</p><time className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</time></li>) : <li className="text-sm text-gray-500">No history entries.</li>}</ol></section></div></main>;
}

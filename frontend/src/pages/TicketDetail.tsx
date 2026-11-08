import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ticketApi, type AssetContextResponse, type TicketResponse } from '../services/api';
import { getAllowedTicketTransitions, isTerminalTicketStatus, REOPEN_TARGET_STATUS } from '../../../shared/src/ticketTransitions';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import EntityPicker from '../components/EntityPicker';
import { Modal } from '../components/Modal';
import DetailTabs from '../components/DetailTabs';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { formatApiError } from '../utils/apiError';
import PageShell from '../components/PageShell';
import { PageBreadcrumbs } from '../components/PageHeader';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';

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
  const [problemForm, setProblemForm] = useState<{ rootCause: string; workaround: string; permanentFix: string } | null>(null);
  const [changeForm, setChangeForm] = useState<{ changeType: string; riskLevel: string; cabApproved: boolean; implementationPlan: string; rollbackPlan: string } | null>(null);
  const [riskPicker, setRiskPicker] = useState<EntityPickerResult | null>(null);
  const navigate = useNavigate();
  // Detail leaf label comes from already-loaded page state (no extra fetch).
  const breadcrumbs = useBreadcrumbs({ leaf: ticket?.displayId ? `${ticket.displayId} – ${ticket.title}` : null });

  const load = useCallback(async () => {
    if (!ticketId) return;
    try {
      const [ticketResponse, assetContextResponse] = await Promise.all([
        ticketApi.getById(ticketId),
        ticketApi.getAssets(ticketId).catch(() => ({ data: { ticketId, assets: [] } })) as any,
      ]);
      setTicket(ticketResponse.data);
      setAssetContext(assetContextResponse.data);
      // Pre-fill the type-specific extension forms (ITIL problem/change data).
      const data = ticketResponse.data;
      setProblemForm(data.type === 'problem' ? { rootCause: data.problem?.rootCause ?? '', workaround: data.problem?.workaround ?? '', permanentFix: data.problem?.permanentFix ?? '' } : null);
      setChangeForm(data.type === 'change' ? { changeType: data.change?.changeType ?? 'standard', riskLevel: data.change?.riskLevel ?? 'low', cabApproved: Boolean(data.change?.cabApproved), implementationPlan: data.change?.implementationPlan ?? '', rollbackPlan: data.change?.rollbackPlan ?? '' } : null);
      setAssetPickerValues([]);
      const assignee = ticketResponse.data.assignee;
      setAssignee(assignee ?? null);
      // Do NOT pre-fill the assignee picker with the current assignee: the input
      // is only used to assign a NEW assignee, so it must start empty. The current
      // assignee is displayed separately in the <dd> below the label.
      setAssigneePicker(null);
      setError(null);
    } catch (err: unknown) {
      setError(formatApiError(err, t('tickets.detail.loadError'), t('common.referenceId')));
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
      setError(formatApiError(err, t('tickets.detail.loadError'), t('common.referenceId')));
    }
  };

  const transition = async (status: string) => {
    if (!ticketId) return;
    setWorking(true);
    try { await ticketApi.changeStatus(ticketId, { status }); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.statusError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };
  const updateEstimatedEffort = async (value: string) => {
    if (!ticketId || value === '') return;
    const estimatedEffortUnits = Number(value);
    if (!Number.isInteger(estimatedEffortUnits) || estimatedEffortUnits < 0) return;
    setWorking(true);
    try { await ticketApi.update(ticketId, { estimatedEffortUnits }); await load(); }
    catch (err: any) { setError(formatApiError(err, t('common.saveError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };
  const updatePriority = async (priority: string) => {
    if (!ticketId || !ticket || priority === ticket.priority) return;
    setWorking(true);
    try { await ticketApi.update(ticketId, { priority }); await load(); }
    catch (err: any) { setError(formatApiError(err, t('common.saveError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };
  const updateType = async (type: 'service_request' | 'problem' | 'change') => {
    if (!ticketId || !ticket || type === ticket.type) return;
    setWorking(true);
    try { await ticketApi.changeType(ticketId, { type }); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.typeError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };

  const saveProblem = async () => {
    if (!ticketId || !problemForm) return;
    setWorking(true);
    try { await ticketApi.updateProblem(ticketId, problemForm); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.extensionSaveError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };

  const saveChange = async () => {
    if (!ticketId || !changeForm) return;
    setWorking(true);
    try { await ticketApi.updateChange(ticketId, changeForm); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.extensionSaveError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };

  // Guided Incident → Problem / Change conversion: creates a linked follow-up
  // ticket (the incident itself stays untouched) and opens it.
  const convertTo = async (targetType: 'problem' | 'change') => {
    if (!ticketId || !window.confirm(t('tickets.detail.convertConfirm'))) return;
    setWorking(true);
    try {
      const response = await ticketApi.convertFromIncident(ticketId, { targetType });
      navigate(`/tickets/${response.data.id}`);
    } catch (err: any) {
      setError(formatApiError(err, t('tickets.detail.convertError'), t('common.referenceId')));
      setWorking(false);
    }
  };

  const linkRisk = async () => {
    if (!ticketId || !riskPicker) return;
    setWorking(true);
    try { await ticketApi.linkRisk(ticketId, riskPicker.id); setRiskPicker(null); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.extensionSaveError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };

  const unlinkRisk = async (riskId: string) => {
    if (!ticketId) return;
    setWorking(true);
    try { await ticketApi.unlinkRisk(ticketId, riskId); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.extensionSaveError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };
const addComment = async (event: FormEvent) => {
  event.preventDefault();
  if (!ticketId || !comment.trim()) return;
  setWorking(true);
  try { await ticketApi.comment(ticketId, { body: comment, isInternal: internal }); setComment(''); await load(); }
  catch (err: any) { setError(formatApiError(err, t('tickets.detail.commentError'), t('common.referenceId'))); }
  finally { setWorking(false); }
};

  const requesterCommentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ticketId || !requesterCommentText.trim()) return;
    setWorking(true);
    try { await ticketApi.requesterComment(ticketId, { body: requesterCommentText }); setRequesterCommentText(''); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.commentError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };

  const close = async () => {
    const summary = window.prompt(t('tickets.detail.closurePrompt'));
    if (!summary?.trim() || !ticketId) return;
    setWorking(true);
    try { await ticketApi.close(ticketId, { summary }); await load(); }
    catch (err: any) { setError(formatApiError(err, t('tickets.detail.closeError'), t('common.referenceId'))); }
    finally { setWorking(false); }
  };

  const assignAssignee = async () => {
    if (!ticketId) return;
    setWorking(true);
    try {
      await ticketApi.assign(ticketId, { assigneeId: assigneePicker?.id ?? null });
      await load();
    } catch (err: any) {
      setError(formatApiError(err, t('tickets.detail.assignError'), t('common.referenceId')));
    } finally { setWorking(false); }
  };

  const addAssets = async () => {
    if (!assetPickerValues.length || !ticketId) return;
    setWorking(true);
    try {
      await ticketApi.addAssets(ticketId, { assetIds: assetPickerValues.map((v) => v.id) });
      await load();
    } catch (err: any) {
      setError(formatApiError(err, t('tickets.detail.attachError'), t('common.referenceId')));
    } finally { setWorking(false); }
  };

  const removeAsset = async (assetId: string) => {
    if (!ticketId) return;
    setWorking(true);
    try {
      await ticketApi.removeAssets(ticketId, { assetIds: [assetId] });
      await load();
    } catch (err: any) {
      setError(formatApiError(err, t('tickets.detail.detachError'), t('common.referenceId')));
    } finally { setWorking(false); }
  };

  if (!ticket && !error) return <PageShell noPadding><span className="text-text-secondary">{t('tickets.detail.loading')}</span></PageShell>;
  if (!ticket) return <PageShell noPadding><Link to="/tickets" className="text-primary-700 hover:underline">← {t('navigation.tickets')}</Link><p role="alert" className="mt-4 text-status-critical-fg">{error}</p></PageShell>;

  const targets = getAllowedTicketTransitions(ticket.type as any, ticket.status);
  const selectableStatuses = isTerminalTicketStatus(ticket.type as any, ticket.status)
    ? [ticket.status, REOPEN_TARGET_STATUS[ticket.type]]
    : [ticket.status, ...targets];

  // Stage 10c / LT-5: the existing sections are grouped into DetailTabs
  // (Details = assignment + type extensions, History = comments/work notes,
  // Assets = ticket asset context). Section content and fetch lifecycle are
  // unchanged; the auditable-history Modal keeps its original trigger.
  return <PageShell>
    <PageBreadcrumbs items={breadcrumbs} />
    <Link to="/tickets" className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">← {t('tickets.detail.allTickets')}</Link>
    {error && <div role="alert" className="mt-4 rounded-md bg-status-critical-bg p-3 text-status-critical-fg">{error}</div>}
    <header className="mt-4 rounded-lg bg-surface-default p-card-pad shadow-e1">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <h1 className="text-h2 text-text-primary">{ticket.displayId} – {ticket.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-body2 text-text-secondary">{ticket.description || t('tickets.detail.noDescription')}</p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-text-muted">{t('common.type')}</dt><dd>{canWrite && ticket.type !== 'incident' ? <select value={ticket.type} disabled={working} onChange={(event) => void updateType(event.target.value as 'service_request' | 'problem' | 'change')} aria-label={t('common.type')} className="w-full rounded-md border border-border-strong bg-surface-default px-2 py-1 font-semibold text-text-primary">{(['service_request', 'problem', 'change'] as const).map((type) => <option key={type} value={type}>{t(`tickets.types.${type}`)}</option>)}</select> : <span className="font-semibold">{t(`tickets.types.${ticket.type}`)}</span>}</dd></div>
          <div><dt className="text-text-muted">{t('tickets.detail.status')}</dt><dd>{canWrite ? <select value={ticket.status} disabled={working} onChange={(event) => { if (event.target.value !== ticket.status) void transition(event.target.value); }} aria-label={t('tickets.detail.status')} className="w-full rounded-md border border-border-strong bg-surface-default px-2 py-1 font-semibold text-text-primary">{selectableStatuses.filter((status, index, values) => values.indexOf(status) === index).map((status) => <option key={status} value={status}>{t(`tickets.status.${status}`)}</option>)}</select> : <span className="font-semibold">{t(`tickets.status.${ticket.status}`)}</span>}</dd></div>
          <div><dt className="text-text-muted">{t('tickets.detail.priority')}</dt><dd>{canWrite ? <select value={ticket.priority} disabled={working} onChange={(event) => void updatePriority(event.target.value)} aria-label={t('tickets.detail.priority')} className="w-full rounded-md border border-border-strong bg-surface-default px-2 py-1 font-semibold text-text-primary">{['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{t(`tickets.priorities.${priority}`)}</option>)}</select> : <span className="font-semibold">{t(`tickets.priorities.${ticket.priority}`)}</span>}</dd></div>
          <div><dt className="text-text-muted">{t('tickets.detail.slaTarget')}</dt><dd>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : t('tickets.detail.notConfigured')}</dd></div>
          <div><dt className="text-text-muted" title={t('tickets.detail.estimatedEffortHint')}>{t('tickets.detail.estimatedEffort')}</dt><dd>{canWrite ? <input type="number" min="0" step="1" defaultValue={ticket.estimatedEffortUnits ?? ''} onBlur={(event) => void updateEstimatedEffort(event.target.value)} disabled={working} aria-label={t('tickets.detail.estimatedEffortHint')} className="w-20 rounded-md border border-border-strong bg-surface-default px-2 py-1 text-text-primary" /> : ticket.estimatedEffortUnits ?? '–'}</dd></div>
        </dl>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
        <button onClick={() => void openHistory()} className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary">{t('tickets.detail.historyButton')}</button>
        {canWrite && ticket.type === 'incident' && <button disabled={working} onClick={() => void convertTo('problem')} className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50">{t('tickets.detail.convertToProblem')}</button>}
        {canWrite && ticket.type === 'incident' && <button disabled={working} onClick={() => void convertTo('change')} className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50">{t('tickets.detail.convertToChange')}</button>}
        {canClose && !isTerminalTicketStatus(ticket.type as any, ticket.status) && <button disabled={working} onClick={() => void close()} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('tickets.detail.closeTicket')}</button>}
      </div>
    </header>
    <DetailTabs
      className="mt-section-gap"
      ariaLabel={ticket.displayId}
      syncUrlParam
      tabs={[
        {
          id: 'details',
          label: t('tickets.detail.tabs.details'),
          content: (
            <>
              <section className="rounded-lg bg-surface-default p-card-pad shadow-e1">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h2 className="text-h3 text-text-primary">{t('tickets.detail.assignmentTitle')}</h2>
                    <dl className="mt-3 text-sm">
                      <div><dt className="text-text-muted">{t('tickets.detail.assignee')}</dt><dd className="font-semibold">{assignee ? assigneeLabel(assignee) : t('tickets.detail.unassigned')}</dd></div>
                    </dl>
                    {canAssign && <div className="mt-3">
                      <EntityPicker labelKey="tickets.detail.assignee" entityType="user" value={assigneePicker} onChange={setAssigneePicker} />
                      <div className="mt-2 flex gap-2">
                        <button disabled={working} onClick={() => void assignAssignee()} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('tickets.detail.assign')}</button>
                        {assignee && <button disabled={working} onClick={() => void assignAssignee()} className="rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50">{t('tickets.detail.unassign')}</button>}
                      </div>
                    </div>}
                  </div>
                </div>
              </section>
              {canWrite && ticket.type === 'problem' && problemForm && <section className="mt-section-gap rounded-lg bg-surface-default p-card-pad shadow-e1">
                <h2 className="text-h3 text-text-primary">{t('tickets.detail.problemDetailsTitle')}</h2>
                <div className="mt-3 grid gap-4">
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="problem-root-cause">{t('tickets.detail.rootCauseLabel')}</label>
                    <textarea id="problem-root-cause" rows={3} value={problemForm.rootCause} disabled={working} onChange={(event) => setProblemForm({ ...problemForm, rootCause: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary disabled:opacity-50" /></div>
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="problem-workaround">{t('tickets.detail.workaroundLabel')}</label>
                    <textarea id="problem-workaround" rows={3} value={problemForm.workaround} disabled={working} onChange={(event) => setProblemForm({ ...problemForm, workaround: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary disabled:opacity-50" /></div>
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="problem-permanent-fix">{t('tickets.detail.permanentFixLabel')}</label>
                    <textarea id="problem-permanent-fix" rows={3} value={problemForm.permanentFix} disabled={working} onChange={(event) => setProblemForm({ ...problemForm, permanentFix: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary disabled:opacity-50" /></div>
                </div>
                <button disabled={working} onClick={() => void saveProblem()} className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('tickets.detail.saveExtension')}</button>
              </section>}
              {canWrite && ticket.type === 'change' && changeForm && <section className="mt-section-gap rounded-lg bg-surface-default p-card-pad shadow-e1">
                <h2 className="text-h3 text-text-primary">{t('tickets.detail.changeDetailsTitle')}</h2>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="change-type">{t('tickets.detail.changeTypeField')}</label>
                    <select id="change-type" value={changeForm.changeType} disabled={working} onChange={(event) => setChangeForm({ ...changeForm, changeType: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default px-2 py-2 text-text-primary">{(['standard', 'normal', 'emergency'] as const).map((type) => <option key={type} value={type}>{t(`tickets.detail.changeTypes.${type}`)}</option>)}</select></div>
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="change-risk-level">{t('tickets.detail.riskLevelField')}</label>
                    <select id="change-risk-level" value={changeForm.riskLevel} disabled={working} onChange={(event) => setChangeForm({ ...changeForm, riskLevel: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default px-2 py-2 text-text-primary">{(['low', 'medium', 'high', 'critical'] as const).map((level) => <option key={level} value={level}>{t(`tickets.priorities.${level}`)}</option>)}</select></div>
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={changeForm.cabApproved} disabled={working} onChange={(event) => setChangeForm({ ...changeForm, cabApproved: event.target.checked })} /> {t('tickets.detail.cabApprovedField')}</label>
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="change-implementation-plan">{t('tickets.detail.implementationPlanLabel')}</label>
                    <textarea id="change-implementation-plan" rows={3} value={changeForm.implementationPlan} disabled={working} onChange={(event) => setChangeForm({ ...changeForm, implementationPlan: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary disabled:opacity-50" /></div>
                  <div><label className="block text-sm font-medium text-text-secondary" htmlFor="change-rollback-plan">{t('tickets.detail.rollbackPlanLabel')}</label>
                    <textarea id="change-rollback-plan" rows={3} value={changeForm.rollbackPlan} disabled={working} onChange={(event) => setChangeForm({ ...changeForm, rollbackPlan: event.target.value })} className="mt-1 w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary disabled:opacity-50" /></div>
                </div>
                <button disabled={working} onClick={() => void saveChange()} className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('tickets.detail.saveExtension')}</button>
                <div className="mt-5 border-t border-border-subtle pt-4">
                  <h3 className="text-body1 font-bold text-text-primary">{t('tickets.detail.riskLinksTitle')}</h3>
                  {ticket.change?.riskLinks?.length ? (
                    <ul className="mt-2 space-y-2">
                      {ticket.change.riskLinks.map((link) => (
                        <li key={link.id} className="flex items-center justify-between rounded border border-border-subtle p-2">
                          <Link to={`/risks/${link.risk.id}`} className="group flex flex-1 items-center gap-2 text-primary-700 hover:underline dark:text-primary-300">
                            <span className="font-semibold">{link.risk.displayId}</span> · {link.risk.title}
                          </Link>
                          <button disabled={working} onClick={() => void unlinkRisk(link.risk.id)} className="text-sm text-status-critical-fg hover:underline">{t('tickets.detail.unlinkRisk')}</button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-sm text-text-muted">{t('tickets.detail.noRiskLinks')}</p>}
                  <div className="mt-3">
                    <EntityPicker labelKey="tickets.detail.linkRisk" entityType="risk" value={riskPicker} onChange={setRiskPicker} />
                    <button disabled={working || !riskPicker} onClick={() => void linkRisk()} className="mt-2 rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('tickets.detail.linkRisk')}</button>
                  </div>
                </div>
              </section>}
            </>
          ),
        },
        {
          id: 'history',
          label: t('tickets.detail.tabs.history'),
          content: (
            <section className="rounded-lg bg-surface-default p-card-pad shadow-e1">
                <h2 className="text-h3 text-text-primary">{t('tickets.detail.commentsTitle')}</h2>
                <div className="mt-4 space-y-3">
                  {ticket.comments?.length ? ticket.comments.map((entry) => (
                    <article key={entry.id} className="rounded-md border border-border-subtle p-3">
                      <div className="mb-1 text-xs font-semibold text-text-muted">
                        {entry.isInternal ? t('tickets.detail.internalWorkNote') : t('tickets.detail.requesterComment')}
                        · {entry.authorName ? `${t('tickets.detail.by')} ${entry.authorName}` : t('tickets.detail.anonymous')}
                        · {new Date(entry.createdAt).toLocaleString()}
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{entry.body}</p>
                    </article>
                  )) : <p className="text-sm text-text-muted">{t('tickets.detail.noComments')}</p>}
                </div>
                {canWrite && <form onSubmit={addComment} className="mt-4 border-t border-border-subtle pt-4">
                  <textarea value={comment} onChange={(event) => setComment(event.target.value)} required rows={3} placeholder={t('tickets.detail.updatePlaceholder')} className="w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary" />
                  <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> {t('tickets.detail.internalWorkNote')}</label>
                  <button disabled={working} className="mt-3 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('tickets.detail.addUpdate')}</button>
                </form>}
                {!canWrite && user?.id === ticket.requester?.id && <form onSubmit={requesterCommentSubmit} className="mt-4 border-t border-border-subtle pt-4">
                  <textarea value={requesterCommentText} onChange={(event) => setRequesterCommentText(event.target.value)} required rows={3} placeholder={t('tickets.detail.requesterCommentPlaceholder')} className="w-full rounded-md border border-border-strong bg-surface-default p-2 text-text-primary" />
                  <button disabled={working} className="mt-3 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('tickets.detail.submitComment')}</button>
                </form>}
            </section>
          ),
        },
        {
          id: 'assets',
          label: t('tickets.detail.tabs.assets'),
          content: (
            <section className="rounded-lg bg-surface-default p-card-pad shadow-e1">
              <h2 className="text-h3 text-text-primary">{t('tickets.detail.assetContextTitle')}</h2>
              <div className="mt-3">
                {assetContext?.assets?.length ? (
                  <ul className="space-y-2">
                    {assetContext.assets.map((entry) => {
                      const a = entry.asset;
                      return <li key={entry.id} className="flex items-center justify-between rounded border border-border-subtle p-2">
                        <Link to={`/assets/${a?.id}`} className="group flex flex-1 items-center gap-2 text-primary-700 hover:underline dark:text-primary-300">
                          <span className="font-semibold">{a?.displayId}</span> · {a?.name}
                          <div className="text-xs text-text-muted group-hover:text-text-secondary">{a?.assetType?.name} · {a?.manufacturer || t('tickets.detail.noManufacturer')} · {a?.status || ''}</div>
                        </Link>
                        {canContext && <button onClick={() => void removeAsset(a!.id)} className="text-sm text-status-critical-fg hover:underline">{t('tickets.detail.detach')}</button>}
                      </li>;
                    })}
                  </ul>
                ) : <p className="text-sm text-text-muted">{t('tickets.detail.noAssets')}</p>}
              </div>
              {canContext && <div className="mt-3">
                <EntityPicker labelKey="tickets.detail.attachAsset" entityType="asset" multiple values={assetPickerValues} onValuesChange={setAssetPickerValues} />
                <div className="mt-2">
                  <button disabled={working || !assetPickerValues.length} onClick={() => void addAssets()} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{t('tickets.detail.attachAssets')}</button>
                </div>
              </div>}
            </section>
          ),
        },
      ]}
    />
    <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title={t('tickets.detail.historyTitle')} maxWidthClassName="max-w-2xl">
        <ol className="mt-4 space-y-3">
          {history.length ? history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-primary-500 pl-3">
              <p className="text-sm font-semibold">{entry.action}</p>
              <p className="text-sm text-text-secondary">{entry.summary}</p>
              <time className="text-xs text-text-muted">{new Date(entry.createdAt).toLocaleString()}</time>
            </li>
          )) : <li className="text-sm text-text-muted">{t('tickets.detail.noHistory')}</li>}
        </ol>
    </Modal>
  </PageShell>;
}

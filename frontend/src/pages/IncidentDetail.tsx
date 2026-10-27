import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { incidentApi, type IncidentDeadlineResponse, type IncidentDetailResponse, type IncidentReportType, type Nis2ReportingStatus } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import EntityPicker from '../components/EntityPicker';
import type { EntityPickerResult } from '../services/entityPickerApi';
// Single source of truth for the incident status-transition matrix (shared with the backend).
import { getAllowedIncidentTransitions } from '../../../shared/src/incidentTransitions';

const toLocal = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const toDateTimeLocal = (value?: string) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-card">
    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
    {children}
  </section>
);

const IncidentDetail = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const user = useAuthStore((state) => state.user);
  const [incident, setIncident] = useState<IncidentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState({ isReportable: true, reportingJustification: '', decisionNotToReport: '', decisionApprovedBy: '' });
  const [decisionApprover, setDecisionApprover] = useState<EntityPickerResult | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [knowledgeChange, setKnowledgeChange] = useState({ knowledgeTime: '', reason: '' });
  const [statusChange, setStatusChange] = useState<{ status: '' | 'new' | 'under_investigation' | 'contained' | 'resolved'; reason: string }>({ status: '', reason: '' });
  const [report, setReport] = useState({ reportType: 'early_warning_24h' as IncidentReportType, title: '', content: '', recipient: '', submissionMethod: '', submissionProof: '' });
  const [communication, setCommunication] = useState<{ channel: string; direction: 'inbound' | 'outbound'; recipient: string; sender: string; message: string; scheduledAt: string; sentAt: string }>({ channel: 'email', direction: 'outbound', recipient: '', sender: '', message: '', scheduledAt: '', sentAt: '' });
  const [closure, setClosure] = useState({ rootCause: '', measuresEvaluation: '', lessonsLearned: '', closureSummary: '' });
  const [nis2Status, setNis2Status] = useState<Nis2ReportingStatus | null>(null);
  const [nis2Form, setNis2Form] = useState({ earlyWarningDescription: '', notificationDescription: '', finalReportDescription: '', finalReportContent: '' });
  const { t } = useI18n();
  const reportLabels: Record<IncidentReportType, string> = {
    early_warning_24h: t('incidents.detail.reportTypes.earlyWarning'),
    incident_notification_72h: t('incidents.detail.reportTypes.notification72h'),
    interim_report: t('incidents.detail.reportTypes.interimReport'),
    monthly_final_report: t('incidents.detail.reportTypes.finalReport'),
  };
  const asErrorMessage = (error: any) => error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || t('incidents.detail.actionFailed');

  const load = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const response = await incidentApi.getById(incidentId);
      const detail = response.data;
      setIncident(detail);
      setKnowledgeChange((current) => ({ ...current, knowledgeTime: toDateTimeLocal(detail.knowledgeTime) }));
      incidentApi.getNis2ReportingStatus(incidentId).then((statusResponse) => setNis2Status(statusResponse.data)).catch(() => setNis2Status(null));
      setClosure({ rootCause: (detail as any).rootCause || '', measuresEvaluation: (detail as any).measuresEvaluation || '', lessonsLearned: (detail as any).lessonsLearned || '', closureSummary: (detail as any).closureSummary || '' });
      setError(null);
    } catch (requestError) {
      setError(asErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asErrorMessage is recreated each render and only wraps translation fallbacks; adding it would rerun the effect every render.
  }, [incidentId]);

  useEffect(() => { void load(); }, [load]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); setNotice(message); await load(); } catch (requestError) { setError(asErrorMessage(requestError)); } finally { setBusy(false); }
  };

  const deadlines = useMemo(() => incident?.notificationDeadlines || [], [incident]);
  const deadlineState = (deadline: IncidentDeadlineResponse) => {
    if (deadline.status === 'sent') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (deadline.status === 'overdue' || new Date(deadline.deadlineDate) < new Date()) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    if (new Date(deadline.deadlineDate).getTime() - Date.now() < 24 * 60 * 60 * 1000) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';
  };

  const exportReport = async (reportId: string, type: string) => {
    try {
      const response = await incidentApi.exportReport(reportId);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type}.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(asErrorMessage(requestError)); }
  };

  if (loading) return <div className="p-6 text-gray-500">{t('incidents.detail.loading')}</div>;
  if (!incident) return <div className="p-6 text-red-700">{error || t('incidents.detail.notFound')}</div>;

  return <div data-testid="incident-detail-page" className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link to="/incidents" className="text-sm text-primary-600 hover:underline">{'← '}{t('navigation.incidents')}</Link><h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{incident.displayId} · {incident.title}</h1><p className="text-sm text-gray-500">{(incident.status || 'new').replace(/_/g, ' ')} · {incident.severity || t('incidents.detail.unknownSeverity')} {t('incidents.detail.severityWord')}</p></div>
      <button disabled={busy} onClick={() => run(() => incidentApi.recalculateDeadlines(incident.id), t('incidents.detail.recalculateDone'))} className="rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.recalculateDeadlines')}</button>
    </div>
    {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
    {notice && <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{notice}</div>}

    <Section title={t('incidents.detail.overviewTitle')}><p className="mb-4 whitespace-pre-wrap text-gray-700 dark:text-gray-300">{incident.description}</p><dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3"><div><dt className="font-medium">{t('incidents.detail.detectedLabel')}</dt><dd>{toLocal(incident.detectionTime)}</dd></div><div><dt className="font-medium">{t('incidents.detail.knownLabel')}</dt><dd>{toLocal(incident.knowledgeTime)}</dd></div><div><dt className="font-medium">{t('incidents.detail.notificationStatusLabel')}</dt><dd>{(incident as any).notificationStatus || '—'}</dd></div></dl><div className="mt-4 grid gap-3 md:grid-cols-3">{[[t('incidents.detail.linkedAssets'), incident.incidentAssets.map((link) => link.asset)], [t('incidents.detail.linkedServices'), incident.serviceLinks.map((link) => link.service)], [t('incidents.detail.linkedProcesses'), incident.processLinks.map((link) => link.process)]].map(([title, links]: any) => <div key={title}><h3 className="font-medium">{title}</h3><p className="text-sm text-gray-600 dark:text-gray-300">{links.length ? links.map((link: any) => `${link.displayId} — ${link.name}`).join(', ') : t('incidents.detail.noneRecorded')}</p></div>)}</div></Section>

    <Section title={t('incidents.detail.statusTransitionTitle')}><p className="mb-3 text-sm text-gray-600">{t('incidents.detail.currentStatusPrefix')}<strong>{(incident.status || 'new').replace(/_/g, ' ')}</strong>{' · '}{t('incidents.detail.transitionHint')}</p>{['resolved', 'closed'].includes(incident.status || 'new') ? <p className="text-sm text-gray-500">{t('incidents.detail.terminalState')}</p> : <div><div className="grid gap-2 md:grid-cols-3"><select value={statusChange.status} onChange={(event) => setStatusChange({ ...statusChange, status: event.target.value as '' | 'new' | 'under_investigation' | 'contained' | 'resolved' })} className="rounded border p-2"><option value="">{t('incidents.detail.targetStatusPlaceholder')}</option>{getAllowedIncidentTransitions(incident.status || 'new').map((status) => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}</select><input value={statusChange.reason} onChange={(event) => setStatusChange({ ...statusChange, reason: event.target.value })} placeholder={t('incidents.detail.reasonRequired')} className="rounded border p-2 md:col-span-2" /></div><button disabled={busy || !statusChange.status || !statusChange.reason.trim()} onClick={() => { const targetStatus = statusChange.status; if (targetStatus) { run(() => incidentApi.changeStatus(incident.id, { status: targetStatus, reason: statusChange.reason }), t('incidents.detail.statusChangedDone')); } }} className="mt-2 rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.changeStatus')}</button></div>}</Section>

    <Section title={t('incidents.detail.nis2SignificanceTitle')}><p className="mb-2 text-sm">{t('incidents.detail.significanceLabel')}<strong>{incident.isSignificant ? t('incidents.detail.significantValue') : t('incidents.detail.notSignificantValue')}</strong></p><p className="mb-4 text-sm text-gray-600">{incident.significanceReasons?.join(', ') || t('incidents.detail.noRuleReasons')}</p><div className="mb-4 text-sm">{t('incidents.detail.latestAssessment')}: {(incident.assessments[0] as any)?.isReportable === undefined ? t('incidents.detail.notAssessed') : (incident.assessments[0] as any)?.isReportable ? t('incidents.detail.reportableValue') : `${t('incidents.detail.notReportableValue')} · ${(incident.assessments[0] as any)?.status?.replace(/_/g, ' ') || t('incidents.detail.pendingApproval')}`}{(incident.assessments[0] as any)?.decisionApprovedBy ? ` · ${t('incidents.detail.approvedBy')} ${(incident.assessments[0] as any).decisionApprovedBy}` : ''}</div>{(incident.assessments[0] as any)?.status === 'pending_approval' && (incident.assessments[0] as any)?.decisionApprovalAssigneeId === user?.id && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3"><p className="text-sm font-medium">{t('incidents.detail.approverNotice')}</p><input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder={t('incidents.detail.returnReasonPlaceholder')} className="mt-2 w-full rounded border p-2" /><div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => run(() => incidentApi.decideNonReportableApproval(incident.id, { decision: 'approve' }), t('incidents.detail.approveDone'))} className="rounded bg-green-700 px-3 py-2 text-white disabled:opacity-50">{t('incidents.detail.approveDecision')}</button><button disabled={busy || !returnReason.trim()} onClick={() => run(() => incidentApi.decideNonReportableApproval(incident.id, { decision: 'reject', returnReason }), t('incidents.detail.returnDone'))} className="rounded bg-amber-600 px-3 py-2 text-white disabled:opacity-50">{t('incidents.detail.returnDecision')}</button></div></div>}<div className="grid gap-3 md:grid-cols-2"><label className="flex gap-2"><input type="checkbox" checked={assessment.isReportable} onChange={(event) => setAssessment({ ...assessment, isReportable: event.target.checked })} />{' '}{t('incidents.detail.reportableCheckbox')}</label><textarea value={assessment.isReportable ? assessment.reportingJustification : assessment.decisionNotToReport} onChange={(event) => setAssessment(assessment.isReportable ? { ...assessment, reportingJustification: event.target.value } : { ...assessment, decisionNotToReport: event.target.value })} placeholder={assessment.isReportable ? t('incidents.detail.reportingJustificationPlaceholder') : t('incidents.detail.decisionNotToReportPlaceholder')} className="rounded border p-2" />{!assessment.isReportable && <EntityPicker labelKey="incidents.detail.approvingUser" entityType="user" value={decisionApprover} onChange={(approver) => { if (approver.id === user?.id) { setError(t('incidents.detail.assessorNotApproverError')); return; } setDecisionApprover(approver); setAssessment({ ...assessment, decisionApprovedBy: approver.id }); }} required />}</div><button data-testid="incident-save-assessment" disabled={busy || !user?.id || (!assessment.isReportable && !assessment.decisionApprovedBy)} onClick={() => run(() => incidentApi.assess(incident.id, assessment), assessment.isReportable ? t('incidents.detail.assessmentSavedDone') : t('incidents.detail.nonReportableSubmittedDone'))} className="mt-3 rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{assessment.isReportable ? t('incidents.detail.saveAssessment') : t('incidents.detail.submitForApproval')}</button></Section>

    <Section title={t('incidents.detail.deadlinesTitle')}><div className="space-y-2">{deadlines.length ? deadlines.map((deadline) => <div key={deadline.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{reportLabels[deadline.notificationType]}</span><span>{toLocal(deadline.deadlineDate)}</span><span className={`rounded px-2 py-1 text-xs font-semibold ${deadlineState(deadline)}`}>{deadline.status}</span></div>) : <p className="text-sm text-gray-500">{t('incidents.detail.noDeadlinesNotice')}</p>}</div><div className="mt-5 border-t pt-4"><h3 className="mb-2 font-medium">{t('incidents.detail.correctKnowledgeTimeTitle')}</h3><div className="grid gap-2 md:grid-cols-3"><input type="datetime-local" value={knowledgeChange.knowledgeTime} onChange={(event) => setKnowledgeChange({ ...knowledgeChange, knowledgeTime: event.target.value })} className="rounded border p-2" /><input value={knowledgeChange.reason} onChange={(event) => setKnowledgeChange({ ...knowledgeChange, reason: event.target.value })} placeholder={t('incidents.detail.reasonRequired')} className="rounded border p-2 md:col-span-2" /></div><button disabled={busy || !knowledgeChange.reason.trim()} onClick={() => run(() => incidentApi.changeKnowledgeTime(incident.id, { knowledgeTime: new Date(knowledgeChange.knowledgeTime), reason: knowledgeChange.reason }), t('incidents.detail.knowledgeTimeDone'))} className="mt-2 rounded bg-amber-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.changeKnowledgeTime')}</button></div></Section>
    <Section title={t('incidents.detail.nis2ReportingTitle')}>
      {!nis2Status?.isRelevant ? (
        <div className="rounded border border-gray-300 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800">
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">{t('incidents.detail.markNis2Explanation')}</p>
          <button disabled={busy} onClick={() => run(() => incidentApi.markNis2Relevant(incident.id), t('incidents.detail.markNis2Done'))} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.markNis2Button')}</button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className={'rounded px-2 py-1 text-xs font-semibold ' + (nis2Status.severity === 'final' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : nis2Status.severity === 'notification' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200' : nis2Status.severity === 'early_warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200')}>{(nis2Status.severity || '').replace(/_/g, ' ')}</span>
            <span>{t('incidents.detail.reportDeadlineLabel')}<strong>{toLocal(nis2Status.reportDeadline)}</strong>{nis2Status.isReportDeadlineOverdue && nis2Status.severity !== 'final' && nis2Status.severity !== 'notification' ? <em className="ml-1 text-red-700">{t('incidents.detail.overdueTag')}</em> : null}</span>
            <span>{t('incidents.detail.finalReportDueLabel')}<strong>{toLocal(nis2Status.finalReportDue)}</strong>{nis2Status.isFinalReportDueOverdue && nis2Status.severity !== 'final' ? <em className="ml-1 text-red-700">{t('incidents.detail.overdueTag')}</em> : null}</span>
            {nis2Status.reportedAt ? <span>{t('incidents.detail.reportedAtLabel')} {toLocal(nis2Status.reportedAt)}</span> : null}
          </div>
          {nis2Status.severity === 'final' ? (
            <p className="text-sm text-green-700 dark:text-green-300">{t('incidents.detail.allReportsSubmitted')}</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-gray-300 p-3 dark:border-gray-600">
                <h3 className="mb-2 text-sm font-medium">{t('incidents.detail.earlyWarningStepTitle')}</h3>
                {nis2Status.severity === 'not_assessed' ? (
                  <div className="grid gap-2">
                    <textarea value={nis2Form.earlyWarningDescription} onChange={(event) => setNis2Form({ ...nis2Form, earlyWarningDescription: event.target.value })} placeholder={t('incidents.detail.earlyWarningPlaceholder')} className="rounded border p-2" />
                    <button disabled={busy || !nis2Form.earlyWarningDescription.trim()} onClick={() => run(() => incidentApi.submitNis2EarlyWarning(incident.id, { description: nis2Form.earlyWarningDescription }), t('incidents.detail.earlyWarningDone'))} className="rounded bg-amber-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.submitEarlyWarning')}</button>
                  </div>
                ) : <p className="text-sm text-gray-600 dark:text-gray-300">{t('incidents.detail.earlyWarningAlready')}</p>}
              </div>
              <div className="rounded border border-gray-300 p-3 dark:border-gray-600">
                <h3 className="mb-2 text-sm font-medium">{t('incidents.detail.notificationStepTitle')}</h3>
                <div className="grid gap-2">
                  <textarea value={nis2Form.notificationDescription} onChange={(event) => setNis2Form({ ...nis2Form, notificationDescription: event.target.value })} placeholder={t('incidents.detail.notificationPlaceholder')} className="rounded border p-2" />
                  <button disabled={busy || !nis2Form.notificationDescription.trim()} onClick={() => run(() => incidentApi.submitNis2Notification(incident.id, { description: nis2Form.notificationDescription }), t('incidents.detail.notificationDone'))} className="rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.submitNotification')}</button>
                </div>
              </div>
              <div className="rounded border border-gray-300 p-3 dark:border-gray-600">
                <h3 className="mb-2 text-sm font-medium">{t('incidents.detail.finalReportStepTitle')}</h3>
                <div className="grid gap-2">
                  <textarea value={nis2Form.finalReportDescription} onChange={(event) => setNis2Form({ ...nis2Form, finalReportDescription: event.target.value })} placeholder={t('incidents.detail.finalReportSummaryPlaceholder')} className="rounded border p-2" />
                  <textarea value={nis2Form.finalReportContent} onChange={(event) => setNis2Form({ ...nis2Form, finalReportContent: event.target.value })} placeholder={t('incidents.detail.finalReportContentPlaceholder')} className="rounded border p-2" />
                  <button disabled={busy || !nis2Form.finalReportDescription.trim() || !nis2Form.finalReportContent.trim()} onClick={() => run(() => incidentApi.submitNis2FinalReport(incident.id, { description: nis2Form.finalReportDescription, content: nis2Form.finalReportContent }), t('incidents.detail.finalReportDone'))} className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.submitFinalReport')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>

    <Section title={t('incidents.detail.reportsTitle')}><div className="space-y-2">{incident.reports.map((entry: any) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{reportLabels[entry.reportType as IncidentReportType]} · {entry.status}</span><span className="text-sm">{t('incidents.detail.dueLabel')} {toLocal(entry.dueAt)} {entry.submittedAt ? `· ${t('incidents.detail.submittedLabel')} ${toLocal(entry.submittedAt)}` : ''}</span><button onClick={() => void exportReport(entry.id, entry.reportType)} className="text-primary-600 hover:underline">{t('incidents.detail.export')}</button></div>)}</div><div className="mt-4 grid gap-2 md:grid-cols-2"><select value={report.reportType} onChange={(event) => setReport({ ...report, reportType: event.target.value as IncidentReportType })} className="rounded border p-2">{Object.entries(reportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={report.title} onChange={(event) => setReport({ ...report, title: event.target.value })} placeholder={t('incidents.detail.reportTitlePlaceholder')} className="rounded border p-2" /><textarea value={report.content} onChange={(event) => setReport({ ...report, content: event.target.value })} placeholder={t('incidents.detail.reportContentPlaceholder')} className="rounded border p-2 md:col-span-2" /><input value={report.recipient} onChange={(event) => setReport({ ...report, recipient: event.target.value })} placeholder={t('incidents.detail.recipientPlaceholder')} className="rounded border p-2" /><input value={report.submissionProof} onChange={(event) => setReport({ ...report, submissionProof: event.target.value })} placeholder={t('incidents.detail.submissionProofPlaceholder')} className="rounded border p-2" /></div><button disabled={busy || !user?.id || !report.content.trim()} onClick={() => run(() => incidentApi.createReport(incident.id, { ...report, content: { text: report.content }, submissionMethod: report.submissionMethod || undefined, submissionProof: report.submissionProof || undefined }), t('incidents.detail.reportSavedDone'))} className="mt-3 rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.saveReport')}</button></Section>

    <Section title={t('incidents.detail.communicationsTitle')}><div className="space-y-2">{incident.communications.map((entry: any) => <div key={entry.id} className="rounded border p-3 text-sm"><strong>{entry.direction} {entry.channel}</strong> {t('incidents.detail.toLabel')} {entry.recipient} · {entry.status}<p className="mt-1 whitespace-pre-wrap">{entry.message}</p></div>)}</div><div className="mt-4 grid gap-2 md:grid-cols-2"><input value={communication.channel} onChange={(event) => setCommunication({ ...communication, channel: event.target.value })} placeholder={t('incidents.detail.channelPlaceholder')} className="rounded border p-2" /><select value={communication.direction} onChange={(event) => setCommunication({ ...communication, direction: event.target.value as 'inbound' | 'outbound' })} className="rounded border p-2"><option value="outbound">{t('incidents.detail.outboundOption')}</option><option value="inbound">{t('incidents.detail.inboundOption')}</option></select><input value={communication.recipient} onChange={(event) => setCommunication({ ...communication, recipient: event.target.value })} placeholder={t('incidents.detail.recipientPlaceholder')} className="rounded border p-2" /><input value={communication.sender} onChange={(event) => setCommunication({ ...communication, sender: event.target.value })} placeholder={t('incidents.detail.senderPlaceholder')} className="rounded border p-2" /><textarea value={communication.message} onChange={(event) => setCommunication({ ...communication, message: event.target.value })} placeholder={t('incidents.detail.messagePlaceholder')} className="rounded border p-2 md:col-span-2" /></div><button disabled={busy || !communication.recipient.trim() || !communication.message.trim()} onClick={() => run(() => incidentApi.createCommunication(incident.id, { ...communication, scheduledAt: communication.scheduledAt ? new Date(communication.scheduledAt) : undefined, sentAt: communication.sentAt ? new Date(communication.sentAt) : undefined }), t('incidents.detail.communicationDone'))} className="mt-3 rounded bg-primary-600 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.recordCommunication')}</button></Section>

    <Section title={t('incidents.detail.closureTitle')}><div className="grid gap-2"><textarea value={closure.rootCause} onChange={(event) => setClosure({ ...closure, rootCause: event.target.value })} placeholder={t('incidents.detail.rootCausePlaceholder')} className="rounded border p-2" /><textarea value={closure.measuresEvaluation} onChange={(event) => setClosure({ ...closure, measuresEvaluation: event.target.value })} placeholder={t('incidents.detail.measuresEvaluationPlaceholder')} className="rounded border p-2" /><textarea value={closure.lessonsLearned} onChange={(event) => setClosure({ ...closure, lessonsLearned: event.target.value })} placeholder={t('incidents.detail.lessonsLearnedPlaceholder')} className="rounded border p-2" /><textarea value={closure.closureSummary} onChange={(event) => setClosure({ ...closure, closureSummary: event.target.value })} placeholder={t('incidents.detail.closureSummaryPlaceholder')} className="rounded border p-2" /></div><p className="mt-2 text-sm text-gray-500">{t('incidents.detail.closureHint')}</p><button disabled={busy || !closure.rootCause.trim() || !closure.measuresEvaluation.trim()} onClick={() => run(() => incidentApi.close(incident.id, closure), t('incidents.detail.closedDone'))} className="mt-3 rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">{t('incidents.detail.closeIncident')}</button></Section>
  </div>;
};

export default IncidentDetail;

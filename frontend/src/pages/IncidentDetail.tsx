import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { incidentApi, type IncidentDeadlineResponse, type IncidentDetailResponse, type IncidentReportType } from '../services/api';
import { useAuthStore } from '../store/auth';
import EntityPicker from '../components/EntityPicker';
import type { EntityPickerResult } from '../services/entityPickerApi';

const reportLabels: Record<IncidentReportType, string> = {
  early_warning_24h: '24-hour early warning',
  incident_notification_72h: '72-hour incident notification',
  interim_report: 'Interim report',
  monthly_final_report: 'Final report',
};

const asErrorMessage = (error: any) => error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'The requested action could not be completed.';
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
  const [report, setReport] = useState({ reportType: 'early_warning_24h' as IncidentReportType, title: '', content: '', recipient: '', submissionMethod: '', submissionProof: '' });
  const [communication, setCommunication] = useState<{ channel: string; direction: 'inbound' | 'outbound'; recipient: string; sender: string; message: string; scheduledAt: string; sentAt: string }>({ channel: 'email', direction: 'outbound', recipient: '', sender: '', message: '', scheduledAt: '', sentAt: '' });
  const [closure, setClosure] = useState({ rootCause: '', measuresEvaluation: '', lessonsLearned: '', closureSummary: '' });

  const load = async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const response = await incidentApi.getById(incidentId);
      const detail = response.data;
      setIncident(detail);
      setKnowledgeChange((current) => ({ ...current, knowledgeTime: toDateTimeLocal(detail.knowledgeTime) }));
      setClosure({ rootCause: (detail as any).rootCause || '', measuresEvaluation: (detail as any).measuresEvaluation || '', lessonsLearned: (detail as any).lessonsLearned || '', closureSummary: (detail as any).closureSummary || '' });
      setError(null);
    } catch (requestError) {
      setError(asErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [incidentId]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); setNotice(message); await load(); } catch (requestError) { setError(asErrorMessage(requestError)); } finally { setBusy(false); }
  };

  const deadlines = useMemo(() => incident?.notificationDeadlines || [], [incident]);
  const deadlineState = (deadline: IncidentDeadlineResponse) => {
    if (deadline.status === 'sent') return 'bg-green-100 text-green-800';
    if (deadline.status === 'overdue' || new Date(deadline.deadlineDate) < new Date()) return 'bg-red-100 text-red-800';
    if (new Date(deadline.deadlineDate).getTime() - Date.now() < 24 * 60 * 60 * 1000) return 'bg-amber-100 text-amber-800';
    return 'bg-blue-100 text-blue-800';
  };

  const exportReport = async (reportId: string, type: string) => {
    try {
      const response = await incidentApi.exportReport(reportId);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${type}.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(asErrorMessage(requestError)); }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading incident…</div>;
  if (!incident) return <div className="p-6 text-red-700">{error || 'Incident not found.'}</div>;

  return <div data-testid="incident-detail-page" className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link to="/incidents" className="text-sm text-blue-600 hover:underline">← Incidents</Link><h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{incident.displayId} · {incident.title}</h1><p className="text-sm text-gray-500">{(incident.status || 'new').replace(/_/g, ' ')} · {incident.severity || 'unknown'} severity</p></div>
      <button disabled={busy} onClick={() => run(() => incidentApi.recalculateDeadlines(incident.id), 'Pending notification deadlines recalculated.')} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Recalculate deadlines</button>
    </div>
    {error && <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
    {notice && <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">{notice}</div>}

    <Section title="Overview and timeline"><p className="mb-4 whitespace-pre-wrap text-gray-700 dark:text-gray-300">{incident.description}</p><dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3"><div><dt className="font-medium">Detected</dt><dd>{toLocal(incident.detectionTime)}</dd></div><div><dt className="font-medium">Known</dt><dd>{toLocal(incident.knowledgeTime)}</dd></div><div><dt className="font-medium">Notification status</dt><dd>{(incident as any).notificationStatus || '—'}</dd></div></dl><div className="mt-4 grid gap-3 md:grid-cols-3">{[['Assets', incident.incidentAssets.map((link) => link.asset)], ['Services', incident.serviceLinks.map((link) => link.service)], ['Processes', incident.processLinks.map((link) => link.process)]].map(([title, links]: any) => <div key={title}><h3 className="font-medium">{title}</h3><p className="text-sm text-gray-600 dark:text-gray-300">{links.length ? links.map((link: any) => `${link.displayId} — ${link.name}`).join(', ') : 'None recorded'}</p></div>)}</div></Section>

    <Section title="NIS2 significance and reportability"><p className="mb-2 text-sm">Significance: <strong>{incident.isSignificant ? 'Significant' : 'Not significant'}</strong></p><p className="mb-4 text-sm text-gray-600">{incident.significanceReasons?.join(', ') || 'No rule reasons recorded.'}</p><div className="mb-4 text-sm">Latest assessment: {(incident.assessments[0] as any)?.isReportable === undefined ? 'Not assessed' : (incident.assessments[0] as any)?.isReportable ? 'Reportable' : `Not reportable · ${(incident.assessments[0] as any)?.status?.replace(/_/g, ' ') || 'pending approval'}`}{(incident.assessments[0] as any)?.decisionApprovedBy ? ` · approved by ${(incident.assessments[0] as any).decisionApprovedBy}` : ''}</div>{(incident.assessments[0] as any)?.status === 'pending_approval' && (incident.assessments[0] as any)?.decisionApprovalAssigneeId === user?.id && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3"><p className="text-sm font-medium">You are the assigned independent approver.</p><input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Return reason (required to return)" className="mt-2 w-full rounded border p-2" /><div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => run(() => incidentApi.decideNonReportableApproval(incident.id, { decision: 'approve' }), 'Non-reportable decision approved.')} className="rounded bg-green-700 px-3 py-2 text-white disabled:opacity-50">Approve decision</button><button disabled={busy || !returnReason.trim()} onClick={() => run(() => incidentApi.decideNonReportableApproval(incident.id, { decision: 'reject', returnReason }), 'Decision returned to the assessor.')} className="rounded bg-amber-600 px-3 py-2 text-white disabled:opacity-50">Return decision</button></div></div>}<div className="grid gap-3 md:grid-cols-2"><label className="flex gap-2"><input type="checkbox" checked={assessment.isReportable} onChange={(event) => setAssessment({ ...assessment, isReportable: event.target.checked })} /> Reportable</label><textarea value={assessment.isReportable ? assessment.reportingJustification : assessment.decisionNotToReport} onChange={(event) => setAssessment(assessment.isReportable ? { ...assessment, reportingJustification: event.target.value } : { ...assessment, decisionNotToReport: event.target.value })} placeholder={assessment.isReportable ? 'Reporting justification' : 'Decision not to report (required)'} className="rounded border p-2" />{!assessment.isReportable && <EntityPicker label="Approving user" labelKey="entityPicker.searchPlaceholder" entityType="user" value={decisionApprover} onChange={(approver) => { if (approver.id === user?.id) { setError('The assessor cannot be selected as approver.'); return; } setDecisionApprover(approver); setAssessment({ ...assessment, decisionApprovedBy: approver.id }); }} required />}</div><button data-testid="incident-save-assessment" disabled={busy || !user?.id || (!assessment.isReportable && !assessment.decisionApprovedBy)} onClick={() => run(() => incidentApi.assess(incident.id, assessment), assessment.isReportable ? 'Reportability assessment saved.' : 'Non-reportable decision submitted for independent approval.')} className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{assessment.isReportable ? 'Save assessment' : 'Submit for approval'}</button></Section>

    <Section title="Notification deadlines"><div className="space-y-2">{deadlines.length ? deadlines.map((deadline) => <div key={deadline.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{reportLabels[deadline.notificationType]}</span><span>{toLocal(deadline.deadlineDate)}</span><span className={`rounded px-2 py-1 text-xs font-semibold ${deadlineState(deadline)}`}>{deadline.status}</span></div>) : <p className="text-sm text-gray-500">No notification deadlines exist until the incident is significant/reportable.</p>}</div><div className="mt-5 border-t pt-4"><h3 className="mb-2 font-medium">Correct protected knowledge time</h3><div className="grid gap-2 md:grid-cols-3"><input type="datetime-local" value={knowledgeChange.knowledgeTime} onChange={(event) => setKnowledgeChange({ ...knowledgeChange, knowledgeTime: event.target.value })} className="rounded border p-2" /><input value={knowledgeChange.reason} onChange={(event) => setKnowledgeChange({ ...knowledgeChange, reason: event.target.value })} placeholder="Reason (required)" className="rounded border p-2 md:col-span-2" /></div><button disabled={busy || !knowledgeChange.reason.trim()} onClick={() => run(() => incidentApi.changeKnowledgeTime(incident.id, { knowledgeTime: new Date(knowledgeChange.knowledgeTime), reason: knowledgeChange.reason }), 'Knowledge time changed and deadlines recalculated.')} className="mt-2 rounded bg-amber-600 px-4 py-2 text-white disabled:opacity-50">Change knowledge time</button></div></Section>

    <Section title="Reports"><div className="space-y-2">{incident.reports.map((entry: any) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"><span>{reportLabels[entry.reportType as IncidentReportType]} · {entry.status}</span><span className="text-sm">Due {toLocal(entry.dueAt)} {entry.submittedAt ? `· submitted ${toLocal(entry.submittedAt)}` : ''}</span><button onClick={() => void exportReport(entry.id, entry.reportType)} className="text-blue-600 hover:underline">Export</button></div>)}</div><div className="mt-4 grid gap-2 md:grid-cols-2"><select value={report.reportType} onChange={(event) => setReport({ ...report, reportType: event.target.value as IncidentReportType })} className="rounded border p-2">{Object.entries(reportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={report.title} onChange={(event) => setReport({ ...report, title: event.target.value })} placeholder="Report title" className="rounded border p-2" /><textarea value={report.content} onChange={(event) => setReport({ ...report, content: event.target.value })} placeholder="Report content" className="rounded border p-2 md:col-span-2" /><input value={report.recipient} onChange={(event) => setReport({ ...report, recipient: event.target.value })} placeholder="Recipient" className="rounded border p-2" /><input value={report.submissionProof} onChange={(event) => setReport({ ...report, submissionProof: event.target.value })} placeholder="Submission proof (marks submitted)" className="rounded border p-2" /></div><button disabled={busy || !user?.id || !report.content.trim()} onClick={() => run(() => incidentApi.createReport(incident.id, { ...report, content: { text: report.content }, submissionMethod: report.submissionMethod || undefined, submissionProof: report.submissionProof || undefined }), 'Report saved.')} className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Save report</button></Section>

    <Section title="Communications and evidence"><div className="space-y-2">{incident.communications.map((entry: any) => <div key={entry.id} className="rounded border p-3 text-sm"><strong>{entry.direction} {entry.channel}</strong> to {entry.recipient} · {entry.status}<p className="mt-1 whitespace-pre-wrap">{entry.message}</p></div>)}</div><div className="mt-4 grid gap-2 md:grid-cols-2"><input value={communication.channel} onChange={(event) => setCommunication({ ...communication, channel: event.target.value })} placeholder="Channel" className="rounded border p-2" /><select value={communication.direction} onChange={(event) => setCommunication({ ...communication, direction: event.target.value as 'inbound' | 'outbound' })} className="rounded border p-2"><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select><input value={communication.recipient} onChange={(event) => setCommunication({ ...communication, recipient: event.target.value })} placeholder="Recipient" className="rounded border p-2" /><input value={communication.sender} onChange={(event) => setCommunication({ ...communication, sender: event.target.value })} placeholder="Sender" className="rounded border p-2" /><textarea value={communication.message} onChange={(event) => setCommunication({ ...communication, message: event.target.value })} placeholder="Message / evidence reference" className="rounded border p-2 md:col-span-2" /></div><button disabled={busy || !communication.recipient.trim() || !communication.message.trim()} onClick={() => run(() => incidentApi.createCommunication(incident.id, { ...communication, scheduledAt: communication.scheduledAt ? new Date(communication.scheduledAt) : undefined, sentAt: communication.sentAt ? new Date(communication.sentAt) : undefined }), 'Communication recorded.')} className="mt-3 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Record communication</button></Section>

    <Section title="Closure and lessons learned"><div className="grid gap-2"><textarea value={closure.rootCause} onChange={(event) => setClosure({ ...closure, rootCause: event.target.value })} placeholder="Root cause (required)" className="rounded border p-2" /><textarea value={closure.measuresEvaluation} onChange={(event) => setClosure({ ...closure, measuresEvaluation: event.target.value })} placeholder="Measures evaluation (required)" className="rounded border p-2" /><textarea value={closure.lessonsLearned} onChange={(event) => setClosure({ ...closure, lessonsLearned: event.target.value })} placeholder="Lessons learned" className="rounded border p-2" /><textarea value={closure.closureSummary} onChange={(event) => setClosure({ ...closure, closureSummary: event.target.value })} placeholder="Closure summary" className="rounded border p-2" /></div><p className="mt-2 text-sm text-gray-500">Significant incidents also require a submitted final report before closure.</p><button disabled={busy || !closure.rootCause.trim() || !closure.measuresEvaluation.trim()} onClick={() => run(() => incidentApi.close(incident.id, closure), 'Incident closed.')} className="mt-3 rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">Close incident</button></Section>
  </div>;
};

export default IncidentDetail;

const fs = require('fs');
const p = 'frontend/src/pages/IncidentDetail.tsx';
let s = fs.readFileSync(p, 'utf8');

function rep(find, replace) {
  if (!s.includes(find)) { console.error('NOT FOUND: ' + find.slice(0, 80)); process.exitCode = 1; return; }
  s = s.split(find).join(replace);
}

// Imports + hook + translated reportLabels / asErrorMessage
rep("import { useAuthStore } from '../store/auth';",
  "import { useAuthStore } from '../store/auth';\nimport { useI18n } from '../context/I18nContext';");

rep(`const reportLabels: Record<IncidentReportType, string> = {
  early_warning_24h: '24-hour early warning',
  incident_notification_72h: '72-hour incident notification',
  interim_report: 'Interim report',
  monthly_final_report: 'Final report',
};

const asErrorMessage = (error: any) => error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'The requested action could not be completed.';`, '');

rep("  const [nis2Form, setNis2Form] = useState({ earlyWarningDescription: '', notificationDescription: '', finalReportDescription: '', finalReportContent: '' });",
  `  const [nis2Form, setNis2Form] = useState({ earlyWarningDescription: '', notificationDescription: '', finalReportDescription: '', finalReportContent: '' });
  const { t } = useI18n();
  const reportLabels: Record<IncidentReportType, string> = {
    early_warning_24h: t('incidents.detail.reportTypes.earlyWarning'),
    incident_notification_72h: t('incidents.detail.reportTypes.notification72h'),
    interim_report: t('incidents.detail.reportTypes.interimReport'),
    monthly_final_report: t('incidents.detail.reportTypes.finalReport'),
  };
  const asErrorMessage = (error: any) => error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || t('incidents.detail.actionFailed');`);

// Loading / not found / header
rep(">Loading incident…</div>", ">{t('incidents.detail.loading')}</div>");
rep("{error || 'Incident not found.'}", "{error || t('incidents.detail.notFound')}");
rep(">← Incidents</Link>", ">{'← '}{t('navigation.incidents')}</Link>");
rep("{incident.severity || 'unknown'} severity", "{incident.severity || t('incidents.detail.unknownSeverity')} {t('incidents.detail.severityWord')}");
rep(", 'Pending notification deadlines recalculated.')", ", t('incidents.detail.recalculateDone'))");
rep(">Recalculate deadlines</button>", ">{t('incidents.detail.recalculateDeadlines')}</button>");

// Overview section
rep('<Section title="Overview and timeline">', "<Section title={t('incidents.detail.overviewTitle')}>");
rep(">Detected</dt>", ">{t('incidents.detail.detectedLabel')}</dt>");
rep(">Known</dt>", ">{t('incidents.detail.knownLabel')}</dt>");
rep(">Notification status</dt>", ">{t('incidents.detail.notificationStatusLabel')}</dt>");
rep("[['Assets', incident.incidentAssets", "[[t('incidents.detail.linkedAssets'), incident.incidentAssets");
rep("['Services', incident.serviceLinks", "[t('incidents.detail.linkedServices'), incident.serviceLinks");
rep("['Processes', incident.processLinks", "[t('incidents.detail.linkedProcesses'), incident.processLinks");
rep(": 'None recorded'}", ": t('incidents.detail.noneRecorded')}");

// Status transition section
rep('<Section title="Status transition">', "<Section title={t('incidents.detail.statusTransitionTitle')}>");
rep(">Current status: <strong>", ">{t('incidents.detail.currentStatusPrefix')}<strong>");
rep(" · Status changes require a reason and are recorded in the incident history. Closing an incident requires the dedicated closure flow below.</p>", "{' · '}{t('incidents.detail.transitionHint')}</p>");
rep(">This incident is in a terminal workflow state and cannot be transitioned further.</p>", ">{t('incidents.detail.terminalState')}</p>");
rep('<option value="">Target status…</option>', "<option value=\"\">{t('incidents.detail.targetStatusPlaceholder')}</option>");
rep('placeholder="Reason (required)"', "placeholder={t('incidents.detail.reasonRequired')}");
rep(", 'Incident status changed.')", ", t('incidents.detail.statusChangedDone'))");
rep(">Change status</button>", ">{t('incidents.detail.changeStatus')}</button>");

// NIS2 significance section
rep('<Section title="NIS2 significance and reportability">', "<Section title={t('incidents.detail.nis2SignificanceTitle')}>");
rep(">Significance: <strong>{incident.isSignificant ? 'Significant' : 'Not significant'}</strong>", ">{t('incidents.detail.significanceLabel')}<strong>{incident.isSignificant ? t('incidents.detail.significantValue') : t('incidents.detail.notSignificantValue')}</strong>");
rep("|| 'No rule reasons recorded.'}", "|| t('incidents.detail.noRuleReasons')}");
rep(">Latest assessment: {", ">{t('incidents.detail.latestAssessment')}: {");
rep("? 'Not assessed' :", "? t('incidents.detail.notAssessed') :");
rep("? 'Reportable' : `Not reportable · ", "? t('incidents.detail.reportableValue') : `${t('incidents.detail.notReportableValue')} · ");
rep("|| 'pending approval'}`", "|| t('incidents.detail.pendingApproval')}`");
rep("` · approved by ${", "` · ${t('incidents.detail.approvedBy')} ${");
rep(">You are the assigned independent approver.</p>", ">{t('incidents.detail.approverNotice')}</p>");
rep('placeholder="Return reason (required to return)"', "placeholder={t('incidents.detail.returnReasonPlaceholder')}");
rep(", 'Non-reportable decision approved.')", ", t('incidents.detail.approveDone'))");
rep(">Approve decision</button>", ">{t('incidents.detail.approveDecision')}</button>");
rep(", 'Decision returned to the assessor.')", ", t('incidents.detail.returnDone'))");
rep(">Return decision</button>", ">{t('incidents.detail.returnDecision')}</button>");
rep(" /> Reportable</label>", " />{' '}{t('incidents.detail.reportableCheckbox')}</label>");
rep("placeholder={assessment.isReportable ? 'Reporting justification' : 'Decision not to report (required)'}", "placeholder={assessment.isReportable ? t('incidents.detail.reportingJustificationPlaceholder') : t('incidents.detail.decisionNotToReportPlaceholder')}");
rep('<EntityPicker label="Approving user" labelKey="entityPicker.searchPlaceholder"', "<EntityPicker labelKey=\"incidents.detail.approvingUser\"");
rep("setError('The assessor cannot be selected as approver.');", "setError(t('incidents.detail.assessorNotApproverError'));");
rep(", assessment.isReportable ? 'Reportability assessment saved.' : 'Non-reportable decision submitted for independent approval.')", ", assessment.isReportable ? t('incidents.detail.assessmentSavedDone') : t('incidents.detail.nonReportableSubmittedDone'))");
rep("{assessment.isReportable ? 'Save assessment' : 'Submit for approval'}", "{assessment.isReportable ? t('incidents.detail.saveAssessment') : t('incidents.detail.submitForApproval')}");

// Deadlines section
rep('<Section title="Notification deadlines">', "<Section title={t('incidents.detail.deadlinesTitle')}>");
rep(">No notification deadlines exist until the incident is significant/reportable.</p>", ">{t('incidents.detail.noDeadlinesNotice')}</p>");
rep(">Correct protected knowledge time</h3>", ">{t('incidents.detail.correctKnowledgeTimeTitle')}</h3>");
rep(", 'Knowledge time changed and deadlines recalculated.')", ", t('incidents.detail.knowledgeTimeDone'))");
rep(">Change knowledge time</button>", ">{t('incidents.detail.changeKnowledgeTime')}</button>");

// NIS2 reporting section
rep('<Section title="NIS2 reporting (Art. 23)">', "<Section title={t('incidents.detail.nis2ReportingTitle')}>");
rep("<p className=\"mb-3 text-sm text-gray-700 dark:text-gray-300\">This incident has not been marked as NIS2-relevant. Marking it enables the Art. 23 NIS-2 reporting workflow (§ 32 BSIG): an <strong>early warning</strong> without undue delay (at the latest within 24 hours), the <strong>72-hour notification</strong> to the competent authority, and a <strong>final report one month after the notification</strong>. The deadlines are derived from the knowledge time.</p>", "<p className=\"mb-3 text-sm text-gray-700 dark:text-gray-300\">{t('incidents.detail.markNis2Explanation')}</p>");
rep(", 'Incident marked as NIS2-relevant. Deadlines calculated from the knowledge time.')", ", t('incidents.detail.markNis2Done'))");
rep(">Mark as NIS2-relevant</button>", ">{t('incidents.detail.markNis2Button')}</button>");
rep("<span>72h notification deadline: <strong>", "<span>{t('incidents.detail.reportDeadlineLabel')}<strong>");
rep("(overdue)</em>", "{t('incidents.detail.overdueTag')}</em>");
rep("<span>Final report due: <strong>", "<span>{t('incidents.detail.finalReportDueLabel')}<strong>");
rep("<span>Reported at: ", "<span>{t('incidents.detail.reportedAtLabel')} ");
rep(">All NIS2 reports have been submitted for this incident.</p>", ">{t('incidents.detail.allReportsSubmitted')}</p>");
rep(">1 · Early warning (Frühwarnung)</h3>", ">{t('incidents.detail.earlyWarningStepTitle')}</h3>");
rep('placeholder="Short description of the incident for the early warning (required)"', "placeholder={t('incidents.detail.earlyWarningPlaceholder')}");
rep(", 'Early warning submitted.')", ", t('incidents.detail.earlyWarningDone'))");
rep(">Submit early warning</button>", ">{t('incidents.detail.submitEarlyWarning')}</button>");
rep(">Early warning already submitted.</p>", ">{t('incidents.detail.earlyWarningAlready')}</p>");
rep(">2 · 72-hour notification (Meldung)</h3>", ">{t('incidents.detail.notificationStepTitle')}</h3>");
rep('placeholder="Description for the formal 72h notification to the competent authority (required)"', "placeholder={t('incidents.detail.notificationPlaceholder')}");
rep(", 'NIS2 notification submitted.')", ", t('incidents.detail.notificationDone'))");
rep(">Submit 72h notification</button>", ">{t('incidents.detail.submitNotification')}</button>");
rep(">3 · Final report (Abschlussmeldung, one month after notification)</h3>", ">{t('incidents.detail.finalReportStepTitle')}</h3>");
rep('placeholder="Summary description (required)"', "placeholder={t('incidents.detail.finalReportSummaryPlaceholder')}");
rep('placeholder="Full final report content (required)"', "placeholder={t('incidents.detail.finalReportContentPlaceholder')}");
rep(", 'NIS2 final report submitted.')", ", t('incidents.detail.finalReportDone'))");
rep(">Submit final report</button>", ">{t('incidents.detail.submitFinalReport')}</button>");

// Reports section
rep('<Section title="Reports">', "<Section title={t('incidents.detail.reportsTitle')}>");
rep(">Due {toLocal(entry.dueAt)}", ">{t('incidents.detail.dueLabel')} {toLocal(entry.dueAt)}");
rep("`· submitted ${toLocal(entry.submittedAt)}`", "`· ${t('incidents.detail.submittedLabel')} ${toLocal(entry.submittedAt)}`");
rep(">Export</button>", ">{t('incidents.detail.export')}</button>");
rep('placeholder="Report title"', "placeholder={t('incidents.detail.reportTitlePlaceholder')}");
rep('placeholder="Report content"', "placeholder={t('incidents.detail.reportContentPlaceholder')}");
rep('placeholder="Recipient"', "placeholder={t('incidents.detail.recipientPlaceholder')}");
rep('placeholder="Submission proof (marks submitted)"', "placeholder={t('incidents.detail.submissionProofPlaceholder')}");
rep(", 'Report saved.')", ", t('incidents.detail.reportSavedDone'))");
rep(">Save report</button>", ">{t('incidents.detail.saveReport')}</button>");

// Communications section
rep('<Section title="Communications and evidence">', "<Section title={t('incidents.detail.communicationsTitle')}>");
rep("</strong> to {entry.recipient}", "</strong> {t('incidents.detail.toLabel')} {entry.recipient}");
rep('placeholder="Channel"', "placeholder={t('incidents.detail.channelPlaceholder')}");
rep('<option value="outbound">Outbound</option><option value="inbound">Inbound</option>', "<option value=\"outbound\">{t('incidents.detail.outboundOption')}</option><option value=\"inbound\">{t('incidents.detail.inboundOption')}</option>");
rep('placeholder="Sender"', "placeholder={t('incidents.detail.senderPlaceholder')}");
rep('placeholder="Message / evidence reference"', "placeholder={t('incidents.detail.messagePlaceholder')}");
rep(", 'Communication recorded.')", ", t('incidents.detail.communicationDone'))");
rep(">Record communication</button>", ">{t('incidents.detail.recordCommunication')}</button>");

// Closure section
rep('<Section title="Closure and lessons learned">', "<Section title={t('incidents.detail.closureTitle')}>");
rep('placeholder="Root cause (required)"', "placeholder={t('incidents.detail.rootCausePlaceholder')}");
rep('placeholder="Measures evaluation (required)"', "placeholder={t('incidents.detail.measuresEvaluationPlaceholder')}");
rep('placeholder="Lessons learned"', "placeholder={t('incidents.detail.lessonsLearnedPlaceholder')}");
rep('placeholder="Closure summary"', "placeholder={t('incidents.detail.closureSummaryPlaceholder')}");
rep(">Significant incidents also require a submitted final report before closure.</p>", ">{t('incidents.detail.closureHint')}</p>");
rep(", 'Incident closed.')", ", t('incidents.detail.closedDone'))");
rep(">Close incident</button>", ">{t('incidents.detail.closeIncident')}</button>");

fs.writeFileSync(p, s);
console.log('done');

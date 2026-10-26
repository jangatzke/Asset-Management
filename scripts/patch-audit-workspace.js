const fs = require('fs');
const p = 'frontend/src/pages/AuditWorkspace.tsx';
let s = fs.readFileSync(p, 'utf8');

function rep(find, replace) {
  if (!s.includes(find)) { console.error('NOT FOUND: ' + find.slice(0, 90)); process.exitCode = 1; return; }
  s = s.split(find).join(replace);
}

// Add useI18n hook to each subcomponent (they are defined outside AuditWorkspace)
const sigs = [
  "function ProgramForm({ onSave, onCancel, busy }: { onSave: (data: Omit<AuditProgram, 'id' | 'displayId'>) => void; onCancel: () => void; busy: boolean }) {",
  "function AuditForm({ onSave, onCancel, busy }: { onSave: (data: Omit<import('../services/api').AuditPlan, 'id' | 'displayId' | 'programId'>) => void; onCancel: () => void; busy: boolean }) {",
  "function FindingForm({ onSave, onCancel, busy }: { onSave: (data: Omit<AuditFinding, 'id' | 'displayId' | 'auditPlanId' | 'correctiveActionId'>) => void; onCancel: () => void; busy: boolean }) {",
  "function EvidencePanel({ detail, onRun, busy }: { detail: AuditFindingDetail; onRun: (action: () => Promise<unknown>) => Promise<void>; busy: boolean }) {",
  "function CapaForm({ onSave, onCancel, busy }: { onSave: (data: any) => void; onCancel: () => void; busy: boolean }) {",
  "function CapaPanel({ capa, onRun, busy }: { capa: CorrectiveAction; onRun: (action: () => Promise<unknown>) => Promise<void>; busy: boolean }) {",
  "function Form({ title, children, onSubmit, onCancel, busy }: { title: string; children: React.ReactNode; onSubmit: () => void; onCancel: () => void; busy: boolean }) {",
];
for (const sig of sigs) rep(sig, sig + ' const { t } = useI18n();');

// Program view
rep('<h3 className="font-semibold">Audits</h3>', "<h3 className=\"font-semibold\">{t('audit.audits')}</h3>");
rep('>Create audit</button>', ">{t('audit.createAudit')}</button>");

// Audit view
rep("?? 'Program'}", "?? t('audit.auditProgram')}");
rep('<h3 className="font-semibold">Findings</h3>', "<h3 className=\"font-semibold\">{t('audit.findings')}</h3>");
rep('>Record finding</button>', ">{t('audit.recordFinding')}</button>");
rep(">No findings recorded.</p>", ">{t('audit.noFindings')}</p>");

// Finding view
rep('<h3 className="font-semibold">Corrective action</h3>', "<h3 className=\"font-semibold\">{t('audit.correctiveAction')}</h3>");
rep('>Generate CAPA</button>', ">{t('audit.generateCapa')}</button>");
rep(">No CAPA is linked to this finding.</p>", ">{t('audit.noCapaLinked')}</p>");

// ProgramForm
rep('<Form title="Create audit program"', "<Form title={t('audit.createAuditProgram')}");
rep('placeholder="Program title"', "placeholder={t('audit.programTitle')}");
rep('placeholder="Program scope"', "placeholder={t('audit.programScope')}");
rep('<Picker label="Program owner"', "<Picker label={t('audit.programOwner')}");

// AuditForm
rep('<Form title="Create audit"', "<Form title={t('audit.createAudit')}");
rep('placeholder="Audit title"', "placeholder={t('audit.auditTitle')}");
rep('placeholder="Audit scope"', "placeholder={t('audit.auditScope')}");
rep('<Picker label="Auditors"', "<Picker label={t('audit.auditors')}");

// FindingForm
rep('<Form title="Record audit finding"', "<Form title={t('audit.recordAuditFinding')}");
rep('placeholder="Finding title"', "placeholder={t('audit.findingTitle')}");
rep('placeholder="Finding description"', "placeholder={t('audit.findingDescription')}");
rep('<Picker label="Finding owner"', "<Picker label={t('audit.findingOwner')}");
rep('<Picker label="Requirements"', "<Picker label={t('audit.requirements')}");
rep('<Picker label="Controls"', "<Picker label={t('audit.controlsLabel')}");
rep('<Picker label="Assets"', "<Picker label={t('audit.assetsLabel')}");
rep('<Picker label="Risks"', "<Picker label={t('audit.risksLabel')}");

// EvidencePanel
rep('<h3 className="font-semibold">Evidence</h3>', "<h3 className=\"font-semibold\">{t('audit.evidence')}</h3>");
rep('<Picker label="Visible evidence"', "<Picker label={t('audit.visibleEvidence')}");
rep('>Link evidence</button>', ">{t('audit.linkEvidence')}</button>");
rep("?? 'Evidence is no longer visible'}", "?? t('audit.evidenceNotVisible')}");
rep(">Remove</button>", ">{t('audit.remove')}</button>");

// CapaForm
rep('<Form title="Generate corrective action"', "<Form title={t('audit.generateCapaFormTitle')}");
rep('placeholder="CAPA title"', "placeholder={t('audit.capaTitle')}");
rep('placeholder="Correction and preventive action"', "placeholder={t('audit.capaDescription')}");
rep('<Picker label="CAPA owner"', "<Picker label={t('audit.capaOwner')}");

// CapaPanel
rep(">Due {new Date(capa.dueDate).toLocaleDateString()} · effectiveness: {capa.effectivenessStatus ?? 'not reviewed'}</p>", ">{t('audit.dueLabel')} {new Date(capa.dueDate).toLocaleDateString()} · {t('audit.effectivenessLabel')} {capa.effectivenessStatus ?? t('audit.notReviewed')}</p>");
rep(">Start progress</button>", ">{t('audit.startProgress')}</button>");
rep(">Mark completed</button>", ">{t('audit.markCompleted')}</button>");
rep('placeholder="Effectiveness review evidence and result"', "placeholder={t('audit.reviewPlaceholder')}");
rep(">Review effectiveness</button>", ">{t('audit.reviewEffectiveness')}</button>");
rep(">Close CAPA</button>", ">{t('audit.closeCapa')}</button>");
rep('placeholder="Required justification for reopening"', "placeholder={t('audit.reopenJustification')}");
rep(">Reopen</button>", ">{t('audit.reopen')}</button>");

// Form component (Cancel/Save)
rep('<button type="button" className="rounded border px-3 py-2 text-sm" onClick={onCancel}>Cancel</button>', "<button type=\"button\" className=\"rounded border px-3 py-2 text-sm\" onClick={onCancel}>{t('common.cancel')}</button>");
rep('<button disabled={busy} className={buttonClass}>Save</button>', "<button disabled={busy} className={buttonClass}>{t('common.save')}</button>");

fs.writeFileSync(p, s);
console.log('done');

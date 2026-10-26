const fs = require('fs');
const p = 'frontend/src/pages/SupplierDetail.tsx';
let src = fs.readFileSync(p, 'utf8');
let missing = 0;

function rep(find, replace) {
  if (!src.includes(find)) { console.log('NOT FOUND:', JSON.stringify(find.slice(0, 70))); missing++; return; }
  src = src.split(find).join(replace);
}

// Subcomponents: add useI18n hooks
rep("function Questionnaire({ value, onChange }: { value: Record<string, string | number | boolean | null>; onChange: (next: Record<string, string | number | boolean | null>) => void }) { const [key, setKey] = useState('');",
    "function Questionnaire({ value, onChange }: { value: Record<string, string | number | boolean | null>; onChange: (next: Record<string, string | number | boolean | null>) => void }) { const { t } = useI18n(); const [key, setKey] = useState('');");
rep("function Editor<T>({ title, items, onAdd, render }: { title: string; items: T[]; onAdd: () => void; render: (item: T, index: number) => React.ReactNode }) { return",
    "function Editor<T>({ title, items, onAdd, render }: { title: string; items: T[]; onAdd: () => void; render: (item: T, index: number) => React.ReactNode }) { const { t } = useI18n(); return");
rep("function FindingEditor({ value, onChange, onRemove }: { value: SupplierFinding; onChange: (value: SupplierFinding) => void; onRemove: () => void }) { return",
    "function FindingEditor({ value, onChange, onRemove }: { value: SupplierFinding; onChange: (value: SupplierFinding) => void; onRemove: () => void }) { const { t } = useI18n(); return");
rep("function ActionEditor({ value, onChange, onRemove }: { value: SupplierAction; onChange: (value: SupplierAction) => void; onRemove: () => void }) { return",
    "function ActionEditor({ value, onChange, onRemove }: { value: SupplierAction; onChange: (value: SupplierAction) => void; onRemove: () => void }) { const { t } = useI18n(); return");
rep("function RelationSection({ label, picker, canAdd, onAdd, relations, onRemove }: { label: string; picker: React.ReactNode; canAdd: boolean; onAdd: () => void; relations: Array<Record<string, unknown>>; onRemove: (id: string) => void }) { return",
    "function RelationSection({ label, title, picker, canAdd, onAdd, relations, onRemove }: { label: string; title: string; picker: React.ReactNode; canAdd: boolean; onAdd: () => void; relations: Array<Record<string, unknown>>; onRemove: (id: string) => void }) { const { t } = useI18n(); return");

// Tabs
rep("{item === 'actions' ? 'CAPAs / Actions' : item === 'history' ? 'History / Reviews' : item}", "{t(`suppliers.detail.tabs.${item}`)}");

// Profile tab
rep('<h2 className="text-lg font-semibold">Profile</h2>', "<h2 className=\"text-lg font-semibold\">{t('suppliers.detail.profile')}</h2>");
rep("([['Contact', detail.supplier.contactPerson], ['Email', detail.supplier.contactEmail], ['Services', detail.supplier.servicesProvided], ['Criticality', detail.supplier.criticality], ['Next review', detail.supplier.nextReviewDate]]",
    "([[t('suppliers.detail.contact'), detail.supplier.contactPerson], [t('suppliers.detail.emailLabel'), detail.supplier.contactEmail], [t('suppliers.detail.services'), detail.supplier.servicesProvided], [t('suppliers.criticality'), detail.supplier.criticality], [t('suppliers.nextReviewDate'), detail.supplier.nextReviewDate]]");
rep("<dd>{String(value ?? 'Not recorded')}</dd>", "<dd>{String(value ?? t('incidents.detail.noneRecorded'))}</dd>");

// Assessments tab
rep("{editingAssessment ? 'Edit assessment' : 'New guided assessment'}", "{editingAssessment ? t('suppliers.detail.editAssessment') : t('suppliers.detail.newGuidedAssessment')}");
rep('<EntityPicker label="Assessor" labelKey="supplier.assessor" entityType="user"', '<EntityPicker labelKey="risks.assessor" entityType="user"');
rep('<label>Type<select', "{t('common.type')}<select");
rep('<option value="initial">Initial</option><option value="periodic">Periodic</option><option value="ad_hoc">Ad hoc</option>', "<option value=\"initial\">{t('suppliers.detail.assessmentTypeInitial')}</option><option value=\"periodic\">{t('suppliers.detail.assessmentTypePeriodic')}</option><option value=\"ad_hoc\">{t('suppliers.detail.assessmentTypeAdHoc')}</option>");
rep('<label>Score<input', "{t('suppliers.detail.scoreLabel')}<input");
rep('<label>Rating<select', "{t('suppliers.detail.ratingLabel')}<select");
rep('<option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div><Questionnaire', "<option>{t('risks.riskLevel.low')}</option><option>{t('risks.riskLevel.medium')}</option><option>{t('risks.riskLevel.high')}</option><option>{t('risks.riskLevel.critical')}</option></select></label></div><Questionnaire");
rep('<Editor title="Findings"', "<Editor title={t('suppliers.detail.findingsHeading')}");
rep('<Editor title="Planned actions"', "<Editor title={t('suppliers.detail.plannedActionsHeading')}");
rep("{busy ? 'Saving…' : 'Save assessment'}", "{busy ? t('common.saving') : t('suppliers.detail.saveAssessment')}");
rep("setAssessment(emptyAssessment(currentUser?.id)); }}>Cancel</button>", "setAssessment(emptyAssessment(currentUser?.id)); }}>{t('common.cancel')}</button>");
rep('<h2 className="text-lg font-semibold">Assessment history</h2>', "<h2 className=\"text-lg font-semibold\">{t('suppliers.detail.assessmentHistory')}</h2>");
rep("{item.score ?? 'No'} score · {item.findings.length} finding(s)</span>", "{item.score ?? t('common.no')} {t('suppliers.detail.scoreWord')} · {item.findings.length} {t('suppliers.detail.findingsCount')}</span>");
rep('<button className="text-primary-600" onClick={() => { setAssessment(item); setEditingAssessment(item.id); }}>Edit</button>', "<button className=\"text-primary-600\" onClick={() => { setAssessment(item); setEditingAssessment(item.id); }}>{t('common.edit')}</button>");

// Contracts / risks tabs (label kept as data key; title for display)
rep('<RelationSection label="Contract" picker={<EntityPicker label="Select a visible contract" labelKey="supplier.contract"', '<RelationSection label="Contract" title={t(\'suppliers.detail.contract\')} picker={<EntityPicker labelKey="suppliers.detail.selectContract"');
rep('<RelationSection label="Risk" picker={<EntityPicker label="Select a visible risk" labelKey="supplier.risk"', '<RelationSection label="Risk" title={t(\'suppliers.detail.risk\')} picker={<EntityPicker labelKey="suppliers.detail.selectRisk"');

// Actions (CAPA) tab
rep('<h2 className="text-lg font-semibold">Create CAPA from this supplier</h2>', "<h2 className=\"text-lg font-semibold\">{t('suppliers.detail.createCapaTitle')}</h2>");
rep('placeholder="Corrective action title"', "placeholder={t('suppliers.detail.capaTitlePlaceholder')}");
rep('<input className={input} placeholder="Description" value={capa.description}', "<input className={input} placeholder={t('common.description')} value={capa.description}");
rep('<button className={`${button} mt-2`} disabled={busy}>Create CAPA</button>', "<button className={`${button} mt-2`} disabled={busy}>{t('suppliers.detail.createCapaButton')}</button>");
rep('<h2 className="text-lg font-semibold">Supplier CAPAs</h2>', "<h2 className=\"text-lg font-semibold\">{t('suppliers.detail.supplierCapas')}</h2>");

// History tab
rep('<h2 className="text-lg font-semibold">Workflow history and reviews</h2>', "<h2 className=\"text-lg font-semibold\">{t('suppliers.detail.workflowHistoryHeading')}</h2>");
rep("{item.details || item.summary || 'Supplier workflow event'}", "{item.details || item.summary || t('suppliers.detail.defaultEvent')}");

// Questionnaire subcomponent
rep('<h3 className="font-medium">Questionnaire responses</h3>', "<h3 className=\"font-medium\">{t('suppliers.detail.questionnaireResponses')}</h3>");
rep('placeholder="Question"', "placeholder={t('suppliers.detail.questionPlaceholder')}");
rep('placeholder="Answer"', "placeholder={t('suppliers.detail.answerPlaceholder')}");
rep('setKey(\'\'); setAnswer(\'\'); } }}>Add</button>', "setKey(''); setAnswer(''); } }}>{t('common.add')}</button>");

// Editor subcomponent
rep('<button type="button" className="text-sm text-primary-600" onClick={onAdd}>Add</button>', "<button type=\"button\" className=\"text-sm text-primary-600\" onClick={onAdd}>{t('common.add')}</button>");

// FindingEditor subcomponent
rep('placeholder="Finding"', "placeholder={t('suppliers.detail.findingPlaceholder')}");
rep('<option>low</option><option>medium</option><option>high</option><option>critical</option></select><input className={input} placeholder="Recommended action"', "<option>{t('risks.riskLevel.low')}</option><option>{t('risks.riskLevel.medium')}</option><option>{t('risks.riskLevel.high')}</option><option>{t('risks.riskLevel.critical')}</option></select><input className={input} placeholder={t('suppliers.detail.recommendedActionPlaceholder')}");
rep('<button type="button" className="text-red-600" onClick={onRemove}>Remove</button>', "<button type=\"button\" className=\"text-red-600\" onClick={onRemove}>{t('audit.remove')}</button>");

// ActionEditor subcomponent
rep('<input className={input} placeholder="Action"', "<input className={input} placeholder={t('suppliers.detail.actionPlaceholder')}");
rep('<input className={input} placeholder="Owner"', "<input className={input} placeholder={t('suppliers.detail.ownerPlaceholder')}");

// RelationSection subcomponent
rep('<h2 className="text-lg font-semibold">{label} relationships</h2>', "<h2 className=\"text-lg font-semibold\">{t('suppliers.detail.relationshipsHeading', { name: title })}</h2>");
rep('<button className={button} disabled={!canAdd} onClick={onAdd}>Link {label}</button>', "<button className={button} disabled={!canAdd} onClick={onAdd}>{t('suppliers.detail.linkNamed', { name: title })}</button>");
rep('<button className="text-red-600" onClick={() => onRemove(String(relation.id))}>Remove</button>', "<button className=\"text-red-600\" onClick={() => onRemove(String(relation.id))}>{t('audit.remove')}</button>");

fs.writeFileSync(p, src);
console.log(missing ? `done with ${missing} missing` : 'done');
process.exit(missing ? 1 : 0);

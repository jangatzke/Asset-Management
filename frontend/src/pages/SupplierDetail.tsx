import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EntityPicker from '../components/EntityPicker';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { supplierApi, type SupplierAction, type SupplierAssessment, type SupplierDetail, type SupplierFinding } from '../services/api';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';

type Tab = 'profile' | 'assessments' | 'contracts' | 'risks' | 'actions' | 'history';
const card = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800';
const input = 'mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900';
const button = 'rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';

const emptyAssessment = (assessorId = ''): Partial<SupplierAssessment> => ({ assessorId, assessmentType: 'initial', rating: 'medium', status: 'draft', questionnaire: {}, findings: [], actions: [] });

export default function SupplierDetailPage() {
  const { t } = useI18n();
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [assessment, setAssessment] = useState<Partial<SupplierAssessment>>(emptyAssessment(currentUser?.id));
  const [editingAssessment, setEditingAssessment] = useState<string | null>(null);
  const [contract, setContract] = useState<EntityPickerResult | null>(null);
  const [risk, setRisk] = useState<EntityPickerResult | null>(null);
  const [capa, setCapa] = useState({ title: '', description: '', dueDate: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setError('');
    try { setDetail((await supplierApi.getDetail(supplierId)).data); } catch (err) { setError(err instanceof Error ? err.message : t('common.loading')); }
  }, [supplierId, t]);
  useEffect(() => { void load(); }, [load]);

  const saveAssessment = async (event: FormEvent) => {
    event.preventDefault(); if (!supplierId || !assessment.assessorId) { setError(t('common.requiredField')); return; }
    setBusy(true); setError('');
    try {
      if (editingAssessment) await supplierApi.updateAssessment(editingAssessment, assessment);
      else await supplierApi.createAssessment(supplierId, assessment as any);
      setAssessment(emptyAssessment(currentUser?.id)); setEditingAssessment(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : t('common.saveError')); } finally { setBusy(false); }
  };
  const addRelation = async (kind: 'contract' | 'risk') => {
    if (!supplierId || !(kind === 'contract' ? contract : risk)) return;
    setBusy(true); try {
      if (kind === 'contract') await supplierApi.addContract(supplierId, { contractId: contract!.id }); else await supplierApi.addRisk(supplierId, { riskId: risk!.id });
      setContract(null); setRisk(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : t('common.saveError')); } finally { setBusy(false); }
  };
  const createCapa = async (event: FormEvent) => {
    event.preventDefault(); if (!supplierId || !capa.title) return;
    setBusy(true); try { await supplierApi.createCapa(supplierId, { ...capa, dueDate: capa.dueDate || undefined }); setCapa({ title: '', description: '', dueDate: '' }); await load(); } catch (err) { setError(err instanceof Error ? err.message : t('common.saveError')); } finally { setBusy(false); }
  };
  const findings = assessment.findings ?? []; const actions = assessment.actions ?? [];
  const updateFinding = (index: number, value: SupplierFinding) => setAssessment((old) => ({ ...old, findings: findings.map((item, i) => i === index ? value : item) }));
  const updateAction = (index: number, value: SupplierAction) => setAssessment((old) => ({ ...old, actions: actions.map((item, i) => i === index ? value : item) }));
  if (!detail) return <div className={card}>{error || t('common.loading')}</div>;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><button onClick={() => navigate('/isms-operations')} className="text-sm text-blue-600">← {t('ismsOperations.title')}</button><h1 className="mt-2 text-2xl font-bold">{String(detail.supplier.legalName)}</h1><p className="text-sm text-gray-500">{String(detail.supplier.displayId)} · {t('suppliers.title')}</p></div><span className="rounded bg-blue-50 px-3 py-1 text-sm text-blue-800">{String(detail.supplier.status)}</span></header>
    {error && <p className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <nav className="flex flex-wrap gap-2">{(['profile', 'assessments', 'contracts', 'risks', 'actions', 'history'] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded px-3 py-2 text-sm capitalize ${tab === item ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>{item === 'actions' ? 'CAPAs / Actions' : item === 'history' ? 'History / Reviews' : item}</button>)}</nav>
    {tab === 'profile' && <section className={card}><h2 className="text-lg font-semibold">Profile</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2">{([['Contact', detail.supplier.contactPerson], ['Email', detail.supplier.contactEmail], ['Services', detail.supplier.servicesProvided], ['Criticality', detail.supplier.criticality], ['Next review', detail.supplier.nextReviewDate]] as Array<[string, unknown]>).map(([label, value]) => <div key={label}><dt className="text-xs uppercase text-gray-500">{label}</dt><dd>{String(value ?? 'Not recorded')}</dd></div>)}</dl></section>}
    {tab === 'assessments' && <div className="space-y-5"><section className={card}><h2 className="text-lg font-semibold">{editingAssessment ? 'Edit assessment' : 'New guided assessment'}</h2><form onSubmit={saveAssessment} className="mt-4 space-y-4"><EntityPicker label="Assessor" labelKey="supplier.assessor" entityType="user" value={assessment.assessorId ? { id: assessment.assessorId, label: assessment.assessorId === currentUser?.id ? `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''} (you)` : assessment.assessorId } : null} onChange={(value) => setAssessment((old) => ({ ...old, assessorId: value.id }))}/><div className="grid gap-3 sm:grid-cols-3"><label>Type<select className={input} value={assessment.assessmentType ?? 'initial'} onChange={(e) => setAssessment((old) => ({ ...old, assessmentType: e.target.value as any }))}><option value="initial">Initial</option><option value="periodic">Periodic</option><option value="ad_hoc">Ad hoc</option></select></label><label>Score<input className={input} type="number" min="0" max="100" value={assessment.score ?? ''} onChange={(e) => setAssessment((old) => ({ ...old, score: e.target.value ? Number(e.target.value) : undefined }))}/></label><label>Rating<select className={input} value={assessment.rating ?? 'medium'} onChange={(e) => setAssessment((old) => ({ ...old, rating: e.target.value }))}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label></div><Questionnaire value={assessment.questionnaire ?? {}} onChange={(questionnaire) => setAssessment((old) => ({ ...old, questionnaire }))}/><Editor title="Findings" items={findings} onAdd={() => setAssessment((old) => ({ ...old, findings: [...findings, { title: '', severity: 'medium' }] }))} render={(item, index) => <FindingEditor value={item} onChange={(value) => updateFinding(index, value)} onRemove={() => setAssessment((old) => ({ ...old, findings: findings.filter((_, i) => i !== index) }))}/>} /><Editor title="Planned actions" items={actions} onAdd={() => setAssessment((old) => ({ ...old, actions: [...actions, { title: '', status: 'open' }] }))} render={(item, index) => <ActionEditor value={item} onChange={(value) => updateAction(index, value)} onRemove={() => setAssessment((old) => ({ ...old, actions: actions.filter((_, i) => i !== index) }))}/>} /><button className={button} disabled={busy}>{busy ? 'Saving…' : 'Save assessment'}</button>{editingAssessment && <button type="button" className="ml-2 text-sm" onClick={() => { setEditingAssessment(null); setAssessment(emptyAssessment(currentUser?.id)); }}>Cancel</button>}</form></section><section className={card}><h2 className="text-lg font-semibold">Assessment history</h2><div className="mt-3 space-y-2">{detail.assessments.map((item) => <div key={item.id} className="flex justify-between rounded border p-3"><span>{item.assessmentType} · {item.rating} · {item.score ?? 'No'} score · {item.findings.length} finding(s)</span><button className="text-blue-600" onClick={() => { setAssessment(item); setEditingAssessment(item.id); }}>Edit</button></div>)}</div></section></div>}
    {tab === 'contracts' && <RelationSection label="Contract" picker={<EntityPicker label="Select a visible contract" labelKey="supplier.contract" entityType="contract" value={contract} onChange={setContract}/>} canAdd={!!contract} onAdd={() => void addRelation('contract')} relations={detail.contracts} onRemove={(id) => supplierId && void supplierApi.removeContract(supplierId, id).then(load)} />}
    {tab === 'risks' && <RelationSection label="Risk" picker={<EntityPicker label="Select a visible risk" labelKey="supplier.risk" entityType="risk" value={risk} onChange={setRisk}/>} canAdd={!!risk} onAdd={() => void addRelation('risk')} relations={detail.risks} onRemove={(id) => supplierId && void supplierApi.removeRisk(supplierId, id).then(load)} />}
    {tab === 'actions' && <div className="space-y-5"><section className={card}><h2 className="text-lg font-semibold">Create CAPA from this supplier</h2><form onSubmit={createCapa} className="mt-3 grid gap-3 sm:grid-cols-3"><input className={input} placeholder="Corrective action title" value={capa.title} onChange={(e) => setCapa({ ...capa, title: e.target.value })}/><input className={input} placeholder="Description" value={capa.description} onChange={(e) => setCapa({ ...capa, description: e.target.value })}/><div><input className={input} type="date" value={capa.dueDate} onChange={(e) => setCapa({ ...capa, dueDate: e.target.value })}/><button className={`${button} mt-2`} disabled={busy}>Create CAPA</button></div></form></section><section className={card}><h2 className="text-lg font-semibold">Supplier CAPAs</h2>{detail.correctiveActions.map((item) => <div key={String(item.id)} className="mt-2 rounded border p-3">{String(item.displayId)} · {String(item.title)} · {String(item.status)}</div>)}</section></div>}
    {tab === 'history' && <section className={card}><h2 className="text-lg font-semibold">Workflow history and reviews</h2>{detail.history.map((item) => <div key={item.id} className="mt-2 rounded border p-3"><strong>{item.action}</strong> · {item.details || item.summary || 'Supplier workflow event'}<div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</div></div>)}</section>}
  </div>;
}

function Questionnaire({ value, onChange }: { value: Record<string, string | number | boolean | null>; onChange: (next: Record<string, string | number | boolean | null>) => void }) { const [key, setKey] = useState(''); const [answer, setAnswer] = useState(''); return <section><h3 className="font-medium">Questionnaire responses</h3>{Object.entries(value).map(([question, response]) => <label key={question} className="mt-2 block text-sm">{question}<input className={input} value={String(response ?? '')} onChange={(e) => onChange({ ...value, [question]: e.target.value })}/></label>)}<div className="mt-2 flex gap-2"><input className={input} placeholder="Question" value={key} onChange={(e) => setKey(e.target.value)}/><input className={input} placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)}/><button type="button" className={button} onClick={() => { if (key) { onChange({ ...value, [key]: answer }); setKey(''); setAnswer(''); } }}>Add</button></div></section>; }
function Editor<T>({ title, items, onAdd, render }: { title: string; items: T[]; onAdd: () => void; render: (item: T, index: number) => React.ReactNode }) { return <section><div className="flex justify-between"><h3 className="font-medium">{title}</h3><button type="button" className="text-sm text-blue-600" onClick={onAdd}>Add</button></div>{items.map(render)}</section>; }
function FindingEditor({ value, onChange, onRemove }: { value: SupplierFinding; onChange: (value: SupplierFinding) => void; onRemove: () => void }) { return <div className="mt-2 grid gap-2 rounded border p-3 sm:grid-cols-4"><input className={input} placeholder="Finding" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })}/><select className={input} value={value.severity} onChange={(e) => onChange({ ...value, severity: e.target.value as SupplierFinding['severity'] })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select><input className={input} placeholder="Recommended action" value={value.recommendedAction ?? ''} onChange={(e) => onChange({ ...value, recommendedAction: e.target.value })}/><button type="button" className="text-red-600" onClick={onRemove}>Remove</button></div>; }
function ActionEditor({ value, onChange, onRemove }: { value: SupplierAction; onChange: (value: SupplierAction) => void; onRemove: () => void }) { return <div className="mt-2 grid gap-2 rounded border p-3 sm:grid-cols-4"><input className={input} placeholder="Action" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })}/><input className={input} placeholder="Owner" value={value.owner ?? ''} onChange={(e) => onChange({ ...value, owner: e.target.value })}/><input className={input} type="date" value={value.dueDate ?? ''} onChange={(e) => onChange({ ...value, dueDate: e.target.value })}/><button type="button" className="text-red-600" onClick={onRemove}>Remove</button></div>; }
function RelationSection({ label, picker, canAdd, onAdd, relations, onRemove }: { label: string; picker: React.ReactNode; canAdd: boolean; onAdd: () => void; relations: Array<Record<string, unknown>>; onRemove: (id: string) => void }) { return <section className={card}><h2 className="text-lg font-semibold">{label} relationships</h2><div className="mt-3 flex flex-wrap items-end gap-3"><div className="min-w-72 flex-1">{picker}</div><button className={button} disabled={!canAdd} onClick={onAdd}>Link {label}</button></div><div className="mt-4 space-y-2">{relations.map((relation) => { const linked = relation[label.toLowerCase()] as Record<string, unknown> | null; return <div key={String(relation.id)} className="flex justify-between rounded border p-3"><span>{String(linked?.displayId ?? '')} {String(linked?.title ?? '')}</span><button className="text-red-600" onClick={() => onRemove(String(relation.id))}>Remove</button></div>; })}</div></section>; }

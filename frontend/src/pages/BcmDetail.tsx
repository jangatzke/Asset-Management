import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EntityPicker from '../components/EntityPicker';
import { bcmApi, type BcpExerciseFinding } from '../services/api';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { useI18n } from '../context/I18nContext';

type Strategy = { name: string; priority: 'primary' | 'alternate' | 'fallback'; steps: string[]; recoveryTargetMinutes?: number };
type Communication = { audience: string; channel: string; message: string; timing?: string; ownerId?: string };
type Participant = { userId: string; role: string; attended: boolean };
type Result = { objective: string; outcome: 'met' | 'partially_met' | 'not_met'; notes?: string };

const asArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const isoDate = (value?: string) => value ? value.slice(0, 10) : '';
const newStrategy = (): Strategy => ({ name: '', priority: 'primary', steps: [''] });
const newCommunication = (): Communication => ({ audience: '', channel: '', message: '' });
const newFinding = (): BcpExerciseFinding => ({ title: '', description: '', severity: 'medium' });

export default function BcmDetail() {
  const { t } = useI18n();
  const { kind, id } = useParams<{ kind: 'bia' | 'bcp' | 'exercise'; id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [related, setRelated] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assetLinks, setAssetLinks] = useState<Array<{ assetId: string; role: 'dependency' | 'primary' | 'supporting' }>>([]);
  const [assets, setAssets] = useState<EntityPickerResult[]>([]);
  const [bia, setBia] = useState<EntityPickerResult | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([newStrategy()]);
  const [communications, setCommunications] = useState<Communication[]>([newCommunication()]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantUsers, setParticipantUsers] = useState<EntityPickerResult[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [findings, setFindings] = useState<BcpExerciseFinding[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!id || !kind) return;
      setLoading(true); setError(null);
      try {
        const response = kind === 'bia' ? await bcmApi.getBiaDetail(id) : kind === 'bcp' ? await bcmApi.getBcpDetail(id) : await bcmApi.getExerciseDetail(id);
        if (ignore) return;
        const data: any = response.data;
        const entity = data[kind === 'bia' ? 'bia' : kind === 'bcp' ? 'bcp' : 'exercise'];
        setRecord(entity); setRelated(data);
        if (kind === 'bia') { setAssetLinks(asArray(data.assets)); setAssets(asArray(data.assets).map((x: any) => ({ id: x.assetId, label: x.assetId }))); }
        if (kind === 'bcp') { setBia(data.bia ? { id: data.bia.id, label: data.bia.title } : null); setStrategies(asArray(entity.recoveryStrategies)); setCommunications(asArray(entity.communicationPlan)); }
        if (kind === 'exercise') { const loadedParticipants = asArray<Participant>(entity.participants); setParticipants(loadedParticipants); setParticipantUsers(loadedParticipants.map((x) => ({ id: x.userId, label: x.userId }))); setResults(asArray(entity.results)); setFindings(asArray(entity.findings)); }
      } catch (e) { if (!ignore) setError(e instanceof Error ? e.message : t('common.loading')); }
      finally { if (!ignore) setLoading(false); }
    }
    load(); return () => { ignore = true; };
  }, [id, kind, t]);

  const update = (key: string, value: unknown) => setRecord(previous => previous ? { ...previous, [key]: value } : previous);
  const save = async () => {
    if (!record || !id || !kind) return;
    setSaving(true); setError(null);
    try {
      if (kind === 'bia') await bcmApi.updateBia(id, { title: record.title, ownerId: record.ownerId, processId: record.processId || undefined, serviceId: record.serviceId || undefined, mtpdMinutes: Number(record.mtpdMinutes), rtoMinutes: Number(record.rtoMinutes), rpoMinutes: Number(record.rpoMinutes), assetLinks, impactCategories: asArray(record.impactCategories), timeDependentImpacts: asArray(record.timeDependentImpacts), requiredResources: asArray(record.requiredResources), minimumOperatingLevel: record.minimumOperatingLevel || undefined, nextReviewDate: record.nextReviewDate || undefined, status: record.status });
      if (kind === 'bcp') await bcmApi.updateBcp(id, { title: record.title, ownerId: record.ownerId, biaId: bia?.id, scope: record.scope || undefined, version: record.version, recoveryStrategies: strategies, communicationPlan: communications, activationCriteria: record.activationCriteria || undefined, nextTestDate: record.nextTestDate || undefined, status: record.status });
      if (kind === 'exercise') await bcmApi.updateExercise(id, { bcpId: record.bcpId, exerciseType: record.exerciseType, plannedAt: record.plannedAt, executedAt: record.executedAt || undefined, participants, results, findings, status: record.status });
      navigate('/isms-operations');
    } catch (e) { setError(e instanceof Error ? e.message : t('common.saveError')); }
    finally { setSaving(false); }
  };
  const createCapa = async (findingIndex: number) => {
    if (!id) return;
    const finding = findings[findingIndex];
    const ownerId = record?.bcpOwnerId ?? related.bcp?.ownerId;
    if (!ownerId) { setError(t('bcm.detail.capaNeedsOwner')); return; }
    try { await bcmApi.createCapaFromExercise(id, { findingIndex, title: finding.title, description: finding.description, ownerId, dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), priority: finding.severity }); navigate('/isms-operations'); }
    catch (e) { setError(e instanceof Error ? e.message : t('common.saveError')); }
  };
  if (loading) return <div className="p-6">{t('common.loading')}</div>;
  if (!record || !kind) return <div className="p-6">{error ?? t('common.noResults')}</div>;
  const label = kind === 'bia' ? t('bcm.businessImpactAnalysis') : kind === 'bcp' ? t('bcm.continuityPlan') : t('bcm.exercise');
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><Link className="text-sm text-primary-600 hover:underline" to="/isms-operations">← {t('ismsOperations.title')}</Link><h1 className="mt-2 text-2xl font-semibold">{label}: {record.title ?? record.exerciseType}</h1></div>
    {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <section className="grid gap-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800 md:grid-cols-2">
      {kind !== 'exercise' && <><Input label={t('common.title')} value={record.title} onChange={(v) => update('title', v)} /><Picker label={t('bcm.detail.owner')} entityType="user" value={record.ownerId} onSelect={(item) => update('ownerId', item.id)} /></>}
      {kind === 'bia' && <><Picker label={t('bcm.detail.businessProcess')} entityType="businessProcess" value={record.processId} onSelect={(item) => update('processId', item.id)} /><Input label={t('bcm.detail.mtpdMinutes')} type="number" value={record.mtpdMinutes} onChange={(v) => update('mtpdMinutes', v)} /><Input label={t('bcm.detail.rtoMinutes')} type="number" value={record.rtoMinutes} onChange={(v) => update('rtoMinutes', v)} /><Input label={t('bcm.detail.rpoMinutes')} type="number" value={record.rpoMinutes} onChange={(v) => update('rpoMinutes', v)} /><Input label={t('bcm.detail.nextReview')} type="date" value={isoDate(record.nextReviewDate)} onChange={(v) => update('nextReviewDate', v)} /></>}
      {kind === 'bcp' && <><Picker label={t('bcm.detail.derivedFromBia')} entityType="bia" value={bia?.id} onSelect={setBia} /><Input label={t('bcm.detail.scope')} value={record.scope} onChange={(v) => update('scope', v)} /><Input label={t('bcm.nextTest')} type="date" value={isoDate(record.nextTestDate)} onChange={(v) => update('nextTestDate', v)} /></>}
      {kind === 'exercise' && <><Picker label={t('bcm.detail.bcpLabel')} entityType="bcp" value={record.bcpId} onSelect={(item) => update('bcpId', item.id)} /><Input label={t('bcm.detail.exerciseType')} value={record.exerciseType} onChange={(v) => update('exerciseType', v)} /><Input label={t('bcm.detail.plannedDate')} type="date" value={isoDate(record.plannedAt)} onChange={(v) => update('plannedAt', v)} /><Input label={t('bcm.detail.executedDate')} type="date" value={isoDate(record.executedAt)} onChange={(v) => update('executedAt', v)} /></>}
    </section>
    {kind === 'bia' && <AssetEditor assets={assets} links={assetLinks} setAssets={setAssets} setLinks={setAssetLinks} />}
    {kind === 'bcp' && <StrategyEditor strategies={strategies} setStrategies={setStrategies} communications={communications} setCommunications={setCommunications} />}
    {kind === 'exercise' && <ExerciseEditor users={participantUsers} setUsers={setParticipantUsers} participants={participants} setParticipants={setParticipants} results={results} setResults={setResults} findings={findings} setFindings={setFindings} onCapa={createCapa} />}
    <button onClick={save} disabled={saving} className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? t('common.saving') : t('common.save')}</button>
  </div>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: unknown; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-medium">{label}<input type={type} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border p-2 font-normal" /></label>; }
function Picker({ label, entityType, value, onSelect }: { label: string; entityType: any; value?: string; onSelect: (item: EntityPickerResult) => void }) { return <EntityPicker label={label} labelKey={label} entityType={entityType} value={value ? { id: value, label: value } : null} onChange={onSelect} />; }
function AssetEditor({ assets, links, setAssets, setLinks }: any) { const { t } = useI18n(); return <section className="rounded-lg bg-white p-5 shadow dark:bg-gray-800"><h2 className="font-semibold">{t('bcm.detail.linkedAssets')}</h2><EntityPicker labelKey="entities.assets" entityType="asset" multiple values={assets} onValuesChange={(values) => { setAssets(values); setLinks(values.map((asset: EntityPickerResult) => links.find((link: any) => link.assetId === asset.id) ?? { assetId: asset.id, role: 'dependency' })); }} />{links.map((link: any, i: number) => <select key={link.assetId} value={link.role} onChange={(e) => setLinks(links.map((x: any, j: number) => j === i ? { ...x, role: e.target.value } : x))} className="mt-2 rounded border p-2"><option value="dependency">{t('bcm.detail.roleDependency')}</option><option value="primary">{t('bcm.detail.rolePrimary')}</option><option value="supporting">{t('bcm.detail.roleSupporting')}</option></select>)}</section>; }
function StrategyEditor({ strategies, setStrategies, communications, setCommunications }: any) { const { t } = useI18n(); return <section className="space-y-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800"><h2 className="font-semibold">{t('bcm.detail.recoveryStrategies')}</h2>{strategies.map((s: Strategy, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label={t('bcm.detail.strategyName')} value={s.name} onChange={(v) => setStrategies(strategies.map((x: Strategy, j: number) => j === i ? { ...x, name: v } : x))} /><Input label={t('bcm.detail.stepsOnePerLine')} value={s.steps.join('\n')} onChange={(v) => setStrategies(strategies.map((x: Strategy, j: number) => j === i ? { ...x, steps: v.split('\n').filter(Boolean) } : x))} /></div>)}<button onClick={() => setStrategies([...strategies, newStrategy()])} className="text-sm text-primary-600">{t('bcm.detail.addStrategy')}</button><h2 className="font-semibold">{t('bcm.detail.communicationPlan')}</h2>{communications.map((c: Communication, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label={t('bcm.detail.audience')} value={c.audience} onChange={(v) => setCommunications(communications.map((x: Communication, j: number) => j === i ? { ...x, audience: v } : x))} /><Input label={t('bcm.detail.channel')} value={c.channel} onChange={(v) => setCommunications(communications.map((x: Communication, j: number) => j === i ? { ...x, channel: v } : x))} /><Input label={t('bcm.detail.message')} value={c.message} onChange={(v) => setCommunications(communications.map((x: Communication, j: number) => j === i ? { ...x, message: v } : x))} /></div>)}<button onClick={() => setCommunications([...communications, newCommunication()])} className="text-sm text-primary-600">{t('bcm.detail.addCommunication')}</button></section>; }
function ExerciseEditor({ users, setUsers, participants, setParticipants, results, setResults, findings, setFindings, onCapa }: any) { const { t } = useI18n(); return <section className="space-y-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800"><h2 className="font-semibold">{t('bcm.detail.participants')}</h2><EntityPicker labelKey="bcm.detail.participants" entityType="user" multiple values={users} onValuesChange={(items) => { setUsers(items); setParticipants(items.map(item => participants.find((p: Participant) => p.userId === item.id) ?? { userId: item.id, role: 'Participant', attended: true })); }} /><h2 className="font-semibold">{t('bcm.detail.results')}</h2>{results.map((result: Result, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label={t('bcm.detail.objective')} value={result.objective} onChange={(v) => setResults(results.map((x: Result, j: number) => j === i ? { ...x, objective: v } : x))} /><select value={result.outcome} onChange={(e) => setResults(results.map((x: Result, j: number) => j === i ? { ...x, outcome: e.target.value } : x))} className="rounded border p-2"><option value="met">{t('bcm.detail.outcomeMet')}</option><option value="partially_met">{t('bcm.detail.outcomePartiallyMet')}</option><option value="not_met">{t('bcm.detail.outcomeNotMet')}</option></select></div>)}<button onClick={() => setResults([...results, { objective: '', outcome: 'met' }])} className="text-sm text-primary-600">{t('bcm.detail.addResult')}</button><h2 className="font-semibold">{t('bcm.detail.findingsAndCapa')}</h2>{findings.map((finding: BcpExerciseFinding, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label={t('bcm.detail.finding')} value={finding.title} onChange={(v) => setFindings(findings.map((x: BcpExerciseFinding, j: number) => j === i ? { ...x, title: v } : x))} /><Input label={t('common.description')} value={finding.description} onChange={(v) => setFindings(findings.map((x: BcpExerciseFinding, j: number) => j === i ? { ...x, description: v } : x))} /><button onClick={() => onCapa(i)} className="w-fit text-sm text-primary-600">{t('bcm.detail.createCapa')}</button></div>)}<button onClick={() => setFindings([...findings, newFinding()])} className="text-sm text-primary-600">{t('bcm.detail.addFinding')}</button></section>; }

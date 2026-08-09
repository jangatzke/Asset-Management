import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import EntityPicker from '../components/EntityPicker';
import { bcmApi, type BcpExerciseFinding } from '../services/api';
import type { EntityPickerResult } from '../services/entityPickerApi';

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
      } catch (e) { if (!ignore) setError(e instanceof Error ? e.message : 'Unable to load BCM workflow.'); }
      finally { if (!ignore) setLoading(false); }
    }
    load(); return () => { ignore = true; };
  }, [id, kind]);

  const update = (key: string, value: unknown) => setRecord(previous => previous ? { ...previous, [key]: value } : previous);
  const save = async () => {
    if (!record || !id || !kind) return;
    setSaving(true); setError(null);
    try {
      if (kind === 'bia') await bcmApi.updateBia(id, { title: record.title, ownerId: record.ownerId, processId: record.processId || undefined, serviceId: record.serviceId || undefined, mtpdMinutes: Number(record.mtpdMinutes), rtoMinutes: Number(record.rtoMinutes), rpoMinutes: Number(record.rpoMinutes), assetLinks, impactCategories: asArray(record.impactCategories), timeDependentImpacts: asArray(record.timeDependentImpacts), requiredResources: asArray(record.requiredResources), minimumOperatingLevel: record.minimumOperatingLevel || undefined, nextReviewDate: record.nextReviewDate || undefined, status: record.status });
      if (kind === 'bcp') await bcmApi.updateBcp(id, { title: record.title, ownerId: record.ownerId, biaId: bia?.id, scope: record.scope || undefined, version: record.version, recoveryStrategies: strategies, communicationPlan: communications, activationCriteria: record.activationCriteria || undefined, nextTestDate: record.nextTestDate || undefined, status: record.status });
      if (kind === 'exercise') await bcmApi.updateExercise(id, { bcpId: record.bcpId, exerciseType: record.exerciseType, plannedAt: record.plannedAt, executedAt: record.executedAt || undefined, participants, results, findings, status: record.status });
      navigate('/isms-operations');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save BCM workflow.'); }
    finally { setSaving(false); }
  };
  const createCapa = async (findingIndex: number) => {
    if (!id) return;
    const finding = findings[findingIndex];
    const ownerId = record?.bcpOwnerId ?? related.bcp?.ownerId;
    if (!ownerId) { setError('The linked BCP must have an owner before creating a CAPA.'); return; }
    try { await bcmApi.createCapaFromExercise(id, { findingIndex, title: finding.title, description: finding.description, ownerId, dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), priority: finding.severity }); navigate('/isms-operations'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to create CAPA.'); }
  };
  if (loading) return <div className="p-6">Loading BCM workflow…</div>;
  if (!record || !kind) return <div className="p-6">{error ?? 'BCM workflow not found.'}</div>;
  const label = kind === 'bia' ? 'Business Impact Analysis' : kind === 'bcp' ? 'Business Continuity Plan' : 'BCP Exercise';
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><Link className="text-sm text-blue-600 hover:underline" to="/isms-operations">← ISMS Operations</Link><h1 className="mt-2 text-2xl font-semibold">{label}: {record.title ?? record.exerciseType}</h1></div>
    {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <section className="grid gap-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800 md:grid-cols-2">
      {kind !== 'exercise' && <><Input label="Title" value={record.title} onChange={(v) => update('title', v)} /><Picker label="Owner" entityType="user" value={record.ownerId} onSelect={(item) => update('ownerId', item.id)} /></>}
      {kind === 'bia' && <><Picker label="Business process" entityType="businessProcess" value={record.processId} onSelect={(item) => update('processId', item.id)} /><Input label="MTPD minutes" type="number" value={record.mtpdMinutes} onChange={(v) => update('mtpdMinutes', v)} /><Input label="RTO minutes" type="number" value={record.rtoMinutes} onChange={(v) => update('rtoMinutes', v)} /><Input label="RPO minutes" type="number" value={record.rpoMinutes} onChange={(v) => update('rpoMinutes', v)} /><Input label="Next review" type="date" value={isoDate(record.nextReviewDate)} onChange={(v) => update('nextReviewDate', v)} /></>}
      {kind === 'bcp' && <><Picker label="Derived from BIA" entityType="bia" value={bia?.id} onSelect={setBia} /><Input label="Scope" value={record.scope} onChange={(v) => update('scope', v)} /><Input label="Next test" type="date" value={isoDate(record.nextTestDate)} onChange={(v) => update('nextTestDate', v)} /></>}
      {kind === 'exercise' && <><Picker label="BCP" entityType="bcp" value={record.bcpId} onSelect={(item) => update('bcpId', item.id)} /><Input label="Exercise type" value={record.exerciseType} onChange={(v) => update('exerciseType', v)} /><Input label="Planned date" type="date" value={isoDate(record.plannedAt)} onChange={(v) => update('plannedAt', v)} /><Input label="Executed date" type="date" value={isoDate(record.executedAt)} onChange={(v) => update('executedAt', v)} /></>}
    </section>
    {kind === 'bia' && <AssetEditor assets={assets} links={assetLinks} setAssets={setAssets} setLinks={setAssetLinks} />}
    {kind === 'bcp' && <StrategyEditor strategies={strategies} setStrategies={setStrategies} communications={communications} setCommunications={setCommunications} />}
    {kind === 'exercise' && <ExerciseEditor users={participantUsers} setUsers={setParticipantUsers} participants={participants} setParticipants={setParticipants} results={results} setResults={setResults} findings={findings} setFindings={setFindings} onCapa={createCapa} />}
    <button onClick={save} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save workflow'}</button>
  </div>;
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: unknown; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-medium">{label}<input type={type} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border p-2 font-normal" /></label>; }
function Picker({ label, entityType, value, onSelect }: { label: string; entityType: any; value?: string; onSelect: (item: EntityPickerResult) => void }) { return <EntityPicker label={label} labelKey={label} entityType={entityType} value={value ? { id: value, label: value } : null} onChange={onSelect} />; }
function AssetEditor({ assets, links, setAssets, setLinks }: any) { return <section className="rounded-lg bg-white p-5 shadow dark:bg-gray-800"><h2 className="font-semibold">Linked assets</h2><EntityPicker label="Assets" labelKey="Assets" entityType="asset" multiple values={assets} onValuesChange={(values) => { setAssets(values); setLinks(values.map((asset: EntityPickerResult) => links.find((link: any) => link.assetId === asset.id) ?? { assetId: asset.id, role: 'dependency' })); }} />{links.map((link: any, i: number) => <select key={link.assetId} value={link.role} onChange={(e) => setLinks(links.map((x: any, j: number) => j === i ? { ...x, role: e.target.value } : x))} className="mt-2 rounded border p-2"><option value="dependency">Dependency</option><option value="primary">Primary</option><option value="supporting">Supporting</option></select>)}</section>; }
function StrategyEditor({ strategies, setStrategies, communications, setCommunications }: any) { return <section className="space-y-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800"><h2 className="font-semibold">Recovery strategies</h2>{strategies.map((s: Strategy, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label="Strategy name" value={s.name} onChange={(v) => setStrategies(strategies.map((x: Strategy, j: number) => j === i ? { ...x, name: v } : x))} /><Input label="Steps (one per line)" value={s.steps.join('\n')} onChange={(v) => setStrategies(strategies.map((x: Strategy, j: number) => j === i ? { ...x, steps: v.split('\n').filter(Boolean) } : x))} /></div>)}<button onClick={() => setStrategies([...strategies, newStrategy()])} className="text-sm text-blue-600">Add strategy</button><h2 className="font-semibold">Communication plan</h2>{communications.map((c: Communication, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label="Audience" value={c.audience} onChange={(v) => setCommunications(communications.map((x: Communication, j: number) => j === i ? { ...x, audience: v } : x))} /><Input label="Channel" value={c.channel} onChange={(v) => setCommunications(communications.map((x: Communication, j: number) => j === i ? { ...x, channel: v } : x))} /><Input label="Message" value={c.message} onChange={(v) => setCommunications(communications.map((x: Communication, j: number) => j === i ? { ...x, message: v } : x))} /></div>)}<button onClick={() => setCommunications([...communications, newCommunication()])} className="text-sm text-blue-600">Add communication</button></section>; }
function ExerciseEditor({ users, setUsers, participants, setParticipants, results, setResults, findings, setFindings, onCapa }: any) { return <section className="space-y-4 rounded-lg bg-white p-5 shadow dark:bg-gray-800"><h2 className="font-semibold">Participants</h2><EntityPicker label="Participants" labelKey="Participants" entityType="user" multiple values={users} onValuesChange={(items) => { setUsers(items); setParticipants(items.map(item => participants.find((p: Participant) => p.userId === item.id) ?? { userId: item.id, role: 'Participant', attended: true })); }} /><h2 className="font-semibold">Results</h2>{results.map((result: Result, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label="Objective" value={result.objective} onChange={(v) => setResults(results.map((x: Result, j: number) => j === i ? { ...x, objective: v } : x))} /><select value={result.outcome} onChange={(e) => setResults(results.map((x: Result, j: number) => j === i ? { ...x, outcome: e.target.value } : x))} className="rounded border p-2"><option value="met">Met</option><option value="partially_met">Partially met</option><option value="not_met">Not met</option></select></div>)}<button onClick={() => setResults([...results, { objective: '', outcome: 'met' }])} className="text-sm text-blue-600">Add result</button><h2 className="font-semibold">Findings and CAPA</h2>{findings.map((finding: BcpExerciseFinding, i: number) => <div key={i} className="grid gap-2 rounded border p-3"><Input label="Finding" value={finding.title} onChange={(v) => setFindings(findings.map((x: BcpExerciseFinding, j: number) => j === i ? { ...x, title: v } : x))} /><Input label="Description" value={finding.description} onChange={(v) => setFindings(findings.map((x: BcpExerciseFinding, j: number) => j === i ? { ...x, description: v } : x))} /><button onClick={() => onCapa(i)} className="w-fit text-sm text-blue-600">Create CAPA</button></div>)}<button onClick={() => setFindings([...findings, newFinding()])} className="text-sm text-blue-600">Add finding</button></section>; }

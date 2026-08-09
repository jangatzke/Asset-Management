import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import EntityPicker from '../components/EntityPicker';
import { Modal } from '../components/Modal';
import { phase6Api } from '../services/api';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { useI18n } from '../context/I18nContext';
import { humanizeWorkflowAction, pickerEntityTypeForWorkflow, workflowEntityTypes, type WorkflowAction } from './workflowUx';

type RecordItem = Record<string, any>;
type Workspace = 'training' | 'metrics' | 'reviews' | 'workflows' | 'reports';
const workspaces: Array<{ key: Workspace; label: string; resources: string[] }> = [
  { key: 'training', label: 'Training', resources: ['trainingCourses', 'trainingAssignments', 'trainingAcknowledgements'] },
  { key: 'metrics', label: 'Metrics', resources: ['metricDefinitions', 'metricValues'] },
  { key: 'reviews', label: 'Management reviews', resources: ['managementReviews', 'managementReviewActions'] },
  { key: 'workflows', label: 'Workflow tasks', resources: ['workflowDefinitions', 'workflowInstances', 'workflowTasks'] },
  { key: 'reports', label: 'Reports & exports', resources: ['reportDefinitions', 'reportRuns', 'exportJobs'] },
];

const inputClass = 'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800';
const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} className={`rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 ${props.className ?? ''}`}>{children}</button>;
export const optionalNumber = (form: FormData, key: string): number | undefined => {
  const value = form.get(key);
  return value === null || value === '' ? undefined : Number(value);
};

export default function OperationsWorkspace() {
  const { t } = useI18n();
  const [workspace, setWorkspace] = useState<Workspace>('training');
  const [data, setData] = useState<Record<string, RecordItem[]>>({});
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [error, setError] = useState('');
  const active = useMemo(() => workspaces.find(item => item.key === workspace)!, [workspace]);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const responses = await Promise.all(active.resources.map(resource => phase6Api.list(resource, { limit: 100 })));
      setData(previous => ({ ...previous, ...Object.fromEntries(active.resources.map((resource, index) => [resource, responses[index].data.data ?? responses[index].data])) }));
    } catch { setError(t('operationsWorkspace.loadError')); }
    finally { setBusy(false); }
  }, [active.resources, t]);
  useEffect(() => { void load(); }, [load]);
  const items = (resource: string) => data[resource] ?? [];

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('operationsWorkspace.title')}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('operationsWorkspace.description')}</p></div>
    <nav className="flex flex-wrap gap-2" aria-label={t('operationsWorkspace.navigationLabel')}>{workspaces.map(item => <button key={item.key} onClick={() => setWorkspace(item.key)} className={`rounded px-3 py-2 text-sm font-medium ${workspace === item.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>{t(`operationsWorkspace.workspaces.${item.key}`)}</button>)}</nav>
    {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {workspace === 'training' && <Training courses={items('trainingCourses')} assignments={items('trainingAssignments')} acknowledgements={items('trainingAcknowledgements')} open={setModal} refresh={load} />}
    {workspace === 'metrics' && <Metrics definitions={items('metricDefinitions')} values={items('metricValues')} open={setModal} refresh={load} />}
    {workspace === 'reviews' && <Reviews reviews={items('managementReviews')} actions={items('managementReviewActions')} open={setModal} refresh={load} />}
    {workspace === 'workflows' && <Workflows definitions={items('workflowDefinitions')} instances={items('workflowInstances')} tasks={items('workflowTasks')} open={setModal} refresh={load} />}
    {workspace === 'reports' && <Reports definitions={items('reportDefinitions')} runs={items('reportRuns')} exports={items('exportJobs')} open={setModal} refresh={load} />}
    {busy && <p className="text-sm text-gray-500">{t('operationsWorkspace.refreshing')}</p>}
    <OperationModal kind={modal} courses={items('trainingCourses')} assignments={items('trainingAssignments')} definitions={items('metricDefinitions')} reviews={items('managementReviews')} workflows={items('workflowDefinitions')} instances={items('workflowInstances')} reports={items('reportDefinitions')} onClose={() => setModal(null)} onDone={() => { setModal(null); void load(); }} />
  </div>;
}

function List({ heading, items, children }: { heading: string; items: RecordItem[]; children?: React.ReactNode }) { const { t } = useI18n(); return <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-gray-900 dark:text-white">{heading}</h2>{children}</div>{items.length ? <div className="divide-y divide-gray-200 dark:divide-gray-700">{items.map(item => <div key={item.id} className="py-3 text-sm"><strong className="text-gray-900 dark:text-white">{item.title ?? item.name ?? item.displayId}</strong><span className="ml-2 text-gray-500">{item.status ?? item.breachStatus ?? ''}</span><p className="mt-1 text-gray-600 dark:text-gray-400">{item.dueDate ? t('operationsWorkspace.dueDate').replace('{date}', new Date(item.dueDate).toLocaleDateString()) : item.comment ?? item.description ?? ''}</p></div>)}</div> : <p className="text-sm text-gray-500">{t('operationsWorkspace.noRecords')}</p>}</section> }
function Training({ courses, assignments, acknowledgements, open }: any) { const { t } = useI18n(); return <div className="grid gap-5 lg:grid-cols-2"><List heading="Courses" items={courses}><Button onClick={() => open('course')}>{t('operationsWorkspace.actions.createCourse')}</Button></List><List heading="Assignments" items={assignments}><div className="flex gap-2"><Button onClick={() => open('assignment')}>{t('operationsWorkspace.actions.assignCourse')}</Button><Button onClick={() => open('completion')}>{t('operationsWorkspace.actions.recordCompletion')}</Button></div></List><List heading="Acknowledgements" items={acknowledgements}><Button onClick={() => open('acknowledgement')}>{t('operationsWorkspace.actions.acknowledgeCourse')}</Button></List></div> }
function Metrics({ definitions, values, open }: any) { const { t } = useI18n(); return <div className="grid gap-5 lg:grid-cols-2"><List heading="Metric definitions" items={definitions}><Button onClick={() => open('metric')}>{t('operationsWorkspace.actions.defineMetric')}</Button></List><List heading="Values, trends & breaches" items={values}><Button onClick={() => open('value')}>{t('operationsWorkspace.actions.enterValue')}</Button></List></div> }
function Reviews({ reviews, actions, open }: any) { const { t } = useI18n(); return <div className="grid gap-5 lg:grid-cols-2"><List heading={t('operationsWorkspace.workspaces.reviews')} items={reviews}><div className="flex gap-2"><Button onClick={() => open('review')}>{t('operationsWorkspace.actions.scheduleReview')}</Button><Button onClick={() => open('approve')}>{t('operationsWorkspace.actions.approveReview')}</Button></div></List><List heading="Decisions and actions" items={actions}><Button onClick={() => open('reviewAction')}>{t('operationsWorkspace.actions.addAction')}</Button></List></div> }
function Workflows({ definitions, instances, tasks, open }: any) { const { t } = useI18n(); return <div className="grid gap-5 lg:grid-cols-2"><List heading="Definitions (administrative)" items={definitions}/><List heading="Contextual instances" items={instances}><Button onClick={() => open('startWorkflow')}>{t('operationsWorkspace.actions.startFromEntity')}</Button></List><List heading="Actionable tasks" items={tasks}><Button onClick={() => open('transition')}>{t('operationsWorkspace.actions.transitionInstance')}</Button></List></div> }
function Reports({ definitions, runs, exports, open }: any) { const { t } = useI18n(); return <div className="grid gap-5 lg:grid-cols-2"><List heading="Report definitions" items={definitions}><Button onClick={() => open('report')}>{t('operationsWorkspace.actions.createDefinition')}</Button></List><List heading="Run results" items={runs}><Button onClick={() => open('run')}>{t('operationsWorkspace.actions.runReport')}</Button></List><List heading="Exports" items={exports}/></div> }

function OperationModal({ kind, courses, assignments, definitions, reviews, workflows, instances, reports, onClose, onDone }: any) {
  const [selected, setSelected] = useState<RecordItem | null>(null); const [user, setUser] = useState<EntityPickerResult | null>(null); const [entity, setEntity] = useState<EntityPickerResult | null>(null);
  const [workflowEntityType, setWorkflowEntityType] = useState(''); const [workflowActions, setWorkflowActions] = useState<WorkflowAction[]>([]); const [actionsLoading, setActionsLoading] = useState(false);
  useEffect(() => {
    if (kind !== 'startWorkflow') return;
    const supportedType = workflowEntityTypes(selected)[0]?.value ?? '';
    setWorkflowEntityType(supportedType);
    setEntity(null);
  }, [kind, selected?.id]);
  useEffect(() => {
    if (kind !== 'transition' || !selected) { setWorkflowActions([]); return; }
    let cancelled = false;
    setActionsLoading(true);
    phase6Api.workflowActions(selected.id).then(response => { if (!cancelled) setWorkflowActions(response.data.data); }).catch(() => { if (!cancelled) setWorkflowActions([]); }).finally(() => { if (!cancelled) setActionsLoading(false); });
    return () => { cancelled = true; };
  }, [kind, selected?.id]);
  if (!kind) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const str = (key: string) => String(form.get(key) ?? ''); const num = (key: string) => Number(form.get(key));
    if (kind === 'course' && user) await phase6Api.create('trainingCourses', { title: str('title'), category: str('category') || undefined, description: str('description') || undefined, ownerId: user.id, status: 'active' });
    if (kind === 'assignment' && selected && user) await phase6Api.create('trainingAssignments', { courseId: selected.id, userId: user.id, dueDate: str('dueDate'), notes: str('notes') || undefined });
    if (kind === 'completion' && selected) await phase6Api.completeTraining(selected.id, { score: optionalNumber(form, 'score'), result: 'passed' });
    if (kind === 'acknowledgement' && selected) await phase6Api.acknowledgeTraining({ courseId: selected.id, comment: str('comment') || undefined });
    if (kind === 'metric' && user) await phase6Api.createMetricDefinition({ name: str('name'), unit: str('unit') || undefined, ownerId: user.id, thresholds: { warningMin: optionalNumber(form, 'warningMin'), warningMax: optionalNumber(form, 'warningMax'), criticalMin: optionalNumber(form, 'criticalMin'), criticalMax: optionalNumber(form, 'criticalMax') } });
    if (kind === 'value' && selected) await phase6Api.enterMetricValue({ metricId: selected.id, value: num('value'), measuredAt: str('measuredAt') || undefined, source: str('source') || undefined, comment: str('comment') || undefined });
    if (kind === 'review' && user) await phase6Api.createManagementReview({ title: str('title'), reviewDate: str('reviewDate'), chairId: user.id, agenda: str('agenda') ? [{ topic: str('agenda') }] : [], decisions: str('decision') ? [{ decision: str('decision') }] : [] });
    if (kind === 'reviewAction' && selected && user) await phase6Api.addManagementReviewAction({ reviewId: selected.id, title: str('title'), ownerId: user.id, dueDate: str('dueDate') });
    if (kind === 'approve' && selected) await phase6Api.approveManagementReview(selected.id, true);
    if (kind === 'startWorkflow' && selected && entity && workflowEntityType) await phase6Api.startWorkflow({ definitionId: selected.id, entityType: workflowEntityType, entityId: entity.id });
    if (kind === 'transition' && selected) await phase6Api.transitionWorkflow(selected.id, { transition: str('transition'), comment: str('comment') || undefined });
    if (kind === 'report' && user) await phase6Api.createReportDefinition({ name: str('name'), module: str('module'), ownerId: user.id, columns: str('columns').split('\n').filter(Boolean), format: str('format') });
    if (kind === 'run' && selected) await phase6Api.runReport({ definitionId: selected.id, module: selected.module, format: str('format') as 'json' | 'csv' }); onDone(); };
  const choose = (items: RecordItem[], label: string) => <label className="block text-sm font-medium">{label}<select required className={inputClass} onChange={e => setSelected(items.find(item => item.id === e.target.value) ?? null)} defaultValue=""><option value="" disabled>Select {label.toLowerCase()}</option>{items.map(item => <option key={item.id} value={item.id}>{item.title ?? item.name ?? item.displayId}</option>)}</select></label>;
  const needsUser = ['course', 'assignment', 'metric', 'review', 'reviewAction', 'report'].includes(kind); const picker = needsUser && <EntityPicker label="Responsible user" labelKey="entityPicker.searchPlaceholder" entityType="user" value={user} onChange={setUser} required />;
  const supportedEntityTypes = workflowEntityTypes(selected);
  const pickerEntityType = pickerEntityTypeForWorkflow(workflowEntityType);
  return <Modal isOpen onClose={onClose} title={kind.replace(/([A-Z])/g, ' $1')}><form onSubmit={submit} className="space-y-4">{kind === 'course' && <><Field name="title" label="Course title" required/>{picker}<Field name="category" label="Category"/><Field name="description" label="Description" textarea/></>}{kind === 'assignment' && <>{choose(courses, 'Course')}{picker}<Field name="dueDate" label="Due date" type="date" required/><Field name="notes" label="Notes" textarea/></>}{kind === 'completion' && <>{choose(assignments, 'Assignment')}<Field name="score" label="Score (%)" type="number"/></>}{kind === 'acknowledgement' && <>{choose(courses, 'Course')}<Field name="comment" label="Acknowledgement note" textarea/></>}{kind === 'metric' && <><Field name="name" label="Metric name" required/>{picker}<Field name="unit" label="Unit"/><div className="grid grid-cols-2 gap-3"><Field name="warningMin" label="Warning minimum" type="number"/><Field name="criticalMin" label="Critical minimum" type="number"/><Field name="warningMax" label="Warning maximum" type="number"/><Field name="criticalMax" label="Critical maximum" type="number"/></div></>}{kind === 'value' && <>{choose(definitions, 'Metric')}<Field name="value" label="Measured value" type="number" required/><Field name="measuredAt" label="Measured at" type="date"/><Field name="source" label="Source"/><Field name="comment" label="Comment" textarea/></>}{kind === 'review' && <><Field name="title" label="Review title" required/>{picker}<Field name="reviewDate" label="Review date" type="date" required/><Field name="agenda" label="Agenda topic"/><Field name="decision" label="Initial decision" textarea/></>}{kind === 'reviewAction' && <>{choose(reviews, 'Management review')}<Field name="title" label="Action" required/>{picker}<Field name="dueDate" label="Due date" type="date" required/></>}{kind === 'approve' && choose(reviews, 'Management review')}{kind === 'startWorkflow' && <>{choose(workflows, 'Workflow definition')}<label className="block text-sm font-medium">Entity type<select value={workflowEntityType} onChange={event => { setWorkflowEntityType(event.target.value); setEntity(null); }} required disabled={!selected} className={inputClass}><option value="" disabled>Select a workflow definition first</option>{supportedEntityTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>{pickerEntityType && <EntityPicker label="Context entity" labelKey="entityPicker.searchPlaceholder" entityType={pickerEntityType} value={entity} onChange={setEntity} required />}</>}{kind === 'transition' && <>{choose(instances, 'Workflow instance')}<label className="block text-sm font-medium">Action<select name="transition" required disabled={!selected || actionsLoading || workflowActions.length === 0} className={inputClass} defaultValue=""><option value="" disabled>{actionsLoading ? 'Loading available actions…' : workflowActions.length ? 'Select an allowed action' : 'No actions available for this state'}</option>{workflowActions.map(action => <option key={action.key} value={action.key}>{humanizeWorkflowAction(action)}</option>)}</select></label><Field name="comment" label="Comment" textarea/></>}{kind === 'report' && <><Field name="name" label="Report name" required/>{picker}<Field name="module" label="Data module" required/><Field name="columns" label="Columns (one per line)" textarea/><label className="block text-sm font-medium">Format<select name="format" className={inputClass}><option value="json">JSON</option><option value="csv">CSV</option></select></label></>}{kind === 'run' && <>{choose(reports, 'Report definition')}<label className="block text-sm font-medium">Format<select name="format" className={inputClass}><option value="json">JSON</option><option value="csv">CSV</option></select></label></>}<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border px-3 py-2 text-sm">Cancel</button><Button type="submit">Save</Button></div></form></Modal>;
}
function Field({ label, textarea, ...props }: any) { return <label className="block text-sm font-medium">{label}{textarea ? <textarea {...props} className={inputClass} rows={3} /> : <input {...props} className={inputClass} />}</label>; }

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../context/I18nContext';
import { phase6Api, documentApi } from '../services/api';
import { Modal } from '../components/Modal';
import EntityPicker from '../components/EntityPicker';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { useAuthStore } from '../store/auth';

type Clause = 'clause4' | 'clause5' | 'clause7';

interface InterestedParty {
  id: string;
  displayId?: string;
  name: string;
  type: string;
  requirements: JsonValue;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const inputClass = 'w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800';
const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} className={`rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 ${props.className ?? ''}`}>{children}</button>;
const SecondaryButton = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} className={`rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 ${props.className ?? ''}`}>{children}</button>;

const INTERESTED_PARTY_TYPES = [
  { value: 'customers', label: 'customers' },
  { value: 'suppliers', label: 'suppliers' },
  { value: 'employees', label: 'employees' },
  { value: 'owners', label: 'owners' },
  { value: 'partners', label: 'partners' },
  { value: 'regulators', label: 'regulators' },
  { value: 'community', label: 'community' },
];

const ISMS_POLICY_TYPES = ['informationSecurityPolicy', 'riskAcceptancePolicy', 'ismsScope', 'awarenessPolicy', 'backupPolicy', 'accessControlPolicy'];
const CLAUSE_TABS: { key: Clause; labelKey: string; descriptionKey: string }[] = [
  { key: 'clause4', labelKey: 'ismsProcess.clause4.label', descriptionKey: 'ismsProcess.clause4.description' },
  { key: 'clause5', labelKey: 'ismsProcess.clause5.label', descriptionKey: 'ismsProcess.clause5.description' },
  { key: 'clause7', labelKey: 'ismsProcess.clause7.label', descriptionKey: 'ismsProcess.clause7.description' },
];

const TRAINING_CATEGORIES = [
  { value: 'security_awareness', labelKey: 'ismsProcess.clause7.categories.security_awareness' },
  { value: 'role_specific', labelKey: 'ismsProcess.clause7.categories.role_specific' },
  { value: 'compliance', labelKey: 'ismsProcess.clause7.categories.compliance' },
  { value: 'technical', labelKey: 'ismsProcess.clause7.categories.technical' },
];

const TRAINING_RESULTS = [
  { value: 'passed', labelKey: 'ismsProcess.clause7.results.passed' },
  { value: 'failed', labelKey: 'ismsProcess.clause7.results.failed' },
  { value: 'completed', labelKey: 'ismsProcess.clause7.results.completed' },
];

type TrainingModalKind = 'course' | 'assignment' | 'completion' | 'acknowledgement';

const ISMSProcessWorkspace = () => {
  const { t } = useI18n();
  const [clause, setClause] = useState<Clause>('clause4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clause 4 — Interested Parties
  const [parties, setParties] = useState<InterestedParty[]>([]);
  const [partyPage, setPartyPage] = useState(1);
  const [partyTotal, setPartyTotal] = useState(1);

  // Clause 5 — ISMS Policy documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [docLoading, setDocLoading] = useState(false);

  // Clause 7 — Training records
  const [trainingData, setTrainingData] = useState<Record<string, any[]>>({
    courses: [],
    assignments: [],
    completions: [],
    acknowledgements: [],
  });
  const [trainingLoading, setTrainingLoading] = useState(false);

  // Modals
  const [partyModal, setPartyModal] = useState<{ mode: 'create' | 'edit'; row?: InterestedParty } | null>(null);
  const [docModal, setDocModal] = useState<{ mode: 'create' | 'edit' | 'detail'; row?: any } | null>(null);
  const [trainingModal, setTrainingModal] = useState<{ kind: TrainingModalKind; row?: any } | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const partyForm = useDirtyForm<any>({ formData: {}, entityPickerValues: {} });
  const docForm = useDirtyForm<any>({ formData: {}, entityPickerValues: {} });
  const trainingForm = useDirtyForm<any>({ formData: {}, entityPickerValues: {} });
  const latestRequestId = useRef(0);

  const currentUser = useAuthStore((state) => state.user);

  // ─── Clause 4: Interested Parties ────────────────────────────────────────

  const loadParties = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoading(true);
    setError('');
    try {
      const res = await phase6Api.list('interestedParties', { page: partyPage, limit: 20 });
      if (requestId !== latestRequestId.current) return;
      const data = res.data.data ?? res.data ?? [];
      setParties(Array.isArray(data) ? data : []);
      setPartyTotal(res.data.pagination?.totalPages ?? 1);
    } catch (err) {
      if (requestId === latestRequestId.current) setError(err instanceof Error ? err.message : t('common.loading'));
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [partyPage, t]);

  useEffect(() => {
    if (clause === 'clause4') { void loadParties(); }
  }, [clause, loadParties]);

  // ─── Clause 5: ISMS Policy documents ─────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setDocLoading(true);
    try {
      const res = await documentApi.list({ limit: 20 });
      if (requestId !== latestRequestId.current) return;
      const data = res.data.data ?? res.data ?? [];
      setDocuments(Array.isArray(data) ? data : []);
    } catch {
      /* handled by caller */
    } finally {
      if (requestId === latestRequestId.current) setDocLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clause === 'clause5') { void loadDocuments(); }
  }, [clause, loadDocuments]);

  // ─── Clause 7: Training records ──────────────────────────────────────────

  const loadTraining = useCallback(async () => {
    setTrainingLoading(true);
    setError('');
    const extract = (res: any) => res?.data?.data ?? res?.data ?? [];
    const safeList = (resource: string): Promise<any[]> =>
      phase6Api.list(resource, { limit: 100 })
        .then((res) => extract(res))
        .catch(() => []);
    const [courses, assignments, completions, acknowledgements] = await Promise.all([
      safeList('trainingCourses'),
      safeList('trainingAssignments'),
      safeList('trainingCompletions'),
      safeList('trainingAcknowledgements'),
    ]);
    setTrainingData({
      courses: Array.isArray(courses) ? courses : [],
      assignments: Array.isArray(assignments) ? assignments : [],
      completions: Array.isArray(completions) ? completions : [],
      acknowledgements: Array.isArray(acknowledgements) ? acknowledgements : [],
    });
    setTrainingLoading(false);
  }, []);

  useEffect(() => {
    if (clause === 'clause7') { void loadTraining(); }
  }, [clause, loadTraining]);

  // ─── Handlers: Interested Parties ────────────────────────────────────────

  const handleOpenPartyModal = useCallback((mode: 'create' | 'edit', row?: InterestedParty) => {
    if (mode === 'edit' && row) {
      partyForm.setFormValues({
        formData: {
          id: row.id,
          name: row.name ?? '',
          type: row.type ?? '',
          contactPerson: row.contactPerson ?? '',
          contactEmail: row.contactEmail ?? '',
          contactPhone: row.contactPhone ?? '',
          status: row.status ?? 'active',
          requirements: row.requirements ? JSON.stringify(row.requirements, null, 2) : '',
        },
        entityPickerValues: {},
      });
    } else {
      partyForm.setFormValues({ formData: { name: '', type: '', contactPerson: '', contactEmail: '', contactPhone: '', status: 'active', requirements: '' }, entityPickerValues: {} });
    }
    setPartyModal({ mode, row });
  }, [partyForm]);

  const handleCreateParty = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setSubmitLoading(true);
    setSubmitError('');
    try {
      const data = partyForm.values.formData;
      const payload = {
        name: data.name,
        type: data.type,
        requirements: data.requirements ? parseJsonOrJson(data.requirements) : {},
        contactPerson: data.contactPerson || undefined,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        status: data.status || 'active',
      };
      if (partyForm.values.formData.id) {
        await phase6Api.update('interestedParties', partyForm.values.formData.id, payload);
      } else {
        await phase6Api.create('interestedParties', payload);
      }
      setPartyModal(null);
      partyForm.resetForm();
      void loadParties();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('ismsProcess.saveError'));
    } finally {
      setSubmitLoading(false);
    }
  }, [partyForm, loadParties, t]);

  // ─── Handlers: Documents ─────────────────────────────────────────────────

  const handleCreateDocument = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    setSubmitLoading(true);
    setSubmitError('');
    try {
      const data = docForm.values.formData;
      const payload = {
        title: data.title,
        description: data.description,
        documentType: data.documentType,
        ownerId: data.ownerId,
        content: data.content ?? '',
      };
      if (docForm.values.formData.id) {
        await documentApi.updateVersion(docForm.values.formData.id, { content: data.content ?? '' });
      } else {
        await documentApi.create(payload);
      }
      setDocModal(null);
      docForm.resetForm();
      void loadDocuments();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('ismsProcess.saveError'));
    } finally {
      setSubmitLoading(false);
    }
  }, [docForm, loadDocuments, t]);

  const handleTransitionDocument = useCallback(async (id: string, status: string) => {
    setSubmitLoading(true);
    setSubmitError('');
    try {
      await documentApi.transition(id, { status });
      void loadDocuments();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('ismsProcess.saveError'));
    } finally {
      setSubmitLoading(false);
    }
  }, [loadDocuments, t]);

  // ─── Handlers: Training (Clause 7) ───────────────────────────────────────

  const handleOpenTrainingModal = useCallback((kind: TrainingModalKind, row?: any) => {
    const base = { formData: { courseId: '', userId: '', dueDate: '', score: '', result: 'passed', comment: '', title: '', category: 'security_awareness', description: '', mandatory: false }, entityPickerValues: {} };
    if (row) {
      trainingForm.setFormValues({
        formData: {
          ...base.formData,
          id: row.id,
          title: row.title ?? '',
          category: row.category ?? 'security_awareness',
          description: row.description ?? '',
          courseId: row.courseId ?? '',
          userId: row.userId ?? '',
          dueDate: row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : '',
          score: row.score != null ? String(row.score) : '',
          result: row.result ?? 'passed',
          comment: row.comment ?? '',
        },
        entityPickerValues: {},
      });
    } else {
      trainingForm.setFormValues(base);
    }
    setTrainingModal({ kind, row });
  }, [trainingForm]);

  const handleCreateTraining = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!trainingModal) return;
    setSubmitLoading(true);
    setSubmitError('');
    try {
      const data = trainingForm.values.formData;
      if (trainingModal.kind === 'course') {
        await phase6Api.create('trainingCourses', {
          title: data.title,
          category: data.category || undefined,
          description: data.description || undefined,
          mandatory: data.mandatory === true,
          ownerId: currentUser?.id ?? undefined,
          status: 'active',
        });
      } else if (trainingModal.kind === 'assignment') {
        await phase6Api.create('trainingAssignments', {
          courseId: data.courseId,
          userId: data.userId,
          dueDate: data.dueDate,
          notes: data.comment || undefined,
        });
      } else if (trainingModal.kind === 'completion') {
        const assignmentId = trainingModal.row?.id ?? data.courseId;
        await phase6Api.completeTraining(assignmentId, {
          score: data.score !== '' ? Number(data.score) : undefined,
          result: (data.result as 'passed' | 'failed' | 'completed') || 'passed',
        });
      } else if (trainingModal.kind === 'acknowledgement') {
        await phase6Api.acknowledgeTraining({
          courseId: data.courseId,
          comment: data.comment || undefined,
        });
      }
      setTrainingModal(null);
      trainingForm.resetForm();
      void loadTraining();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('ismsProcess.saveError'));
    } finally {
      setSubmitLoading(false);
    }
  }, [trainingModal, trainingForm, currentUser, loadTraining, t]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function parseJsonOrJson(value: string): JsonValue {
    if (value === '') return {};
    try {
      const parsed = JSON.parse(value);
      return parsed;
    } catch {
      return value;
    }
  }

  const activeTab = useMemo(() => CLAUSE_TABS.find((tab) => tab.key === clause)!, [clause]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('ismsProcess.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('ismsProcess.description')}</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-semibold">{t('common.dismiss')}</button>
        </div>
      )}

      {/* Clause tabs */}
      <nav className="flex flex-wrap gap-2" aria-label={t('ismsProcess.navigationLabel')}>
        {CLAUSE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setClause(tab.key)}
            className={`rounded px-3 py-2 text-sm font-medium ${clause === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <p className="text-sm text-gray-600 dark:text-gray-300">{t(activeTab.descriptionKey)}</p>

      {/* ─── Clause 4: Context & Interested Parties ─────────────────────── */}
      {clause === 'clause4' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause4.partiesHeading')}</h2>
            <Button onClick={() => handleOpenPartyModal('create')}>{t('ismsProcess.clause4.addParty')}</Button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : parties.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-600">{t('ismsProcess.clause4.noParties')}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parties.map((party) => (
                <section key={party.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{party.name}</h3>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{party.type}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{party.contactEmail || party.contactPerson || '—'}</p>
                  <div className="mt-3 flex gap-2">
                    <SecondaryButton onClick={() => handleOpenPartyModal('edit', party)}>{t('common.edit')}</SecondaryButton>
                    <button onClick={() => { void phase6Api.delete('interestedParties', party.id); void loadParties(); }} className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/30">{t('common.delete')}</button>
                  </div>
                </section>
              ))}
            </div>
          )}

          {partyTotal > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPartyPage((p) => Math.max(1, p - 1))} disabled={partyPage <= 1} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm disabled:opacity-50">Previous</button>
              <span className="text-sm text-gray-600 dark:text-gray-300">Page {partyPage} of {partyTotal}</span>
              <button onClick={() => setPartyPage((p) => Math.min(partyTotal, p + 1))} disabled={partyPage >= partyTotal} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </section>
      )}

      {/* ─── Clause 5: ISMS Policy Documents ────────────────────────────── */}
      {clause === 'clause5' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause5.documentsHeading')}</h2>
            <Button onClick={() => setDocModal({ mode: 'create' })}>{t('ismsProcess.clause5.addDocument')}</Button>
          </div>

          {docLoading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : documents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-600">{t('ismsProcess.clause5.noDocuments')}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc) => (
                <section key={doc.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{doc.title}</h3>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{doc.documentType}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">v{doc.version} · {doc.workflowStatus}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => setDocModal({ mode: 'detail', row: doc })}>{t('common.view')}</SecondaryButton>
                    {doc.workflowStatus === 'draft' && (
                      <Button onClick={() => void handleTransitionDocument(doc.id, 'review')}>{t('ismsProcess.clause5.submitForReview')}</Button>
                    )}
                    {doc.workflowStatus === 'review' && (
                      <Button onClick={() => void handleTransitionDocument(doc.id, 'approved')}>{t('ismsProcess.clause5.approve')}</Button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─── Clause 7: Competence & Awareness ───────────────────────────── */}
      {clause === 'clause7' && (
        <section className="space-y-4">
          {trainingLoading ? (
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Courses */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.courses')}</h3>
                  <Button onClick={() => handleOpenTrainingModal('course')}>{t('ismsProcess.clause7.addCourse')}</Button>
                </div>
                {trainingData.courses.length ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trainingData.courses.map((course) => (
                      <div key={course.id} className="py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <strong className="text-gray-900 dark:text-white">{course.title}</strong>
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{t(`ismsProcess.clause7.categories.${course.category}`) ?? course.category}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{course.status ?? ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ismsProcess.clause7.noRecords')}</p>
                )}
              </div>

              {/* Assignments */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.assignments')}</h3>
                  <Button onClick={() => handleOpenTrainingModal('assignment')}>{t('ismsProcess.clause7.assignCourse')}</Button>
                </div>
                {trainingData.assignments.length ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trainingData.assignments.map((assignment) => {
                      const course = trainingData.courses.find((c) => c.id === assignment.courseId);
                      const canComplete = assignment.status === 'assigned' || assignment.status === 'in_progress';
                      return (
                        <div key={assignment.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <strong className="text-gray-900 dark:text-white">{course?.title ?? assignment.courseId}</strong>
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{assignment.status ?? ''}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {assignment.dueDate ? t('ismsProcess.clause7.dueDateDisplay').replace('{date}', new Date(assignment.dueDate).toLocaleDateString()) : ''}
                          </p>
                          {canComplete && (
                            <button onClick={() => handleOpenTrainingModal('completion', assignment)} className="mt-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700">{t('ismsProcess.clause7.recordCompletion')}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ismsProcess.clause7.noRecords')}</p>
                )}
              </div>

              {/* Completions */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.completions')}</h3>
                {trainingData.completions.length ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trainingData.completions.map((completion) => {
                      const course = trainingData.courses.find((c) => c.id === completion.courseId);
                      return (
                        <div key={completion.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <strong className="text-gray-900 dark:text-white">{course?.title ?? completion.courseId}</strong>
                            <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">{t(`ismsProcess.clause7.results.${completion.result}`) ?? completion.result}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{completion.completedAt ? new Date(completion.completedAt).toLocaleDateString() : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ismsProcess.clause7.noRecords')}</p>
                )}
              </div>

              {/* Acknowledgements */}
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.acknowledgements')}</h3>
                  <Button onClick={() => handleOpenTrainingModal('acknowledgement')}>{t('ismsProcess.clause7.acknowledgeCourse')}</Button>
                </div>
                {trainingData.acknowledgements.length ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trainingData.acknowledgements.map((ack) => {
                      const course = trainingData.courses.find((c) => c.id === ack.courseId);
                      return (
                        <div key={ack.id} className="py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <strong className="text-gray-900 dark:text-white">{course?.title ?? ack.courseId}</strong>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{ack.acknowledgedAt ? new Date(ack.acknowledgedAt).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('ismsProcess.clause7.noRecords')}</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── Interested Party Modal ─────────────────────────────────────── */}
      <Modal isOpen={partyModal !== null} onClose={() => setPartyModal(null)} title={partyModal?.mode === 'edit' ? t('common.edit') : t('ismsProcess.clause4.addParty')} isDirty={partyForm.isDirty && !submitLoading} onDiscardConfirm={() => { if (partyForm.isDirty) partyForm.resetForm(); }}>
        {partyModal && (
          <form onSubmit={handleCreateParty} className="space-y-4">
            {submitError && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.name')} *</label>
              <input className={`${inputClass} mt-1`} value={String(partyForm.values.formData.name ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, name: e.target.value } })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.type')} *</label>
              <select className={`${inputClass} mt-1`} value={String(partyForm.values.formData.type ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, type: e.target.value } })}>
                <option value="">-- Select --</option>
                {INTERESTED_PARTY_TYPES.map((o) => <option key={o.value} value={o.value}>{t(`ismsProcess.clause4.partyTypes.${o.value}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.contactPerson')}</label>
              <input className={`${inputClass} mt-1`} value={String(partyForm.values.formData.contactPerson ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, contactPerson: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.contactPhone')}</label>
              <input className={`${inputClass} mt-1`} value={String(partyForm.values.formData.contactPhone ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, contactPhone: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.contactEmail')}</label>
              <input className={`${inputClass} mt-1`} type="email" value={String(partyForm.values.formData.contactEmail ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, contactEmail: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.requirements')}</label>
              <textarea className={`${inputClass} mt-1`} rows={3} placeholder='{"dataProtection": "DSGVO-konforme Datenverarbeitung"}' value={String(partyForm.values.formData.requirements ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, requirements: e.target.value } })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.status')}</label>
              <select className={`${inputClass} mt-1`} value={String(partyForm.values.formData.status ?? 'active')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, status: e.target.value } })}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton type="button" onClick={() => { if (partyForm.isDirty) partyForm.resetForm(); setPartyModal(null); }}>{t('common.cancel')}</SecondaryButton>
              <Button type="submit" disabled={submitLoading}>{submitLoading ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Document Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={docModal !== null} onClose={() => setDocModal(null)} title={docModal?.mode === 'detail' ? t('common.view') : docModal?.mode === 'edit' ? t('common.edit') : t('ismsProcess.clause5.addDocument')} isDirty={docForm.isDirty && !submitLoading} onDiscardConfirm={() => { if (docForm.isDirty) docForm.resetForm(); }}>
        {docModal && docModal.row && (
          docModal.mode === 'detail' ? (
            <div className="space-y-3">
              <div><div className="text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.title')}</div><div className="text-sm text-gray-900 dark:text-gray-100 mt-1">{docModal.row.title}</div></div>
              <div><div className="text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.documentType')}</div><div className="text-sm text-gray-900 dark:text-gray-100 mt-1">{docModal.row.documentType}</div></div>
              <div><div className="text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.version')}</div><div className="text-sm text-gray-900 dark:text-gray-100 mt-1">{docModal.row.version}</div></div>
              <div className="flex justify-end gap-2 pt-2">
                <SecondaryButton onClick={() => setDocModal(null)}>{t('common.close')}</SecondaryButton>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateDocument} className="space-y-4">
              {submitError && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.title')} *</label>
                <input className={`${inputClass} mt-1`} value={String(docForm.values.formData.title ?? '')} onChange={(e) => docForm.handleChange({ ...docForm.values, formData: { ...docForm.values.formData, title: e.target.value } })} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.documentType')} *</label>
                <select className={`${inputClass} mt-1`} value={String(docForm.values.formData.documentType ?? '')} onChange={(e) => docForm.handleChange({ ...docForm.values, formData: { ...docForm.values.formData, documentType: e.target.value } })}>
                  <option value="">-- Select --</option>
                  {ISMS_POLICY_TYPES.map((o) => <option key={o} value={o}>{t(`ismsProcess.clause5.policyTypes.${o}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.owner')}</label>
                <EntityPicker
                  labelKey="ismsProcess.clause5.owner"
                  entityType="user"
                  value={docForm.values.formData.ownerId ? { id: String(docForm.values.formData.ownerId), label: String(docForm.values.formData.ownerId) } : null}
                  onChange={(v) => docForm.handleChange({ ...docForm.values, formData: { ...docForm.values.formData, ownerId: v.id } })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause5.content')}</label>
                <textarea className={`${inputClass} mt-1`} rows={5} value={String(docForm.values.formData.content ?? '')} onChange={(e) => docForm.handleChange({ ...docForm.values, formData: { ...docForm.values.formData, content: e.target.value } })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <SecondaryButton type="button" onClick={() => { if (docForm.isDirty) docForm.resetForm(); setDocModal(null); }}>{t('common.cancel')}</SecondaryButton>
                <Button type="submit" disabled={submitLoading}>{submitLoading ? t('common.saving') : t('common.save')}</Button>
              </div>
            </form>
          )
        )}
      </Modal>

      {/* ─── Training Modal (Clause 7) ───────────────────────────────────── */}
      <Modal isOpen={trainingModal !== null} onClose={() => setTrainingModal(null)} title={trainingModal ? t(`ismsProcess.clause7.modal.${trainingModal.kind}`) : ''} isDirty={trainingForm.isDirty && !submitLoading} onDiscardConfirm={() => { if (trainingForm.isDirty) trainingForm.resetForm(); }}>
        {trainingModal && (
          <form onSubmit={handleCreateTraining} className="space-y-4">
            {submitError && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{submitError}</div>}

            {trainingModal.kind === 'course' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.title')} *</label>
                  <input className={`${inputClass} mt-1`} value={String(trainingForm.values.formData.title ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, title: e.target.value } })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.category')}</label>
                  <select className={`${inputClass} mt-1`} value={String(trainingForm.values.formData.category ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, category: e.target.value } })}>
                    {TRAINING_CATEGORIES.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.description')}</label>
                  <textarea className={`${inputClass} mt-1`} rows={3} value={String(trainingForm.values.formData.description ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, description: e.target.value } })} />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={trainingForm.values.formData.mandatory === true} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, mandatory: e.target.checked } })} />
                  {t('ismsProcess.clause7.mandatory')}
                </label>
              </>
            )}

            {trainingModal.kind === 'assignment' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.course')} *</label>
                  <select className={`${inputClass} mt-1`} value={String(trainingForm.values.formData.courseId ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, courseId: e.target.value } })} required>
                    <option value="">-- Select --</option>
                    {trainingData.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.assignee')} *</label>
                  <EntityPicker
                    labelKey="ismsProcess.clause7.assignee"
                    entityType="user"
                    value={trainingForm.values.formData.userId ? { id: String(trainingForm.values.formData.userId), label: String(trainingForm.values.formData.userId) } : null}
                    onChange={(v) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, userId: v.id } })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.dueDate')} *</label>
                  <input className={`${inputClass} mt-1`} type="date" value={String(trainingForm.values.formData.dueDate ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, dueDate: e.target.value } })} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.notes')}</label>
                  <textarea className={`${inputClass} mt-1`} rows={2} value={String(trainingForm.values.formData.comment ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, comment: e.target.value } })} />
                </div>
              </>
            )}

            {trainingModal.kind === 'completion' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.score')}</label>
                  <input className={`${inputClass} mt-1`} type="number" min={0} max={100} value={String(trainingForm.values.formData.score ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, score: e.target.value } })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.result')}</label>
                  <select className={`${inputClass} mt-1`} value={String(trainingForm.values.formData.result ?? 'passed')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, result: e.target.value } })}>
                    {TRAINING_RESULTS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                  </select>
                </div>
              </>
            )}

            {trainingModal.kind === 'acknowledgement' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.course')} *</label>
                  <select className={`${inputClass} mt-1`} value={String(trainingForm.values.formData.courseId ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, courseId: e.target.value } })} required>
                    <option value="">-- Select --</option>
                    {trainingData.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause7.comment')}</label>
                  <textarea className={`${inputClass} mt-1`} rows={2} value={String(trainingForm.values.formData.comment ?? '')} onChange={(e) => trainingForm.handleChange({ ...trainingForm.values, formData: { ...trainingForm.values.formData, comment: e.target.value } })} />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton type="button" onClick={() => { if (trainingForm.isDirty) trainingForm.resetForm(); setTrainingModal(null); }}>{t('common.cancel')}</SecondaryButton>
              <Button type="submit" disabled={submitLoading}>{submitLoading ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ISMSProcessWorkspace;

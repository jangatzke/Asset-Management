import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useI18n } from '../context/I18nContext';
import { phase6Api, documentApi } from '../services/api';
import { Modal } from '../components/Modal';
import EntityPicker from '../components/EntityPicker';
import { useDirtyForm } from '../hooks/useDirtyForm';

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
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const partyForm = useDirtyForm<any>({ formData: {}, entityPickerValues: {} });
  const docForm = useDirtyForm<any>({ formData: {}, entityPickerValues: {} });
  const latestRequestId = useRef(0);

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
    try {
      const responses = await Promise.all([
        phase6Api.list('trainingCourses', { limit: 100 }),
        phase6Api.list('trainingAssignments', { limit: 100 }),
        phase6Api.list('trainingCompletions', { limit: 100 }),
        phase6Api.list('trainingAcknowledgements', { limit: 100 }),
      ]);
      setTrainingData({
        courses: responses[0].data.data ?? responses[0].data ?? [],
        assignments: responses[1].data.data ?? responses[1].data ?? [],
        completions: responses[2].data.data ?? responses[2].data ?? [],
        acknowledgements: responses[3].data.data ?? responses[3].data ?? [],
      });
    } catch {
      setError(t('ismsProcess.loadError'));
    } finally {
      setTrainingLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (clause === 'clause7') { void loadTraining(); }
  }, [clause, loadTraining]);

  // ─── Handlers: Interested Parties ────────────────────────────────────────

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

  const tabs: { key: Clause; labelKey: string; descriptionKey: string }[] = [
    { key: 'clause4', labelKey: 'ismsProcess.clause4.label', descriptionKey: 'ismsProcess.clause4.description' },
    { key: 'clause5', labelKey: 'ismsProcess.clause5.label', descriptionKey: 'ismsProcess.clause5.description' },
    { key: 'clause7', labelKey: 'ismsProcess.clause7.label', descriptionKey: 'ismsProcess.clause7.description' },
  ];

  const activeTab = useMemo(() => tabs.find((tab) => tab.key === clause)!, [clause]);

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
        {tabs.map((tab) => (
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
            <Button onClick={() => setPartyModal({ mode: 'create' })}>{t('ismsProcess.clause4.addParty')}</Button>
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
                    <SecondaryButton onClick={() => setPartyModal({ mode: 'edit', row: party })}>{t('common.edit')}</SecondaryButton>
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
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.courses')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{trainingData.courses.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.assignments')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{trainingData.assignments.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.completions')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{trainingData.completions.length}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('ismsProcess.clause7.acknowledgements')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{trainingData.acknowledgements.length}</p>
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
              <label className="block text-xs font-medium text-gray-500 uppercase">{t('ismsProcess.clause4.contactEmail')}</label>
              <input className={`${inputClass} mt-1`} type="email" value={String(partyForm.values.formData.contactEmail ?? '')} onChange={(e) => partyForm.handleChange({ ...partyForm.values, formData: { ...partyForm.values.formData, contactEmail: e.target.value } })} />
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
    </div>
  );
};

export default ISMSProcessWorkspace;

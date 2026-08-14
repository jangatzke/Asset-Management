import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import EntityPicker from '../components/EntityPicker';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { nis2Api, type Nis2Answer, type Nis2Assessment, type Nis2Question, type Nis2Questionnaire, type Nis2Registration } from '../services/api';

const card = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800';
const input = 'mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

export default function NIS2() {
  const { t } = useI18n();
  const [questionnaires, setQuestionnaires] = useState<Nis2Questionnaire[]>([]);
  const [assessments, setAssessments] = useState<Nis2Assessment[]>([]);
  const [registrations, setRegistrations] = useState<Nis2Registration[]>([]);
  const [questionnaireVersion, setQuestionnaireVersion] = useState('');
  const [answers, setAnswers] = useState<Record<string, Nis2Answer>>({});
  const [organizationUnit, setOrganizationUnit] = useState<EntityPickerResult | null>(null);
  const [justification, setJustification] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [registrationAssessmentId, setRegistrationAssessmentId] = useState('');
  const [entityType, setEntityType] = useState('important_entity');
  const [deadline, setDeadline] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [submissionProof, setSubmissionProof] = useState('');
  const [changeRegistrationId, setChangeRegistrationId] = useState('');
  const [changeType, setChangeType] = useState('contact_details');
  const [changeDescription, setChangeDescription] = useState('');
  const [changeValue, setChangeValue] = useState('');
  const [changeDeadline, setChangeDeadline] = useState('');
  const [changeProof, setChangeProof] = useState('');

  const selectedQuestionnaire = useMemo(() => questionnaires.find((item) => item.version === questionnaireVersion), [questionnaires, questionnaireVersion]);

  const questionnaireQuestions = useMemo<Nis2Question[]>(() => {
    if (!selectedQuestionnaire || !Array.isArray(selectedQuestionnaire.questions)) return [];
    return selectedQuestionnaire.questions as Nis2Question[];
  }, [selectedQuestionnaire]);

  const load = useCallback(async () => {
    try {
      const [q, a, r] = await Promise.all([nis2Api.listActiveQuestionnaires(), nis2Api.listAssessments(), nis2Api.listRegistrations()]);
      setQuestionnaires(q.data);
      setAssessments(a.data);
      setRegistrations(r.data);
      setQuestionnaireVersion((v) => v || q.data[0]?.version || '');
      setRegistrationAssessmentId((v) => v || a.data.find((x) => x.status === 'approved' && x.result !== 'not_in_scope')?.id || '');
      setChangeRegistrationId((v) => v || r.data[0]?.id || '');
    } catch (caught: unknown) {
      const message = (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || t('nis2.loadingError');
      setError(message);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // Reset answers when questionnaire changes
  useEffect(() => { setAnswers({}); }, [questionnaireVersion]);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      setMessage(success);
      await load();
    } catch (caught: unknown) {
      const message = (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || t('nis2.operationError');
      setError(message);
    } finally { setBusy(false); }
  };

  const ensureCatalogue = async () => {
    setCatalogBusy(true);
    setCatalogError('');
    setCatalogMessage('');
    try {
      await nis2Api.ensureMeasuresCatalogue();
      setCatalogMessage(t('nis2.catalogEnsured'));
      await load();
    } catch (caught: unknown) {
      const message = (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || t('nis2.catalogError');
      setCatalogError(message);
    } finally { setCatalogBusy(false); }
  };

  const loadDefaultQuestionnaire = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await nis2Api.ensureDefaultQuestionnaire();
      await load();
      setMessage(t('nis2.defaultQuestionnaireLoaded'));
    } catch (caught: unknown) {
      const message = (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || t('nis2.operationError');
      setError(message);
    } finally { setBusy(false); }
  };

  const createAssessment = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedQuestionnaire) return;
    const missing = questionnaireQuestions.find((q) => q.required && (answers[q.key] === undefined || answers[q.key] === ''));
    if (missing) return setError(`${t('nis2.missingAnswerError')}: ${missing.label}`);
    void run(() => nis2Api.createAssessment({ organizationUnitId: organizationUnit?.id, questionnaireVersion, answers, justification: justification || undefined }), t('nis2.assessmentCreated'));
  };

  const createRegistration = (event: FormEvent) => {
    event.preventDefault();
    void run(() => nis2Api.createRegistration({ assessmentId: registrationAssessmentId, entityType, deadline, contactPerson: contactPerson || undefined, contactDetails: contactDetails || undefined, submissionProof: submissionProof || undefined }), t('nis2.registrationCreated'));
  };

  const createChange = (event: FormEvent) => {
    event.preventDefault();
    void run(() => nis2Api.recordRegistrationChange(changeRegistrationId, { changeType, description: changeDescription, changedData: { value: changeValue }, notificationDeadline: changeDeadline || undefined, submissionProof: changeProof || undefined, submittedAt: changeProof ? new Date().toISOString() : undefined }), t('nis2.registrationChangeRecorded'));
  };

  const approved = assessments.filter((item) => item.status === 'approved' && item.result && item.result !== 'not_in_scope');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('nis2.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('nis2.description')}</p>
      </header>

      {message && <p className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
      {error && <p className="rounded bg-red-50 p-3 text-red-800">{error}</p>}

      {/* Section 1: Create applicability assessment */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t('nis2.section1')}</h2>
        {questionnaires.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600">{t('nis2.emptyQuestionnaireExplanation')}</p>
            <p className="text-sm text-gray-500 italic">{t('nis2.answersFillableOncePresent')}</p>
            <button
              disabled={busy}
              onClick={loadDefaultQuestionnaire}
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {busy ? t('common.loading') : t('nis2.loadDefaultQuestionnaire')}
            </button>
          </div>
        ) : (
          <form className="mt-4 grid gap-4" onSubmit={createAssessment}>
            <label>
              {t('nis2.selectQuestionnaire')}
              <select className={input} value={questionnaireVersion} onChange={(e) => setQuestionnaireVersion(e.target.value)} required>
                <option value="">{t('nis2.select')}</option>
                {questionnaires.map((q) => (<option key={q.id} value={q.version}>{q.title} (v{q.version})</option>))}
              </select>
            </label>

            <EntityPicker label={t('nis2.organizationUnit')} labelKey="entityPicker.searchPlaceholder" entityType="organizationUnit" value={organizationUnit} onChange={setOrganizationUnit} />

            {questionnaireQuestions.map((q) => (
              <label key={q.key}>
                {t(`nis2.questionnaireLabels.${q.key}`) || q.label}
                {q.required ? ' *' : ''}
                {q.type === 'boolean' ? (
                  <select className={input} value={String(answers[q.key] ?? '')} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value === 'true' })} required={q.required}>
                    <option value="">{t('nis2.select')}</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    className={input}
                    type={q.type === 'number' ? 'number' : 'text'}
                    value={String(answers[q.key] ?? '')}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: q.type === 'number' ? Number(e.target.value) : e.target.value })}
                    required={q.required}
                  />
                )}
              </label>
            ))}

            <label>
              {t('nis2.justification')}
              <textarea className={input} value={justification} onChange={(e) => setJustification(e.target.value)} />
            </label>

            <button disabled={busy || !questionnaireVersion} className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              {t('nis2.createDraftAssessment')}
            </button>
          </form>
        )}
      </section>

      {/* Section 2: Submit and approve */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t('nis2.section2')}</h2>
        <div className="mt-3 space-y-2">
          {assessments.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
              <span>
                <strong>{a.result?.replace(/_/g, ' ') || t('nis2.pending')}</strong> · {a.status} · questionnaire v{a.questionnaireVersion}
              </span>
              {a.status === 'draft' ? (
                <button disabled={busy} onClick={() => void run(() => nis2Api.submitAssessment(a.id), t('nis2.assessmentSubmitted'))} className="rounded border px-3 py-1">
                  {t('nis2.submit')}
                </button>
              ) : a.status === 'under_review' ? (
                <button disabled={busy} onClick={() => void run(() => nis2Api.approveAssessment(a.id), t('nis2.assessmentApproved'))} className="rounded bg-green-600 px-3 py-1 text-white">
                  {t('nis2.approve')}
                </button>
              ) : null}
            </div>
          ))}
          {!assessments.length && <p className="text-sm text-gray-500">{t('nis2.noAssessments')}</p>}
        </div>
      </section>

      {/* Section 3: Register approved in-scope entity */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t('nis2.section3')}</h2>
        {approved.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">{t('nis2.noApprovedAssessments')}</p>
        )}
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={createRegistration}>
          <label>
            {t('nis2.approvedAssessment')}
            <select className={input} value={registrationAssessmentId} onChange={(e) => setRegistrationAssessmentId(e.target.value)} required>
              <option value="">{t('nis2.select')}</option>
              {approved.map((a) => (<option key={a.id} value={a.id}>{a.result?.replace(/_/g, ' ')} · v{a.questionnaireVersion}</option>))}
            </select>
          </label>
          <label>
            {t('nis2.entityType')}
            <select className={input} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="essential_entity">{t('nis2.essentialEntity')}</option>
              <option value="important_entity">{t('nis2.importantEntity')}</option>
            </select>
          </label>
          <label>
            {t('nis2.registrationDeadline')}
            <input className={input} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </label>
          <label>
            {t('nis2.contactPerson')}
            <input className={input} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </label>
          <label>
            {t('nis2.contactDetails')}
            <input className={input} value={contactDetails} onChange={(e) => setContactDetails(e.target.value)} />
          </label>
          <label>
            {t('nis2.submissionProof')}
            <input className={input} value={submissionProof} onChange={(e) => setSubmissionProof(e.target.value)} />
          </label>
          <button disabled={busy || !approved.length} className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {t('nis2.createRegistration')}
          </button>
        </form>
      </section>

      {/* Section 4: Log registration change */}
      <section className={card}>
        <h2 className="text-lg font-semibold">{t('nis2.section4')}</h2>
        {registrations.length === 0 && <p className="mt-2 text-sm text-gray-500">{t('nis2.noRegistrations')}</p>}
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={createChange}>
          <label>
            {t('nis2.registration')}
            <select className={input} value={changeRegistrationId} onChange={(e) => setChangeRegistrationId(e.target.value)} required>
              <option value="">{t('nis2.select')}</option>
              {registrations.map((r) => (<option key={r.id} value={r.id}>{r.entityType.replace(/_/g, ' ')} · {r.status}</option>))}
            </select>
          </label>
          <label>
            {t('nis2.changeType')}
            <select className={input} value={changeType} onChange={(e) => setChangeType(e.target.value)}>
              <option value="contact_details">{t('nis2.changeContactDetails')}</option>
              <option value="entity_data">{t('nis2.changeEntityData')}</option>
              <option value="scope">{t('nis2.changeScope')}</option>
              <option value="other">{t('nis2.changeOther')}</option>
            </select>
          </label>
          <label className="md:col-span-2">
            {t('nis2.description')}
            <textarea className={input} value={changeDescription} onChange={(e) => setChangeDescription(e.target.value)} required />
          </label>
          <label>
            {t('nis2.newValue')}
            <input className={input} value={changeValue} onChange={(e) => setChangeValue(e.target.value)} required />
          </label>
          <label>
            {t('nis2.notificationDeadline')}
            <input className={input} type="date" value={changeDeadline} onChange={(e) => setChangeDeadline(e.target.value)} />
          </label>
          <label>
            {t('nis2.submissionProofChange')}
            <input className={input} value={changeProof} onChange={(e) => setChangeProof(e.target.value)} />
          </label>
          <button disabled={busy || !registrations.length} className="w-fit rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
            {t('nis2.recordChange')}
          </button>
        </form>
      </section>

      {/* Catalog administration */}
      <details className="border-t pt-4">
        <summary className="cursor-pointer font-medium">{t('nis2.catalogAdministration')}</summary>
        <p className="mt-2 text-sm text-gray-600">{t('nis2.catalogEnsureDescription')}</p>

        {catalogMessage && <p className="mt-2 rounded bg-green-50 p-2 text-sm text-green-800">{catalogMessage}</p>}
        {catalogError && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800">{catalogError}</p>}

        <button
          disabled={catalogBusy}
          onClick={ensureCatalogue}
          className="mt-2 rounded border bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {catalogBusy ? t('nis2.catalogEnsuring') : t('nis2.catalogEnsureButton')}
        </button>
      </details>
    </div>
  );
}

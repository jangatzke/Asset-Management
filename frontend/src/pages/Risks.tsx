
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { riskApi, assetApi, adminApi, processApi, treatmentApi, controlApi, organizationApi } from '../services/api';
import { Modal } from '../components/Modal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import { useI18n } from '../context/I18nContext';
import { riskControlEffectivenessTranslationKey } from './riskControlWorkflow.utils';
import { getRiskColor, getErrorMessage } from '../utils/statusHelpers';

interface Risk {
  id: string;
  displayId: string;
  title: string;
  description: string;
  status: string;
  inherentRisk: string;
  residualRisk: string;
  likelihood: number;
  impact: number;
  targetRisk?: string;
  riskAssessmentVersions?: RiskAssessmentVersion[];
  riskControls?: RiskControlLink[];
}

interface RiskAssessmentVersion {
  id: string;
  assessmentType: 'inherent' | 'current' | 'target';
  likelihood: number;
  impact: number;
  inherentRisk: string;
  residualRisk: string;
  targetRisk: string;
  isCurrent: boolean;
  status?: string;
  controlAssessments?: Array<{ effectivenessStatus: string; riskControl?: RiskControlLink }>;
}

interface RiskControlLink {
  id: string;
  riskId: string;
  controlImplementationId: string;
  role: string;
  mitigationDimension: string;
  isKeyControl: boolean;
  status: string;
  controlImplementation?: { id: string; implementationStatus?: string; control?: { title: string } };
  assessments?: RiskControlAssessment[];
}

interface RiskControlAssessment {
  id: string;
  effectivenessStatus: string;
  effectivenessRating?: number;
  likelihoodReduction?: number;
  impactReduction?: number;
  justification: string;
  assessedAt?: string;
  RiskAssessmentVersion?: { id: string; versionNumber: number; status: string; isClosed?: boolean };
}

interface EntityOption {
  id: string;
  label: string;
}

interface CreateRiskForm {
  title: string;
  description: string;
  possibleImpact: string;
  likelihood: number;
  impact: number;
  nextReviewDate: string;
  justification: string;
  riskOwnerId?: EntityOption | null;
  assessorId?: EntityOption | null;
  assetIds?: EntityOption[];
  organizationUnitId?: EntityOption | null;
  processId?: EntityOption | null;
}

interface TreatmentForm {
  treatmentOption: string;
  plannedActions: string;
  actionTitle: string;
  actionType: 'create' | 'extend' | 'replace' | 'improve';
  controlImplementationId: string;
  targetDate: string;
}

interface RiskControlForm {
  controlImplementationId: string;
  role: string;
  mitigationDimension: string;
  isKeyControl: boolean;
  status: string;
}

interface RiskControlAssessmentForm {
  RiskAssessmentVersionId: string;
  effectivenessStatus: string;
  effectivenessRating: number;
  likelihoodReduction: number;
  impactReduction: number;
  justification: string;
}

const initialForm: CreateRiskForm = {
  title: '',
  description: '',
  possibleImpact: '',
  likelihood: 3,
  impact: 3,
  nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  justification: '',
};

const initialTreatmentForm: TreatmentForm = {
  treatmentOption: 'reduce',
  plannedActions: '',
  actionTitle: '',
  actionType: 'improve',
  controlImplementationId: '',
  targetDate: '',
};

const initialRiskControlForm: RiskControlForm = { controlImplementationId: '', role: 'preventive', mitigationDimension: 'likelihood', isKeyControl: false, status: 'active' };
const initialRiskControlAssessmentForm: RiskControlAssessmentForm = { RiskAssessmentVersionId: '', effectivenessStatus: 'not_tested', effectivenessRating: 0, likelihoodReduction: 0, impactReduction: 0, justification: '' };
const openRiskStatuses = ['identified', 'assessed', 'treatment_planned', 'treatment_in_progress'];

export const normalizeRiskStatusFilter = (value: string | null) => value === 'open' ? 'open' : value ?? '';
export const matchesRiskStatusFilter = (risk: Pick<Risk, 'status'>, statusFilter: string) => {
  if (!statusFilter) return true;
  if (statusFilter === 'open') return openRiskStatuses.includes(risk.status);
  return risk.status === statusFilter;
};

const Risks = () => {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => normalizeRiskStatusFilter(searchParams.get('status')));
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateRiskForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Treatment plan state
  const [treatmentModalOpen, setTreatmentModalOpen] = useState(false);
  const [selectedRiskForTreatment, setSelectedRiskForTreatment] = useState<Risk | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [riskDetails, setRiskDetails] = useState<Record<string, any>>({});
  const [controlImplementations, setControlImplementations] = useState<any[]>([]);
  const [treatmentForm, setTreatmentForm] = useState<TreatmentForm>(initialTreatmentForm);
  const [controlsModalOpen, setControlsModalOpen] = useState(false);
  const [selectedRiskForControls, setSelectedRiskForControls] = useState<Risk | null>(null);
  const [riskControlForm, setRiskControlForm] = useState<RiskControlForm>(initialRiskControlForm);
  const [assessmentForm, setAssessmentForm] = useState<RiskControlAssessmentForm>(initialRiskControlAssessmentForm);
  const [assessingRiskControlId, setAssessingRiskControlId] = useState<string | null>(null);

  useEffect(() => { loadRisks();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial risks load only; loader uses current translation fallback for this mount.
  }, []);

  const loadRisks = async () => {
    try {
      setLoading(true);
      const params: { page: number; limit: number; status?: string } = { page: 1, limit: 50 };
      if (statusFilter && statusFilter !== 'open') params.status = statusFilter;
      const response = await riskApi.list(params);
      const list = response.data?.data || [];
      setRisks(list);
      const detailPairs = await Promise.allSettled(list.slice(0, 20).map((risk: Risk) => riskApi.getById(risk.id)));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API responses have dynamic shape
      const details: Record<string, any> = {};
      detailPairs.forEach((result, index) => {
        if (result.status === 'fulfilled') details[list[index].id] = result.value.data;
      });
      setRiskDetails(details);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('common.saveError'));
    } finally { setLoading(false); }
  };

  // Search endpoints for EntitySearchSelect
  const searchAssets = async (q: string) => {
    try {
      const res = await assetApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response shape is dynamic
  const searchUsers = async (q: string) => {
    try {
      const res = await adminApi.listUsers();
      const users = res.data?.data ?? res.data ?? [];
      if (!q) return users;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return users.filter((u: any) =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q.toLowerCase())
      );
    } catch { return []; }
  };

  const searchProcesses = async (q: string) => {
    try {
      const res = await processApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  const searchOrganizationUnits = async (q: string) => {
    try {
      const res = await organizationApi.listUnits({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response shape is dynamic
  const loadControlImplementations = async () => {
    try {
      const res = await controlApi.list({ page: 1, limit: 100 });
      const controls = res.data?.data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setControlImplementations(controls.flatMap((control: any) => (control.implementations ?? []).map((impl: any) => ({ ...impl, control }))));
    } catch { setControlImplementations([]); }
  };

  const currentAssessment = (risk: Risk, type?: 'inherent' | 'current' | 'target') => {
    const versions = (riskDetails[risk.id]?.riskAssessmentVersions ?? risk.riskAssessmentVersions ?? []) as RiskAssessmentVersion[];
    return versions.find((a) => a.isCurrent && (!type || a.assessmentType === type)) ?? versions.find((a) => !type || a.assessmentType === type);
  };

  const riskControls = (risk: Risk): RiskControlLink[] => riskDetails[risk.id]?.riskControls ?? risk.riskControls ?? [];

  const controlVerificationLabel = (link: RiskControlLink) => {
    return t(riskControlEffectivenessTranslationKey(link));
  };

  const handleOpenControls = async (risk: Risk) => {
    setSelectedRiskForControls(risk);
    setControlsModalOpen(true);
    setRiskControlForm(initialRiskControlForm);
    setAssessmentForm(initialRiskControlAssessmentForm);
    setAssessingRiskControlId(null);
    await loadControlImplementations();
    try {
      const [detail, controls] = await Promise.all([riskApi.getById(risk.id), riskApi.listControls(risk.id, { includeInactive: true })]);
      setRiskDetails((prev) => ({ ...prev, [risk.id]: { ...detail.data, riskControls: controls.data } }));
    } catch (err: unknown) { setError(getErrorMessage(err) || t('risks.controls.loadError')); }
  };

  const refreshSelectedRiskControls = async () => {
    if (!selectedRiskForControls) return;
    const controls = await riskApi.listControls(selectedRiskForControls.id, { includeInactive: true });
    setRiskDetails((prev) => ({ ...prev, [selectedRiskForControls.id]: { ...(prev[selectedRiskForControls.id] ?? selectedRiskForControls), riskControls: controls.data } }));
  };

  const handleLinkControl = async () => {
    if (!selectedRiskForControls || !riskControlForm.controlImplementationId) return setError(t('common.requiredField'));
    try {
      await riskApi.linkControl(selectedRiskForControls.id, riskControlForm);
      setRiskControlForm(initialRiskControlForm);
      await refreshSelectedRiskControls();
    } catch (err: unknown) { setError(getErrorMessage(err) || t('risks.controls.linkError')); }
  };

  const handleUpdateRiskControl = async (link: RiskControlLink, data: Partial<RiskControlForm>) => {
    if (!selectedRiskForControls) return;
    try {
      await riskApi.updateControl(selectedRiskForControls.id, link.id, data);
      await refreshSelectedRiskControls();
    } catch (err: unknown) { setError(getErrorMessage(err) || t('risks.controls.updateError')); }
  };

  const handleRemoveRiskControl = async (link: RiskControlLink) => {
    if (!selectedRiskForControls || !confirm(t('risks.controls.removeConfirm'))) return;
    try {
      await riskApi.removeControl(selectedRiskForControls.id, link.id);
      await refreshSelectedRiskControls();
    } catch (err: unknown) { setError(getErrorMessage(err) || t('risks.controls.removeError')); }
  };

  const handleAssessRiskControl = async (link: RiskControlLink) => {
    if (!selectedRiskForControls || !assessmentForm.RiskAssessmentVersionId || !assessmentForm.justification) return setError(t('common.requiredField'));
    const payload: any = {
      ...assessmentForm,
      effectivenessRating: Number(assessmentForm.effectivenessRating),
      likelihoodReduction: link.mitigationDimension === 'impact' ? undefined : Number(assessmentForm.likelihoodReduction),
      impactReduction: link.mitigationDimension === 'likelihood' ? undefined : Number(assessmentForm.impactReduction),
    };
    try {
      await riskApi.assessRiskControl(selectedRiskForControls.id, link.id, payload);
      setAssessmentForm(initialRiskControlAssessmentForm);
      setAssessingRiskControlId(null);
      await refreshSelectedRiskControls();
    } catch (err: unknown) { setError(getErrorMessage(err) || t('risks.controls.assessmentError')); }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const filteredRisks = risks.filter((risk) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = risk.title.toLowerCase().includes(searchLower) ||
      risk.displayId.toLowerCase().includes(searchLower);
    return matchesSearch && matchesRiskStatusFilter(risk, statusFilter);
  });

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.possibleImpact || !form.riskOwnerId || !form.assessorId || !form.nextReviewDate || !form.justification) {
      setError(t('common.requiredField'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        possibleImpact: form.possibleImpact,
        likelihood: form.likelihood,
        impact: form.impact,
        riskOwnerId: form.riskOwnerId.id,
        assessorId: form.assessorId.id,
        nextReviewDate: form.nextReviewDate,
        justification: form.justification,
      };
      if (form.assetIds?.length) payload.assetIds = form.assetIds.map(a => a.id);
      if (form.organizationUnitId) payload.organizationUnitId = form.organizationUnitId.id;
      if (form.processId) payload.processIds = [form.processId.id];

      if (editingId) {
        await riskApi.update(editingId, payload);
      } else {
        await riskApi.create(payload);
      }
      setModalOpen(false);
      resetForm();
      await loadRisks();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('risks.createSuccess'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (risk: Risk) => {
    try {
      const res = await riskApi.getById(risk.id);
      const data = res.data;
      setForm({
        title: data.title || '',
        description: data.description || '',
        possibleImpact: data.possibleImpact || '',
        likelihood: data.likelihood || 3,
        impact: data.impact || 3,
        nextReviewDate: data.nextReviewDate ? String(data.nextReviewDate).slice(0, 10) : initialForm.nextReviewDate,
        justification: data.evaluationJustification || '',
      });
      setEditingId(risk.id);
      setModalOpen(true);
    } catch {
      setError(t('risks.loadDetailsError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('risks.deleteConfirm'))) return;
    try {
      await riskApi.delete(id);
      await loadRisks();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('common.deleteError'));
    }
  };

  const handleOpenTreatment = async (risk: Risk) => {
    setSelectedRiskForTreatment(risk);
    setTreatmentModalOpen(true);
    setTreatmentForm(initialTreatmentForm);
    loadControlImplementations();
    try {
      const res = await treatmentApi.list({ riskId: risk.id });
      setTreatments(res.data?.data ?? []);
    } catch { setTreatments([]); }
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleChange = (field: keyof CreateRiskForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTreatment = async () => {
    if (!selectedRiskForTreatment || !treatmentForm.plannedActions || !treatmentForm.actionTitle) {
      setError(t('common.requiredField'));
      return;
    }
    try {
      const current = currentAssessment(selectedRiskForTreatment, 'current');
      await treatmentApi.create({
        riskId: selectedRiskForTreatment.id,
        assessmentId: current?.id,
        treatmentOption: treatmentForm.treatmentOption,
        plannedActions: treatmentForm.plannedActions,
        targetDate: treatmentForm.targetDate || undefined,
        actions: [{
          actionType: treatmentForm.actionType,
          title: treatmentForm.actionTitle,
          controlImplementationId: treatmentForm.controlImplementationId || undefined,
          targetDate: treatmentForm.targetDate || undefined,
        }],
      });
      const res = await treatmentApi.list({ riskId: selectedRiskForTreatment.id });
      setTreatments(res.data?.data ?? []);
      setTreatmentForm(initialTreatmentForm);
    } catch (err: unknown) { setError(getErrorMessage(err) || t('risks.createTreatmentError')); }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('risks.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('risks.title')}</h1>
        <button onClick={() => { resetForm(); setModalOpen(true); }}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
          {t('risks.newRisk')}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <input type="text" placeholder={t('risks.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select aria-label="Risk status filter" value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">{t('common.all')}</option>
          <option value="open">{t('risks.statusFilter.open')}</option>
          <option value="identified">{t('risks.status.identified')}</option>
          <option value="assessed">{t('risks.status.assessed')}</option>
          <option value="treatment_planned">{t('risks.status.treatment_planned')}</option>
          <option value="treatment_in_progress">{t('risks.status.treatment_in_progress')}</option>
          <option value="accepted">{t('risks.status.accepted')}</option>
          <option value="closed">{t('risks.status.closed')}</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.id')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.title')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.likelihood')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.impact')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.inherentRisk')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.residualRisk')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.targetRisk')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.controls')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRisks.length === 0 ? (
              <tr><td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('risks.noRisks')}</td></tr>
            ) : filteredRisks.map((risk) => (
              <tr key={risk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{risk.displayId}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{risk.title}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{risk.likelihood}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{risk.impact}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(risk.inherentRisk)}`}>
                    {t(`risks.riskLevel.${currentAssessment(risk, 'inherent')?.inherentRisk ?? risk.inherentRisk}`)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(currentAssessment(risk, 'current')?.residualRisk ?? risk.residualRisk)}`}>{t(`risks.riskLevel.${currentAssessment(risk, 'current')?.residualRisk ?? risk.residualRisk}`)}</span></td>
                <td className="px-6 py-4 text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(currentAssessment(risk, 'target')?.targetRisk ?? risk.targetRisk ?? risk.residualRisk)}`}>{t(`risks.riskLevel.${currentAssessment(risk, 'target')?.targetRisk ?? risk.targetRisk ?? risk.residualRisk}`)}</span></td>
                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                  {riskControls(risk).length === 0 ? t('risks.controls.none') : riskControls(risk).slice(0, 2).map((link) => (
                    <div key={link.id}>{link.controlImplementation?.control?.title ?? link.controlImplementationId}: {controlVerificationLabel(link)}</div>
                  ))}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{t(`risks.status.${risk.status}`)}</td>
                <td className="px-6 py-4 text-sm">
                  <button onClick={() => handleEdit(risk)} className="text-blue-600 hover:text-blue-800 mr-3">{t('common.edit')}</button>
                  <button onClick={() => handleOpenControls(risk)} className="text-purple-600 hover:text-purple-800 mr-3">{t('risks.controls.manage')}</button>
                  <button onClick={() => handleOpenTreatment(risk)} className="text-green-600 hover:text-green-800 mr-3">{t('common.treatment')}</button>
                  <button onClick={() => handleDelete(risk.id)} className="text-red-600 hover:text-red-800">{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Risk Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('risks.editRisk') : t('risks.createRisk')}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          {/* Basic Fields */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2">{t('risks.basicInformation')}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.title')} *</label>
            <input type="text" value={form.title} onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.description')} *</label>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.possibleImpact')} *</label>
            <textarea value={form.possibleImpact} onChange={(e) => handleChange('possibleImpact', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.nextReviewDate')} *</label>
              <input type="date" value={form.nextReviewDate} onChange={(e) => handleChange('nextReviewDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.justification')} *</label>
              <input type="text" value={form.justification} onChange={(e) => handleChange('justification', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.likelihood')}</label>
              <select value={form.likelihood} onChange={(e) => handleChange('likelihood', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={1}>{t('risks.likelihood.1')}</option>
                <option value={2}>{t('risks.likelihood.2')}</option>
                <option value={3}>{t('risks.likelihood.3')}</option>
                <option value={4}>{t('risks.likelihood.4')}</option>
                <option value={5}>{t('risks.likelihood.5')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('risks.fields.impact')}</label>
              <select value={form.impact} onChange={(e) => handleChange('impact', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={1}>{t('risks.impact.1')}</option>
                <option value={2}>{t('risks.impact.2')}</option>
                <option value={3}>{t('risks.impact.3')}</option>
                <option value={4}>{t('risks.impact.4')}</option>
                <option value={5}>{t('risks.impact.5')}</option>
              </select>
            </div>
          </div>

          {/* Relations */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">{t('risks.relations')}</h3>

          <EntitySearchSelect label={t('risks.riskOwner')} searchEndpoint={searchUsers} value={form.riskOwnerId}
            onChange={(v) => setForm({ ...form, riskOwnerId: v })} placeholder={t('risks.searchUsers')} />

          <EntitySearchSelect label={t('risks.assessor')} searchEndpoint={searchUsers} value={form.assessorId}
            onChange={(v) => setForm({ ...form, assessorId: v })} placeholder={t('risks.searchUsers')} />

          <EntitySearchSelect label={t('risks.organizationUnit')} searchEndpoint={searchOrganizationUnits} value={form.organizationUnitId}
            onChange={(v) => setForm({ ...form, organizationUnitId: v })} placeholder={t('risks.searchOrgUnits')} />

          <EntitySearchSelect label={t('risks.businessProcess')} searchEndpoint={searchProcesses} value={form.processId}
            onChange={(v) => setForm({ ...form, processId: v })} placeholder={t('risks.searchProcesses')} />

          <EntitySearchSelect label={t('risks.fields.assets')} searchEndpoint={searchAssets} values={form.assetIds}
            onValuesChange={(v) => setForm({ ...form, assetIds: v })} multiple placeholder={t('risks.searchAssets')} />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {saving ? t('common.loading') : (editingId ? t('common.update') : t('risks.createRisk'))}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={controlsModalOpen} onClose={() => setControlsModalOpen(false)} title={t('risks.controls.modalTitle').replace('{title}', selectedRiskForControls?.title || '')}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          <p className="text-sm text-amber-700 dark:text-amber-300">{t('risks.controls.separationNotice')}</p>
          {selectedRiskForControls && currentAssessment(selectedRiskForControls, 'current') && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded text-sm text-blue-800 dark:text-blue-200">
              {t('risks.controls.assessmentContext')}: {t('risks.columns.residualRisk')} {currentAssessment(selectedRiskForControls, 'current')?.residualRisk}. {t('risks.controls.noAutoResidual')}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 border-b pb-4">
            <select value={riskControlForm.controlImplementationId} onChange={(e) => setRiskControlForm({ ...riskControlForm, controlImplementationId: e.target.value })} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white md:col-span-2">
              <option value="">{t('risks.controls.selectImplementation')}</option>
              {controlImplementations.filter((impl) => !impl.isArchived).map((impl) => <option key={impl.id} value={impl.id}>{impl.control?.title ?? impl.controlId} - {impl.implementationStatus}</option>)}
            </select>
            <select value={riskControlForm.role} onChange={(e) => setRiskControlForm({ ...riskControlForm, role: e.target.value })} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              {['preventive', 'detective', 'corrective', 'recovery', 'compensating'].map((role) => <option key={role} value={role}>{t(`risks.controls.roles.${role}`)}</option>)}
            </select>
            <select value={riskControlForm.mitigationDimension} onChange={(e) => setRiskControlForm({ ...riskControlForm, mitigationDimension: e.target.value })} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
              {['likelihood', 'impact', 'both'].map((dimension) => <option key={dimension} value={dimension}>{t(`risks.controls.dimensions.${dimension}`)}</option>)}
            </select>
            <button onClick={handleLinkControl} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">{t('risks.controls.add')}</button>
          </div>
          {(selectedRiskForControls ? riskControls(selectedRiskForControls) : []).length === 0 ? <p className="text-sm text-gray-500">{t('risks.controls.empty')}</p> : (selectedRiskForControls ? riskControls(selectedRiskForControls) : []).map((link) => (
            <div key={link.id} className="p-3 border dark:border-gray-700 rounded-md space-y-2">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{link.controlImplementation?.control?.title ?? link.controlImplementationId}</div>
                  <div className="text-xs text-gray-500">{t(`risks.controls.roles.${link.role}`)} · {t(`risks.controls.dimensions.${link.mitigationDimension}`)} · {t('risks.controls.implementationReadiness')}: {link.controlImplementation?.implementationStatus ?? '-'}</div>
                  <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">{t('risks.controls.latestEffectiveness')}: {controlVerificationLabel(link)}</div>
                </div>
                <div className="space-x-2 whitespace-nowrap">
                  <button onClick={() => handleUpdateRiskControl(link, { status: link.status === 'active' ? 'inactive' : 'active' })} className="text-blue-600 text-sm">{link.status === 'active' ? t('risks.controls.deactivate') : t('risks.controls.activate')}</button>
                  <button onClick={() => setAssessingRiskControlId(assessingRiskControlId === link.id ? null : link.id)} className="text-green-600 text-sm">{t('risks.controls.assess')}</button>
                  <button onClick={() => handleRemoveRiskControl(link)} className="text-red-600 text-sm">{t('common.delete')}</button>
                </div>
              </div>
              {(link.assessments ?? []).slice(0, 3).map((assessment) => <div key={assessment.id} className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded">{new Date(assessment.assessedAt ?? '').toLocaleDateString()} · {t(`risks.controls.effectiveness.${assessment.effectivenessStatus}`)} · {assessment.effectivenessRating ?? '-'}% · {assessment.justification}</div>)}
              {assessingRiskControlId === link.id && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                  <select value={assessmentForm.RiskAssessmentVersionId} onChange={(e) => setAssessmentForm({ ...assessmentForm, RiskAssessmentVersionId: e.target.value })} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="">{t('risks.controls.selectAssessmentVersion')}</option>
                    {(riskDetails[selectedRiskForControls?.id ?? '']?.riskAssessmentVersions ?? []).filter((v: RiskAssessmentVersion) => !v.status || !['closed', 'completed', 'approved'].includes(v.status)).map((v: any) => <option key={v.id} value={v.id}>{v.assessmentType} #{v.versionNumber ?? v.versionNumber ?? ''} ({v.status ?? 'draft'})</option>)}
                  </select>
                  <select value={assessmentForm.effectivenessStatus} onChange={(e) => setAssessmentForm({ ...assessmentForm, effectivenessStatus: e.target.value })} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    {['effective', 'partially_effective', 'ineffective', 'not_tested', 'not_applicable'].map((status) => <option key={status} value={status}>{t(`risks.controls.effectiveness.${status}`)}</option>)}
                  </select>
                  <input type="number" min="0" max="100" value={assessmentForm.effectivenessRating} onChange={(e) => setAssessmentForm({ ...assessmentForm, effectivenessRating: Number(e.target.value) })} placeholder={t('risks.controls.rating')} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  {link.mitigationDimension !== 'impact' && <input type="number" min="0" max="100" value={assessmentForm.likelihoodReduction} onChange={(e) => setAssessmentForm({ ...assessmentForm, likelihoodReduction: Number(e.target.value) })} placeholder={t('risks.controls.likelihoodReduction')} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />}
                  {link.mitigationDimension !== 'likelihood' && <input type="number" min="0" max="100" value={assessmentForm.impactReduction} onChange={(e) => setAssessmentForm({ ...assessmentForm, impactReduction: Number(e.target.value) })} placeholder={t('risks.controls.impactReduction')} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />}
                  <input value={assessmentForm.justification} onChange={(e) => setAssessmentForm({ ...assessmentForm, justification: e.target.value })} placeholder={t('risks.controls.justification')} className="px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white md:col-span-2" />
                  <button onClick={() => handleAssessRiskControl(link)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{t('risks.controls.saveAssessment')}</button>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-4"><button onClick={() => setControlsModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">{t('common.close')}</button></div>
        </div>
      </Modal>

      {/* Treatment Plan Modal */}
      <Modal isOpen={treatmentModalOpen} onClose={() => setTreatmentModalOpen(false)} title={t('risks.treatmentTitle').replace('{title}', selectedRiskForTreatment?.title || '')}>
        <div className="space-y-4">
          {treatments.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('risks.noTreatmentPlans')}</p>
          ) : (
            <div className="space-y-3">
              {treatments.map((tr: any) => (
                <div key={tr.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{tr.name || tr.description?.substring(0, 50) || t('common.treatment')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      tr.status === 'approved' ? 'bg-green-100 text-green-800' :
                      tr.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>{tr.status || 'draft'}</span>
                  </div>
                  {tr.description && <p className="text-xs text-gray-500 mt-1">{tr.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Create Treatment */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">{t('risks.createNewTreatment')}</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">{t('risks.treatmentAssessmentNotice')}</p>
            <select value={treatmentForm.treatmentOption} onChange={(e) => setTreatmentForm({ ...treatmentForm, treatmentOption: e.target.value })}
              className="w-full mb-2 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm">
              <option value="reduce">{t('risks.treatmentOptions.reduce')}</option>
              <option value="avoid">{t('risks.treatmentOptions.avoid')}</option>
              <option value="transfer">{t('risks.treatmentOptions.transfer')}</option>
              <option value="accept">{t('risks.treatmentOptions.accept')}</option>
            </select>
            <textarea value={treatmentForm.plannedActions} onChange={(e) => setTreatmentForm({ ...treatmentForm, plannedActions: e.target.value })} placeholder={t('risks.describeTreatmentPlan')} rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <input value={treatmentForm.actionTitle} onChange={(e) => setTreatmentForm({ ...treatmentForm, actionTitle: e.target.value })} placeholder={t('risks.treatmentActionTitle')}
              className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
            <select value={treatmentForm.controlImplementationId} onChange={(e) => setTreatmentForm({ ...treatmentForm, controlImplementationId: e.target.value })}
              className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm">
              <option value="">{t('risks.selectControlImplementation')}</option>
              {controlImplementations.map((impl) => <option key={impl.id} value={impl.id}>{impl.control?.title ?? impl.controlId} - {impl.implementationStatus}</option>)}
            </select>
            <button onClick={handleCreateTreatment}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
              {t('risks.createTreatmentPlan')}
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={() => setTreatmentModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.close')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Risks;


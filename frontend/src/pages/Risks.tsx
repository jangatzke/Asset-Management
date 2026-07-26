
import { useState, useEffect } from 'react';
import { riskApi, assetApi, adminApi, processApi, treatmentApi, controlApi } from '../services/api';
import { Modal } from '../components/Modal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import { useI18n } from '../context/I18nContext';

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
  RiskAssessment?: RiskAssessmentVersion[];
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

const Risks = () => {
  const { t } = useI18n();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => { loadRisks(); }, []);

  const loadRisks = async () => {
    try {
      setLoading(true);
      const response = await riskApi.list({ page: 1, limit: 50 });
      const list = response.data?.data || [];
      setRisks(list);
      const detailPairs = await Promise.allSettled(list.slice(0, 20).map((risk: Risk) => riskApi.getById(risk.id)));
      const details: Record<string, any> = {};
      detailPairs.forEach((result, index) => {
        if (result.status === 'fulfilled') details[list[index].id] = result.value.data;
      });
      setRiskDetails(details);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.saveError'));
    } finally { setLoading(false); }
  };

  // Search endpoints for EntitySearchSelect
  const searchAssets = async (q: string) => {
    try {
      const res = await assetApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  const searchUsers = async (q: string) => {
    try {
      const res = await adminApi.listUsers();
      const users = res.data?.data ?? res.data ?? [];
      if (!q) return users;
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

  const loadControlImplementations = async () => {
    try {
      const res = await controlApi.list({ page: 1, limit: 100 });
      const controls = res.data?.data ?? [];
      setControlImplementations(controls.flatMap((control: any) => (control.implementations ?? []).map((impl: any) => ({ ...impl, control }))));
    } catch { setControlImplementations([]); }
  };

  const currentAssessment = (risk: Risk, type?: 'inherent' | 'current' | 'target') => {
    const versions = (riskDetails[risk.id]?.RiskAssessment ?? risk.RiskAssessment ?? []) as RiskAssessmentVersion[];
    return versions.find((a) => a.isCurrent && (!type || a.assessmentType === type)) ?? versions.find((a) => !type || a.assessmentType === type);
  };

  const riskControls = (risk: Risk): RiskControlLink[] => riskDetails[risk.id]?.riskControls ?? risk.riskControls ?? [];

  const controlVerificationLabel = (link: RiskControlLink) => {
    const status = link.controlImplementation?.implementationStatus;
    if (status === 'effective' || status === 'tested') return t('risks.controls.effectiveTested');
    if (status === 'implemented') return t('risks.controls.notVerified');
    return t('risks.controls.plannedNoResidualReduction');
  };

  const filteredRisks = risks.filter((risk) =>
    risk.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    risk.displayId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel?.toLowerCase()) {
      case 'very_high': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'high': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'low': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

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
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('risks.createSuccess'));
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
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.deleteError'));
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
    } catch (err: any) { setError(err.response?.data?.error?.message || t('risks.createTreatmentError')); }
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

      <div className="mb-4">
        <input type="text" placeholder={t('risks.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

          <EntitySearchSelect label={t('risks.organizationUnit')} searchEndpoint={searchUsers} value={form.organizationUnitId}
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


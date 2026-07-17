
import { useState, useEffect } from 'react';
import { riskApi, assetApi, adminApi, processApi, treatmentApi } from '../services/api';
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
  riskOwnerId?: EntityOption | null;
  assessorId?: EntityOption | null;
  assetIds?: EntityOption[];
  organizationUnitId?: EntityOption | null;
  processId?: EntityOption | null;
}

const initialForm: CreateRiskForm = {
  title: '',
  description: '',
  possibleImpact: '',
  likelihood: 3,
  impact: 3,
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

  useEffect(() => { loadRisks(); }, []);

  const loadRisks = async () => {
    try {
      setLoading(true);
      const response = await riskApi.list({ page: 1, limit: 50 });
      setRisks(response.data?.data || []);
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
    if (!form.title || !form.description || !form.possibleImpact) {
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
      };
      if (form.riskOwnerId) payload.riskOwnerId = form.riskOwnerId.id;
      if (form.assessorId) payload.assessorId = form.assessorId.id;
      if (form.assetIds?.length) payload.assetIds = form.assetIds.map(a => a.id);
      if (form.organizationUnitId) payload.organizationUnitId = form.organizationUnitId.id;
      if (form.processId) payload.processId = form.processId.id;

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
      });
      setEditingId(risk.id);
      setModalOpen(true);
    } catch {
      setError('Failed to load risk details');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this risk?')) return;
    try {
      await riskApi.delete(id);
      await loadRisks();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const handleOpenTreatment = async (risk: Risk) => {
    setSelectedRiskForTreatment(risk);
    setTreatmentModalOpen(true);
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('risks.columns.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRisks.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('risks.noRisks')}</td></tr>
            ) : filteredRisks.map((risk) => (
              <tr key={risk.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{risk.displayId}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{risk.title}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{risk.likelihood}</td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{risk.impact}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskColor(risk.inherentRisk)}`}>
                    {t(`risks.riskLevel.${risk.inherentRisk}`)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{t(`risks.status.${risk.status}`)}</td>
                <td className="px-6 py-4 text-sm">
                  <button onClick={() => handleEdit(risk)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                  <button onClick={() => handleOpenTreatment(risk)} className="text-green-600 hover:text-green-800 mr-3">Treatment</button>
                  <button onClick={() => handleDelete(risk.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Risk Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Risk' : t('risks.createRisk')}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          {/* Basic Fields */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2">Basic Information</h3>

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
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">Relations</h3>

          <EntitySearchSelect label="Risk Owner" searchEndpoint={searchUsers} value={form.riskOwnerId}
            onChange={(v) => setForm({ ...form, riskOwnerId: v })} placeholder="Search users..." />

          <EntitySearchSelect label="Assessor" searchEndpoint={searchUsers} value={form.assessorId}
            onChange={(v) => setForm({ ...form, assessorId: v })} placeholder="Search users..." />

          <EntitySearchSelect label="Organization Unit" searchEndpoint={searchUsers} value={form.organizationUnitId}
            onChange={(v) => setForm({ ...form, organizationUnitId: v })} placeholder="Search org units..." />

          <EntitySearchSelect label="Business Process" searchEndpoint={searchProcesses} value={form.processId}
            onChange={(v) => setForm({ ...form, processId: v })} placeholder="Search processes..." />

          <EntitySearchSelect label="Affected Assets" searchEndpoint={searchAssets} values={form.assetIds}
            onValuesChange={(v) => setForm({ ...form, assetIds: v })} multiple placeholder="Search assets..." />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {saving ? t('common.loading') : (editingId ? 'Update' : t('risks.createRisk'))}
            </button>
          </div>
        </div>
      </Modal>

      {/* Treatment Plan Modal */}
      <Modal isOpen={treatmentModalOpen} onClose={() => setTreatmentModalOpen(false)} title={`Treatment: ${selectedRiskForTreatment?.title}`}>
        <div className="space-y-4">
          {treatments.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No treatment plans yet for this risk.</p>
          ) : (
            <div className="space-y-3">
              {treatments.map((tr: any) => (
                <div key={tr.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{tr.name || tr.description?.substring(0, 50) || 'Treatment'}</span>
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
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Create New Treatment</h4>
            <textarea placeholder="Describe the treatment plan..." rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            <button onClick={async () => {
              if (!selectedRiskForTreatment) return;
              try {
                await riskApi.createTreatmentPlan(selectedRiskForTreatment.id, {});
                setTreatmentModalOpen(false);
                await loadRisks();
              } catch (err: any) { setError(err.response?.data?.error?.message || 'Failed to create treatment'); }
            }}
              className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
              Create Treatment Plan
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button onClick={() => setTreatmentModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Risks;


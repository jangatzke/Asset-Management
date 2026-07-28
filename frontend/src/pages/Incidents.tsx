import { useState, useEffect } from 'react';
import { incidentApi, nis2Api } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';

interface Incident {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  detectionTime: string;
  knowledgeTime: string;
  isSignificant?: boolean;
  significanceReasons?: string[];
  reports?: Array<{ id: string; reportType: string; status: string; dueAt?: string }>;
  escalations?: Array<{ id: string; reason: string; status: string }>;
  incidentManagerId?: string;
  reporterSource?: string;
  confidentialityImpact?: string;
  integrityImpact?: string;
  availabilityImpact?: string;
  operationalImpact?: string;
  financialImpact?: number | string;
  legalImpact?: string;
  personalDataImpact?: boolean;
  suspectedCause?: string;
  isIntentional?: boolean;
  hasCrossBorderImpact?: boolean;
}

interface IncidentForm {
  title: string;
  description: string;
  detectionTime: string;
  knowledgeTime: string;
  incidentManagerId: string;
  severity: string;
  status: string;
  reporterSource: string;
  confidentialityImpact: string;
  integrityImpact: string;
  availabilityImpact: string;
  operationalImpact: string;
  financialImpact: string;
  legalImpact: string;
  personalDataImpact: boolean;
  suspectedCause: string;
  isIntentional: boolean;
  hasCrossBorderImpact: boolean;
}

const toDateTimeLocal = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const initialIncidentForm = (): IncidentForm => {
  const now = toDateTimeLocal();
  return {
    title: '',
    description: '',
    detectionTime: now,
    knowledgeTime: now,
    incidentManagerId: 'frontend-user',
    severity: 'medium',
    status: 'new',
    reporterSource: '',
    confidentialityImpact: 'none',
    integrityImpact: 'none',
    availabilityImpact: 'none',
    operationalImpact: '',
    financialImpact: '',
    legalImpact: '',
    personalDataImpact: false,
    suspectedCause: '',
    isIntentional: false,
    hasCrossBorderImpact: false,
  };
};

const Incidents = () => {
  const { t } = useI18n();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [form, setForm] = useState<IncidentForm>(initialIncidentForm);

  useEffect(() => {
    loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial incidents load only; loader uses current translation fallback for this mount.
  }, []);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const response = await incidentApi.list();
      setIncidents(response.data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || t('incidents.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const ensureNis2Catalogue = async () => {
    try {
      await nis2Api.ensureMeasuresCatalogue();
      setActionMessage(t('incidents.catalogueEnsured'));
    } catch (err: any) {
      setError(err.response?.data?.message || t('incidents.catalogueError'));
    }
  };

  const createEarlyWarning = async (incident: Incident) => {
    try {
      await incidentApi.createReport(incident.id, {
        reportType: 'early_warning_24h',
        content: { summary: incident.title, reasons: incident.significanceReasons ?? [] },
        authorId: 'frontend-user',
      });
      setActionMessage(t('incidents.warningDraftCreated').replace('{title}', incident.title));
      loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.message || t('incidents.warningDraftError'));
    }
  };

  const openCreateModal = () => {
    setEditingIncident(null);
    setForm(initialIncidentForm());
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (incident: Incident) => {
    setEditingIncident(incident);
    setForm({
      title: incident.title || '',
      description: incident.description || '',
      detectionTime: toDateTimeLocal(incident.detectionTime),
      knowledgeTime: toDateTimeLocal(incident.knowledgeTime),
      incidentManagerId: incident.incidentManagerId || 'frontend-user',
      severity: incident.severity || 'medium',
      status: incident.status || 'new',
      reporterSource: incident.reporterSource || '',
      confidentialityImpact: incident.confidentialityImpact || 'none',
      integrityImpact: incident.integrityImpact || 'none',
      availabilityImpact: incident.availabilityImpact || 'none',
      operationalImpact: incident.operationalImpact || '',
      financialImpact: incident.financialImpact?.toString() || '',
      legalImpact: incident.legalImpact || '',
      personalDataImpact: Boolean(incident.personalDataImpact),
      suspectedCause: incident.suspectedCause || '',
      isIntentional: Boolean(incident.isIntentional),
      hasCrossBorderImpact: Boolean(incident.hasCrossBorderImpact),
    });
    setError(null);
    setModalOpen(true);
  };

  const handleFormChange = (field: keyof IncidentForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildIncidentPayload = () => {
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim(),
      detectionTime: new Date(form.detectionTime).toISOString(),
      knowledgeTime: new Date(form.knowledgeTime).toISOString(),
      incidentManagerId: form.incidentManagerId.trim(),
      severity: form.severity,
      reporterSource: form.reporterSource.trim() || undefined,
      confidentialityImpact: form.confidentialityImpact,
      integrityImpact: form.integrityImpact,
      availabilityImpact: form.availabilityImpact,
      operationalImpact: form.operationalImpact.trim() || undefined,
      legalImpact: form.legalImpact.trim() || undefined,
      personalDataImpact: form.personalDataImpact,
      suspectedCause: form.suspectedCause.trim() || undefined,
      isIntentional: form.isIntentional,
      hasCrossBorderImpact: form.hasCrossBorderImpact,
    };

    if (form.financialImpact.trim()) payload.financialImpact = Number(form.financialImpact);
    if (editingIncident) payload.status = form.status;
    return payload;
  };

  const saveIncident = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.detectionTime || !form.knowledgeTime || !form.incidentManagerId.trim()) {
      setError(t('common.requiredField'));
      return;
    }

    setSaving(true);
    setError(null);
    setActionMessage(null);
    try {
      const payload = buildIncidentPayload();
      if (editingIncident) {
        await incidentApi.update(editingIncident.id, payload);
        setActionMessage(t('incidents.updateSuccess'));
      } else {
        await incidentApi.create(payload);
        setActionMessage(t('incidents.createSuccess'));
      }
      setModalOpen(false);
      setEditingIncident(null);
      setForm(initialIncidentForm());
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('incidents.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'under_investigation':
        return 'bg-yellow-100 text-yellow-800';
      case 'contained':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredIncidents = incidents.filter((incident) => {
    const searchLower = search.toLowerCase();
    return (
      incident.title.toLowerCase().includes(searchLower) ||
      incident.description.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">{t('incidents.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('incidents.title')}</h1>
        <div className="flex gap-3">
          <button onClick={ensureNis2Catalogue} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            {t('incidents.ensureCatalogue')}
          </button>
          <button onClick={openCreateModal} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
            {t('incidents.addIncident')}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded mb-4">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('incidents.searchPlaceholder')}
          className="w-full px-4 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-card rounded-lg shadow overflow-hidden border border-transparent dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('incidents.columns.title')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('incidents.columns.status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('incidents.columns.severity')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('incidents.columns.detectionTime')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                NIS-2
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('incidents.noIncidents')}
                </td>
              </tr>
            ) : (
              filteredIncidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {incident.title}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(incident.status)}`}>
                      {incident.status?.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(incident.severity)}`}>
                      {incident.severity?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    {new Date(incident.detectionTime).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <div>{incident.isSignificant ? t('incidents.significant') : t('incidents.notSignificant')}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{t('incidents.knowledge')}: {incident.knowledgeTime ? new Date(incident.knowledgeTime).toLocaleString() : '-'}</div>
                    {incident.significanceReasons?.length ? <div className="text-xs text-red-600 dark:text-red-400">{incident.significanceReasons.join(', ')}</div> : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                    <button onClick={() => openEditModal(incident)} className="px-3 py-1 mr-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => createEarlyWarning(incident)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                      {t('incidents.warningDraft')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingIncident ? t('incidents.editIncident') : t('incidents.createIncident')}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.title')} *</label>
              <input type="text" value={form.title} onChange={(e) => handleFormChange('title', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.description')} *</label>
              <textarea rows={3} value={form.description} onChange={(e) => handleFormChange('description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.detectionTime')} *</label>
              <input type="datetime-local" value={form.detectionTime} onChange={(e) => handleFormChange('detectionTime', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.knowledgeTime')} *</label>
              <input type="datetime-local" value={form.knowledgeTime} onChange={(e) => handleFormChange('knowledgeTime', e.target.value)} disabled={Boolean(editingIncident)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.severity')}</label>
              <select value={form.severity} onChange={(e) => handleFormChange('severity', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['low', 'medium', 'high', 'critical'].map((severity) => <option key={severity} value={severity}>{t(`incidents.severity.${severity}`)}</option>)}
              </select>
            </div>
            {editingIncident && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.status')}</label>
                <select value={form.status} onChange={(e) => handleFormChange('status', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['new', 'under_investigation', 'contained', 'resolved', 'closed'].map((status) => <option key={status} value={status}>{t(`incidents.status.${status}`)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.incidentManagerId')} *</label>
              <input type="text" value={form.incidentManagerId} onChange={(e) => handleFormChange('incidentManagerId', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.reporterSource')}</label>
              <input type="text" value={form.reporterSource} onChange={(e) => handleFormChange('reporterSource', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.confidentialityImpact')}</label>
              <select value={form.confidentialityImpact} onChange={(e) => handleFormChange('confidentialityImpact', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['none', 'low', 'medium', 'high'].map((impact) => <option key={impact} value={impact}>{t(`incidents.impact.${impact}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.integrityImpact')}</label>
              <select value={form.integrityImpact} onChange={(e) => handleFormChange('integrityImpact', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['none', 'low', 'medium', 'high'].map((impact) => <option key={impact} value={impact}>{t(`incidents.impact.${impact}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.availabilityImpact')}</label>
              <select value={form.availabilityImpact} onChange={(e) => handleFormChange('availabilityImpact', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['none', 'low', 'medium', 'high'].map((impact) => <option key={impact} value={impact}>{t(`incidents.impact.${impact}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.financialImpact')}</label>
              <input type="number" min="0" step="0.01" value={form.financialImpact} onChange={(e) => handleFormChange('financialImpact', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.operationalImpact')}</label>
              <textarea rows={2} value={form.operationalImpact} onChange={(e) => handleFormChange('operationalImpact', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.legalImpact')}</label>
              <textarea rows={2} value={form.legalImpact} onChange={(e) => handleFormChange('legalImpact', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.suspectedCause')}</label>
              <textarea rows={2} value={form.suspectedCause} onChange={(e) => handleFormChange('suspectedCause', e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.personalDataImpact} onChange={(e) => handleFormChange('personalDataImpact', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t('incidents.fields.personalDataImpact')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.isIntentional} onChange={(e) => handleFormChange('isIntentional', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t('incidents.fields.isIntentional')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.hasCrossBorderImpact} onChange={(e) => handleFormChange('hasCrossBorderImpact', e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t('incidents.fields.hasCrossBorderImpact')}
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={saveIncident} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Incidents;

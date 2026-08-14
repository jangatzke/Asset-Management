import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DocumentPlusIcon, PencilSquareIcon, ClockIcon } from '@heroicons/react/24/outline';
import { incidentApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { DiscardConfirmationDialog } from '../components/DiscardConfirmationDialog';
import EntityPicker from '../components/EntityPicker';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { useAuthStore } from '../store/auth';

interface HistoryEntry {
  id: string;
  incidentId: string;
  action: string;
  fieldChanges?: Record<string, unknown>;
  summary?: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

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
  affectedAssetIds: string[];
  affectedProcessIds: string[];
}

const toDateTimeLocal = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const initialIncidentForm = (currentUserId = ''): IncidentForm => {
  const now = toDateTimeLocal();
  return {
    title: '',
    description: '',
    detectionTime: now,
    knowledgeTime: now,
    incidentManagerId: currentUserId,
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
    affectedAssetIds: [],
    affectedProcessIds: [],
  };
};

const activeIncidentStatuses = ['new', 'under_investigation', 'contained'];

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';

export const normalizeIncidentStatusFilter = (value: string | null) => value === 'open' ? 'open' : value ?? '';
export const matchesIncidentStatusFilter = (incident: Pick<Incident, 'status'>, statusFilter: string) => {
  if (!statusFilter) return true;
  if (statusFilter === 'open') return activeIncidentStatuses.includes(incident.status);
  return incident.status === statusFilter;
};

const Incidents = () => {
  const { t } = useI18n();
  const currentUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => normalizeIncidentStatusFilter(searchParams.get('status')));
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const form = useDirtyForm<IncidentForm>(initialIncidentForm(currentUser?.id || ''));
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const pendingClose = useRef<(() => void) | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyActionFilter, setHistoryActionFilter] = useState('');
  const [incidentManager, setIncidentManager] = useState<EntityPickerResult | null>(null);
  const [affectedAssets, setAffectedAssets] = useState<EntityPickerResult[]>([]);
  const [affectedProcesses, setAffectedProcesses] = useState<EntityPickerResult[]>([]);

  const handleDiscard = useCallback(() => {
    form.resetForm();
    setEditingIncident(null);
    setModalOpen(false);
  }, [form]);

  const handleModalClose = useCallback(() => {
    if (form.isDirty) {
      pendingClose.current = () => setModalOpen(false);
      setDiscardConfirmOpen(true);
    } else {
      setModalOpen(false);
    }
  }, [form]);

  const openHistory = async (incidentId: string) => {
    setHistoryOpen(true);
    setHistoryEntries([]);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params: Record<string, string | number | undefined> = { limit: 100, offset: 0 };
      if (historyActionFilter) params.action = historyActionFilter;
      const response = await incidentApi.history(incidentId, params);
      setHistoryEntries(response.data.data || response.data || []);
    } catch (err: any) {
      setHistoryError(err.response?.data?.message || t('incidents.history.loadHistoryError'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryPage = async (incidentId: string, offset: number) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params: Record<string, string | number | undefined> = { limit: 50, offset };
      if (historyActionFilter) params.action = historyActionFilter;
      const response = await incidentApi.history(incidentId, params);
      setHistoryEntries(response.data.data || response.data || []);
    } catch (err: any) {
      setHistoryError(err.response?.data?.message || t('incidents.history.loadHistoryError'));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial incidents load only; loader uses current translation fallback for this mount.
  }, []);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const params: { page: number; limit: number; status?: string } = { page: 1, limit: 50 };
      if (statusFilter && statusFilter !== 'open') params.status = statusFilter;
      const response = await incidentApi.list(params);
      setIncidents(response.data.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || t('incidents.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const createEarlyWarning = async (incident: Incident) => {
    try {
      await incidentApi.createReport(incident.id, {
        reportType: 'early_warning_24h',
        content: { summary: incident.title, reasons: incident.significanceReasons ?? [] },
      });
      setActionMessage(t('incidents.warningDraftCreated').replace('{title}', incident.title));
      loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.message || t('incidents.warningDraftError'));
    }
  };

  const openCreateModal = useCallback(() => {
    setEditingIncident(null);
    form.setFormValues(initialIncidentForm(currentUser?.id || ''));
    setIncidentManager(currentUser ? { id: currentUser.id, label: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email } : null);
    setAffectedAssets([]);
    setAffectedProcesses([]);
    setError(null);
    setModalOpen(true);
  }, [form, currentUser, t]);

  const openEditModal = useCallback((incident: Incident) => {
    setEditingIncident(incident);
    form.setFormValues({
      title: incident.title || '',
      description: incident.description || '',
      detectionTime: toDateTimeLocal(incident.detectionTime),
      knowledgeTime: toDateTimeLocal(incident.knowledgeTime),
      incidentManagerId: incident.incidentManagerId || currentUser?.id || '',
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
      affectedAssetIds: [],
      affectedProcessIds: [],
    });
    setIncidentManager(incident.incidentManagerId ? { id: incident.incidentManagerId, label: t('incidents.fields.incidentManagerId') } : null);
    setAffectedAssets([]);
    setAffectedProcesses([]);
    setError(null);
    setModalOpen(true);
  }, [form, currentUser, t]);

  const buildIncidentPayload = () => {
    const v = form.values;
    const payload: any = {
      title: v.title.trim(),
      description: v.description.trim(),
      detectionTime: new Date(v.detectionTime).toISOString(),
      knowledgeTime: new Date(v.knowledgeTime).toISOString(),
      incidentManagerId: v.incidentManagerId.trim(),
      severity: v.severity,
      reporterSource: v.reporterSource.trim() || undefined,
      confidentialityImpact: v.confidentialityImpact,
      integrityImpact: v.integrityImpact,
      availabilityImpact: v.availabilityImpact,
      operationalImpact: v.operationalImpact.trim() || undefined,
      legalImpact: v.legalImpact.trim() || undefined,
      personalDataImpact: v.personalDataImpact,
      suspectedCause: v.suspectedCause.trim() || undefined,
      isIntentional: v.isIntentional,
      hasCrossBorderImpact: v.hasCrossBorderImpact,
      affectedAssetIds: v.affectedAssetIds,
      affectedProcessIds: v.affectedProcessIds,
    };

    if (v.financialImpact.trim()) payload.financialImpact = Number(v.financialImpact);
    if (editingIncident) payload.status = v.status;
    return payload;
  };

  const saveIncident = useCallback(async () => {
    const v = form.values;
    if (!v.title.trim() || !v.description.trim() || !v.detectionTime || !v.knowledgeTime || !v.incidentManagerId.trim()) {
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
      form.resetForm();
      setAffectedAssets([]);
      setAffectedProcesses([]);
      await loadIncidents();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.message || t('incidents.saveError'));
    } finally {
      setSaving(false);
    }
  }, [form, editingIncident, t]);

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

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const filteredIncidents = incidents.filter((incident) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = (
      incident.title.toLowerCase().includes(searchLower) ||
      incident.description.toLowerCase().includes(searchLower)
    );
    return matchesSearch && matchesIncidentStatusFilter(incident, statusFilter);
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

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <input
          type="text"
          placeholder={t('incidents.searchPlaceholder')}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Incident status filter"
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{t('common.all')}</option>
          <option value="open">{t('incidents.statusFilter.open')}</option>
          <option value="new">{t('incidents.status.new')}</option>
          <option value="under_investigation">{t('incidents.status.under_investigation')}</option>
          <option value="contained">{t('incidents.status.contained')}</option>
          <option value="resolved">{t('incidents.status.resolved')}</option>
          <option value="closed">{t('incidents.status.closed')}</option>
        </select>
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
                    <Link to={`/incidents/${incident.id}`} className="hover:text-blue-600 hover:underline">{incident.title}</Link>
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(incident)} aria-label={`${t('common.edit')}: ${incident.title}`} title={t('common.edit')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                        <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      <button onClick={() => createEarlyWarning(incident)} aria-label={`${t('incidents.warningDraft')}: ${incident.title}`} title={t('incidents.warningDraft')} className={`${actionButtonClassName} text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300`}>
                        <DocumentPlusIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      <button onClick={() => openHistory(incident.id)} aria-label={`${t('incidents.history.viewHistory')}: ${incident.title}`} title={t('incidents.history.viewHistory')} className={`${actionButtonClassName} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`}>
                        <ClockIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={handleModalClose} title={editingIncident ? t('incidents.editIncident') : t('incidents.createIncident')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.title')} *</label>
              <input type="text" value={form.values.title} onChange={(e) => form.handleChange({ title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.description')} *</label>
              <textarea rows={3} value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.detectionTime')} *</label>
              <input type="datetime-local" value={form.values.detectionTime} onChange={(e) => form.handleChange({ detectionTime: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.knowledgeTime')} *</label>
              <input type="datetime-local" value={form.values.knowledgeTime} onChange={(e) => form.handleChange({ knowledgeTime: e.target.value })} disabled={Boolean(editingIncident)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.severity')}</label>
              <select value={form.values.severity} onChange={(e) => form.handleChange({ severity: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['low', 'medium', 'high', 'critical'].map((severity) => <option key={severity} value={severity}>{t(`incidents.severity.${severity}`)}</option>)}
              </select>
            </div>
            {editingIncident && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.status')}</label>
                <select value={form.values.status} onChange={(e) => form.handleChange({ status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['new', 'under_investigation', 'contained', 'resolved', 'closed'].map((status) => <option key={status} value={status}>{t(`incidents.status.${status}`)}</option>)}
                </select>
              </div>
            )}
            <EntityPicker
              labelKey="incidents.fields.incidentManagerId"
              entityType="user"
              value={incidentManager}
              required
              onChange={(manager) => {
                setIncidentManager(manager);
                form.handleChange({ incidentManagerId: manager.id });
              }}
            />
            <EntityPicker
              labelKey="incidents.fields.affectedAssets"
              label="Affected assets"
              entityType="asset"
              values={affectedAssets}
              multiple
              onValuesChange={(assets) => {
                setAffectedAssets(assets);
                form.handleChange({ affectedAssetIds: assets.map((asset) => asset.id) });
              }}
            />
            <EntityPicker
              labelKey="incidents.fields.affectedProcesses"
              label="Affected processes"
              entityType="businessProcess"
              values={affectedProcesses}
              multiple
              onValuesChange={(processes) => {
                setAffectedProcesses(processes);
                form.handleChange({ affectedProcessIds: processes.map((process) => process.id) });
              }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.reporterSource')}</label>
              <input type="text" value={form.values.reporterSource} onChange={(e) => form.handleChange({ reporterSource: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.confidentialityImpact')}</label>
              <select value={form.values.confidentialityImpact} onChange={(e) => form.handleChange({ confidentialityImpact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['none', 'low', 'medium', 'high'].map((impact) => <option key={impact} value={impact}>{t(`incidents.impact.${impact}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.integrityImpact')}</label>
              <select value={form.values.integrityImpact} onChange={(e) => form.handleChange({ integrityImpact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['none', 'low', 'medium', 'high'].map((impact) => <option key={impact} value={impact}>{t(`incidents.impact.${impact}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.availabilityImpact')}</label>
              <select value={form.values.availabilityImpact} onChange={(e) => form.handleChange({ availabilityImpact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['none', 'low', 'medium', 'high'].map((impact) => <option key={impact} value={impact}>{t(`incidents.impact.${impact}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.financialImpact')}</label>
              <input type="number" min="0" step="0.01" value={form.values.financialImpact} onChange={(e) => form.handleChange({ financialImpact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.operationalImpact')}</label>
              <textarea rows={2} value={form.values.operationalImpact} onChange={(e) => form.handleChange({ operationalImpact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.legalImpact')}</label>
              <textarea rows={2} value={form.values.legalImpact} onChange={(e) => form.handleChange({ legalImpact: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('incidents.fields.suspectedCause')}</label>
              <textarea rows={2} value={form.values.suspectedCause} onChange={(e) => form.handleChange({ suspectedCause: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.values.personalDataImpact} onChange={(e) => form.handleChange({ personalDataImpact: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t('incidents.fields.personalDataImpact')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.values.isIntentional} onChange={(e) => form.handleChange({ isIntentional: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t('incidents.fields.isIntentional')}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={form.values.hasCrossBorderImpact} onChange={(e) => form.handleChange({ hasCrossBorderImpact: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              {t('incidents.fields.hasCrossBorderImpact')}
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button type="button" onClick={saveIncident} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title={t('incidents.history.title')}>
        <div className="space-y-4">
          {historyError && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              {historyError}
            </div>
          )}

          <div className="flex gap-2">
            <select
              aria-label="Filter by action"
              value={historyActionFilter}
              onChange={(e) => {
                setHistoryActionFilter(e.target.value);
              }}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onBlur={() => {
                if (editingIncident) loadHistoryPage(editingIncident.id, 0);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="CREATE">{t('incidents.history.actions.CREATE')}</option>
              <option value="UPDATE">{t('incidents.history.actions.UPDATE')}</option>
              <option value="DELETE">{t('incidents.history.actions.DELETE')}</option>
              <option value="STATUS_CHANGE">{t('incidents.history.actions.STATUS_CHANGE')}</option>
              <option value="ASSESSMENT">{t('incidents.history.actions.ASSESSMENT')}</option>
              <option value="KNOWLEDGE_TIME_CHANGE">{t('incidents.history.actions.KNOWLEDGE_TIME_CHANGE')}</option>
              <option value="CLOSE">{t('incidents.history.actions.CLOSE')}</option>
              <option value="REOPEN">{t('incidents.history.actions.REOPEN')}</option>
            </select>
          </div>

          {historyLoading ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">{t('incidents.history.loadingHistory')}</div>
          ) : historyEntries.length === 0 ? (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">{t('incidents.history.noHistory')}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-3">
              {historyEntries.map((entry) => {
                // Exclude oldStatus/newStatus from the changes table count and rows since they are already in the summary.
                const visibleFieldChanges = entry.fieldChanges && typeof entry.fieldChanges === 'object'
                  ? Object.fromEntries(Object.entries(entry.fieldChanges).filter(([key]) => !['oldStatus', 'newStatus'].includes(key)))
                  : {};
                const hasVisibleChanges = Object.keys(visibleFieldChanges).length > 0;

                // Resolve actor display name: prefer explicit actorName, fall back to actorId, then "System".
                const actorDisplay = entry.actorName || (entry.actorId ? `User ${entry.actorId}` : 'System');

                return (
                  <div key={entry.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t(`incidents.history.actions.${entry.action}` as any) || entry.action}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2" title={actorDisplay}>
                            by {actorDisplay}
                          </span>
                        </div>
                        {entry.summary && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">{entry.summary}</p>
                        )}
                        {hasVisibleChanges && (
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                const el = document.getElementById(`changes-${entry.id}`);
                                if (el) el.classList.toggle('hidden');
                              }}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {t('incidents.history.changes')} ({Object.keys(visibleFieldChanges).length})
                            </button>
                            <div id={`changes-${entry.id}`} className="hidden mt-2">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="pb-1 font-medium">{t('incidents.history.field')}</th>
                                    <th className="pb-1 font-medium">{t('incidents.history.oldValue')}</th>
                                    <th className="pb-1 font-medium">{t('incidents.history.newValue')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(visibleFieldChanges).map(([field, change], idx) => (
                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-700">
                                      <td className="py-1 text-gray-700 dark:text-gray-300">{field}</td>
                                      <td className="py-1 text-gray-500 dark:text-gray-400">{JSON.stringify((change as { old?: unknown }).old ?? '-')}</td>
                                      <td className="py-1 text-gray-500 dark:text-gray-400">{JSON.stringify((change as { new?: unknown }).new ?? '-')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Modal>

      <DiscardConfirmationDialog
        open={discardConfirmOpen}
        onClose={() => {
          if (pendingClose.current) {
            pendingClose.current();
            pendingClose.current = null;
          }
          setDiscardConfirmOpen(false);
        }}
        onDiscard={() => {
          handleDiscard();
          setDiscardConfirmOpen(false);
        }}
        titleKey="Discard Changes"
        messageKey="You have unsaved changes. Are you sure you want to discard them?"
      />
    </div>
  );
};

export default Incidents;

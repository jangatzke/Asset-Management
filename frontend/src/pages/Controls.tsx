import { useState, useEffect, useCallback, useRef } from 'react';
import { ClockIcon, PencilSquareIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { controlApi, frameworkApi, evidenceApi, catalogApi, adminApi, organizationApi } from '../services/api';
import { getAccessToken } from '../store/accessToken';
import { Modal } from '../components/Modal';
import { DiscardConfirmationDialog } from '../components/DiscardConfirmationDialog';
import { EntityHistoryModal } from '../components/EntityHistoryModal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import { useI18n } from '../context/I18nContext';
import { implementationRiskDisplayRows } from './riskControlWorkflow.utils';
import { getControlStatusColor, getErrorMessage } from '../utils/statusHelpers';
import { useDirtyForm } from '../hooks/useDirtyForm';

interface Control {
  id: string;
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  implementationStatus: string;
  maturityLevel: number;
  applicability: string;
  status: string;
  implementations?: ControlImplementation[];
  requirementMappings?: Array<{ requirement?: { id: string; requirementKey?: string; title: string } }>;
}

interface ControlImplementation {
  id: string;
  implementationStatus?: string;
  maturityLevel?: number;
  implementationDescription?: string;
  responsibleUserId?: string;
  testMethod?: string;
  testFrequency?: string;
  lastTestDate?: string;
  nextTestDate?: string;
  findings?: any[];
  actions?: any[];
  linkedRisks?: any[];
}

interface CatalogOption {
  id: string;
  name: string;
  version?: string;
  itemCount: number;
}

interface IsmsScopeOption {
  id: string;
  name: string;
  version: string;
}

interface CreateControlForm {
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  responsibleId: string;
  applicability: string;
  implementationStatus: string;
  maturityLevel: number;
}

interface ImplementationForm {
  controlId: string;
  organizationUnitId: string;
  responsibleUserId: string;
  implementationStatus: string;
  maturityLevel: number;
  implementationDescription: string;
  testMethod: string;
  testFrequency: string;
}

const initialForm: CreateControlForm = {
  catalogId: '',
  catalogVersion: '',
  title: '',
  description: '',
  controlGoal: '',
  responsibleId: '',
  applicability: '',
  implementationStatus: 'planned',
  maturityLevel: 0,
};

const initialImplementationForm: ImplementationForm = {
  controlId: '',
  organizationUnitId: '',
  responsibleUserId: '',
  implementationStatus: 'planned',
  maturityLevel: 0,
  implementationDescription: '',
  testMethod: '',
  testFrequency: '',
};

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';

const Controls = () => {
  const { t } = useI18n();
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const formState = useDirtyForm<CreateControlForm>(initialForm);
  const [editingControlId, setEditingControlId] = useState<string | null>(null);
  const [frameworkCount, setFrameworkCount] = useState(0);
  const [soaCount, setSoaCount] = useState(0);
  const [soaList, setSoaList] = useState<any[]>([]);
  const [selectedSoAId, setSelectedSoAId] = useState('');
  const [exportingSoA, setExportingSoA] = useState(false);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [ismsScopes, setIsmsScopes] = useState<IsmsScopeOption[]>([]);
  const [selectedSoAScopeId, setSelectedSoAScopeId] = useState('');
  const [generatingSoA, setGeneratingSoA] = useState(false);
  const [soaSuccessMessage, setSoaSuccessMessage] = useState('');
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [implementationModalOpen, setImplementationModalOpen] = useState(false);
  const implementationFormState = useDirtyForm<ImplementationForm>(initialImplementationForm);
  const [expandedImplementationId, setExpandedImplementationId] = useState<string | null>(null);
  const [responsibleUserOption, setResponsibleUserOption] = useState<{ id: string; label: string } | null>(null);
  const [organizationUnitOption, setOrganizationUnitOption] = useState<{ id: string; label: string } | null>(null);
  const [historyControl, setHistoryControl] = useState<Control | null>(null);

  // Dirty guard state for control modal
  const [controlDiscardConfirmOpen, setControlDiscardConfirmOpen] = useState(false);
  const controlPendingClose = useRef<(() => void) | null>(null);

  // Dirty guard state for implementation modal
  const [implementationDiscardConfirmOpen, setImplementationDiscardConfirmOpen] = useState(false);
  const implementationPendingClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadControls();
    loadCatalogOptions();
    loadIsmsScopes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial controls page load only; loaders use current translation fallback for this mount.
  }, []);

  const loadCatalogOptions = async () => {
    try {
      const response = await catalogApi.listOptions();
      setCatalogOptions(response.data || []);
    } catch (err) {
      console.error('Failed to load catalog options:', err);
    }
  };

  const loadIsmsScopes = async () => {
    try {
      const response = await organizationApi.listScopes();
      setIsmsScopes(response.data?.data ?? []);
    } catch (err) {
      console.error('Failed to load ISMS scopes:', err);
    }
  };

  const loadControls = async () => {
    try {
      setLoading(true);
      const response = await controlApi.list({ page: 1, limit: 50 });
      const listedControls = response.data.data || [];
      const implementations = listedControls.flatMap((control: Control) => control.implementations ?? []);
      const riskResults = await Promise.allSettled(implementations.map((impl: ControlImplementation) => controlApi.listImplementationRisks(impl.id)));
      const risksByImplementation: Record<string, any[]> = {};
      riskResults.forEach((result, index) => {
        if (result.status === 'fulfilled') risksByImplementation[implementations[index].id] = result.value.data?.risks ?? [];
      });
      setControls(listedControls.map((control: Control) => ({
        ...control,
        implementations: (control.implementations ?? []).map((impl) => ({ ...impl, linkedRisks: risksByImplementation[impl.id] ?? [] })),
      })));
      const [frameworks, soa, evidence] = await Promise.allSettled([
        frameworkApi.list(),
        controlApi.listSoA(),
        evidenceApi.list(),
      ]);
      if (frameworks.status === 'fulfilled') setFrameworkCount(frameworks.value.data?.length ?? 0);
      if (soa.status === 'fulfilled') {
        const soaItems = soa.value.data ?? [];
        setSoaCount(soaItems.length);
        setSoaList(soaItems);
      }
      if (evidence.status === 'fulfilled') setEvidenceCount(evidence.value.data?.length ?? 0);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('common.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredControls = controls.filter((control) =>
    control.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    control.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const primaryImplementation = (control: Control) => control.implementations?.[0];

  const implementationSummary = (control: Control) => {
    const impl = primaryImplementation(control);
    if (!impl) return t('controls.noImplementation');
    if (impl.implementationStatus === 'implemented' && !impl.lastTestDate) return t('controls.verification.notVerified');
    if (impl.implementationStatus === 'tested' || impl.implementationStatus === 'effective') return t('controls.verification.effectiveTested');
    return t(`controls.implementationStatus.${impl.implementationStatus || 'planned'}`);
  };

  const implementationRiskCount = (control: Control) => (control.implementations ?? []).reduce((sum, impl) => sum + (impl.linkedRisks?.length ?? 0), 0);

  const latestEffectiveness = (risk: any) => t(implementationRiskDisplayRows([risk])[0].effectivenessKey);

  const handleCatalogChange = (catalogId: string) => {
    setSelectedCatalogId(catalogId);
    const catalog = catalogOptions.find(c => c.id === catalogId);
    if (catalog) {
      formState.handleChange({ catalogId: `${catalog.name} - ${catalog.version}`, catalogVersion: catalog.version || '' });
    }
  };

  const handleGenerateIso27001SoA = async () => {
    if (!selectedSoAScopeId || generatingSoA) return;
    try {
      setGeneratingSoA(true);
      setError('');
      setSoaSuccessMessage('');
      const response = await controlApi.generateIso27001AnnexASoA(selectedSoAScopeId);
      const itemCount = response.data?.items?.length ?? 93;
      setSoaSuccessMessage(t('controls.soaGenerator.success').replace('{count}', String(itemCount)));
      await loadControls();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('controls.soaGenerator.generateError'));
    } finally {
      setGeneratingSoA(false);
    }
  };

  const handleExportSoA = async (format: 'csv' | 'html') => {
    if (!selectedSoAId || exportingSoA) return;
    try {
      setExportingSoA(true);
      setError('');
      const token = getAccessToken();
      const response = await fetch(`/api/v1/controls/soa/${selectedSoAId}/export?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `soa-${selectedSoAId.slice(0, 8)}.${format === 'csv' ? 'csv' : 'html'}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('controls.soaGenerator.exportError'));
    } finally {
      setExportingSoA(false);
    }
  };

  const resetControlForm = () => {
    formState.resetForm();
    setSelectedCatalogId('');
    setEditingControlId(null);
  };

  // Dirty guard handlers for control modal
  const handleControlDiscard = useCallback(() => {
    formState.resetForm();
    setModalOpen(false);
  }, [formState]);

  const handleControlModalClose = useCallback(() => {
    if (formState.isDirty) {
      controlPendingClose.current = () => setModalOpen(false);
      setControlDiscardConfirmOpen(true);
    } else {
      setModalOpen(false);
    }
  }, [formState]);

  const handleEditControl = async (control: Control) => {
    try {
      const response = await controlApi.getById(control.id);
      const data = response.data ?? control;
      const catalog = catalogOptions.find((option) => data.catalogId === `${option.name} - ${option.version}` || data.catalogId === option.id || data.catalogId === option.name);
      formState.setFormValues({
        catalogId: data.catalogId || '',
        catalogVersion: data.catalogVersion || catalog?.version || '',
        title: data.title || '',
        description: data.description || '',
        controlGoal: data.controlGoal || '',
        responsibleId: data.responsibleId || '',
        applicability: data.applicability || '',
        implementationStatus: data.implementationStatus || 'planned',
        maturityLevel: data.maturityLevel ?? 0,
      });
      setSelectedCatalogId(catalog?.id ?? '');
      setEditingControlId(control.id);
      setModalOpen(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('controls.loadDetailsError'));
    }
  };

  const handleSubmitControl = async () => {
    if (!formState.values.catalogId || !formState.values.catalogVersion || !formState.values.title || !formState.values.controlGoal) {
      setError(t('common.requiredField'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = formState.values as any;
      if (editingControlId) {
        await controlApi.update(editingControlId, payload);
      } else {
        await controlApi.create(payload);
      }
      setModalOpen(false);
      resetControlForm();
      await loadControls();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || (editingControlId ? t('common.saveError') : t('controls.createError')));
    } finally {
      setSaving(false);
    }
  };

  const openImplementationModal = (control: Control) => {
    implementationFormState.setFormValues({ ...initialImplementationForm, controlId: control.id });
    setResponsibleUserOption(null);
    setOrganizationUnitOption(null);
    setImplementationModalOpen(true);
  };

  // Dirty guard handlers for implementation modal
  const handleImplementationDiscard = useCallback(() => {
    implementationFormState.resetForm();
    setImplementationModalOpen(false);
  }, [implementationFormState]);

  const handleImplementationModalClose = useCallback(() => {
    if (implementationFormState.isDirty) {
      implementationPendingClose.current = () => setImplementationModalOpen(false);
      setImplementationDiscardConfirmOpen(true);
    } else {
      setImplementationModalOpen(false);
    }
  }, [implementationFormState]);

  // Search endpoint for EntitySearchSelect (responsible person)
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

  const searchOrganizationUnits = async (q: string) => {
    try {
      const res = await organizationApi.listUnits({ q, limit: 20 });
      return res.data?.data ?? res.data ?? [];
    } catch { return []; }
  };

  const handleCreateImplementation = async () => {
    const responsibleUserId = responsibleUserOption?.id || implementationFormState.values.responsibleUserId;
    const organizationUnitId = organizationUnitOption?.id || implementationFormState.values.organizationUnitId;
    if (!implementationFormState.values.controlId || !responsibleUserId || !organizationUnitId) {
      setError(t('common.requiredField'));
      return;
    }
    setSaving(true);
    try {
      await controlApi.createImplementation({ ...implementationFormState.values, responsibleUserId, organizationUnitId });
      setImplementationModalOpen(false);
      implementationFormState.resetForm();
      setResponsibleUserOption(null);
      setOrganizationUnitOption(null);
      await loadControls();
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('controls.implementationCreateError'));
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('controls.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('controls.title')}</h1>
        <button
          onClick={() => { resetControlForm(); setModalOpen(true); }}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          {t('controls.newControl')}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">
          {error}
        </div>
      )}

      {soaSuccessMessage && (
        <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 p-3 rounded mb-4" role="status">
          {soaSuccessMessage}
        </div>
      )}

      <section className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4" aria-labelledby="iso27001-soa-generator-title">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="iso27001-soa-generator-title" className="font-semibold text-gray-900 dark:text-white">{t('controls.soaGenerator.title')}</h2>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{t('controls.soaGenerator.description')}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label className="sr-only" htmlFor="iso27001-soa-scope">{t('controls.soaGenerator.scopeLabel')}</label>
            <select
              id="iso27001-soa-scope"
              value={selectedSoAScopeId}
              onChange={(event) => setSelectedSoAScopeId(event.target.value)}
              className="min-w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md"
            >
              <option value="">{t('controls.soaGenerator.scopePlaceholder')}</option>
              {ismsScopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name} (v{scope.version})</option>)}
            </select>
            <button
              type="button"
              onClick={handleGenerateIso27001SoA}
              disabled={!selectedSoAScopeId || generatingSoA}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingSoA ? t('controls.soaGenerator.generating') : t('controls.soaGenerator.generateButton')}
            </button>
          </div>
        </div>
        {soaList.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="sr-only" htmlFor="iso27001-soa-export">{t('controls.soaGenerator.exportTitle')}</label>
            <select
              id="iso27001-soa-export"
              value={selectedSoAId}
              onChange={(event) => setSelectedSoAId(event.target.value)}
              className="min-w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md"
            >
              <option value="">{t('controls.soaGenerator.soaPlaceholder')}</option>
              {soaList.map((soa) => (
                <option key={soa.id} value={soa.id}>
                  {soa.frameworkId} v{soa.frameworkVersion} · {soa.approvalStatus} · {soa.items?.length ?? 0} items
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleExportSoA('csv')}
              disabled={!selectedSoAId || exportingSoA}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingSoA ? t('controls.soaGenerator.exportInProgress') : t('controls.soaGenerator.exportCsv')}
            </button>
            <button
              type="button"
              onClick={() => handleExportSoA('html')}
              disabled={!selectedSoAId || exportingSoA}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingSoA ? t('controls.soaGenerator.exportInProgress') : t('controls.soaGenerator.exportPdf')}
            </button>
          </div>
        )}
      </section>

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('controls.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('controls.stats.frameworkVersions')}</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{frameworkCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('controls.stats.statementsOfApplicability')}</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{soaCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('controls.stats.evidenceItems')}</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">{evidenceCount}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.title')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.controlGoal')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.implementation')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.maturity')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.applicability')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('controls.columns.requirements')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredControls.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  {t('controls.noControls')}
                </td>
              </tr>
            ) : (
              filteredControls.map((control) => (
                <tr key={control.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{control.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{control.controlGoal}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getControlStatusColor(primaryImplementation(control)?.implementationStatus || control.implementationStatus)}`}>
                      {implementationSummary(control)}
                    </span>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('controls.implementationCount').replace('{count}', String(control.implementations?.length ?? 0))}</div>
                    <div className="mt-1 text-xs text-purple-600 dark:text-purple-300">{t('controls.linkedRiskCount').replace('{count}', String(implementationRiskCount(control)))}</div>
                    {(control.implementations ?? []).map((impl) => (
                      <div key={impl.id} className="mt-2 text-xs">
                        <button onClick={() => setExpandedImplementationId(expandedImplementationId === impl.id ? null : impl.id)} className="text-blue-600 dark:text-blue-400">
                          {t('controls.showLinkedRisks').replace('{count}', String(impl.linkedRisks?.length ?? 0))}
                        </button>
                        {expandedImplementationId === impl.id && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded space-y-1">
                            {(impl.linkedRisks ?? []).length === 0 ? <div className="text-gray-500">{t('controls.noLinkedRisks')}</div> : impl.linkedRisks?.map((risk: any) => (
                              <div key={risk.riskControlId} className="border-b border-gray-200 dark:border-gray-700 pb-1 last:border-b-0">
                                <div className="font-medium text-gray-800 dark:text-gray-100">{risk.displayId} {risk.title}</div>
                                <div className="text-gray-500">{t(`risks.controls.roles.${risk.role}`)} · {t(`risks.controls.dimensions.${risk.mitigationDimension}`)} · {t('risks.controls.latestEffectiveness')}: {latestEffectiveness(risk)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{primaryImplementation(control)?.maturityLevel ?? control.maturityLevel ?? 0}/5</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{t(`controls.applicability.${control.applicability}`)}</td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                    {(control.requirementMappings ?? []).slice(0, 2).map((m) => <div key={m.requirement?.id}>{m.requirement?.requirementKey ?? ''} {m.requirement?.title}</div>)}
                    {(control.requirementMappings?.length ?? 0) === 0 && '-'}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditControl(control)} aria-label={`${t('common.edit')}: ${control.title}`} title={t('common.edit')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                        <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      <button onClick={() => openImplementationModal(control)} aria-label={`${t('controls.addImplementation')}: ${control.title}`} title={t('controls.addImplementation')} className={`${actionButtonClassName} text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300`}>
                        <PlusCircleIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      <button onClick={() => setHistoryControl(control)} aria-label={`${t('history.viewHistory')}: ${control.title}`} title={t('history.viewHistory')} className={`${actionButtonClassName} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`}>
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

      {/* Control Modal */}
      <Modal isOpen={modalOpen} onClose={handleControlModalClose} title={editingControlId ? t('controls.editControlTitle') : t('controls.createControl')} isDirty={formState.isDirty && !saving} onDiscardConfirm={handleControlDiscard}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.catalogId')} <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCatalogId}
                onChange={(e) => handleCatalogChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- {t('controls.selectCatalog')} --</option>
                {catalogOptions.map((catalog) => (
                  <option key={catalog.id} value={catalog.id}>
                    {catalog.name} ({catalog.version})
                  </option>
                ))}
              </select>
              <input
                type="hidden"
                value={formState.values.catalogId}
                onChange={(e) => formState.handleChange({ catalogId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.catalogVersion')} <span className="text-red-500">*</span>
              </label>
              <select
                value={formState.values.catalogVersion}
                onChange={(e) => formState.handleChange({ catalogVersion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- {t('controls.selectVersion')} --</option>
                {selectedCatalogId && (
                  <option value={catalogOptions.find(c => c.id === selectedCatalogId)?.version}>
                    {catalogOptions.find(c => c.id === selectedCatalogId)?.version}
                  </option>
                )}
                <option value="2022">2022</option>
                <option value="2.0">2.0</option>
                <option value="2019">2019</option>
                <option value="2017">2017</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.title')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formState.values.title}
              onChange={(e) => formState.handleChange({ title: e.target.value })}
              placeholder={t('controls.fields.title')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.description')}
            </label>
            <textarea
              value={formState.values.description}
              onChange={(e) => formState.handleChange({ description: e.target.value })}
              placeholder={t('controls.fields.description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.controlGoal')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formState.values.controlGoal}
              onChange={(e) => formState.handleChange({ controlGoal: e.target.value })}
              placeholder={t('controls.fields.controlGoal')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.responsibleId')}
              </label>
              <input
                type="text"
                value={formState.values.responsibleId}
                onChange={(e) => formState.handleChange({ responsibleId: e.target.value })}
                placeholder={t('controls.fields.responsibleId')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.applicability')}
              </label>
              <input
                type="text"
                value={formState.values.applicability}
                onChange={(e) => formState.handleChange({ applicability: e.target.value })}
                placeholder={t('controls.fields.applicability')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.implementationStatus')}
              </label>
              <select
                value={formState.values.implementationStatus}
                onChange={(e) => formState.handleChange({ implementationStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planned">{t('controls.implementationStatus.planned')}</option>
                <option value="in_progress">{t('controls.implementationStatus.in_progress')}</option>
                <option value="implemented">{t('controls.implementationStatus.implemented')}</option>
                <option value="under_review">{t('controls.implementationStatus.under_review')}</option>
                <option value="tested">{t('controls.implementationStatus.tested')}</option>
                <option value="effective">{t('controls.implementationStatus.effective')}</option>
                <option value="not_applicable">{t('controls.implementationStatus.not_applicable')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.maturityLevel')}
              </label>
              <select
                value={formState.values.maturityLevel}
                onChange={(e) => formState.handleChange({ maturityLevel: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>{t('controls.maturity.0')}</option>
                <option value={1}>{t('controls.maturity.1')}</option>
                <option value={2}>{t('controls.maturity.2')}</option>
                <option value={3}>{t('controls.maturity.3')}</option>
                <option value={4}>{t('controls.maturity.4')}</option>
                <option value={5}>{t('controls.maturity.5')}</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={handleControlModalClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmitControl}
              disabled={!formState.values.catalogId || !formState.values.catalogVersion || !formState.values.title || !formState.values.controlGoal || saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('common.saving') : (editingControlId ? t('common.update') : t('controls.createControl'))}
            </button>
          </div>
        </div>
      </Modal>

      {/* Implementation Modal */}
      <Modal isOpen={implementationModalOpen} onClose={handleImplementationModalClose} title={t('controls.createImplementation')} isDirty={implementationFormState.isDirty && !saving} onDiscardConfirm={handleImplementationDiscard}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('controls.fields.organizationUnitId')} *</label>
              <EntitySearchSelect
                label={t('controls.fields.organizationUnitId')}
                searchEndpoint={searchOrganizationUnits}
                value={organizationUnitOption}
                onChange={(opt: { id: string; label: string }) => {
                  setOrganizationUnitOption(opt);
                  implementationFormState.handleChange({ organizationUnitId: opt.id });
                }}
                placeholder={t('controls.searchOrganizationUnits') || 'Search organization units...'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('controls.fields.responsibleId')} *</label>
              <EntitySearchSelect
                label={t('controls.fields.responsibleId')}
                searchEndpoint={searchUsers}
                value={responsibleUserOption}
                onChange={(opt: { id: string; label: string }) => setResponsibleUserOption(opt)}
                placeholder={t('controls.searchUsers') || 'Search users...'}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select value={implementationFormState.values.implementationStatus} onChange={(e) => implementationFormState.handleChange({ implementationStatus: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
              <option value="planned">{t('controls.implementationStatus.planned')}</option>
              <option value="in_progress">{t('controls.implementationStatus.in_progress')}</option>
              <option value="implemented">{t('controls.implementationStatus.implemented')}</option>
              <option value="tested">{t('controls.implementationStatus.tested')}</option>
              <option value="effective">{t('controls.implementationStatus.effective')}</option>
            </select>
            <select value={implementationFormState.values.maturityLevel} onChange={(e) => implementationFormState.handleChange({ maturityLevel: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
              {[0,1,2,3,4,5].map((level) => <option key={level} value={level}>{t(`controls.maturity.${level}`)}</option>)}
            </select>
          </div>
          <textarea value={implementationFormState.values.implementationDescription} onChange={(e) => implementationFormState.handleChange({ implementationDescription: e.target.value })} placeholder={t('controls.fields.implementationDescription')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('controls.implementationNotice')}</p>
          <div className="flex justify-end gap-2">
            <button onClick={handleImplementationModalClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">{t('common.cancel')}</button>
            <button onClick={handleCreateImplementation} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">{t('controls.createImplementation')}</button>
          </div>
        </div>
      </Modal>

      <EntityHistoryModal isOpen={!!historyControl} onClose={() => setHistoryControl(null)} entityId={historyControl?.id} entityName={historyControl?.title} loadHistory={controlApi.history} />

      {/* Discard Confirmation Dialog for Control Modal */}
      <DiscardConfirmationDialog
        open={controlDiscardConfirmOpen}
        onClose={() => {
          if (controlPendingClose.current) {
            controlPendingClose.current();
            controlPendingClose.current = null;
          }
          setControlDiscardConfirmOpen(false);
        }}
        onDiscard={handleControlDiscard}
        titleKey="common.discardChangesTitle"
        messageKey="common.discardChangesMessage"
      />

      {/* Discard Confirmation Dialog for Implementation Modal */}
      <DiscardConfirmationDialog
        open={implementationDiscardConfirmOpen}
        onClose={() => {
          if (implementationPendingClose.current) {
            implementationPendingClose.current();
            implementationPendingClose.current = null;
          }
          setImplementationDiscardConfirmOpen(false);
        }}
        onDiscard={handleImplementationDiscard}
        titleKey="common.discardChangesTitle"
        messageKey="common.discardChangesMessage"
      />
    </div>
  );
};

export default Controls;

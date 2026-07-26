import { useState, useEffect } from 'react';
import { controlApi, frameworkApi, evidenceApi, catalogApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useI18n } from '../context/I18nContext';
import { implementationRiskDisplayRows } from './riskControlWorkflow.utils';

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

const Controls = () => {
  const { t } = useI18n();
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateControlForm>(initialForm);
  const [frameworkCount, setFrameworkCount] = useState(0);
  const [soaCount, setSoaCount] = useState(0);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [implementationModalOpen, setImplementationModalOpen] = useState(false);
  const [implementationForm, setImplementationForm] = useState<ImplementationForm>(initialImplementationForm);
  const [expandedImplementationId, setExpandedImplementationId] = useState<string | null>(null);

  useEffect(() => {
    loadControls();
    loadCatalogOptions();
  }, []);

  const loadCatalogOptions = async () => {
    try {
      const response = await catalogApi.listOptions();
      setCatalogOptions(response.data || []);
    } catch (err) {
      console.error('Failed to load catalog options:', err);
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
      if (soa.status === 'fulfilled') setSoaCount(soa.value.data?.length ?? 0);
      if (evidence.status === 'fulfilled') setEvidenceCount(soa.status === 'fulfilled' ? (evidence.value.data?.length ?? 0) : 0);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredControls = controls.filter((control) =>
    control.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    control.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'implemented': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'planned': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'under_review': return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

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
      setForm({ ...form, catalogId: `${catalog.name} - ${catalog.version}`, catalogVersion: catalog.version || '' });
    }
  };

  const handleCreate = async () => {
    if (!form.catalogId || !form.catalogVersion || !form.title || !form.controlGoal) {
      setError(t('common.requiredField'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await controlApi.create(form);
      setModalOpen(false);
      setForm(initialForm);
      setSelectedCatalogId('');
      await loadControls();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('controls.createError'));
    } finally {
      setSaving(false);
    }
  };

  const openImplementationModal = (control: Control) => {
    setImplementationForm({ ...initialImplementationForm, controlId: control.id });
    setImplementationModalOpen(true);
  };

  const handleCreateImplementation = async () => {
    if (!implementationForm.controlId || !implementationForm.responsibleUserId || !implementationForm.organizationUnitId) {
      setError(t('common.requiredField'));
      return;
    }
    setSaving(true);
    try {
      await controlApi.createImplementation(implementationForm);
      setImplementationModalOpen(false);
      setImplementationForm(initialImplementationForm);
      await loadControls();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('controls.implementationCreateError'));
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
          onClick={() => setModalOpen(true)}
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
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(primaryImplementation(control)?.implementationStatus || control.implementationStatus)}`}>
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
                  <td className="px-6 py-4 text-sm"><button onClick={() => openImplementationModal(control)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">{t('controls.addImplementation')}</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('controls.createControl')}>
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
                value={form.catalogId}
                onChange={(e) => setForm({ ...form, catalogId: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('controls.fields.catalogVersion')} <span className="text-red-500">*</span>
              </label>
              <select
                value={form.catalogVersion}
                onChange={(e) => setForm({ ...form, catalogVersion: e.target.value })}
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
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('controls.fields.title')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('controls.fields.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              value={form.controlGoal}
              onChange={(e) => setForm({ ...form, controlGoal: e.target.value })}
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
                value={form.responsibleId}
                onChange={(e) => setForm({ ...form, responsibleId: e.target.value })}
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
                value={form.applicability}
                onChange={(e) => setForm({ ...form, applicability: e.target.value })}
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
                value={form.implementationStatus}
                onChange={(e) => setForm({ ...form, implementationStatus: e.target.value })}
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
                value={form.maturityLevel}
                onChange={(e) => setForm({ ...form, maturityLevel: parseInt(e.target.value) })}
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
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.catalogId || !form.catalogVersion || !form.title || !form.controlGoal || saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('common.saving') : t('controls.createControl')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={implementationModalOpen} onClose={() => setImplementationModalOpen(false)} title={t('controls.createImplementation')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('controls.fields.organizationUnitId')} *</label>
              <input value={implementationForm.organizationUnitId} onChange={(e) => setImplementationForm({ ...implementationForm, organizationUnitId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('controls.fields.responsibleId')} *</label>
              <input value={implementationForm.responsibleUserId} onChange={(e) => setImplementationForm({ ...implementationForm, responsibleUserId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select value={implementationForm.implementationStatus} onChange={(e) => setImplementationForm({ ...implementationForm, implementationStatus: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
              <option value="planned">{t('controls.implementationStatus.planned')}</option>
              <option value="in_progress">{t('controls.implementationStatus.in_progress')}</option>
              <option value="implemented">{t('controls.implementationStatus.implemented')}</option>
              <option value="tested">{t('controls.implementationStatus.tested')}</option>
              <option value="effective">{t('controls.implementationStatus.effective')}</option>
            </select>
            <select value={implementationForm.maturityLevel} onChange={(e) => setImplementationForm({ ...implementationForm, maturityLevel: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
              {[0,1,2,3,4,5].map((level) => <option key={level} value={level}>{t(`controls.maturity.${level}`)}</option>)}
            </select>
          </div>
          <textarea value={implementationForm.implementationDescription} onChange={(e) => setImplementationForm({ ...implementationForm, implementationDescription: e.target.value })} placeholder={t('controls.fields.implementationDescription')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md" />
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('controls.implementationNotice')}</p>
          <div className="flex justify-end gap-2"><button onClick={() => setImplementationModalOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">{t('common.cancel')}</button><button onClick={handleCreateImplementation} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50">{t('controls.createImplementation')}</button></div>
        </div>
      </Modal>
    </div>
  );
};

export default Controls;

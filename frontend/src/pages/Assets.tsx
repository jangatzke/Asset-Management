
import { useState, useEffect } from 'react';
import { assetApi, riskApi, controlApi, contractApi, licenseApi, adminApi } from '../services/api';
import { Modal } from '../components/Modal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import AssetGraph from '../components/AssetGraph';
import AssetImpactAnalysis from '../components/AssetImpactAnalysis';
import { useI18n } from '../context/I18nContext';

interface Asset {
  id: string;
  name: string;
  description?: string;
  displayId: string;
  criticality: string;
  lifecycleStatus: string;
  status: string;
  assetType?: { name: string };
  organizationUnit?: { name: string };
}

interface AssetType {
  id: string;
  name: string;
}

interface EntityOption {
  id: string;
  label: string;
}

interface AssetRelation {
  targetAssetId: string;
  relationType: string;
}

interface CreateAssetForm {
  name: string;
  description: string;
  assetTypeId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  criticality: string;
  lifecycleStatus: string;
  // AST-002 Relations
  organizationUnitId?: EntityOption | null;
  locationId?: EntityOption | null;
  technicalOperatorId?: EntityOption | null;
  businessOwnerId?: EntityOption | null;
  securityResponsibleId?: EntityOption | null;
  contractId?: EntityOption | null;
  licenseId?: EntityOption | null;
  riskIds?: EntityOption[];
  controlIds?: EntityOption[];
  // AST-004 Extended Ratings
  personnelSafetyRelevance: string;
  regulatoryRelevance: string;
  financialDamagePotential: string;
  productionDowntimeImpact: string;
}

const initialForm: CreateAssetForm = {
  name: '',
  description: '',
  assetTypeId: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  criticality: 'low',
  lifecycleStatus: 'planned',
  personnelSafetyRelevance: 'low',
  regulatoryRelevance: 'low',
  financialDamagePotential: 'low',
  productionDowntimeImpact: 'low',
};

const Assets = () => {
  const { t } = useI18n();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateAssetForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Asset detail view state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [detailTab, setDetailTab] = useState<'graph' | 'impact'>('graph');

  // Relations form
  const [newRelationTarget, setNewRelationTarget] = useState<EntityOption | null>(null);
  const [newRelationType, setNewRelationType] = useState('depends_on');
  const [existingRelations, setExistingRelations] = useState<AssetRelation[]>([]);

  useEffect(() => { loadAssets(); loadAssetTypes(); }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await assetApi.list({ page: 1, limit: 50 });
      setAssets(response.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.saveError'));
    } finally { setLoading(false); }
  };

  const loadAssetTypes = async () => {
    try {
      const response = await assetApi.getTypes();
      setAssetTypes(response.data || []);
    } catch { /* Asset types may not exist yet */ }
  };

  // Search endpoint factories for EntitySearchSelect
  const searchAssets = async (q: string) => {
    try {
      const res = await assetApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  const searchRisks = async (q: string) => {
    try {
      const res = await riskApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  const searchControls = async (q: string) => {
    try {
      const res = await controlApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  const searchContracts = async (q: string) => {
    try {
      const res = await contractApi.list({ q, limit: 20 });
      return res.data?.data ?? [];
    } catch { return []; }
  };

  const searchLicenses = async (q: string) => {
    try {
      const res = await licenseApi.list({ q, limit: 20 });
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

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.displayId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!form.name) { setError(t('common.requiredField')); return; }
    if (!form.assetTypeId) { setError(t('common.requiredField')); return; }

    setSaving(true);
    setError('');
    try {
      const payload: any = {
        name: form.name,
        description: form.description,
        assetTypeId: form.assetTypeId,
        manufacturer: form.manufacturer,
        model: form.model,
        serialNumber: form.serialNumber,
        criticality: form.criticality,
        lifecycleStatus: form.lifecycleStatus,
        // Extended ratings
        personnelSafetyRelevance: form.personnelSafetyRelevance,
        regulatoryRelevance: form.regulatoryRelevance,
        financialDamagePotential: form.financialDamagePotential,
        productionDowntimeImpact: form.productionDowntimeImpact,
      };

      if (form.organizationUnitId) payload.organizationUnitId = form.organizationUnitId.id;
      if (form.locationId) payload.locationId = form.locationId.id;
      if (form.technicalOperatorId) payload.technicalOperatorId = form.technicalOperatorId.id;
      if (form.businessOwnerId) payload.businessOwnerId = form.businessOwnerId.id;
      if (form.securityResponsibleId) payload.securityResponsibleId = form.securityResponsibleId.id;
      if (form.contractId) payload.contractId = form.contractId.id;
      if (form.licenseId) payload.licenseId = form.licenseId.id;
      if (form.riskIds?.length) payload.riskIds = form.riskIds.map(r => r.id);
      if (form.controlIds?.length) payload.controlIds = form.controlIds.map(c => c.id);

      if (editingId) {
        await assetApi.update(editingId, payload);
      } else {
        await assetApi.create(payload);
      }
      setModalOpen(false);
      resetForm();
      await loadAssets();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('assets.createSuccess'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (asset: Asset) => {
    try {
      const res = await assetApi.getById(asset.id);
      const data = res.data;
      setForm({
        name: data.name || '',
        description: data.description || '',
        assetTypeId: data.assetTypeId || '',
        manufacturer: data.manufacturer || '',
        model: data.model || '',
        serialNumber: data.serialNumber || '',
        criticality: data.criticality || 'low',
        lifecycleStatus: data.lifecycleStatus || 'planned',
        personnelSafetyRelevance: data.personnelSafetyRelevance || 'low',
        regulatoryRelevance: data.regulatoryRelevance || 'low',
        financialDamagePotential: data.financialDamagePotential || 'low',
        productionDowntimeImpact: data.productionDowntimeImpact || 'low',
      });
      setEditingId(asset.id);
      setModalOpen(true);
    } catch {
      setError('Failed to load asset details');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      await assetApi.delete(id);
      await loadAssets();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const handleViewDetails = (asset: Asset) => {
    setSelectedAsset(asset);
    setDetailTab('graph');
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setNewRelationTarget(null);
    setExistingRelations([]);
  };

  const handleChange = (field: keyof CreateAssetForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Relation management
  const handleAddRelation = async () => {
    if (!newRelationTarget?.id) return;
    try {
      if (editingId) {
        await assetApi.createRelation(editingId, {
          targetAssetId: newRelationTarget.id,
          relationType: newRelationType,
        });
      }
      setExistingRelations(prev => [...prev, {
        targetAssetId: newRelationTarget.id,
        relationType: newRelationType,
      }]);
      setNewRelationTarget(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to add relation');
    }
  };

  if (loading && !selectedAsset) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('assets.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Asset Detail View */}
      {selectedAsset ? (
        <div>
          <button onClick={() => setSelectedAsset(null)} className="mb-4 text-blue-600 hover:text-blue-800">
            ← Back to Assets
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedAsset.name}</h1>
          <p className="text-sm text-gray-500 mb-4">{selectedAsset.displayId}</p>

          {/* Detail Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button onClick={() => setDetailTab('graph')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${detailTab === 'graph' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Dependency Graph
              </button>
              <button onClick={() => setDetailTab('impact')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${detailTab === 'impact' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Impact Analysis
              </button>
            </nav>
          </div>

          {detailTab === 'graph' && <AssetGraph assetId={selectedAsset.id} />}
          {detailTab === 'impact' && <AssetImpactAnalysis assetId={selectedAsset.id} />}
        </div>
      ) : (
        <>
          {/* Asset List */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('assets.title')}</h1>
            <button onClick={() => { resetForm(); setModalOpen(true); }}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
              {t('assets.newAsset')}
            </button>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="mb-4">
            <input type="text" placeholder={t('assets.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.id')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.criticality')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAssets.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('assets.noAssets')}</td></tr>
                ) : filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.displayId}</td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer" onClick={() => handleViewDetails(asset)}>{asset.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.assetType?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        asset.criticality === 'critical' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                        asset.criticality === 'high' ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
                        asset.criticality === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      }`}>
                        {t(`assets.criticality.${asset.criticality}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.status}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={() => handleEdit(asset)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                      <button onClick={() => handleDelete(asset.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Asset' : t('assets.createAsset')}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          {/* Basic Info */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2">Basic Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.name')} *</label>
            <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.description')}</label>
            <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.assetType')} *</label>
              <select value={form.assetTypeId} onChange={(e) => handleChange('assetTypeId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('common.select')}</option>
                {assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.serialNumber')}</label>
              <input type="text" value={form.serialNumber} onChange={(e) => handleChange('serialNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.manufacturer')}</label>
              <input type="text" value={form.manufacturer} onChange={(e) => handleChange('manufacturer', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.model')}</label>
              <input type="text" value={form.model} onChange={(e) => handleChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.criticality')}</label>
              <select value={form.criticality} onChange={(e) => handleChange('criticality', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
                <option value="critical">{t('assets.criticality.critical')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.lifecycleStatus')}</label>
              <select value={form.lifecycleStatus} onChange={(e) => handleChange('lifecycleStatus', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="planned">{t('assets.lifecycleStatus.planned')}</option>
                <option value="procured">{t('assets.lifecycleStatus.procured')}</option>
                <option value="in_use">{t('assets.lifecycleStatus.in_use')}</option>
                <option value="decommissioned">{t('assets.lifecycleStatus.decommissioned')}</option>
                <option value="retired">{t('assets.lifecycleStatus.retired')}</option>
              </select>
            </div>
          </div>

          {/* AST-002: Relations */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">Relations (AST-002)</h3>

          <EntitySearchSelect label="Organization Unit" searchEndpoint={searchUsers} value={form.organizationUnitId}
            onChange={(v) => setForm({ ...form, organizationUnitId: v })} placeholder="Search org units..." />

          <div className="grid grid-cols-2 gap-4">
            <EntitySearchSelect label="Business Owner" searchEndpoint={searchUsers} value={form.businessOwnerId}
              onChange={(v) => setForm({ ...form, businessOwnerId: v })} placeholder="Search users..." />
            <EntitySearchSelect label="Technical Operator" searchEndpoint={searchUsers} value={form.technicalOperatorId}
              onChange={(v) => setForm({ ...form, technicalOperatorId: v })} placeholder="Search users..." />
          </div>

          <EntitySearchSelect label="Security Responsible" searchEndpoint={searchUsers} value={form.securityResponsibleId}
            onChange={(v) => setForm({ ...form, securityResponsibleId: v })} placeholder="Search users..." />

          <div className="grid grid-cols-2 gap-4">
            <EntitySearchSelect label="Contract" searchEndpoint={searchContracts} value={form.contractId}
              onChange={(v) => setForm({ ...form, contractId: v })} placeholder="Search contracts..." />
            <EntitySearchSelect label="License" searchEndpoint={searchLicenses} value={form.licenseId}
              onChange={(v) => setForm({ ...form, licenseId: v })} placeholder="Search licenses..." />
          </div>

          <EntitySearchSelect label="Related Risks" searchEndpoint={searchRisks} values={form.riskIds}
            onValuesChange={(v) => setForm({ ...form, riskIds: v })} multiple placeholder="Search risks..." />

          <EntitySearchSelect label="Related Controls" searchEndpoint={searchControls} values={form.controlIds}
            onValuesChange={(v) => setForm({ ...form, controlIds: v })} multiple placeholder="Search controls..." />

          {/* AST-004: Extended Ratings */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">Extended Ratings (AST-004)</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personnel Safety Relevance</label>
              <select value={form.personnelSafetyRelevance} onChange={(e) => handleChange('personnelSafetyRelevance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Regulatory Relevance</label>
              <select value={form.regulatoryRelevance} onChange={(e) => handleChange('regulatoryRelevance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Financial Damage Potential</label>
              <select value={form.financialDamagePotential} onChange={(e) => handleChange('financialDamagePotential', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Production Downtime Impact</label>
              <select value={form.productionDowntimeImpact} onChange={(e) => handleChange('productionDowntimeImpact', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Asset Relations */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">Asset Relationships</h3>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <EntitySearchSelect label="Target Asset" searchEndpoint={searchAssets} value={newRelationTarget}
                onChange={(v) => setNewRelationTarget(v)} placeholder="Search target asset..." />
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relation Type</label>
              <select value={newRelationType} onChange={(e) => setNewRelationType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="depends_on">Depends On</option>
                <option value="connects_to">Connects To</option>
                <option value="hosts">Hosts</option>
                <option value="uses">Uses</option>
                <option value="protects">Protects</option>
              </select>
            </div>
            <button type="button" onClick={handleAddRelation}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mb-[1px]">Add</button>
          </div>

          {existingRelations.length > 0 && (
            <div className="space-y-1 mt-2">
              {existingRelations.map((rel, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                  <span>{newRelationTarget?.label || rel.targetAssetId} → {rel.relationType}</span>
                  <button onClick={() => setExistingRelations(prev => prev.filter((_, j) => j !== i))} className="text-red-600 hover:text-red-800">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {saving ? t('common.loading') : (editingId ? 'Update' : t('assets.createAsset'))}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Assets;



import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ClockIcon, PencilSquareIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { assetApi, contractApi, licenseApi, adminApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { DiscardConfirmationDialog } from '../components/DiscardConfirmationDialog';
import { EntityHistoryModal } from '../components/EntityHistoryModal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import AssetGraph from '../components/AssetGraph';
import AssetImpactAnalysis from '../components/AssetImpactAnalysis';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/useToast';

interface Asset {
  id: string;
  name: string;
  description?: string;
  displayId: string;
  criticality: string;
  lifecycleStatus: string;
  status: string;
  assetType?: { name: string };
  assetSubtype?: { name: string };
  inventoryNumber?: string;
  organizationUnit?: { name: string };
}

interface AssetType {
  id: string;
  name: string;
  inventoryEnabled?: boolean;
  inventoryPattern?: string;
  subtypes?: AssetSubtype[];
}

interface AssetSubtype {
  id: string;
  name: string;
  inventoryEnabled?: boolean | null;
  inventoryPattern?: string | null;
}

interface EntityOption {
  id: string;
  label: string;
}

interface AssetRelation {
  targetAssetId: string;
  relationshipType: string;
  targetLabel?: string;
}

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';
const PAGE_SIZE = 50;
const messageFrom = (error: any, fallback: string) =>
  error?.response?.data?.error?.message ?? error?.response?.data?.error ?? error?.message ?? fallback;

interface CreateAssetForm {
  name: string;
  description: string;
  assetTypeId: string;
  assetSubtypeId: string;
  inventoryNumber: string;
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
  assetSubtypeId: '',
  inventoryNumber: '',
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
  const location = useLocation();
  const { t } = useI18n();
  const { addToast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 1 });
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useDirtyForm<CreateAssetForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const pendingClose = useRef<(() => void) | null>(null);
  // Guard against out-of-order / stale list responses (same pattern as ISMS Phase 6):
  // only the most recent request may update state, all others are discarded.
  const latestRequestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);

  // Asset detail view state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [graphViewerAsset, setGraphViewerAsset] = useState<Asset | null>(null);
  const [detailTab, setDetailTab] = useState<'graph' | 'impact'>('graph');

  // Relations form
  const [newRelationTarget, setNewRelationTarget] = useState<EntityOption | null>(null);
  const [newRelationType, setNewRelationType] = useState('depends_on');
  const [existingRelations, setExistingRelations] = useState<AssetRelation[]>([]);

  useEffect(() => { loadAssetTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial asset-type load only; the fetch effect handles the initial asset page load.
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editAssetId = params.get('editAsset');
    if (editAssetId && assets.length > 0) {
      const asset = assets.find((a) => a.id === editAssetId);
      if (asset) {
        handleEdit(asset);
        // Clean up the query parameter from the URL
        params.delete('editAsset');
        const newUrl = params.toString() ? `?${params.toString()}` : '';
        window.history.replaceState(null, '', newUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only trigger after assets are loaded.
  }, [loading, assets.length]);

  const handleDiscard = useCallback(() => {
    form.resetForm();
    setEditingId(null);
    setModalOpen(false);
    setExistingRelations([]);
  }, [form]);

  const handleModalClose = useCallback(() => {
    if (form.isDirty) {
      pendingClose.current = () => setModalOpen(false);
      setDiscardConfirmOpen(true);
    } else {
      setModalOpen(false);
    }
  }, [form]);

  const loadAssets = useCallback(async (overrides?: { page?: number; search?: string; assetTypeId?: string; criticality?: string; lifecycleStatus?: string }) => {
    // Cancel any in-flight request and mark this one as the latest.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const isStale = () => requestId !== latestRequestId.current;

    try {
      setLoading(true);
      const params: any = {
        page: overrides?.page ?? 1,
        limit: PAGE_SIZE,
        search: overrides?.search || undefined,
        assetTypeId: overrides?.assetTypeId || undefined,
        criticality: overrides?.criticality || undefined,
        lifecycleStatus: overrides?.lifecycleStatus || undefined,
      };
      const response = await assetApi.list(params, { signal: controller.signal });
      if (isStale()) return;
      setAssets(response.data?.data || []);
      const paginationData = response.data?.pagination;
      if (paginationData) {
        setPagination({ total: paginationData.total ?? 0, totalPages: paginationData.totalPages ?? 1 });
      }
    } catch (err: any) {
      if (isStale()) return;
      // Aborted requests (superseded or unmount) are silent by design.
      if (err?.name === 'CanceledError' || controller.signal.aborted) return;
      const message = messageFrom(err, t('common.saveError'));
      setError(message);
      addToast('error', message);
    } finally {
      if (!isStale() && !controller.signal.aborted) setLoading(false);
    }
  }, [t, addToast]);

  // Single refresh path used after create/update/delete: re-runs the *current*
  // query (page, search, filters) instead of resetting to unfiltered page 1.
  const refreshCurrentQuery = useCallback(async () => {
    await loadAssets({
      page,
      search: debouncedSearch,
      assetTypeId: filterType,
      criticality: filterCriticality,
      lifecycleStatus: filterStatus,
    });
  }, [loadAssets, page, debouncedSearch, filterType, filterCriticality, filterStatus]);

  // Abort any in-flight request when the page unmounts.
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const loadAssetTypes = async () => {
    try {
      const response = await assetApi.getTypes();
      setAssetTypes(response.data || []);
    } catch { /* Asset types may not exist yet */ }
  };

  // Search endpoint factories for EntitySearchSelect
  const searchAssets = async (q: string) => {
    try {
      const res = await assetApi.list({ search: q, limit: 20 });
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

  // Debounce the search input before hitting the server
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterType, filterCriticality, filterStatus]);

  // Fetch the current page from the server whenever the query changes
  useEffect(() => {
    void refreshCurrentQuery();
  }, [refreshCurrentQuery]);

  const selectedType = assetTypes.find((type) => type.id === form.values.assetTypeId);
  const selectedSubtype = selectedType?.subtypes?.find((subtype) => subtype.id === form.values.assetSubtypeId);

  const handleGenerateInventory = async () => {
    if (!form.values.assetTypeId) { setError(t('assets.inventory.selectTypeFirst')); return; }
    try {
      const res = await assetApi.previewInventoryNumber(form.values.assetTypeId, form.values.assetSubtypeId || undefined);
      form.handleChange({ inventoryNumber: res.data?.inventoryNumber ?? res.data?.nextInventoryNumber ?? res.data?.preview ?? '' });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('assets.inventory.previewError'));
    }
  };

  const handleSubmit = useCallback(async () => {
    const v = form.values;
    if (!v.name) { setError(t('common.requiredField')); return; }
    if (!v.assetTypeId) { setError(t('common.requiredField')); return; }

    setSaving(true);
    setError('');
    try {
      const payload: any = {
        name: v.name,
        description: v.description,
        assetTypeId: v.assetTypeId,
        assetSubtypeId: v.assetSubtypeId || undefined,
        inventoryNumber: v.inventoryNumber || undefined,
        manufacturer: v.manufacturer,
        model: v.model,
        serialNumber: v.serialNumber,
        criticality: v.criticality,
        lifecycleStatus: v.lifecycleStatus,
        // Extended ratings
        personnelSafetyRelevance: v.personnelSafetyRelevance,
        regulatoryRelevance: v.regulatoryRelevance,
        financialDamagePotential: v.financialDamagePotential,
        productionDowntimeImpact: v.productionDowntimeImpact,
      };

      if (v.organizationUnitId) payload.organizationUnitId = v.organizationUnitId.id;
      if (v.locationId) payload.locationId = v.locationId.id;
      if (v.technicalOperatorId) payload.technicalOperatorId = v.technicalOperatorId.id;
      if (v.businessOwnerId) payload.businessOwnerId = v.businessOwnerId.id;
      if (v.securityResponsibleId) payload.informationSecurityResponsibleId = v.securityResponsibleId.id;
      if (v.contractId) payload.contractIds = [v.contractId.id];
      if (v.licenseId) payload.licenseIds = [v.licenseId.id];
      payload.assetRelations = existingRelations.map((relation) => ({
        targetAssetId: relation.targetAssetId,
        relationshipType: relation.relationshipType,
      }));

      if (editingId) {
        await assetApi.update(editingId, payload);
      } else {
        await assetApi.create(payload);
      }
      setModalOpen(false);
      form.resetForm();
      setExistingRelations([]);
      addToast('success', editingId ? t('assets.updateSuccess') : t('assets.createSuccess'));
      await refreshCurrentQuery();
    } catch (err: any) {
      const message = messageFrom(err, t('common.saveError'));
      setError(message);
      addToast('error', message);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, existingRelations, t, addToast, refreshCurrentQuery]);

  const handleEdit = useCallback(async (asset: Asset) => {
      const openEditor = (data: any) => {
        const contractLink = data.contractLinks?.[0];
        const licenseLink = data.licenseLinks?.[0];
        const sourceRelations = (data.sourceRelations ?? []).map((relation: any) => ({
          targetAssetId: relation.targetAssetId,
          relationshipType: relation.relationshipType,
          targetLabel: relation.targetAsset?.name || relation.targetAsset?.displayId || relation.targetAssetId,
        }));

        form.setFormValues({
        name: data.name || '',
        description: data.description || '',
        assetTypeId: data.assetTypeId || data.assetType?.id || '',
        assetSubtypeId: data.assetSubtypeId || data.assetSubtype?.id || '',
        inventoryNumber: data.inventoryNumber || '',
        manufacturer: data.manufacturer || '',
        model: data.model || '',
        serialNumber: data.serialNumber || '',
        criticality: data.criticality || 'low',
        lifecycleStatus: data.lifecycleStatus || 'planned',
        personnelSafetyRelevance: data.personnelSafetyRelevance || 'low',
        regulatoryRelevance: data.regulatoryRelevance || 'low',
        financialDamagePotential: data.financialDamagePotential || 'low',
        productionDowntimeImpact: data.productionDowntimeImpact || 'low',
        organizationUnitId: data.organizationUnitId ? { id: data.organizationUnitId, label: data.organizationUnit?.name || data.organizationUnitId } : null,
        locationId: data.locationId ? { id: data.locationId, label: data.location?.name || data.location?.address || data.locationId } : null,
        technicalOperatorId: data.technicalOperatorId ? { id: data.technicalOperatorId, label: data.technicalOperator?.name || data.technicalOperator?.email || data.technicalOperatorId } : null,
        businessOwnerId: data.businessOwnerId ? { id: data.businessOwnerId, label: data.businessOwner?.name || data.businessOwner?.email || data.businessOwnerId } : null,
        securityResponsibleId: data.informationSecurityResponsibleId ? { id: data.informationSecurityResponsibleId, label: data.informationSecurityResponsible?.name || data.informationSecurityResponsible?.email || data.informationSecurityResponsibleId } : null,
        contractId: contractLink?.contractId ? { id: contractLink.contractId, label: contractLink.contract?.contractNumber || contractLink.contract?.title || contractLink.contractId } : null,
        licenseId: licenseLink?.licenseId ? { id: licenseLink.licenseId, label: licenseLink.license?.licenseNumber || licenseLink.license?.title || licenseLink.licenseId } : null,
        });
        setExistingRelations(sourceRelations);
        setEditingId(asset.id);
        setModalOpen(true);
      };

    try {
      setError('');
      // Ensure asset types are loaded before opening the edit modal
      await loadAssetTypes();

      const res = await assetApi.getById(asset.id);
      openEditor(res.data);
    } catch (err: any) {
      console.error('Failed to load asset details for editing:', err);
      const message = messageFrom(err, t('assets.loadDetailsError'));
      setError(message);
      addToast('error', message);
    }
  }, [form, t, addToast]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('assets.deleteConfirm'))) return;
    try {
      await assetApi.delete(id);
      addToast('success', t('assets.deleteSuccess'));
      await refreshCurrentQuery();
    } catch (err: any) {
      const message = messageFrom(err, t('common.deleteError'));
      setError(message);
      addToast('error', message);
    }
  };

  const handleViewDetails = (asset: Asset) => {
    setSelectedAsset(asset);
    setDetailTab('graph');
  };

  const resetForm = useCallback(() => {
    form.resetForm();
    setEditingId(null);
    setNewRelationTarget(null);
    setExistingRelations([]);
  }, [form]);

  // Relation management
  const handleAddRelation = async () => {
    if (!newRelationTarget?.id) return;
    if (editingId && newRelationTarget.id === editingId) {
      setError(t('assets.addRelationError'));
      return;
    }

    setExistingRelations(prev => {
      const withoutDuplicate = prev.filter((relation) =>
        !(relation.targetAssetId === newRelationTarget.id && relation.relationshipType === newRelationType)
      );
      return [...withoutDuplicate, {
        targetAssetId: newRelationTarget.id,
        relationshipType: newRelationType,
        targetLabel: newRelationTarget.label,
      }];
    });
    setNewRelationTarget(null);
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
            {t('assets.backToAssets')}
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedAsset.name}</h1>
          <p className="text-sm text-gray-500 mb-4">{selectedAsset.displayId}</p>

          {/* Detail Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button onClick={() => setDetailTab('graph')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${detailTab === 'graph' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t('assets.dependencyGraph')}
              </button>
              <button onClick={() => setDetailTab('impact')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${detailTab === 'impact' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t('assets.impactAnalysis')}
              </button>
            </nav>
          </div>

          {detailTab === 'graph' && <AssetGraph assetId={selectedAsset.id} fallbackNode={{ id: selectedAsset.id, name: selectedAsset.name, displayId: selectedAsset.displayId, type: selectedAsset.assetType?.name, criticality: selectedAsset.criticality }} />}
          {detailTab === 'impact' && <AssetImpactAnalysis assetId={selectedAsset.id} />}
        </div>
      ) : (
        <>
          {/* Asset List */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('assets.title')}</h1>
            <button onClick={() => { resetForm(); form.setFormValues(initialForm); setModalOpen(true); }}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
              {t('assets.newAsset')}
            </button>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder={t('assets.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label={t('assets.fields.assetType')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('common.all')} {t('assets.fields.assetType')}</option>
                {assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <select value={filterCriticality} onChange={(e) => setFilterCriticality(e.target.value)} aria-label={t('assets.fields.criticality')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('common.all')} {t('assets.fields.criticality')}</option>
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
                <option value="critical">{t('assets.criticality.critical')}</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label={t('assets.fields.lifecycleStatus')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('common.all')} {t('assets.fields.lifecycleStatus')}</option>
                <option value="planned">{t('assets.lifecycleStatus.planned')}</option>
                <option value="ordered">{t('assets.lifecycleStatus.ordered')}</option>
                <option value="in_stock">{t('assets.lifecycleStatus.in_stock')}</option>
                <option value="active">{t('assets.lifecycleStatus.active')}</option>
                <option value="maintenance">{t('assets.lifecycleStatus.maintenance')}</option>
                <option value="isolated">{t('assets.lifecycleStatus.isolated')}</option>
                <option value="decommissioned">{t('assets.lifecycleStatus.decommissioned')}</option>
                <option value="disposed">{t('assets.lifecycleStatus.disposed')}</option>
                <option value="destroyed">{t('assets.lifecycleStatus.destroyed')}</option>
                <option value="lost">{t('assets.lifecycleStatus.lost')}</option>
                <option value="unknown">{t('assets.lifecycleStatus.unknown')}</option>
              </select>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{pagination.total} {t('assets.results')}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.id')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.inventoryNumber')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.subtype')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.criticality')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('assets.columns.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {assets.length === 0 ? (
                   <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('assets.noAssets')}</td></tr>
                ) : assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.displayId}</td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer" onClick={() => handleViewDetails(asset)}>{asset.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.inventoryNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.assetType?.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{asset.assetSubtype?.name || '-'}</td>
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
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(asset)} aria-label={`${t('common.edit')}: ${asset.name}`} title={t('common.edit')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                          <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                        </button>
                        <button onClick={() => setGraphViewerAsset(asset)} aria-label={`${t('assets.openTreeViewer')}: ${asset.name}`} title={t('assets.openTreeViewer')} className={`${actionButtonClassName} text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300`}>
                          <ShareIcon aria-hidden="true" className={actionIconClassName} />
                        </button>
                        <button onClick={() => setHistoryAsset(asset)} aria-label={`${t('history.viewHistory')}: ${asset.name}`} title={t('history.viewHistory')} className={`${actionButtonClassName} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`}>
                          <ClockIcon aria-hidden="true" className={actionIconClassName} />
                        </button>
                        <button onClick={() => handleDelete(asset.id)} aria-label={`${t('common.delete')}: ${asset.name}`} title={t('common.delete')} className={`${actionButtonClassName} text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300`}>
                          <TrashIcon aria-hidden="true" className={actionIconClassName} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {t('common.back')}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={handleModalClose} title={editingId ? t('assets.editAsset') : t('assets.createAsset')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          {/* Basic Info */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2">{t('assets.basicInformation')}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.name')} *</label>
            <input type="text" value={form.values.name} onChange={(e) => form.handleChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.description')}</label>
            <textarea value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.assetType')} *</label>
              <select value={form.values.assetTypeId} onChange={(e) => form.handleChange({ assetTypeId: e.target.value, assetSubtypeId: '', inventoryNumber: '' } as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('common.select')}</option>
                {assetTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.assetSubtype')}</label>
              <select value={form.values.assetSubtypeId} onChange={(e) => form.handleChange({ assetSubtypeId: e.target.value, inventoryNumber: '' } as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('assets.noSubtype')}</option>
                {(selectedType?.subtypes ?? []).map((subtype) => <option key={subtype.id} value={subtype.id}>{subtype.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.inventoryNumber')}</label>
              <input type="text" value={form.values.inventoryNumber} onChange={(e) => form.handleChange({ inventoryNumber: e.target.value })} placeholder={t('assets.inventory.manualPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedSubtype?.inventoryPattern || selectedType?.inventoryPattern || t('assets.inventory.noPattern')}</p>
            </div>
            <button type="button" onClick={handleGenerateInventory} className="self-end px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">{t('assets.inventory.generateNext')}</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.serialNumber')}</label>
            <input type="text" value={form.values.serialNumber} onChange={(e) => form.handleChange({ serialNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.manufacturer')}</label>
              <input type="text" value={form.values.manufacturer} onChange={(e) => form.handleChange({ manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.model')}</label>
              <input type="text" value={form.values.model} onChange={(e) => form.handleChange({ model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.criticality')}</label>
              <select value={form.values.criticality} onChange={(e) => form.handleChange({ criticality: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
                <option value="critical">{t('assets.criticality.critical')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.fields.lifecycleStatus')}</label>
              <select value={form.values.lifecycleStatus} onChange={(e) => form.handleChange({ lifecycleStatus: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="planned">{t('assets.lifecycleStatus.planned')}</option>
                <option value="ordered">{t('assets.lifecycleStatus.ordered')}</option>
                <option value="in_stock">{t('assets.lifecycleStatus.in_stock')}</option>
                <option value="active">{t('assets.lifecycleStatus.active')}</option>
                <option value="maintenance">{t('assets.lifecycleStatus.maintenance')}</option>
                <option value="isolated">{t('assets.lifecycleStatus.isolated')}</option>
                <option value="decommissioned">{t('assets.lifecycleStatus.decommissioned')}</option>
                <option value="disposed">{t('assets.lifecycleStatus.disposed')}</option>
                <option value="destroyed">{t('assets.lifecycleStatus.destroyed')}</option>
                <option value="lost">{t('assets.lifecycleStatus.lost')}</option>
                <option value="unknown">{t('assets.lifecycleStatus.unknown')}</option>
              </select>
            </div>
          </div>

          {/* AST-002: Relations */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">{t('assets.relations')}</h3>

          <EntitySearchSelect label={t('assets.organizationUnit')} searchEndpoint={searchUsers} value={form.values.organizationUnitId}
            onChange={(v) => form.handleChange({ organizationUnitId: v })} placeholder={t('assets.searchOrgUnits')} />

          <div className="grid grid-cols-2 gap-4">
            <EntitySearchSelect label={t('assets.businessOwner')} searchEndpoint={searchUsers} value={form.values.businessOwnerId}
              onChange={(v) => form.handleChange({ businessOwnerId: v })} placeholder={t('assets.searchUsers')} />
            <EntitySearchSelect label={t('assets.technicalOperator')} searchEndpoint={searchUsers} value={form.values.technicalOperatorId}
              onChange={(v) => form.handleChange({ technicalOperatorId: v })} placeholder={t('assets.searchUsers')} />
          </div>

          <EntitySearchSelect label={t('assets.securityResponsible')} searchEndpoint={searchUsers} value={form.values.securityResponsibleId}
            onChange={(v) => form.handleChange({ securityResponsibleId: v })} placeholder={t('assets.searchUsers')} />

          <div className="grid grid-cols-2 gap-4">
            <EntitySearchSelect label={t('assets.contract')} searchEndpoint={searchContracts} value={form.values.contractId}
              onChange={(v) => form.handleChange({ contractId: v })} placeholder={t('assets.searchContracts')} />
            <EntitySearchSelect label={t('assets.license')} searchEndpoint={searchLicenses} value={form.values.licenseId}
              onChange={(v) => form.handleChange({ licenseId: v })} placeholder={t('assets.searchLicenses')} />
          </div>

          {/* AST-004: Extended Ratings */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">{t('assets.extendedRatings')}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.personnelSafetyRelevance')}</label>
              <select value={form.values.personnelSafetyRelevance} onChange={(e) => form.handleChange({ personnelSafetyRelevance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.regulatoryRelevance')}</label>
              <select value={form.values.regulatoryRelevance} onChange={(e) => form.handleChange({ regulatoryRelevance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.financialDamagePotential')}</label>
              <select value={form.values.financialDamagePotential} onChange={(e) => form.handleChange({ financialDamagePotential: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.productionDowntimeImpact')}</label>
              <select value={form.values.productionDowntimeImpact} onChange={(e) => form.handleChange({ productionDowntimeImpact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('assets.criticality.low')}</option>
                <option value="medium">{t('assets.criticality.medium')}</option>
                <option value="high">{t('assets.criticality.high')}</option>
              </select>
            </div>
          </div>

          {/* Asset Relations */}
          <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mt-6">{t('assets.assetRelationships')}</h3>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <EntitySearchSelect label={t('assets.targetAsset')} searchEndpoint={searchAssets} value={newRelationTarget}
                onChange={(v) => setNewRelationTarget(v)} placeholder={t('assets.searchTargetAsset')} />
            </div>
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assets.relationType')}</label>
              <select value={newRelationType} onChange={(e) => setNewRelationType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="depends_on">{t('assets.relationTypes.depends_on')}</option>
                <option value="connects_to">{t('assets.relationTypes.connects_to')}</option>
                <option value="hosts">{t('assets.relationTypes.hosts')}</option>
                <option value="uses">{t('assets.relationTypes.uses')}</option>
                <option value="protects">{t('assets.relationTypes.protects')}</option>
              </select>
            </div>
            <button type="button" onClick={handleAddRelation}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mb-[1px]">{t('common.add')}</button>
          </div>

          {existingRelations.length > 0 && (
            <div className="space-y-1 mt-2">
              {existingRelations.map((rel, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                  <span>{rel.targetLabel || rel.targetAssetId} → {rel.relationshipType}</span>
                  <button onClick={() => setExistingRelations(prev => prev.filter((_, j) => j !== i))} className="text-red-600 hover:text-red-800">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {saving ? t('common.loading') : (editingId ? t('common.update') : t('assets.createAsset'))}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!graphViewerAsset} onClose={() => setGraphViewerAsset(null)} title={graphViewerAsset ? `${t('assets.assetTreeViewer')}: ${graphViewerAsset.name}` : t('assets.assetTreeViewer')} maxWidthClassName="max-w-[96vw]" maxHeightClassName="max-h-[95vh]">
        {graphViewerAsset && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('assets.assetTreeViewerDescription')}
            </p>
            <AssetGraph assetId={graphViewerAsset.id} fallbackNode={{ id: graphViewerAsset.id, name: graphViewerAsset.name, displayId: graphViewerAsset.displayId, type: graphViewerAsset.assetType?.name, criticality: graphViewerAsset.criticality }} focusAssetId={graphViewerAsset.id} heightClassName="h-[44rem]" height="704px" />
          </div>
        )}
      </Modal>

      <EntityHistoryModal isOpen={!!historyAsset} onClose={() => setHistoryAsset(null)} entityId={historyAsset?.id} entityName={historyAsset?.name} loadHistory={assetApi.history} />

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

export default Assets;


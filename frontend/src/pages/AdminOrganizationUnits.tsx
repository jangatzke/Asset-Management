import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../services/api';
import { Modal } from '../components/Modal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import { useI18n } from '../context/I18nContext';
import { useDirtyForm } from '../hooks/useDirtyForm';

interface OrganizationUnit {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  type?: string | null;
  isArchived: boolean;
  _count?: {
    children?: number;
    users?: number;
    assets?: number;
    risks?: number;
    controlImplementations?: number;
  };
}

interface OrganizationUnitForm {
  name: string;
  description: string;
  parentId: string;
  type: string;
}

const initialForm: OrganizationUnitForm = {
  name: '',
  description: '',
  parentId: '',
  type: '',
};

const AdminOrganizationUnits = () => {
  const { t } = useI18n();
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnit | null>(null);
  const form = useDirtyForm<OrganizationUnitForm>({ ...initialForm });
  const [parentOption, setParentOption] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reload when archive filter changes.
  }, [includeArchived]);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const response = await adminApi.listOrganizationUnits(includeArchived);
      setUnits(response.data?.data ?? response.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('organizationUnits.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = useMemo(() => units.filter((unit) => {
    const term = searchTerm.toLowerCase();
    return unit.name.toLowerCase().includes(term) || (unit.description || '').toLowerCase().includes(term) || (unit.type || '').toLowerCase().includes(term);
  }), [searchTerm, units]);

  const searchParentUnits = async (q: string) => {
    try {
      const response = await adminApi.searchOrganizationUnits(q, 20);
      return (response.data?.data ?? response.data ?? []).filter((unit: any) => unit.id !== editingUnit?.id);
    } catch { return []; }
  };

  const openCreateModal = () => {
    setEditingUnit(null);
    form.setFormValues({ ...initialForm });
    setParentOption(null);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (unit: OrganizationUnit) => {
    setEditingUnit(unit);
    form.setFormValues({ name: unit.name, description: unit.description || '', parentId: unit.parentId || '', type: unit.type || '' });
    setParentOption(unit.parent ? { id: unit.parent.id, label: unit.parent.name } : null);
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.values.name.trim()) {
      setError(t('organizationUnits.nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.values.name.trim(),
        description: form.values.description.trim() || undefined,
        parentId: parentOption?.id || undefined,
        type: form.values.type.trim() || undefined,
      };
      if (editingUnit) {
        await adminApi.updateOrganizationUnit(editingUnit.id, payload);
        setSuccess(t('organizationUnits.updateSuccess'));
      } else {
        await adminApi.createOrganizationUnit(payload);
        setSuccess(t('organizationUnits.createSuccess'));
      }
      setModalOpen(false);
      setSaving(false);
      await loadUnits();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('organizationUnits.saveError'));
      setSaving(false);
    } finally {
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleArchive = async (unit: OrganizationUnit) => {
    if (!confirm(t('organizationUnits.archiveConfirm'))) return;
    try {
      await adminApi.archiveOrganizationUnit(unit.id);
      setSuccess(t('organizationUnits.archiveSuccess'));
      await loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('organizationUnits.archiveError'));
    }
  };

  const handleRestore = async (unit: OrganizationUnit) => {
    try {
      await adminApi.restoreOrganizationUnit(unit.id);
      setSuccess(t('organizationUnits.restoreSuccess'));
      await loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('organizationUnits.restoreError'));
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleDiscard = () => {
    form.resetForm();
    setParentOption(null);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('organizationUnits.title')}</h1>
        <button onClick={openCreateModal} className="bg-primary-600 dark:bg-primary-500 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 dark:hover:bg-primary-600">
          {t('organizationUnits.newUnit')}
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-md">{success}</div>}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-3 md:items-center">
          <input type="text" placeholder={t('organizationUnits.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            {t('organizationUnits.includeArchived')}
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('organizationUnits.loading')}</div>
        ) : filteredUnits.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('organizationUnits.noUnits')}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUnits.map((unit) => (
              <div key={unit.id} className={`p-4 ${unit.isArchived ? 'bg-gray-50 dark:bg-gray-900 opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-gray-900 dark:text-white truncate">{unit.name}</h2>
                      {unit.isArchived && <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">{t('organizationUnits.archived')}</span>}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{unit.type || t('organizationUnits.noType')} · {t('organizationUnits.parent')}: {unit.parent?.name || '-'}</div>
                    {unit.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{unit.description}</p>}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {t('organizationUnits.children')}: {unit._count?.children ?? 0} · {t('organizationUnits.users')}: {unit._count?.users ?? 0} · {t('organizationUnits.assets')}: {unit._count?.assets ?? 0} · {t('organizationUnits.risks')}: {unit._count?.risks ?? 0} · {t('organizationUnits.implementations')}: {unit._count?.controlImplementations ?? 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    {!unit.isArchived && <button onClick={() => openEditModal(unit)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300">{t('common.edit')}</button>}
                    {unit.isArchived ? <button onClick={() => handleRestore(unit)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">{t('organizationUnits.restore')}</button> : <button onClick={() => handleArchive(unit)} className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300">{t('organizationUnits.archive')}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={handleModalClose} title={editingUnit ? t('organizationUnits.editUnit') : t('organizationUnits.newUnit')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
            <input value={form.values.name} onChange={(e) => form.handleChange({ name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('organizationUnits.type')}</label>
            <input value={form.values.type} onChange={(e) => form.handleChange({ type: e.target.value })} placeholder={t('organizationUnits.typePlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('organizationUnits.parent')}</label>
            <EntitySearchSelect label={t('organizationUnits.parent')} searchEndpoint={searchParentUnits} value={parentOption} onChange={setParentOption} placeholder={t('organizationUnits.searchParentPlaceholder')} />
            {parentOption && <button onClick={() => setParentOption(null)} className="mt-2 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">{t('organizationUnits.clearParent')}</button>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('organizationUnits.description')}</label>
            <textarea value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">{t('common.cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50">{saving ? t('common.saving') : editingUnit ? t('common.update') : t('common.create')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminOrganizationUnits;

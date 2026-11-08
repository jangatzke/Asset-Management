import { useState, useEffect } from 'react';
import { adminApi, assetApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useI18n } from '../context/I18nContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { formatApiError } from '../utils/apiError';

interface AssetType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isArchived: boolean;
  inventoryEnabled?: boolean;
  inventoryPattern?: string | null;
  subtypes?: AssetSubtype[];
  createdAt: string;
  updatedAt: string;
}

interface AssetSubtype {
  id: string;
  name: string;
  description?: string | null;
  inventoryEnabled?: boolean | null;
  inventoryPattern?: string | null;
}

interface AssetTypeForm {
  name: string;
  description: string;
  category: string;
  inventoryEnabled: boolean;
  inventoryPattern: string;
}

const initialForm: AssetTypeForm = {
  name: '',
  description: '',
  category: '',
  inventoryEnabled: true,
  inventoryPattern: 'AST-{YYYY}-{SEQ4}',
};

interface SubtypeForm {
  name: string;
  description: string;
  inventoryEnabled: boolean;
  inventoryPattern: string;
}

const initialSubtypeForm: SubtypeForm = { name: '', description: '', inventoryEnabled: true, inventoryPattern: '' };

const categories = [
  'Hardware',
  'Software',
  'Network',
  'Cloud',
  'Security',
  'Application',
  'Data',
  'Service',
  'Physical',
  'Other',
];

const AdminAssetTypes = () => {
  const { t } = useI18n();
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Deletion confirmation owned by the styled ConfirmDialog (replaces the native browser dialog).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssetType | null>(null);
  const [saving, setSaving] = useState(false);
  const [subtypeModalOpen, setSubtypeModalOpen] = useState(false);
  const [subtypeParent, setSubtypeParent] = useState<AssetType | null>(null);

  const form = useDirtyForm<AssetTypeForm>(initialForm);
  const subtypeForm = useDirtyForm<SubtypeForm>(initialSubtypeForm);

  useEffect(() => {
    loadAssetTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial page load only; loadAssetTypes uses current translation fallback for this mount.
  }, []);

  const loadAssetTypes = async () => {
    try {
      setLoading(true);
      const response = await adminApi.listAssetTypes();
      setAssetTypes(response.data || []);
    } catch (err: any) {
      setError(formatApiError(err, t('assetTypes.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  };

  const filteredTypes = assetTypes.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDiscard = () => {
    form.resetForm();
    setModalOpen(false);
    setEditingType(null);
    setError('');
  };

  const handleModalClose = () => {
    if (form.isDirty) {
      handleDiscard();
    } else {
      setModalOpen(false);
      setEditingType(null);
      setError('');
    }
  };

  const openCreateModal = () => {
    setEditingType(null);
    form.resetForm();
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (type: AssetType) => {
    setEditingType(type);
    form.setFormValues({
      name: type.name,
      description: type.description || '',
      category: type.category,
      inventoryEnabled: type.inventoryEnabled ?? true,
      inventoryPattern: type.inventoryPattern || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.values.name.trim()) {
      setError(t('assetTypes.nameRequired'));
      return;
    }
    if (!form.values.category) {
      setError(t('assetTypes.categoryRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingType) {
        await adminApi.updateAssetType(editingType.id, form.values);
        setSuccess(t('assetTypes.updateSuccess'));
      } else {
        await adminApi.createAssetType(form.values);
        setSuccess(t('assetTypes.createSuccess'));
      }
      setModalOpen(false);
      setEditingType(null);
      form.resetForm();
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('assetTypes.saveError'), t('common.referenceId')));
    } finally {
      setSaving(false);
    }
  };

  const openSubtypeModal = (type: AssetType) => {
    setSubtypeParent(type);
    subtypeForm.setFormValues({ ...initialSubtypeForm, inventoryPattern: type.inventoryPattern || '' });
    setSubtypeModalOpen(true);
  };

  const handleDiscardSubtype = () => {
    subtypeForm.resetForm();
    setSubtypeModalOpen(false);
    setSubtypeParent(null);
  };

  const handleSubtypeModalClose = () => {
    if (subtypeForm.isDirty) {
      handleDiscardSubtype();
    } else {
      setSubtypeModalOpen(false);
      setSubtypeParent(null);
    }
  };

  const handleSaveSubtype = async () => {
    if (!subtypeParent || !subtypeForm.values.name.trim()) { setError(t('assetTypes.subtypeNameRequired')); return; }
    setSaving(true);
    try {
      await assetApi.createSubtype(subtypeParent.id, subtypeForm.values);
      setSubtypeModalOpen(false);
      setSubtypeParent(null);
      subtypeForm.resetForm();
      setSuccess(t('assetTypes.subtypeCreateSuccess'));
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('assetTypes.subtypeSaveError'), t('common.referenceId')));
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string, name: string) => setPendingDelete({ id, name });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await adminApi.deleteAssetType(id);
      setSuccess(t('assetTypes.deleteSuccess'));
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('assetTypes.deleteError'), t('common.referenceId')));
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await adminApi.archiveAssetType(id);
      setSuccess(t('assetTypes.archiveSuccess'));
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('assetTypes.archiveError'), t('common.referenceId')));
    }
  };

  // Group by category
  const groupedTypes: Record<string, AssetType[]> = {};
  filteredTypes.forEach((type) => {
    if (!groupedTypes[type.category]) {
      groupedTypes[type.category] = [];
    }
    groupedTypes[type.category].push(type);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">{t('assetTypes.title')}</h1>
        <button
          onClick={openCreateModal}
          className="bg-primary-600 dark:bg-primary-500 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 dark:hover:bg-primary-600"
        >
          {t('assetTypes.newAssetType')}
        </button>
      </div>

      {error && (
        <div className="bg-status-critical-bg border border-border-subtle text-status-critical-fg px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-status-ok-bg border border-border-subtle text-status-ok-fg px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <div className="bg-surface-default rounded-lg shadow">
        <div className="p-4 border-b border-border-subtle">
          <input
            type="text"
            placeholder={t('assetTypes.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted">{t('assetTypes.loading')}</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {Object.entries(groupedTypes).map(([category, types]) => (
              <div key={category} className="p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">
                  {t(`assetTypes.categories.${category}`)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {types.map((type) => (
                    <div
                      key={type.id}
                      className={`border rounded-lg p-3 ${
                        type.isArchived
                          ? 'border-border-subtle bg-surface-sunken opacity-60'
                          : 'border-border-subtle bg-surface-default hover:border-primary-300 dark:hover:border-primary-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-text-primary truncate">
                            {type.name}
                          </div>
                          {type.description && (
                            <div className="text-xs text-text-muted mt-1 line-clamp-2">
                              {type.description}
                            </div>
                          )}
                        </div>
                        {type.isArchived && (
                          <span className="text-xs text-text-muted bg-surface-sunken px-1.5 py-0.5 rounded">
                            {t('assetTypes.archived')}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-text-secondary">
                        <div>{t('assetTypes.inventoryEnabled')}: {type.inventoryEnabled ? t('common.yes') : t('common.no')}</div>
                        <div>{t('assetTypes.inventoryPattern')}: {type.inventoryPattern || '-'}</div>
                        <div className="mt-2 font-medium">{t('assetTypes.subtypes')}</div>
                        {(type.subtypes ?? []).length === 0 ? <div className="text-text-muted">{t('assetTypes.noSubtypes')}</div> : (type.subtypes ?? []).map((subtype) => <div key={subtype.id} className="ml-2">• {subtype.name} ({subtype.inventoryPattern || type.inventoryPattern || '-'})</div>)}
                      </div>
                      {!type.isArchived && (
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border-subtle">
                          <button
                            onClick={() => openSubtypeModal(type)}
                            className="text-status-ok-fg hover:underline text-xs font-medium"
                          >
                            {t('assetTypes.addSubtype')}
                          </button>
                          <button
                            onClick={() => openEditModal(type)}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs font-medium"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleArchive(type.id)}
                            className="text-status-warn-fg hover:underline text-xs font-medium"
                          >
                            {t('assetTypes.archive')}
                          </button>
                          <button
                            onClick={() => handleDelete(type.id, type.name)}
                            className="text-status-critical-fg hover:underline text-xs font-medium"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredTypes.length === 0 && (
          <div className="p-8 text-center text-text-muted">{t('assetTypes.noAssetTypes')}</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={handleModalClose} title={editingType ? t('assetTypes.editAssetType') : t('assetTypes.newAssetType')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('common.name')}</label>
            <input
              type="text"
              value={form.values.name}
              onChange={(e) => form.handleChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('assetTypes.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('assetTypes.category')}</label>
            <select
              value={form.values.category}
              onChange={(e) => form.handleChange({ category: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('assetTypes.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`assetTypes.categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('assetTypes.descriptionOptional')}</label>
            <textarea
              value={form.values.description}
              onChange={(e) => form.handleChange({ description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('assetTypes.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={form.values.inventoryEnabled} onChange={(e) => form.handleChange({ inventoryEnabled: e.target.checked })} />{t('assetTypes.inventoryEnabled')}</label>
            <input value={form.values.inventoryPattern} onChange={(e) => form.handleChange({ inventoryPattern: e.target.value })} placeholder={t('assetTypes.inventoryPatternPlaceholder')} className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }}
              className="px-4 py-2 text-sm text-text-primary border border-border-subtle rounded-md hover:bg-surface-hover"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50"
            >
              {saving ? t('common.saving') : editingType ? t('common.update') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={subtypeModalOpen} onClose={handleSubtypeModalClose} title={t('assetTypes.addSubtype')} isDirty={subtypeForm.isDirty && !saving} onDiscardConfirm={handleDiscardSubtype}>
        <div className="space-y-4">
          <input value={subtypeForm.values.name} onChange={(e) => subtypeForm.handleChange({ name: e.target.value })} placeholder={t('assetTypes.subtypeNamePlaceholder')} className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm" />
          <textarea value={subtypeForm.values.description} onChange={(e) => subtypeForm.handleChange({ description: e.target.value })} placeholder={t('assetTypes.descriptionPlaceholder')} className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm" />
          <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={subtypeForm.values.inventoryEnabled} onChange={(e) => subtypeForm.handleChange({ inventoryEnabled: e.target.checked })} />{t('assetTypes.inventoryEnabled')}</label>
          <input value={subtypeForm.values.inventoryPattern} onChange={(e) => subtypeForm.handleChange({ inventoryPattern: e.target.value })} placeholder={t('assetTypes.inventoryPatternPlaceholder')} className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm" />
          <div className="flex justify-end gap-3"><button onClick={() => { if (subtypeForm.isDirty) { handleDiscardSubtype(); } else { handleSubtypeModalClose(); } }} className="px-4 py-2 text-sm text-text-primary border border-border-subtle rounded-md">{t('common.cancel')}</button><button onClick={handleSaveSubtype} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md disabled:opacity-50">{t('common.create')}</button></div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        danger
        titleKey="common.confirmDelete"
        message={pendingDelete ? t('common.confirmDeleteNamed', { name: pendingDelete.name }) : undefined}
      />
    </div>
  );
};

export default AdminAssetTypes;

import { useState, useEffect } from 'react';
import { adminApi, assetApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useI18n } from '../context/I18nContext';

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
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssetType | null>(null);
  const [form, setForm] = useState<AssetTypeForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [subtypeModalOpen, setSubtypeModalOpen] = useState(false);
  const [subtypeParent, setSubtypeParent] = useState<AssetType | null>(null);
  const [subtypeForm, setSubtypeForm] = useState<SubtypeForm>(initialSubtypeForm);

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
      setError(err.response?.data?.error?.message || t('assetTypes.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredTypes = assetTypes.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreateModal = () => {
    setEditingType(null);
    setForm(initialForm);
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (type: AssetType) => {
    setEditingType(type);
    setForm({
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
    if (!form.name.trim()) {
      setError(t('assetTypes.nameRequired'));
      return;
    }
    if (!form.category) {
      setError(t('assetTypes.categoryRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingType) {
        await adminApi.updateAssetType(editingType.id, form);
        setSuccess(t('assetTypes.updateSuccess'));
      } else {
        await adminApi.createAssetType(form);
        setSuccess(t('assetTypes.createSuccess'));
      }
      setModalOpen(false);
      setForm(initialForm);
      setEditingType(null);
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('assetTypes.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const openSubtypeModal = (type: AssetType) => {
    setSubtypeParent(type);
    setSubtypeForm({ ...initialSubtypeForm, inventoryPattern: type.inventoryPattern || '' });
    setSubtypeModalOpen(true);
  };

  const handleSaveSubtype = async () => {
    if (!subtypeParent || !subtypeForm.name.trim()) { setError(t('assetTypes.subtypeNameRequired')); return; }
    setSaving(true);
    try {
      await assetApi.createSubtype(subtypeParent.id, subtypeForm);
      setSubtypeModalOpen(false);
      setSubtypeParent(null);
      setSubtypeForm(initialSubtypeForm);
      setSuccess(t('assetTypes.subtypeCreateSuccess'));
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('assetTypes.subtypeSaveError'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('assetTypes.deleteConfirm'))) return;

    try {
      await adminApi.deleteAssetType(id);
      setSuccess(t('assetTypes.deleteSuccess'));
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('assetTypes.deleteError'));
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await adminApi.archiveAssetType(id);
      setSuccess(t('assetTypes.archiveSuccess'));
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('assetTypes.archiveError'));
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('assetTypes.title')}</h1>
        <button
          onClick={openCreateModal}
          className="bg-primary-600 dark:bg-primary-500 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 dark:hover:bg-primary-600"
        >
          {t('assetTypes.newAssetType')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder={t('assetTypes.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('assetTypes.loading')}</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(groupedTypes).map(([category, types]) => (
              <div key={category} className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {t(`assetTypes.categories.${category}`)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {types.map((type) => (
                    <div
                      key={type.id}
                      className={`border rounded-lg p-3 ${
                        type.isArchived
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-60'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {type.name}
                          </div>
                          {type.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {type.description}
                            </div>
                          )}
                        </div>
                        {type.isArchived && (
                          <span className="text-xs text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {t('assetTypes.archived')}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                        <div>{t('assetTypes.inventoryEnabled')}: {type.inventoryEnabled ? t('common.yes') : t('common.no')}</div>
                        <div>{t('assetTypes.inventoryPattern')}: {type.inventoryPattern || '-'}</div>
                        <div className="mt-2 font-medium">{t('assetTypes.subtypes')}</div>
                        {(type.subtypes ?? []).length === 0 ? <div className="text-gray-500 dark:text-gray-400">{t('assetTypes.noSubtypes')}</div> : (type.subtypes ?? []).map((subtype) => <div key={subtype.id} className="ml-2">• {subtype.name} ({subtype.inventoryPattern || type.inventoryPattern || '-'})</div>)}
                      </div>
                      {!type.isArchived && (
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <button
                            onClick={() => openSubtypeModal(type)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xs font-medium"
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
                            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-xs font-medium"
                          >
                            {t('assetTypes.archive')}
                          </button>
                          <button
                            onClick={() => handleDelete(type.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium"
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
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('assetTypes.noAssetTypes')}</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingType ? t('assetTypes.editAssetType') : t('assetTypes.newAssetType')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('assetTypes.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assetTypes.category')}</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('assetTypes.descriptionOptional')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('assetTypes.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={form.inventoryEnabled} onChange={(e) => setForm({ ...form, inventoryEnabled: e.target.checked })} />{t('assetTypes.inventoryEnabled')}</label>
            <input value={form.inventoryPattern} onChange={(e) => setForm({ ...form, inventoryPattern: e.target.value })} placeholder={t('assetTypes.inventoryPatternPlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
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
      <Modal isOpen={subtypeModalOpen} onClose={() => setSubtypeModalOpen(false)} title={t('assetTypes.addSubtype')}>
        <div className="space-y-4">
          <input value={subtypeForm.name} onChange={(e) => setSubtypeForm({ ...subtypeForm, name: e.target.value })} placeholder={t('assetTypes.subtypeNamePlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          <textarea value={subtypeForm.description} onChange={(e) => setSubtypeForm({ ...subtypeForm, description: e.target.value })} placeholder={t('assetTypes.descriptionPlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={subtypeForm.inventoryEnabled} onChange={(e) => setSubtypeForm({ ...subtypeForm, inventoryEnabled: e.target.checked })} />{t('assetTypes.inventoryEnabled')}</label>
          <input value={subtypeForm.inventoryPattern} onChange={(e) => setSubtypeForm({ ...subtypeForm, inventoryPattern: e.target.value })} placeholder={t('assetTypes.inventoryPatternPlaceholder')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm" />
          <div className="flex justify-end gap-3"><button onClick={() => setSubtypeModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md">{t('common.cancel')}</button><button onClick={handleSaveSubtype} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md disabled:opacity-50">{t('common.create')}</button></div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminAssetTypes;

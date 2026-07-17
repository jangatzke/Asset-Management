import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { Modal } from '../components/Modal';

interface AssetType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AssetTypeForm {
  name: string;
  description: string;
  category: string;
}

const initialForm: AssetTypeForm = {
  name: '',
  description: '',
  category: '',
};

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

  useEffect(() => {
    loadAssetTypes();
  }, []);

  const loadAssetTypes = async () => {
    try {
      setLoading(true);
      const response = await adminApi.listAssetTypes();
      setAssetTypes(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load asset types');
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
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.category) {
      setError('Category is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingType) {
        await adminApi.updateAssetType(editingType.id, form);
        setSuccess('Asset type updated');
      } else {
        await adminApi.createAssetType(form);
        setSuccess('Asset type created');
      }
      setModalOpen(false);
      setForm(initialForm);
      setEditingType(null);
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save asset type');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset type?')) return;

    try {
      await adminApi.deleteAssetType(id);
      setSuccess('Asset type deleted');
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete asset type');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await adminApi.archiveAssetType(id);
      setSuccess('Asset type archived');
      loadAssetTypes();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to archive asset type');
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
        <h1 className="text-2xl font-bold text-gray-900">Asset Types</h1>
        <button
          onClick={openCreateModal}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          + New Asset Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search asset types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading asset types...</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {Object.entries(groupedTypes).map(([category, types]) => (
              <div key={category} className="p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {types.map((type) => (
                    <div
                      key={type.id}
                      className={`border rounded-lg p-3 ${
                        type.isArchived
                          ? 'border-gray-200 bg-gray-50 opacity-60'
                          : 'border-gray-200 bg-white hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {type.name}
                          </div>
                          {type.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {type.description}
                            </div>
                          )}
                        </div>
                        {type.isArchived && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                      {!type.isArchived && (
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => openEditModal(type)}
                            className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchive(type.id)}
                            className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => handleDelete(type.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Delete
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
          <div className="p-8 text-center text-gray-500">No asset types found</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingType ? 'Edit Asset Type' : 'New Asset Type'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g. Physical Server"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select category...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Brief description of this asset type"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingType ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminAssetTypes;

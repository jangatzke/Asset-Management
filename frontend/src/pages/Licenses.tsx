
import { useState, useEffect } from 'react';
import { licenseApi } from '../services/api';
import { Modal } from '../components/Modal';

interface License {
  id: string;
  name: string;
  displayId?: string;
  description?: string;
  vendor?: string;
  type?: string;
  status?: string;
  licenseKey?: string;
  seats?: number;
  usedSeats?: number;
  purchaseDate?: string;
  expiryDate?: string;
  renewalDate?: string;
}

interface LicenseForm {
  name: string;
  description: string;
  vendor: string;
  type: string;
  status: string;
  licenseKey: string;
  seats: string;
  purchaseDate: string;
  expiryDate: string;
  renewalDate: string;
}

const initialForm: LicenseForm = {
  name: '',
  description: '',
  vendor: '',
  type: 'commercial',
  status: 'active',
  licenseKey: '',
  seats: '',
  purchaseDate: '',
  expiryDate: '',
  renewalDate: '',
};

const Licenses = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LicenseForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { loadLicenses(); }, []);

  const loadLicenses = async () => {
    try {
      setLoading(true);
      const response = await licenseApi.list({ page: 1, limit: 100 });
      setLicenses(response.data?.data ?? response.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load licenses');
    } finally { setLoading(false); }
  };

  const filtered = licenses.filter(l => {
    const matchesSearch = !searchTerm ||
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.displayId && l.displayId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.vendor && l.vendor.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !filterStatus || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, seats: form.seats ? parseInt(form.seats) : undefined };
      if (editingId) {
        await licenseApi.update(editingId, payload);
      } else {
        await licenseApi.create(payload);
      }
      setModalOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadLicenses();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleEdit = (license: License) => {
    setForm({
      name: license.name,
      description: license.description || '',
      vendor: license.vendor || '',
      type: license.type || 'commercial',
      status: license.status || 'active',
      licenseKey: license.licenseKey || '',
      seats: String(license.seats ?? ''),
      purchaseDate: license.purchaseDate?.split('T')[0] || '',
      expiryDate: license.expiryDate?.split('T')[0] || '',
      renewalDate: license.renewalDate?.split('T')[0] || '',
    });
    setEditingId(license.id);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this license?')) return;
    try {
      await licenseApi.delete(id);
      await loadLicenses();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const statusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'expired': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'expiring_soon': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Licenses</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Licenses</h1>
        <button onClick={() => { setForm(initialForm); setEditingId(null); setModalOpen(true); }}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
          New License
        </button>
      </div>

      {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-4 mb-4">
        <input type="text" placeholder="Search licenses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="expiring_soon">Expiring Soon</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Seats</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expiry</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No licenses found</td></tr>
            ) : filtered.map(l => {
              const daysLeft = getDaysUntilExpiry(l.expiryDate);
              return (
                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 text-sm text-gray-500">{l.displayId || l.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{l.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{l.vendor || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{l.type || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{l.seats ? `${l.usedSeats ?? 0}/${l.seats}` : '-'}</td>
                  <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(l.status)}`}>{l.status}</span></td>
                  <td className="px-6 py-4 text-sm">
                    {l.expiryDate ? (
                      <span className={daysLeft !== null && daysLeft <= 30 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'}>
                        {l.expiryDate.split('T')[0]}
                        {daysLeft !== null && daysLeft <= 60 && <span className="ml-1 text-xs">({daysLeft}d)</span>}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button onClick={() => handleEdit(l)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                    <button onClick={() => handleDelete(l.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit License' : 'New License'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
              <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="commercial">Commercial</option>
                <option value="open_source">Open Source</option>
                <option value="subscription">Subscription</option>
                <option value="perpetual">Perpetual</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">License Key</label>
              <input type="text" value={form.licenseKey} onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seats</label>
              <input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Renewal Date</label>
              <input type="date" value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Licenses;


import { useState, useEffect } from 'react';
import { contractApi } from '../services/api';
import { Modal } from '../components/Modal';

interface Contract {
  id: string;
  name: string;
  displayId?: string;
  description?: string;
  contractNumber?: string;
  vendor?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  currency?: string;
}

interface ContractForm {
  name: string;
  description: string;
  contractNumber: string;
  vendor: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  value: string;
  currency: string;
}

const initialForm: ContractForm = {
  name: '',
  description: '',
  contractNumber: '',
  vendor: '',
  type: 'service',
  status: 'active',
  startDate: '',
  endDate: '',
  value: '',
  currency: 'EUR',
};

const Contracts = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContractForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { loadContracts(); }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await contractApi.list({ page: 1, limit: 100 });
      setContracts(response.data?.data ?? response.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load contracts');
    } finally { setLoading(false); }
  };

  const filtered = contracts.filter(c => {
    const matchesSearch = !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.displayId && c.displayId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.contractNumber && c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, value: form.value ? parseFloat(form.value) : undefined };
      if (editingId) {
        await contractApi.update(editingId, payload);
      } else {
        await contractApi.create(payload);
      }
      setModalOpen(false);
      setForm(initialForm);
      setEditingId(null);
      await loadContracts();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleEdit = (contract: Contract) => {
    setForm({
      name: contract.name,
      description: contract.description || '',
      contractNumber: contract.contractNumber || '',
      vendor: contract.vendor || '',
      type: contract.type || 'service',
      status: contract.status || 'active',
      startDate: contract.startDate?.split('T')[0] || '',
      endDate: contract.endDate?.split('T')[0] || '',
      value: String(contract.value ?? ''),
      currency: contract.currency || 'EUR',
    });
    setEditingId(contract.id);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;
    try {
      await contractApi.delete(id);
      await loadContracts();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Delete failed');
    }
  };

  const statusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'expired': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Contracts</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contracts</h1>
        <button onClick={() => { setForm(initialForm); setEditingId(null); setModalOpen(true); }}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
          New Contract
        </button>
      </div>

      {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-4 mb-4">
        <input type="text" placeholder="Search contracts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">No contracts found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 text-sm text-gray-500">{c.displayId || c.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{c.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.contractNumber || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.vendor || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{c.type || '-'}</td>
                <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.startDate?.split('T')[0] || '-'} → {c.endDate?.split('T')[0] || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <button onClick={() => handleEdit(c)} className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Contract' : 'New Contract'}>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contract Number</label>
              <input type="text" value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
              <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="service">Service</option>
                <option value="maintenance">Maintenance</option>
                <option value="license">License</option>
                <option value="sla">SLA</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
              <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
              <input type="text" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
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

export default Contracts;

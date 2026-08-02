
import { useState, useEffect } from 'react';
import { ClockIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { contractApi } from '../services/api';
import { Modal } from '../components/Modal';
import { EntityHistoryModal } from '../components/EntityHistoryModal';
import { useI18n } from '../context/I18nContext';

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

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';

const Contracts = () => {
  const { t } = useI18n();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContractForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [historyContract, setHistoryContract] = useState<Contract | null>(null);

  useEffect(() => { loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial contracts load only; loader uses current translation fallback for this mount.
  }, []);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await contractApi.list({ page: 1, limit: 100 });
      setContracts(response.data?.data ?? response.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('contracts.loadError'));
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
    if (!form.name) { setError(t('common.requiredField')); return; }
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
      setError(err.response?.data?.error?.message || t('common.saveError'));
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
    if (!confirm(t('contracts.deleteConfirm'))) return;
    try {
      await contractApi.delete(id);
      await loadContracts();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('common.deleteError'));
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('contracts.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('contracts.title')}</h1>
        <button onClick={() => { setForm(initialForm); setEditingId(null); setModalOpen(true); }}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
          {t('contracts.newContract')}
        </button>
      </div>

      {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-4 mb-4">
        <input type="text" placeholder={t('contracts.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
          <option value="">{t('common.allStatuses')}</option>
          <option value="active">{t('contracts.status.active')}</option>
          <option value="expired">{t('contracts.status.expired')}</option>
          <option value="pending">{t('contracts.status.pending')}</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.id')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.name')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.number')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.vendor')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.type')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.status')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.dates')}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('contracts.noContracts')}</td></tr>
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
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(c)} aria-label={`${t('common.edit')}: ${c.name}`} title={t('common.edit')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                      <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => setHistoryContract(c)} aria-label={`${t('history.viewHistory')}: ${c.name}`} title={t('history.viewHistory')} className={`${actionButtonClassName} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`}>
                      <ClockIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} aria-label={`${t('common.delete')}: ${c.name}`} title={t('common.delete')} className={`${actionButtonClassName} text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300`}>
                      <TrashIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('contracts.editContract') : t('contracts.newContract')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.name')} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('contracts.fields.contractNumber')}</label>
              <input type="text" value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.vendor')}</label>
              <input type="text" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.type')}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="service">{t('contracts.types.service')}</option>
                <option value="maintenance">{t('contracts.types.maintenance')}</option>
                <option value="license">{t('contracts.types.license')}</option>
                <option value="sla">SLA</option>
                <option value="other">{t('contracts.types.other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.status')}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">{t('contracts.status.active')}</option>
                <option value="pending">{t('contracts.status.pending')}</option>
                <option value="expired">{t('contracts.status.expired')}</option>
                <option value="terminated">{t('contracts.status.terminated')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.startDate')}</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.endDate')}</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.value')}</label>
              <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.currency')}</label>
              <input type="text" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50">
              {saving ? t('common.saving') : (editingId ? t('common.update') : t('common.create'))}
            </button>
          </div>
        </div>
      </Modal>

      <EntityHistoryModal isOpen={!!historyContract} onClose={() => setHistoryContract(null)} entityId={historyContract?.id} entityName={historyContract?.name} loadHistory={contractApi.history} />
    </div>
  );
};

export default Contracts;

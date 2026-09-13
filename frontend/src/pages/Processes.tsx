
import { useState, useEffect, useMemo } from 'react';
import { ClockIcon, EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { processApi } from '../services/api';
import { Modal } from '../components/Modal';
import { EntityHistoryModal } from '../components/EntityHistoryModal';
import { useI18n } from '../context/I18nContext';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';

interface Process {
  id: string;
  name: string;
  displayId?: string;
  description?: string;
  category?: string;
  status?: string;
  criticality?: string;
  processOwner?: string;
}

interface ProcessForm {
  name: string;
  description: string;
  category: string;
  status: string;
  criticality: string;
  processOwner: string;
}

const initialForm: ProcessForm = {
  name: '',
  description: '',
  category: 'operational',
  status: 'active',
  criticality: 'medium',
  processOwner: '',
};

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';

const Processes = () => {
  const { t } = useI18n();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useDirtyForm<ProcessForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [linkedRisks, setLinkedRisks] = useState<any[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const [historyProcess, setHistoryProcess] = useState<Process | null>(null);

  useEffect(() => { loadProcesses(); }, []);

  const loadProcesses = async () => {
    try {
      setLoading(true);
      const response = await processApi.list({ page: 1, limit: 100 });
      setProcesses(response.data?.data ?? response.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('processes.loadError'));
    } finally { setLoading(false); }
  };

  const loadRisks = async (processId: string) => {
    try {
      setRisksLoading(true);
      const response = await processApi.getRisks(processId);
      setLinkedRisks(response.data?.data ?? response.data ?? []);
    } catch {
      setLinkedRisks([]);
    } finally { setRisksLoading(false); }
  };

  const filtered = processes.filter(p => {
    const matchesSearch = !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.displayId && p.displayId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !filterStatus || p.status === filterStatus;
    const matchesCriticality = !filterCriticality || p.criticality === filterCriticality;
    return matchesSearch && matchesStatus && matchesCriticality;
  });

  const { sort, toggleSort } = useLocalSort({ routeKey: 'processes', defaultSort: { column: 'name', direction: 'asc' } });
  const sortedProcesses = useMemo(() => {
    if (!sort.column) return filtered;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (p: Process) => {
      if (sort.column === 'id') return (p.displayId ?? p.id ?? '').toLowerCase();
      if (sort.column === 'name') return (p.name ?? '').toLowerCase();
      if (sort.column === 'category') return (p.category ?? '').toLowerCase();
      if (sort.column === 'criticality') return (p.criticality ?? '').toLowerCase();
      if (sort.column === 'status') return (p.status ?? '').toLowerCase();
      if (sort.column === 'owner') return (p.processOwner ?? '').toLowerCase();
      return '';
    };
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [filtered, sort]);

  const exportVisibleProcesses = () => exportCsv('processes', [
    t('processes.columns.id'), t('processes.columns.name'), t('processes.columns.category'),
    t('processes.columns.criticality'), t('processes.columns.status'), t('processes.columns.owner'),
  ], sortedProcesses.map((process) => [
    process.displayId || process.id,
    process.name,
    process.category || '',
    process.criticality || '',
    process.status || '',
    process.processOwner || '',
  ]));

  const handleDiscard = () => {
    form.resetForm();
    setEditingId(null);
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.values.name) { setError(t('processes.nameRequired')); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await processApi.update(editingId, form.values);
      } else {
        await processApi.create(form.values);
      }
      setModalOpen(false);
      form.resetForm();
      setEditingId(null);
      await loadProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('processes.saveError'));
    } finally { setSaving(false); }
  };

  const handleEdit = (process: Process) => {
    form.setFormValues({
      name: process.name,
      description: process.description || '',
      category: process.category || 'operational',
      status: process.status || 'active',
      criticality: process.criticality || 'medium',
      processOwner: process.processOwner || '',
    });
    setEditingId(process.id);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('processes.deleteConfirm'))) return;
    try {
      await processApi.delete(id);
      await loadProcesses();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('processes.deleteError'));
    }
  };

  const handleViewDetails = (process: Process) => {
    setSelectedProcess(process);
    loadRisks(process.id);
  };

  const criticalityColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'critical': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'high': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default: return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    }
  };

  const statusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'inactive': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      case 'under_review': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      default: return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('processes.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('processes.title')}</h1>
        <button onClick={() => { form.resetForm(); setEditingId(null); setModalOpen(true); }}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
          {t('processes.newProcess')}
        </button>
      </div>

      {error && <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-4 mb-4">
        <input type="text" placeholder={t('processes.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
          <option value="">{t('processes.filters.allStatuses')}</option>
          <option value="active">{t('processes.status.active')}</option>
          <option value="inactive">{t('processes.status.inactive')}</option>
          <option value="under_review">{t('processes.status.under_review')}</option>
        </select>
        <select value={filterCriticality} onChange={(e) => setFilterCriticality(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md">
          <option value="">{t('processes.filters.allCriticalities')}</option>
          <option value="critical">{t('processes.criticality.critical')}</option>
          <option value="high">{t('processes.criticality.high')}</option>
          <option value="medium">{t('processes.criticality.medium')}</option>
          <option value="low">{t('processes.criticality.low')}</option>
        </select>
      </div>

      <DataTableShell onExport={exportVisibleProcesses} exportLabel="Export CSV" rowCount={sortedProcesses.length} densityLabel={t('dataTable.density')} compactLabel={t('dataTable.compact')} comfortableLabel={t('dataTable.comfortable')}>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <SortableTh column="id" label={t('processes.columns.id')} activeColumn={sort.column} direction={sort.column === 'id' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="name" label={t('processes.columns.name')} activeColumn={sort.column} direction={sort.column === 'name' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="category" label={t('processes.columns.category')} activeColumn={sort.column} direction={sort.column === 'category' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="criticality" label={t('processes.columns.criticality')} activeColumn={sort.column} direction={sort.column === 'criticality' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="status" label={t('processes.columns.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="owner" label={t('processes.columns.owner')} activeColumn={sort.column} direction={sort.column === 'owner' ? sort.direction : ''} onSort={toggleSort} />
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-200">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{t('processes.noProcesses')}</td></tr>
            ) : sortedProcesses.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 text-sm text-gray-500">{p.displayId || p.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{p.category || '-'}</td>
                <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${criticalityColor(p.criticality)}`}>{p.criticality}</span></td>
                <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(p.status)}`}>{p.status}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{p.processOwner || '-'}</td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleViewDetails(p)} aria-label={`${t('common.view')}: ${p.name}`} title={t('common.view')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                      <EyeIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => handleEdit(p)} aria-label={`${t('common.edit')}: ${p.name}`} title={t('common.edit')} className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}>
                      <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => setHistoryProcess(p)} aria-label={`${t('history.viewHistory')}: ${p.name}`} title={t('history.viewHistory')} className={`${actionButtonClassName} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300`}>
                      <ClockIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} aria-label={`${t('common.delete')}: ${p.name}`} title={t('common.delete')} className={`${actionButtonClassName} text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300`}>
                      <TrashIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => { if (form.isDirty) { handleDiscard(); } else { setModalOpen(false); } }} title={editingId ? t('processes.editProcess') : t('processes.newProcess')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('processes.fields.name')} *</label>
            <input type="text" value={form.values.name} onChange={(e) => form.handleChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('processes.fields.description')}</label>
            <textarea value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('processes.fields.category')}</label>
              <select value={form.values.category} onChange={(e) => form.handleChange({ category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="operational">{t('processes.categories.operational')}</option>
                <option value="management">{t('processes.categories.management')}</option>
                <option value="support">{t('processes.categories.support')}</option>
                <option value="compliance">{t('processes.categories.compliance')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('processes.fields.criticality')}</label>
              <select value={form.values.criticality} onChange={(e) => form.handleChange({ criticality: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="low">{t('processes.criticality.low')}</option>
                <option value="medium">{t('processes.criticality.medium')}</option>
                <option value="high">{t('processes.criticality.high')}</option>
                <option value="critical">{t('processes.criticality.critical')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('processes.fields.status')}</label>
              <select value={form.values.status} onChange={(e) => form.handleChange({ status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">{t('processes.status.active')}</option>
                <option value="inactive">{t('processes.status.inactive')}</option>
                <option value="under_review">{t('processes.status.under_review')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('processes.fields.processOwner')}</label>
              <input type="text" value={form.values.processOwner} onChange={(e) => form.handleChange({ processOwner: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button onClick={() => { if (form.isDirty) { handleDiscard(); } else { setModalOpen(false); } }}
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

      {/* Detail Modal */}
      <Modal isOpen={!!selectedProcess} onClose={() => setSelectedProcess(null)} title={t('processes.detailTitle', { name: selectedProcess?.name || '' })}>
        {selectedProcess && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">{t('processes.detail.displayId')}</dt>
              <dd className="text-gray-900 dark:text-white">{selectedProcess.displayId || '-'}</dd>
              <dt className="text-gray-500">{t('processes.detail.category')}</dt>
              <dd className="text-gray-900 dark:text-white capitalize">{selectedProcess.category || '-'}</dd>
              <dt className="text-gray-500">{t('processes.detail.criticality')}</dt>
              <dd className="text-gray-900 dark:text-white capitalize">{selectedProcess.criticality || '-'}</dd>
              <dt className="text-gray-500">{t('processes.detail.status')}</dt>
              <dd className="text-gray-900 dark:text-white capitalize">{selectedProcess.status || '-'}</dd>
              <dt className="text-gray-500">{t('processes.detail.owner')}</dt>
              <dd className="text-gray-900 dark:text-white">{selectedProcess.processOwner || '-'}</dd>
            </dl>
            {selectedProcess.description && (
              <div>
                <h4 className="font-medium text-gray-700 dark:text-gray-300">{t('processes.detail.description')}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedProcess.description}</p>
              </div>
            )}
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{t('processes.detail.linkedRisks')}</h4>
              {risksLoading ? (
                <div className="flex items-center justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div></div>
              ) : linkedRisks.length > 0 ? (
                <ul className="space-y-1">
                  {linkedRisks.map((r: any) => (
                    <li key={r.id} className="text-sm text-gray-700 dark:text-gray-300">{r.displayId}: {r.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t('processes.detail.noLinkedRisks')}</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <EntityHistoryModal isOpen={!!historyProcess} onClose={() => setHistoryProcess(null)} entityId={historyProcess?.id} entityName={historyProcess?.name} loadHistory={processApi.history} />
    </div>
  );
};

export default Processes;

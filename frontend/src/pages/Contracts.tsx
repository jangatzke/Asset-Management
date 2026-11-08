
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClockIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { contractApi } from '../services/api';
import { Modal } from '../components/Modal';
import { EntityHistoryModal } from '../components/EntityHistoryModal';
import { useI18n } from '../context/I18nContext';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell, tableCellClass, useTableDensity } from '../components/DataTableShell';
import { PageHeader } from '../components/PageHeader';
import { exportCsv } from '../utils/csvExport';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import { formatApiError } from '../utils/apiError';
import { statusBadgeClass, type StatusKind } from '../utils/statusHelpers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

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

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors duration-fast hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary-500';
const actionIconClassName = 'h-4 w-4';

const Contracts = () => {
  const { t } = useI18n();
  // Stage 10b (LT-3): cells follow the globally persisted density preference.
  const cellClass = tableCellClass(useTableDensity());
  const breadcrumbs = useBreadcrumbs();
  const [searchParams] = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  // Seed from ?search= so the global search "show all" deep-link works.
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useDirtyForm<ContractForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [historyContract, setHistoryContract] = useState<Contract | null>(null);

  const loadContracts = async () => {
    try {
      setLoading(true);
      const response = await contractApi.list({ page: 1, limit: 100 });
      setContracts(response.data?.data ?? response.data ?? []);
    } catch (err: unknown) {
      setError(formatApiError(err, t('contracts.loadError'), t('common.referenceId')));
    } finally { setLoading(false); }
  };

  useEffect(() => { loadContracts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial contracts load only; loader uses current translation fallback for this mount.
  }, []);

  const filtered = contracts.filter(c => {
    const matchesSearch = !searchTerm ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.displayId && c.displayId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.contractNumber && c.contractNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !filterStatus || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Client-side sort persisted in localStorage (survives reload/revisit).
  const { sort, toggleSort } = useLocalSort({
    routeKey: 'contracts',
    defaultSort: { column: 'name', direction: 'asc' },
  });

  const sortedContracts = useMemo(() => {
    if (!sort.column) return filtered;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (c: Contract) => {
      if (sort.column === 'name') return (c.name ?? '').toLowerCase();
      if (sort.column === 'id') return (c.displayId ?? c.id ?? '').toLowerCase();
      if (sort.column === 'number') return (c.contractNumber ?? '').toLowerCase();
      if (sort.column === 'vendor') return (c.vendor ?? '').toLowerCase();
      if (sort.column === 'type') return (c.type ?? '').toLowerCase();
      if (sort.column === 'status') return (c.status ?? '').toLowerCase();
      if (sort.column === 'dates') return `${c.startDate ?? ''} ${c.endDate ?? ''}`.toLowerCase();
      return '';
    };
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [filtered, sort]);

  const exportVisibleContracts = () => exportCsv('contracts', [
    t('common.id'),
    t('common.name'),
    t('common.number'),
    t('common.vendor'),
    t('common.type'),
    t('common.status'),
    t('common.dates'),
  ], sortedContracts.map((contract) => [
    contract.displayId || contract.id,
    contract.name,
    contract.contractNumber || '',
    contract.vendor || '',
    contract.type || '',
    contract.status || '',
    `${contract.startDate?.split('T')[0] || ''} → ${contract.endDate?.split('T')[0] || ''}`,
  ]));

  const handleDiscard = () => {
    form.resetForm();
    setEditingId(null);
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.values.name) { setError(t('common.requiredField')); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form.values, value: form.values.value ? parseFloat(form.values.value) : undefined };
      if (editingId) {
        await contractApi.update(editingId, payload);
      } else {
        await contractApi.create(payload);
      }
      setModalOpen(false);
      form.resetForm();
      setEditingId(null);
      await loadContracts();
    } catch (err: unknown) {
      setError(formatApiError(err, t('common.saveError'), t('common.referenceId')));
    } finally { setSaving(false); }
  };

  const handleEdit = (contract: Contract) => {
    form.setFormValues({
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

  // Deletion confirmation owned by the styled ConfirmDialog (replaces the native browser dialog).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDelete = (id: string, name: string) => setPendingDelete({ id, name });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await contractApi.delete(id);
      await loadContracts();
    } catch (err: unknown) {
      setError(formatApiError(err, t('common.deleteError'), t('common.referenceId')));
    }
  };

  const statusColor = (status?: string): string => {
    const kind: StatusKind = (() => {
      switch (status?.toLowerCase()) {
        case 'active': return 'ok';
        case 'expired': return 'critical';
        case 'pending': return 'warn';
        default: return 'idle';
      }
    })();
    return statusBadgeClass(kind);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={t('contracts.title')} breadcrumbs={breadcrumbs} />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('contracts.title')}
        breadcrumbs={breadcrumbs}
        actions={(
          <button onClick={() => { form.resetForm(); setEditingId(null); setModalOpen(true); }}
            className="bg-primary-600 dark:bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-700 dark:hover:bg-primary-600">
            {t('contracts.newContract')}
          </button>
        )}
      />

      {error && <div className="bg-status-critical-bg text-status-critical-fg p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-4 mb-4">
        <input type="text" placeholder={t('contracts.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border-strong rounded-md">
          <option value="">{t('common.allStatuses')}</option>
          <option value="active">{t('contracts.status.active')}</option>
          <option value="expired">{t('contracts.status.expired')}</option>
          <option value="pending">{t('contracts.status.pending')}</option>
        </select>
      </div>

      <DataTableShell onExport={exportVisibleContracts} exportLabel="Export CSV" rowCount={sortedContracts.length} densityLabel={t('dataTable.density')} compactLabel={t('dataTable.compact')} comfortableLabel={t('dataTable.comfortable')}>
        <table className="min-w-full divide-y divide-border-subtle">
          <thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted">
            <tr>
              <SortableTh column="id" label={t('common.id')} activeColumn={sort.column} direction={sort.column === 'id' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="name" label={t('common.name')} activeColumn={sort.column} direction={sort.column === 'name' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="number" label={t('common.number')} activeColumn={sort.column} direction={sort.column === 'number' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="vendor" label={t('common.vendor')} activeColumn={sort.column} direction={sort.column === 'vendor' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="type" label={t('common.type')} activeColumn={sort.column} direction={sort.column === 'type' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="status" label={t('common.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="dates" label={t('common.dates')} activeColumn={sort.column} direction={sort.column === 'dates' ? sort.direction : ''} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 text-left text-caption text-text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-surface-default divide-y divide-border-subtle">
            {sortedContracts.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8"><EmptyState titleKey="contracts.noContracts" /></td></tr>
            ) : sortedContracts.map(c => (
              <tr key={c.id} className="transition-colors duration-fast hover:bg-surface-hover">
                <td className={`${cellClass} text-body2 tabular-nums text-text-muted`}>{c.displayId || c.id}</td>
                <td className={`${cellClass} text-body2 font-medium text-text-primary`}>{c.name}</td>
                <td className={`${cellClass} text-body2 tabular-nums text-text-secondary`}>{c.contractNumber || '-'}</td>
                <td className={`${cellClass} text-body2 text-text-secondary`}>{c.vendor || '-'}</td>
                <td className={`${cellClass} text-body2 text-text-secondary capitalize`}>{c.type || '-'}</td>
                <td className={`${cellClass}`}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                <td className={`${cellClass} text-body2 tabular-nums text-text-secondary`}>{c.startDate?.split('T')[0] || '-'} → {c.endDate?.split('T')[0] || '-'}</td>
                <td className={`${cellClass} text-body2`}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(c)} aria-label={`${t('common.edit')}: ${c.name}`} title={t('common.edit')} className={`${actionButtonClassName} text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300`}>
                      <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => setHistoryContract(c)} aria-label={`${t('history.viewHistory')}: ${c.name}`} title={t('history.viewHistory')} className={`${actionButtonClassName} text-text-secondary hover:text-text-primary`}>
                      <ClockIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                    <button onClick={() => handleDelete(c.id, c.name)} aria-label={`${t('common.delete')}: ${c.name}`} title={t('common.delete')} className={`${actionButtonClassName} text-status-critical-fg hover:text-status-critical-fg`}>
                      <TrashIcon aria-hidden="true" className={actionIconClassName} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

       <Modal isOpen={modalOpen} onClose={() => { if (form.isDirty) { handleDiscard(); } else { setModalOpen(false); } }} title={editingId ? t('contracts.editContract') : t('contracts.newContract')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('common.name')} *</label>
            <input type="text" value={form.values.name} onChange={(e) => form.handleChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('common.description')}</label>
            <textarea value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('contracts.fields.contractNumber')}</label>
              <input type="text" value={form.values.contractNumber} onChange={(e) => form.handleChange({ contractNumber: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.vendor')}</label>
              <input type="text" value={form.values.vendor} onChange={(e) => form.handleChange({ vendor: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.type')}</label>
              <select value={form.values.type} onChange={(e) => form.handleChange({ type: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="service">{t('contracts.types.service')}</option>
                <option value="maintenance">{t('contracts.types.maintenance')}</option>
                <option value="license">{t('contracts.types.license')}</option>
                <option value="sla">SLA</option>
                <option value="other">{t('contracts.types.other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.status')}</label>
              <select value={form.values.status} onChange={(e) => form.handleChange({ status: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="active">{t('contracts.status.active')}</option>
                <option value="pending">{t('contracts.status.pending')}</option>
                <option value="expired">{t('contracts.status.expired')}</option>
                <option value="terminated">{t('contracts.status.terminated')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.startDate')}</label>
              <input type="date" value={form.values.startDate} onChange={(e) => form.handleChange({ startDate: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.endDate')}</label>
              <input type="date" value={form.values.endDate} onChange={(e) => form.handleChange({ endDate: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.value')}</label>
              <input type="number" step="0.01" value={form.values.value} onChange={(e) => form.handleChange({ value: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.currency')}</label>
              <input type="text" value={form.values.currency} onChange={(e) => form.handleChange({ currency: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { if (form.isDirty) { handleDiscard(); } else { setModalOpen(false); } }}
              className="px-4 py-2 border border-border-strong rounded-md text-text-primary hover:bg-surface-hover">
              {t('common.cancel')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50">
              {saving ? t('common.saving') : (editingId ? t('common.update') : t('common.create'))}
            </button>
          </div>
        </div>
      </Modal>

      <EntityHistoryModal isOpen={!!historyContract} onClose={() => setHistoryContract(null)} entityId={historyContract?.id} entityName={historyContract?.name} loadHistory={contractApi.history} />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        danger
        titleKey="contracts.deleteConfirm"
        message={pendingDelete ? t('common.confirmDeleteNamed', { name: pendingDelete.name }) : undefined}
      />
    </div>
  );
};

export default Contracts;

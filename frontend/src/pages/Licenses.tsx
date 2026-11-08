
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClockIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { licenseApi } from '../services/api';
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
import { useListQuery } from '../hooks/useListQuery';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { formatApiError } from '../utils/apiError';
import { statusBadgeClass, type StatusKind } from '../utils/statusHelpers';

interface License {
  id: string;
  title: string;
  name?: string; // legacy alias for title
  displayId?: string;
  description?: string;
  vendor?: string;
  licenseType?: string;
  type?: string; // legacy alias
  status?: string;
  licenseKey?: string;
  seats?: number;
  usedSeats?: number; // legacy, not persisted — for display only
  licensingBasis?: 'user' | 'device';
  assignmentModel?: 'named' | 'concurrent';
  purchaseDate?: string;
  expiryDate?: string;
  renewalDate?: string;
  startDate?: string;
  endDate?: string;
}

interface LicenseForm {
  title: string;
  description: string;
  vendor: string;
  licenseType: string;
  status: string;
  licenseKey: string;
  seats: string;
  licensingBasis: 'user' | 'device';
  assignmentModel: 'named' | 'concurrent';
  purchaseDate: string;
  expiryDate: string;
  renewalDate: string;
}

const initialForm: LicenseForm = {
  title: '',
  description: '',
  vendor: '',
  licenseType: 'commercial',
  status: 'active',
  licenseKey: '',
  seats: '',
  licensingBasis: 'user',
  assignmentModel: 'named',
  purchaseDate: '',
  expiryDate: '',
  renewalDate: '',
};

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors duration-fast hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary-500';
const actionIconClassName = 'h-4 w-4';

const Licenses = () => {
  const { t } = useI18n();
  // Stage 10b (LT-3): cells follow the globally persisted density preference.
  const cellClass = tableCellClass(useTableDensity());
  const breadcrumbs = useBreadcrumbs();
  const [searchParams] = useSearchParams();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  // Seed from ?search= so the global search "show all" deep-link works.
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') ?? '');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useDirtyForm<LicenseForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [historyLicense, setHistoryLicense] = useState<License | null>(null);

  useEffect(() => { loadLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Initial licenses load only; loader uses current translation fallback for this mount.
  }, []);

  // Guard against out-of-order responses: superseded/aborted loads are silent.
  const { run: runLicenseListQuery } = useListQuery();

  const loadLicenses = useCallback(async () => {
    setLoading(true);
    await runLicenseListQuery((signal) => licenseApi.list({ page: 1, limit: 100 }, { signal }), {
      onSuccess: (response) => {
        const raw = response.data?.data ?? response.data ?? [];
      // Normalize legacy field names to canonical ones
      const normalized: License[] = raw.map((l: any) => ({
        id: l.id,
        title: l.title ?? l.name ?? '',
        name: l.name ?? l.title,
        displayId: l.displayId,
        description: l.description,
        vendor: l.vendor,
        licenseType: l.licenseType ?? l.type,
        type: l.type ?? l.licenseType,
        status: l.status,
        licenseKey: l.licenseKey,
        seats: l.seats,
        usedSeats: l.usedSeats,
        licensingBasis: l.licensingBasis ?? 'user',
        assignmentModel: l.assignmentModel ?? 'named',
        purchaseDate: l.startDate ?? l.purchaseDate,
        expiryDate: l.endDate ?? l.expiryDate,
        renewalDate: l.renewalDate,
      }));
        setLicenses(normalized);
      },
      onError: (err: unknown) => { setError(formatApiError(err, t('licenses.loadError'), t('common.referenceId'))); },
      onSettled: () => setLoading(false),
    });
  }, [runLicenseListQuery, t]);

  const filtered = licenses.filter(l => {
    const matchesSearch = !searchTerm ||
      (l.title && l.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.displayId && l.displayId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (l.vendor && l.vendor.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = !filterStatus || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Client-side sort persisted in localStorage (survives reload/revisit).
  const { sort, toggleSort } = useLocalSort({
    routeKey: 'licenses',
    defaultSort: { column: 'name', direction: 'asc' },
  });

  const sortedLicenses = useMemo(() => {
    if (!sort.column) return filtered;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (l: License) => {
      if (sort.column === 'id') return (l.displayId ?? l.id ?? '').toLowerCase();
      if (sort.column === 'name') return (l.title ?? l.name ?? '').toLowerCase();
      if (sort.column === 'vendor') return (l.vendor ?? '').toLowerCase();
      if (sort.column === 'type') return (l.licenseType ?? l.type ?? '').toLowerCase();
      if (sort.column === 'licensingBasis') return (l.licensingBasis ?? '').toLowerCase();
      if (sort.column === 'assignmentModel') return (l.assignmentModel ?? '').toLowerCase();
      if (sort.column === 'seats') return String(l.seats ?? '').toLowerCase();
      if (sort.column === 'status') return (l.status ?? '').toLowerCase();
      if (sort.column === 'expiryDate') return (l.expiryDate ?? l.endDate ?? '').toLowerCase();
      return '';
    };
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [filtered, sort]);

  const exportVisibleLicenses = () => exportCsv('licenses', [
    t('common.id'), t('common.name'), t('common.vendor'), t('common.type'),
    t('licenses.fields.licensingBasis'), t('licenses.fields.assignmentModel'),
    t('licenses.fields.seats'), t('common.status'), t('licenses.fields.expiryDate'),
  ], sortedLicenses.map((license) => [
    license.displayId || license.id,
    license.title,
    license.vendor || '',
    license.licenseType || license.type || '',
    license.licensingBasis ? t(`licenses.basis.${license.licensingBasis}`) : '',
    license.assignmentModel ? t(`licenses.model.${license.assignmentModel}`) : '',
    license.seats ?? '',
    license.status ? t(`licenses.status.${license.status}`) : '',
    license.expiryDate?.split('T')[0] || '',
  ]));

  const handleDiscard = () => {
    form.resetForm();
    setEditingId(null);
    setModalOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.values.title) { setError(t('licenses.titleRequired')); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title: form.values.title,
        description: form.values.description || undefined,
        vendor: form.values.vendor || undefined,
        licenseType: form.values.licenseType,
        status: form.values.status,
        licenseKey: form.values.licenseKey || undefined,
        seats: form.values.seats ? parseInt(form.values.seats, 10) : undefined,
        licensingBasis: form.values.licensingBasis,
        assignmentModel: form.values.assignmentModel,
        startDate: form.values.purchaseDate || undefined,
        endDate: form.values.expiryDate || undefined,
        renewalDate: form.values.renewalDate || undefined,
      };
      if (editingId) {
        await licenseApi.update(editingId, payload);
      } else {
        await licenseApi.create(payload);
      }
      setModalOpen(false);
      form.resetForm();
      setEditingId(null);
      await loadLicenses();
    } catch (err: unknown) {
      setError(formatApiError(err, t('common.saveError'), t('common.referenceId')));
    } finally { setSaving(false); }
  };

  const handleEdit = (license: License) => {
    form.setFormValues({
      title: license.title || license.name || '',
      description: license.description || '',
      vendor: license.vendor || '',
      licenseType: license.licenseType || license.type || 'commercial',
      status: license.status || 'active',
      licenseKey: license.licenseKey || '',
      seats: String(license.seats ?? ''),
      licensingBasis: license.licensingBasis ?? 'user',
      assignmentModel: license.assignmentModel ?? 'named',
      purchaseDate: license.startDate ?? license.purchaseDate ?? '',
      expiryDate: license.endDate ?? license.expiryDate ?? '',
      renewalDate: license.renewalDate || '',
    });
    setEditingId(license.id);
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
      await licenseApi.delete(id);
      await loadLicenses();
    } catch (err: unknown) {
      setError(formatApiError(err, t('common.deleteError'), t('common.referenceId')));
    }
  };

  const getDaysUntilExpiry = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const statusColor = (status?: string): string => {
    const kind: StatusKind = (() => {
      switch (status?.toLowerCase()) {
        case 'active': return 'ok';
        case 'expired': return 'critical';
        case 'expiring_soon': return 'warn';
        default: return 'idle';
      }
    })();
    return statusBadgeClass(kind);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title={t('licenses.title')} breadcrumbs={breadcrumbs} />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('licenses.title')}
        breadcrumbs={breadcrumbs}
        actions={(
          <button onClick={() => { form.resetForm(); setEditingId(null); setModalOpen(true); }}
            className="bg-primary-600 dark:bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-700 dark:hover:bg-primary-600">
            {t('licenses.newLicense')}
          </button>
        )}
      />

      {error && <div className="bg-status-critical-bg text-status-critical-fg p-3 rounded mb-4">{error}</div>}

      <div className="flex gap-4 mb-4">
        <input type="text" placeholder={t('licenses.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-border-strong rounded-md">
          <option value="">{t('common.allStatuses')}</option>
          <option value="active">{t('licenses.status.active')}</option>
          <option value="expired">{t('licenses.status.expired')}</option>
          <option value="expiring_soon">{t('licenses.status.expiring_soon')}</option>
        </select>
      </div>

      <DataTableShell onExport={exportVisibleLicenses} exportLabel="Export CSV" rowCount={sortedLicenses.length} densityLabel={t('dataTable.density')} compactLabel={t('dataTable.compact')} comfortableLabel={t('dataTable.comfortable')}>
        <table className="min-w-full divide-y divide-border-subtle">
          <thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted">
            <tr>
              <SortableTh column="id" label={t('common.id')} activeColumn={sort.column} direction={sort.column === 'id' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="name" label={t('common.name')} activeColumn={sort.column} direction={sort.column === 'name' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="vendor" label={t('common.vendor')} activeColumn={sort.column} direction={sort.column === 'vendor' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="type" label={t('common.type')} activeColumn={sort.column} direction={sort.column === 'type' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="licensingBasis" label={t('licenses.fields.licensingBasis')} activeColumn={sort.column} direction={sort.column === 'licensingBasis' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="assignmentModel" label={t('licenses.fields.assignmentModel')} activeColumn={sort.column} direction={sort.column === 'assignmentModel' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="seats" label={t('licenses.fields.seats')} activeColumn={sort.column} direction={sort.column === 'seats' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="status" label={t('common.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="expiryDate" label={t('licenses.fields.expiryDate')} activeColumn={sort.column} direction={sort.column === 'expiryDate' ? sort.direction : ''} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 text-left text-caption text-text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-surface-default divide-y divide-border-subtle">
            {sortedLicenses.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8"><EmptyState titleKey="licenses.noLicenses" /></td></tr>
            ) : sortedLicenses.map(l => {
              const daysLeft = getDaysUntilExpiry(l.expiryDate);
              return (
                <tr key={l.id} className="transition-colors duration-fast hover:bg-surface-hover">
                  <td className={`${cellClass} text-body2 tabular-nums text-text-muted`}>{l.displayId || l.id}</td>
                  <td className={`${cellClass} text-body2 font-medium text-text-primary`}>{l.title}</td>
                  <td className={`${cellClass} text-body2 text-text-secondary`}>{l.vendor || '-'}</td>
                  <td className={`${cellClass} text-body2 text-text-secondary capitalize`}>{l.licenseType || l.type || '-'}</td>
                  <td className={`${cellClass} text-body2 text-text-secondary capitalize`}>{l.licensingBasis ? t(`licenses.basis.${l.licensingBasis}`) : '-'}</td>
                  <td className={`${cellClass} text-body2 text-text-secondary capitalize`}>{l.assignmentModel ? t(`licenses.model.${l.assignmentModel}`) : '-'}</td>
                  <td className={`${cellClass} text-body2 tabular-nums text-text-secondary`}>{l.seats ?? '-'}</td>
                  <td className={`${cellClass}`}><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(l.status)}`}>{l.status ? t(`licenses.status.${l.status}`) : '-'}</span></td>
                  <td className={`${cellClass} text-body2 tabular-nums`}>
                    {l.expiryDate ? (
                      <span className={daysLeft !== null && daysLeft <= 30 ? 'text-status-critical-fg font-medium' : 'text-text-muted'}>
                        {l.expiryDate.split('T')[0]}
                        {daysLeft !== null && daysLeft <= 60 && <span className="ml-1 text-xs">({daysLeft}d)</span>}
                      </span>
                    ) : '-'}
                  </td>
                  <td className={`${cellClass} text-body2`}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(l)} aria-label={`${t('common.edit')}: ${l.title}`} title={t('common.edit')} className={`${actionButtonClassName} text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300`}>
                        <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      <button onClick={() => setHistoryLicense(l)} aria-label={`${t('history.viewHistory')}: ${l.title}`} title={t('history.viewHistory')} className={`${actionButtonClassName} text-text-secondary hover:text-text-primary`}>
                        <ClockIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      <button onClick={() => handleDelete(l.id, l.title)} aria-label={`${t('common.delete')}: ${l.title}`} title={t('common.delete')} className={`${actionButtonClassName} text-status-critical-fg hover:text-status-critical-fg`}>
                        <TrashIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>

      <Modal isOpen={modalOpen} onClose={() => { if (form.isDirty) { handleDiscard(); } else { setModalOpen(false); } }} title={editingId ? t('licenses.editLicense') : t('licenses.newLicense')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('common.name')} *</label>
            <input type="text" value={form.values.title} onChange={(e) => form.handleChange({ title: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('common.description')}</label>
            <textarea value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.vendor')}</label>
              <input type="text" value={form.values.vendor} onChange={(e) => form.handleChange({ vendor: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('common.type')}</label>
              <select value={form.values.licenseType} onChange={(e) => form.handleChange({ licenseType: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="commercial">{t('licenses.types.commercial')}</option>
                <option value="open_source">{t('licenses.types.open_source')}</option>
                <option value="subscription">{t('licenses.types.subscription')}</option>
                <option value="perpetual">{t('licenses.types.perpetual')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.licensingBasis')}</label>
              <select value={form.values.licensingBasis} onChange={(e) => form.handleChange({ licensingBasis: e.target.value as 'user' | 'device' })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="user">{t('licenses.basis.user')}</option>
                <option value="device">{t('licenses.basis.device')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.assignmentModel')}</label>
              <select value={form.values.assignmentModel} onChange={(e) => form.handleChange({ assignmentModel: e.target.value as 'named' | 'concurrent' })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="named">{t('licenses.model.named')}</option>
                <option value="concurrent">{t('licenses.model.concurrent')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.licenseKey')}</label>
              <input type="text" value={form.values.licenseKey} onChange={(e) => form.handleChange({ licenseKey: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.seats')}</label>
              <input type="number" min="0" value={form.values.seats} onChange={(e) => form.handleChange({ seats: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.startDate')}</label>
              <input type="date" value={form.values.purchaseDate} onChange={(e) => form.handleChange({ purchaseDate: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.endDate')}</label>
              <input type="date" value={form.values.expiryDate} onChange={(e) => form.handleChange({ expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">{t('licenses.fields.renewalDate')}</label>
              <input type="date" value={form.values.renewalDate} onChange={(e) => form.handleChange({ renewalDate: e.target.value })}
                className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">{t('common.status')}</label>
            <select value={form.values.status} onChange={(e) => form.handleChange({ status: e.target.value })}
              className="w-full px-3 py-2 border border-border-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="active">{t('licenses.status.active')}</option>
              <option value="expiring_soon">{t('licenses.status.expiring_soon')}</option>
              <option value="expired">{t('licenses.status.expired')}</option>
              <option value="suspended">{t('licenses.status.suspended')}</option>
            </select>
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

      <EntityHistoryModal isOpen={!!historyLicense} onClose={() => setHistoryLicense(null)} entityId={historyLicense?.id} entityName={historyLicense?.title} loadHistory={licenseApi.history} />

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        danger
        titleKey="licenses.deleteConfirm"
        message={pendingDelete ? t('common.confirmDeleteNamed', { name: pendingDelete.name }) : undefined}
      />
    </div>
  );
};

export default Licenses;

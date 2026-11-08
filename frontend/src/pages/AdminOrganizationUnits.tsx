import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../services/api';
import { entitySearchEndpoint } from '../services/entityPickerApi';
import { Modal } from '../components/Modal';
import EntitySearchSelect from '../components/EntitySearchSelect';
import { useI18n } from '../context/I18nContext';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Field, FieldInput, FieldTextarea } from '../components/FormRow';
import { formatApiError } from '../utils/apiError';

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
  // Archive confirmation owned by the styled ConfirmDialog (replaces the native browser dialog).
  const [pendingArchive, setPendingArchive] = useState<{ id: string; name: string } | null>(null);
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
      setError(formatApiError(err, t('organizationUnits.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = useMemo(() => units.filter((unit) => {
    const term = searchTerm.toLowerCase();
    return unit.name.toLowerCase().includes(term) || (unit.description || '').toLowerCase().includes(term) || (unit.type || '').toLowerCase().includes(term);
  }), [searchTerm, units]);

  // Reuse the shared entity-picker organization-unit search, excluding the
  // unit currently being edited so it cannot become its own parent.
  const searchParentUnits = async (q: string) => {
    try {
      const items = await entitySearchEndpoint('organizationUnit')(q);
      return items.filter((unit) => unit.id !== editingUnit?.id);
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
      setError(formatApiError(err, t('organizationUnits.saveError'), t('common.referenceId')));
      setSaving(false);
    } finally {
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleArchive = (unit: OrganizationUnit) => setPendingArchive({ id: unit.id, name: unit.name });

  const confirmArchive = async () => {
    if (!pendingArchive) return;
    const { id } = pendingArchive;
    setPendingArchive(null);
    try {
      await adminApi.archiveOrganizationUnit(id);
      setSuccess(t('organizationUnits.archiveSuccess'));
      await loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('organizationUnits.archiveError'), t('common.referenceId')));
    }
  };

  const handleRestore = async (unit: OrganizationUnit) => {
    try {
      await adminApi.restoreOrganizationUnit(unit.id);
      setSuccess(t('organizationUnits.restoreSuccess'));
      await loadUnits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('organizationUnits.restoreError'), t('common.referenceId')));
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
        <h1 className="text-2xl font-bold text-text-primary dark:text-white">{t('organizationUnits.title')}</h1>
        <button onClick={openCreateModal} className="bg-primary-600 dark:bg-primary-500 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 dark:hover:bg-primary-600">
          {t('organizationUnits.newUnit')}
        </button>
      </div>

      {error && <div role="alert" className="bg-status-critical-bg border border-border-subtle text-status-critical-fg px-4 py-3 rounded-md">{error}</div>}
      {success && <div className="bg-status-ok-bg border border-border-subtle text-status-ok-fg px-4 py-3 rounded-md">{success}</div>}

      <div className="bg-surface-default dark:bg-surface-sunken rounded-lg shadow">
        <div className="p-4 border-b border-border-subtle dark:border-border-subtle flex flex-col md:flex-row gap-3 md:items-center">
          <input type="text" placeholder={t('organizationUnits.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-3 py-2 border border-border-strong dark:border-border-strong dark:bg-surface-sunken dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <label className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-muted">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            {t('organizationUnits.includeArchived')}
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted dark:text-text-muted">{t('organizationUnits.loading')}</div>
        ) : filteredUnits.length === 0 ? (
          <div className="p-8 text-center text-text-muted dark:text-text-muted">{t('organizationUnits.noUnits')}</div>
        ) : (
          <div className="divide-y divide-border-subtle dark:divide-border-subtle">
            {filteredUnits.map((unit) => (
              <div key={unit.id} className={`p-4 ${unit.isArchived ? 'bg-surface-sunken dark:bg-surface-sunken opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-text-primary dark:text-white truncate">{unit.name}</h2>
                      {unit.isArchived && <span className="text-xs text-text-muted bg-surface-sunken dark:bg-surface-sunken dark:text-text-muted px-2 py-0.5 rounded">{t('organizationUnits.archived')}</span>}
                    </div>
                    <div className="mt-1 text-xs text-text-muted dark:text-text-muted">{unit.type || t('organizationUnits.noType')} · {t('organizationUnits.parent')}: {unit.parent?.name || '-'}</div>
                    {unit.description && <p className="mt-2 text-sm text-text-muted dark:text-text-muted">{unit.description}</p>}
                    <div className="mt-2 text-xs text-text-muted dark:text-text-muted">
                      {t('organizationUnits.children')}: {unit._count?.children ?? 0} · {t('organizationUnits.users')}: {unit._count?.users ?? 0} · {t('organizationUnits.assets')}: {unit._count?.assets ?? 0} · {t('organizationUnits.risks')}: {unit._count?.risks ?? 0} · {t('organizationUnits.implementations')}: {unit._count?.controlImplementations ?? 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    {!unit.isArchived && <button onClick={() => openEditModal(unit)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300">{t('common.edit')}</button>}
                    {unit.isArchived ? <button onClick={() => handleRestore(unit)} className="text-status-ok-fg hover:underline">{t('organizationUnits.restore')}</button> : <button onClick={() => handleArchive(unit)} className="text-status-warn-fg hover:underline">{t('organizationUnits.archive')}</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={handleModalClose} title={editingUnit ? t('organizationUnits.editUnit') : t('organizationUnits.newUnit')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
        <div className="space-y-4">
          <Field label={t('common.name')}>
            <FieldInput value={form.values.name} onChange={(e) => form.handleChange({ name: e.target.value })} />
          </Field>
          <Field label={t('organizationUnits.type')}>
            <FieldInput value={form.values.type} onChange={(e) => form.handleChange({ type: e.target.value })} placeholder={t('organizationUnits.typePlaceholder')} />
          </Field>
          <div>
            <label className="block text-body2 font-medium text-text-secondary mb-1">{t('organizationUnits.parent')}</label>
            <EntitySearchSelect label={t('organizationUnits.parent')} searchEndpoint={searchParentUnits} value={parentOption} onChange={setParentOption} placeholder={t('organizationUnits.searchParentPlaceholder')} />
            {parentOption && <button onClick={() => setParentOption(null)} className="mt-2 text-xs text-text-muted hover:text-text-primary">{t('organizationUnits.clearParent')}</button>}
          </div>
          <Field label={t('organizationUnits.description')}>
            <FieldTextarea value={form.values.description} onChange={(e) => form.handleChange({ description: e.target.value })} rows={3} />
          </Field>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }} className="px-4 py-2 text-sm text-text-secondary dark:text-text-muted border border-border-strong dark:border-border-strong rounded-md hover:bg-surface-hover dark:hover:bg-surface-sunken">{t('common.cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-600 disabled:opacity-50">{saving ? t('common.saving') : editingUnit ? t('common.update') : t('common.create')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingArchive}
        onClose={() => setPendingArchive(null)}
        onConfirm={() => void confirmArchive()}
        danger
        titleKey="organizationUnits.archiveConfirm"
        message={pendingArchive ? t('common.archiveNamed', { name: pendingArchive.name }) : undefined}
      />
    </div>
  );
};

export default AdminOrganizationUnits;

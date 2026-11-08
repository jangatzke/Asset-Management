import { useCallback, useEffect, useState, useMemo } from 'react';
import { PlusIcon, PencilSquareIcon, TrashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { PERMISSION_GROUPS } from '@shared/permissions';
import { adminApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatApiError } from '../utils/apiError';

type Role = { id: string; name: string; description?: string | null; isBuiltIn: boolean; canAccessAdmin: boolean; permissionNames: string[] };
type RoleForm = { name: string; description: string; permissionNames: string[]; canAccessAdmin: boolean };
const emptyForm = (): RoleForm => ({ name: '', description: '', permissionNames: [], canAccessAdmin: false });

const permissionCountBadge = (count: number) => {
  if (count === 0) return 'bg-surface-sunken text-text-muted';
  if (count >= 10) return 'bg-status-ok-bg text-status-ok-fg';
  return 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200';
};

const AdminRoles = () => {
  const { t } = useI18n();
  const { addToast } = useToast();
  const messageFrom = (error: unknown, fallback: string) => formatApiError(error, fallback, t('common.referenceId'));
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const form = useDirtyForm<RoleForm>(emptyForm());

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try { setRoles((await adminApi.getRoles()).data); }
    catch (error) { addToast('error', messageFrom(error, t('roles.loadError'))); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messageFrom is recreated each render and only wraps translation fallbacks; adding it would refetch roles in a loop.
  }, [addToast, t]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const openCreate = () => { setSelectedRole(null); form.setFormValues(emptyForm()); setModalOpen(true); };
  const openEdit = async (role: Role) => {
    setSelectedRole(role);
    try {
      const loaded = (await adminApi.getRole(role.id)).data as Role;
      form.setFormValues({ name: loaded.name, description: loaded.description ?? '', permissionNames: loaded.permissionNames, canAccessAdmin: loaded.canAccessAdmin });
      setModalOpen(true);
    } catch (error) { addToast('error', messageFrom(error, t('roles.loadError'))); }
  };
  const togglePermission = (permission: string) => form.handleChange({ permissionNames: form.values.permissionNames.includes(permission) ? form.values.permissionNames.filter((value) => value !== permission) : [...form.values.permissionNames, permission] });
  // Admin access and administration.access are the same grant (the backend derives
  // canAccessAdmin from that permission) - keep both in sync so the Administration
  // group is rendered exclusively through the checkbox instead of appearing twice.
  const toggleCanAccessAdmin = () => {
    const next = !form.values.canAccessAdmin;
    const permissionNames = next
      ? [...new Set([...form.values.permissionNames, 'administration.access'])]
      : form.values.permissionNames.filter((value) => value !== 'administration.access');
    form.handleChange({ canAccessAdmin: next, permissionNames });
  };
  const save = async () => {
    if (!form.values.name.trim()) { addToast('error', t('roles.nameRequired')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form.values,
        name: form.values.name.trim(),
        permissionNames: form.values.canAccessAdmin
          ? [...new Set([...form.values.permissionNames, 'administration.access'])]
          : form.values.permissionNames.filter((value) => value !== 'administration.access'),
      };
      if (selectedRole) await adminApi.updateRole(selectedRole.id, payload); else await adminApi.createRole(payload);
      addToast('success', selectedRole ? t('roles.roleUpdated') : t('roles.roleCreated'));
      setModalOpen(false); setSaving(false); await loadRoles();
    } catch (error) { addToast('error', messageFrom(error, t('roles.saveError'))); setSaving(false); }
  };
  // Deletion confirmation owned by the styled ConfirmDialog (replaces the native browser dialog).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const remove = (id: string, name: string) => setPendingDelete({ id, name });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try { await adminApi.deleteRole(id); addToast('success', t('roles.roleDeleted')); await loadRoles(); }
    catch (error) { addToast('error', messageFrom(error, t('roles.saveError'))); }
  };

  const handleModalClose = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleDiscard = () => {
    form.resetForm();
    setModalOpen(false);
  };

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-roles', defaultSort: { column: 'name', direction: 'asc' } });
  const sortedRoles = useMemo(() => {
    if (!sort.column) return roles;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (r: Role) => {
      if (sort.column === 'name') return (r.name ?? '').toLowerCase();
      if (sort.column === 'description') return (r.description ?? '').toLowerCase();
      if (sort.column === 'permissions') return String(r.permissionNames ?? []).length;
      return '';
    };
    return [...roles].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [roles, sort]);

  const exportVisibleRoles = () => exportCsv('roles', [
    t('common.name'), t('common.description'), t('roles.permissions'),
  ], sortedRoles.map((role) => [
    role.name,
    role.description || '',
    role.permissionNames.join('; '),
  ]));

  return <div>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{t('navigation.roleManagement')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('roles.subtitle')}</p>
      </div>
      <button
        onClick={openCreate}
        className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        {t('roles.newRole')}
      </button>
    </div>

    {loading ? <div className="text-center py-8 text-text-muted">{t('common.loading')}</div> : (
      <DataTableShell onExport={exportVisibleRoles} exportLabel="Export CSV">
        <table className="min-w-full divide-y divide-border-subtle">
          <thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted">
            <tr>
              <SortableTh column="name" label={t('common.name')} activeColumn={sort.column} direction={sort.column === 'name' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="description" label={t('common.description')} activeColumn={sort.column} direction={sort.column === 'description' ? sort.direction : ''} onSort={toggleSort} />
              <SortableTh column="permissions" label={t('roles.permissions')} activeColumn={sort.column} direction={sort.column === 'permissions' ? sort.direction : ''} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 text-left text-caption text-text-muted">{t('roles.adminAccess')}</th>
              <th scope="col" className="px-4 py-2.5 text-left text-caption text-text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-surface-default divide-y divide-border-subtle">
            {sortedRoles.map((role) => (
              <tr key={role.id} className="transition-colors duration-fast hover:bg-surface-hover">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{role.name}</span>
                    {role.isBuiltIn && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-surface-sunken text-text-secondary">
                        {t('roles.builtIn')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-md">
                  <span className="text-text-secondary">{role.description || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center min-w-[2.25rem] rounded-full px-2 py-0.5 text-xs font-semibold ${permissionCountBadge(role.permissionNames.length)}`}>
                    {role.permissionNames.length}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {role.canAccessAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-status-warn-bg text-status-warn-fg">
                      <ShieldCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('roles.adminAccess')}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void openEdit(role)}
                      disabled={role.isBuiltIn}
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline disabled:text-text-muted disabled:no-underline disabled:cursor-not-allowed"
                    >
                      <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                      {t('common.edit')}
                    </button>
                    {!role.isBuiltIn && (
                      <button onClick={() => remove(role.id, role.name)} className="inline-flex items-center gap-1 text-critical-600 hover:underline">
                        <TrashIcon className="h-4 w-4" aria-hidden="true" />
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    )}

    <Modal
      isOpen={modalOpen}
      onClose={handleModalClose}
      maxWidthClassName="max-w-4xl"
      title={selectedRole ? t('roles.editRole') : t('roles.createRole')}
      isDirty={form.isDirty && !saving}
      onDiscardConfirm={handleDiscard}
    >
      <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-primary">{t('roles.roleName')}</span>
            <input
              value={form.values.name}
              onChange={(event) => form.handleChange({ name: event.target.value })}
              className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('roles.roleName')}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-primary">{t('roles.roleDescription')}</span>
            <textarea
              value={form.values.description}
              onChange={(event) => form.handleChange({ description: event.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-border-subtle rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={t('roles.roleDescription')}
            />
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2.5 cursor-pointer hover:bg-surface-hover">
          <input
            type="checkbox"
            checked={form.values.canAccessAdmin}
            onChange={toggleCanAccessAdmin}
            className="h-4 w-4 rounded border-border-subtle text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-text-primary">{t('roles.adminAccess')}</span>
          <span className="text-xs text-text-muted">({t('roles.adminAccessHint')})</span>
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">{t('roles.permissions')}</span>
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200">
              {form.values.permissionNames.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[38vh] overflow-y-auto pr-1">
            {Object.entries(PERMISSION_GROUPS)
              .filter(([group]) => group !== 'Administration')
              .map(([group, permissions]) => (
              <fieldset key={group} className="rounded-md border border-border-subtle p-2">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{t(`permissionGroups.${group}`)}</legend>
                <div className="mt-1 space-y-1">
                  {permissions.map((permission) => (
                    <label key={permission} className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.values.permissionNames.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        className="h-3.5 w-3.5 rounded border-border-subtle text-primary-600 focus:ring-primary-500"
                      />
                      <span>{permission}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }}
            className="px-4 py-2 text-sm border border-border-subtle rounded-md text-text-primary hover:bg-surface-hover"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {t('common.save')}
          </button>
        </div>
      </form>
    </Modal>

    <ConfirmDialog
      isOpen={!!pendingDelete}
      onClose={() => setPendingDelete(null)}
      onConfirm={() => void confirmDelete()}
      danger
      titleKey="common.confirmDelete"
      message={pendingDelete ? t('common.confirmDeleteNamed', { name: pendingDelete.name }) : undefined}
    />
  </div>;
};
export default AdminRoles;

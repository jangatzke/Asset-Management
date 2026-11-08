import { useState, useEffect, useCallback, useMemo } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { adminApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell, tableCellClass, useTableDensity } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorAlert } from '../components/ErrorAlert';
import { EmptyState } from '../components/EmptyState';
import { formatApiError } from '../utils/apiError';
import { statusBadgeClass } from '../utils/statusHelpers';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  isActive: boolean;
  roles: string[];
  groups?: string[];
  isOidcLinked?: boolean;
  oidcProvider?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Role {
  name: string;
  description: string;
}

interface CreateUserForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  roles: string[];
}

interface EditUserForm {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

const initialForm: CreateUserForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  roles: ['employee'],
};

const initialEditForm: EditUserForm = {
  email: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
};

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors duration-fast hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-primary-500';
const actionIconClassName = 'h-4 w-4';

const AdminUsers = () => {
  const { t } = useI18n();
  // Stage 10b (LT-3): cells follow the globally persisted density preference.
  const cellClass = tableCellClass(useTableDensity());
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // Deletion confirmation owned by the styled ConfirmDialog (replaces the native browser dialog).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const createForm = useDirtyForm<CreateUserForm>(initialForm);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const editForm = useDirtyForm<EditUserForm>(initialEditForm);

  const formatUserLabel = (key: string, user: User) =>
    t(key).replace('{name}', `${user.firstName} ${user.lastName}`);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminApi.listUsers();
      setUsers(response.data || []);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.loadError'), t('common.referenceId')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadRoles = useCallback(async () => {
    try {
      const response = await adminApi.getRoles();
      setRoles(response.data || []);
    } catch (err) {
      // Roles may not load
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers, loadRoles]);

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-users', defaultSort: { column: 'email', direction: 'asc' } });
  const sortedUsers = useMemo(() => {
    if (!sort.column) return filteredUsers;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (u: User) => {
      if (sort.column === 'user') return `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      if (sort.column === 'email') return (u.email ?? '').toLowerCase();
      if (sort.column === 'account') return u.isOidcLinked ? `oidc ${u.oidcProvider ?? ''}`.toLowerCase() : 'local';
      if (sort.column === 'roles') return (u.roles ?? []).join(', ').toLowerCase();
      if (sort.column === 'groups') return (u.groups ?? []).join(', ').toLowerCase();
      if (sort.column === 'status') return u.isActive ? 'active' : 'inactive';
      return '';
    };
    return [...filteredUsers].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [filteredUsers, sort]);

  const exportVisibleUsers = () => exportCsv('users', [
    t('adminUsers.columns.user'), t('adminUsers.columns.email'), t('adminUsers.columns.account'),
    t('adminUsers.columns.roles'), t('adminUsers.columns.groups'), t('adminUsers.columns.status'),
  ], sortedUsers.map((user) => [
    `${user.firstName} ${user.lastName}`.trim(),
    user.email,
    user.isOidcLinked ? `${t('adminUsers.account.oidc')} ${user.oidcProvider || ''}`.trim() : t('adminUsers.account.local'),
    user.roles.join('; '),
    (user.groups ?? []).join('; '),
    user.isActive ? t('common.active') : t('common.inactive'),
  ]));

  const handleCreate = async () => {
    if (!createForm.values.email || !createForm.values.firstName || !createForm.values.lastName) {
      setError(t('adminUsers.messages.requiredUserFields'));
      return;
    }
    if (!createForm.values.password) {
      setError(t('adminUsers.messages.passwordRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await adminApi.createUser(createForm.values);
      setSuccess(t('adminUsers.messages.createSuccess'));
      setCreateModalOpen(false);
      createForm.resetForm();
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.createError'), t('common.referenceId')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: User) => setPendingDelete({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim() || user.email });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      await adminApi.deleteUser(id);
      setSuccess(t('adminUsers.messages.deleteSuccess'));
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.deleteError'), t('common.referenceId')));
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      setSuccess(user.isActive ? t('adminUsers.messages.deactivateSuccess') : t('adminUsers.messages.activateSuccess'));
      setSelectedUser({ ...user, isActive: !user.isActive });
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.updateError'), t('common.referenceId')));
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    editForm.setFormValues({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber || '',
    });
    setSelectedRoles([...user.roles]);
    setError('');
    setEditModalOpen(true);
  };

  const handleDiscardEdit = () => {
    editForm.resetForm();
    setSelectedRoles([]);
    setEditModalOpen(false);
    setSelectedUser(null);
    setError('');
  };

  const closeEditModal = () => {
    if (editForm.isDirty) {
      handleDiscardEdit();
    } else {
      setEditModalOpen(false);
      setSelectedUser(null);
      setSelectedRoles([]);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    if (!editForm.values.email || !editForm.values.firstName || !editForm.values.lastName) {
      setError(t('adminUsers.messages.requiredUserFields'));
      return;
    }

    setSavingEdit(true);
    setError('');
    try {
      const payload = {
        email: editForm.values.email,
        firstName: editForm.values.firstName,
        lastName: editForm.values.lastName,
        phoneNumber: editForm.values.phoneNumber || null,
      };
      const response = await adminApi.updateUser(selectedUser.id, payload);
      setSelectedUser(response.data || { ...selectedUser, ...payload });
      setSuccess(t('adminUsers.messages.updateSuccess'));
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.updateError'), t('common.referenceId')));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    if (selectedRoles.length === 0) {
      setError(t('adminUsers.messages.roleRequired'));
      return;
    }

    setSavingRoles(true);
    setError('');
    try {
      const response = await adminApi.assignRoles(selectedUser.id, selectedRoles);
      setSuccess(t('adminUsers.messages.rolesUpdateSuccess'));
      setSelectedUser(response.data || { ...selectedUser, roles: selectedRoles });
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.rolesUpdateError'), t('common.referenceId')));
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleRole = (roleName: string) => {
    if (selectedRoles.includes(roleName)) {
      // Prevent removing the last role
      if (selectedRoles.length <= 1) {
        setError(t('adminUsers.messages.roleRequired'));
        return;
      }
      setSelectedRoles(selectedRoles.filter((r) => r !== roleName));
    } else {
      setSelectedRoles([...selectedRoles, roleName]);
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = prompt(t('adminUsers.messages.passwordPrompt'));
    if (!newPassword || newPassword.length < 6) {
      if (newPassword) setError(t('adminUsers.messages.passwordMinLength'));
      return;
    }

    try {
      await adminApi.changePassword(userId, newPassword);
      setSuccess(t('adminUsers.messages.passwordResetSuccess'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(formatApiError(err, t('adminUsers.messages.passwordResetError'), t('common.referenceId')));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">{t('adminUsers.title')}</h1>
        <button
          onClick={() => {
            createForm.resetForm();
            setError('');
            setCreateModalOpen(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          {t('adminUsers.newUser')}
        </button>
      </div>

      {error && <ErrorAlert message={error} />}
      {success && (
        <div className="bg-status-ok-bg text-status-ok-fg px-4 py-3 rounded-md" role="status">
          {success}
        </div>
      )}

      <DataTableShell onExport={exportVisibleUsers} exportLabel="Export CSV">
        <div className="p-4 border-b border-border-subtle">
          <input
            type="text"
            placeholder={t('adminUsers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted">{t('adminUsers.loading')}</div>
        ) : (
          <table className="w-full divide-y divide-border-subtle">
            <thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted">
              <tr>
                <SortableTh column="user" label={t('adminUsers.columns.user')} activeColumn={sort.column} direction={sort.column === 'user' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="email" label={t('adminUsers.columns.email')} activeColumn={sort.column} direction={sort.column === 'email' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="account" label={t('adminUsers.columns.account')} activeColumn={sort.column} direction={sort.column === 'account' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="roles" label={t('adminUsers.columns.roles')} activeColumn={sort.column} direction={sort.column === 'roles' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="groups" label={t('adminUsers.columns.groups')} activeColumn={sort.column} direction={sort.column === 'groups' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="status" label={t('adminUsers.columns.status')} activeColumn={sort.column} direction={sort.column === 'status' ? sort.direction : ''} onSort={toggleSort} />
                <th scope="col" className="px-4 py-2.5 text-left text-caption text-text-muted">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-surface-default divide-y divide-border-subtle">
              {sortedUsers.map((user) => (
                <tr key={user.id} className="transition-colors duration-fast hover:bg-surface-hover">
                  <td className={`${cellClass} text-body2`}>
                    <div className="font-medium text-text-primary">
                      {user.firstName} {user.lastName}
                    </div>
                    {user.phoneNumber && (
                      <div className="text-xs text-text-muted tabular-nums">{user.phoneNumber}</div>
                    )}
                  </td>
                  <td className={`${cellClass} text-body2 text-text-secondary`}>{user.email}</td>
                  <td className={`${cellClass} text-body2`}>
                    {user.isOidcLinked ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-status-info-bg text-status-info-fg">
                        {t('adminUsers.account.oidc')} {user.oidcProvider ? `(${user.oidcProvider})` : ''}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-status-idle-bg text-status-idle-fg">
                        {t('adminUsers.account.local')}
                      </span>
                    )}
                  </td>
                  <td className={`${cellClass}`}>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-status-info-bg text-status-info-fg"
                        >
                          {role.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`${cellClass} text-body2`}>
                    <div className="flex flex-wrap gap-1">
                      {user.groups && user.groups.length > 0 ? (
                        user.groups.map((group) => (
                          <span
                            key={group}
                            className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-status-info-bg text-status-info-fg"
                          >
                            {group}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className={`${cellClass} text-body2`}>
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClass(user.isActive ? 'ok' : 'critical')}`}
                    >
                      {user.isActive ? t('adminUsers.status.active') : t('adminUsers.status.inactive')}
                    </span>
                  </td>
                  <td className={`${cellClass} text-body2`}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        aria-label={formatUserLabel('adminUsers.actions.editUser', user)}
                        title={t('common.edit')}
                        className={`${actionButtonClassName} text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300`}
                      >
                        <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() => handleDelete(user)}
                          aria-label={formatUserLabel('adminUsers.actions.deleteUser', user)}
                          title={t('common.delete')}
                          className={`${actionButtonClassName} text-status-critical-fg hover:underline`}
                        >
                          <TrashIcon aria-hidden="true" className={actionIconClassName} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && filteredUsers.length === 0 && (
          <EmptyState titleKey="adminUsers.noUsers" />
        )}
      </DataTableShell>

      {/* Create User Modal */}
      <Modal isOpen={createModalOpen} onClose={() => { if (createForm.isDirty) { createForm.resetForm(); setCreateModalOpen(false); } else { setCreateModalOpen(false); } }} title={t('adminUsers.createUser')} isDirty={createForm.isDirty && !saving} onDiscardConfirm={() => { createForm.resetForm(); setCreateModalOpen(false); setError(''); }}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.firstName')}</label>
              <input
                type="text"
                value={createForm.values.firstName}
                onChange={(e) => createForm.handleChange({ firstName: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.lastName')}</label>
              <input
                type="text"
                value={createForm.values.lastName}
                onChange={(e) => createForm.handleChange({ lastName: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.email')}</label>
            <input
              type="email"
              value={createForm.values.email}
              onChange={(e) => createForm.handleChange({ email: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.password')}</label>
            <input
              type="password"
              value={createForm.values.password}
              onChange={(e) => createForm.handleChange({ password: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.phoneOptional')}</label>
            <input
              type="text"
              value={createForm.values.phoneNumber}
              onChange={(e) => createForm.handleChange({ phoneNumber: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.roles')}</label>
            <div className="max-h-40 overflow-y-auto border border-border-subtle rounded-md p-2 space-y-1">
              {roles.map((role) => (
                <label
                  key={role.name}
                  className="flex items-center gap-2 text-sm text-text-secondary"
                >
                  <input
                    type="checkbox"
                    checked={createForm.values.roles.includes(role.name)}
                    onChange={() => {
                      const current = createForm.values.roles;
                      if (current.includes(role.name)) {
                        if (createForm.values.roles.length <= 1) return;
                        createForm.handleChange({ roles: current.filter((r) => r !== role.name) });
                      } else {
                        createForm.handleChange({ roles: [...current, role.name] });
                      }
                    }}
                    className="rounded border-border-subtle text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium">{role.name.replace(/_/g, ' ')}</span>
                  <span className="text-text-muted text-xs">{role.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => { if (createForm.isDirty) { createForm.resetForm(); setCreateModalOpen(false); } else { setCreateModalOpen(false); } }}
              className="px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-md hover:bg-surface-hover"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? t('adminUsers.creating') : t('adminUsers.createUser')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={editModalOpen} onClose={closeEditModal} title={t('adminUsers.editUser')} maxWidthClassName="max-w-3xl" isDirty={editForm.isDirty && !savingEdit} onDiscardConfirm={handleDiscardEdit}>
        {selectedUser && (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">{t('adminUsers.userDetails')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.firstName')}</label>
                  <input
                    type="text"
                    value={editForm.values.firstName}
                    onChange={(e) => editForm.handleChange({ firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.lastName')}</label>
                  <input
                    type="text"
                    value={editForm.values.lastName}
                    onChange={(e) => editForm.handleChange({ lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.email')}</label>
                <input
                  type="email"
                  value={editForm.values.email}
                  onChange={(e) => editForm.handleChange({ email: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">{t('adminUsers.fields.phoneOptional')}</label>
                <input
                  type="text"
                  value={editForm.values.phoneNumber}
                  onChange={(e) => editForm.handleChange({ phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle bg-surface-default text-text-primary rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingEdit ? t('common.saving') : t('adminUsers.saveUser')}
                </button>
              </div>
            </section>

            <section className="space-y-3 border-t border-border-subtle pt-5">
              <h3 className="text-sm font-semibold text-text-primary">{t('adminUsers.fields.roles')}</h3>
              <p className="text-sm text-text-secondary">
                {t('adminUsers.manageRolesFor')} <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email})
              </p>

              <div className="max-h-60 overflow-y-auto border border-border-subtle rounded-md p-3 space-y-2">
                {roles.map((role) => (
                  <label
                    key={role.name}
                    className="flex items-start gap-2 text-sm text-text-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.name)}
                      onChange={() => toggleRole(role.name)}
                      className="mt-0.5 rounded border-border-subtle text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium">{role.name.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-text-muted">{role.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveRoles}
                  disabled={savingRoles}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingRoles ? t('common.saving') : t('adminUsers.saveRoles')}
                </button>
              </div>
            </section>

            <section className="space-y-3 border-t border-border-subtle pt-5">
              <h3 className="text-sm font-semibold text-text-primary">{t('adminUsers.accountActions')}</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleToggleActive(selectedUser)}
                  className="px-4 py-2 text-sm text-status-warn-fg border border-status-warn-fg/30 rounded-md hover:bg-status-warn-bg"
                >
                  {selectedUser.isActive ? t('adminUsers.actions.deactivate') : t('adminUsers.actions.activate')}
                </button>
                <button
                  onClick={() => handleResetPassword(selectedUser.id)}
                  className="px-4 py-2 text-sm text-text-secondary border border-primary-300 dark:border-primary-700 rounded-md hover:bg-status-info-bg dark:hover:bg-primary-900/30"
                >
                  {t('adminUsers.actions.resetPassword')}
                </button>
              </div>
            </section>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-md hover:bg-surface-hover"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        danger
        titleKey="adminUsers.messages.deleteConfirm"
        message={pendingDelete ? t('common.confirmDeleteNamed', { name: pendingDelete.name }) : undefined}
      />
    </div>
  );
};

export default AdminUsers;

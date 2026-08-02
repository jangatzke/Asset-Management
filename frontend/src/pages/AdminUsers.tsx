import { useState, useEffect } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { adminApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuthStore } from '../store/auth';
import { useI18n } from '../context/I18nContext';

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

const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800';
const actionIconClassName = 'h-4 w-4';

const AdminUsers = () => {
  const { t } = useI18n();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(initialForm);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>(initialEditForm);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  const formatUserLabel = (key: string, user: User) =>
    t(key).replace('{name}', `${user.firstName} ${user.lastName}`);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminApi.listUsers();
      setUsers(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('adminUsers.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await adminApi.getRoles();
      setRoles(response.data || []);
    } catch (err) {
      // Roles may not load
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    if (!createForm.email || !createForm.firstName || !createForm.lastName) {
      setError(t('adminUsers.messages.requiredUserFields'));
      return;
    }
    if (!createForm.password) {
      setError(t('adminUsers.messages.passwordRequired'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await adminApi.createUser(createForm);
      setSuccess(t('adminUsers.messages.createSuccess'));
      setCreateModalOpen(false);
      setCreateForm(initialForm);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('adminUsers.messages.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('adminUsers.messages.deleteConfirm'))) return;

    try {
      await adminApi.deleteUser(id);
      setSuccess(t('adminUsers.messages.deleteSuccess'));
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('adminUsers.messages.deleteError'));
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
      setError(err.response?.data?.error?.message || t('adminUsers.messages.updateError'));
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber || '',
    });
    setSelectedRoles([...user.roles]);
    setError('');
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setSelectedUser(null);
    setEditForm(initialEditForm);
    setSelectedRoles([]);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    if (!editForm.email || !editForm.firstName || !editForm.lastName) {
      setError(t('adminUsers.messages.requiredUserFields'));
      return;
    }

    setSavingEdit(true);
    setError('');
    try {
      const payload = {
        email: editForm.email,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phoneNumber: editForm.phoneNumber || null,
      };
      const response = await adminApi.updateUser(selectedUser.id, payload);
      setSelectedUser(response.data || { ...selectedUser, ...payload });
      setSuccess(t('adminUsers.messages.updateSuccess'));
      await loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t('adminUsers.messages.updateError'));
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
      setError(err.response?.data?.error?.message || t('adminUsers.messages.rolesUpdateError'));
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
      setError(err.response?.data?.error?.message || t('adminUsers.messages.passwordResetError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('adminUsers.title')}</h1>
        <button
          onClick={() => {
            setCreateForm(initialForm);
            setError('');
            setCreateModalOpen(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          {t('adminUsers.newUser')}
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder={t('adminUsers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('adminUsers.loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('adminUsers.columns.user')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('adminUsers.columns.email')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('adminUsers.columns.account')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('adminUsers.columns.roles')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('adminUsers.columns.groups')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('adminUsers.columns.status')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {user.firstName} {user.lastName}
                    </div>
                    {user.phoneNumber && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{user.phoneNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.isOidcLinked ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {t('adminUsers.account.oidc')} {user.oidcProvider ? `(${user.oidcProvider})` : ''}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {t('adminUsers.account.local')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <span
                          key={role}
                          className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700"
                        >
                          {role.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.groups && user.groups.length > 0 ? (
                        user.groups.map((group) => (
                          <span
                            key={group}
                            className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700"
                          >
                            {group}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        user.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.isActive ? t('adminUsers.status.active') : t('adminUsers.status.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        aria-label={formatUserLabel('adminUsers.actions.editUser', user)}
                        title={t('common.edit')}
                        className={`${actionButtonClassName} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300`}
                      >
                        <PencilSquareIcon aria-hidden="true" className={actionIconClassName} />
                      </button>
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          aria-label={formatUserLabel('adminUsers.actions.deleteUser', user)}
                          title={t('common.delete')}
                          className={`${actionButtonClassName} text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300`}
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
          <div className="p-8 text-center text-gray-500">{t('adminUsers.noUsers')}</div>
        )}
      </div>

      {/* Create User Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title={t('adminUsers.createUser')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.firstName')}</label>
              <input
                type="text"
                value={createForm.firstName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, firstName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.lastName')}</label>
              <input
                type="text"
                value={createForm.lastName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, lastName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.email')}</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.password')}</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm({ ...createForm, password: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.phoneOptional')}</label>
            <input
              type="text"
              value={createForm.phoneNumber}
              onChange={(e) =>
                setCreateForm({ ...createForm, phoneNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.roles')}</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-2 space-y-1">
              {roles.map((role) => (
                <label
                  key={role.name}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={createForm.roles.includes(role.name)}
                    onChange={() => {
                      const current = createForm.roles;
                      if (current.includes(role.name)) {
                        if (createForm.roles.length <= 1) return;
                        setCreateForm({
                          ...createForm,
                          roles: current.filter((r) => r !== role.name),
                        });
                      } else {
                        setCreateForm({
                          ...createForm,
                          roles: [...current, role.name],
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="font-medium">{role.name.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">{role.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
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
      <Modal isOpen={editModalOpen} onClose={closeEditModal} title={t('adminUsers.editUser')} maxWidthClassName="max-w-3xl">
        {selectedUser && (
          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('adminUsers.userDetails')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.firstName')}</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.lastName')}</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.email')}</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('adminUsers.fields.phoneOptional')}</label>
                <input
                  type="text"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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

            <section className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('adminUsers.fields.roles')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('adminUsers.manageRolesFor')} <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email})
              </p>

              <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-3 space-y-2">
                {roles.map((role) => (
                  <label
                    key={role.name}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.name)}
                      onChange={() => toggleRole(role.name)}
                      className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <div className="font-medium">{role.name.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{role.description}</div>
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

            <section className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('adminUsers.accountActions')}</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleToggleActive(selectedUser)}
                  className="px-4 py-2 text-sm text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/30"
                >
                  {selectedUser.isActive ? t('adminUsers.actions.deactivate') : t('adminUsers.actions.activate')}
                </button>
                <button
                  onClick={() => handleResetPassword(selectedUser.id)}
                  className="px-4 py-2 text-sm text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  {t('adminUsers.actions.resetPassword')}
                </button>
              </div>
            </section>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsers;

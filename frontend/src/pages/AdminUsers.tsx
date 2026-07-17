import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuthStore } from '../store/auth';

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

const initialForm: CreateUserForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  roles: ['employee'],
};

const AdminUsers = () => {
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

  // Roles modal
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

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
      setError(err.response?.data?.error?.message || 'Failed to load users');
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
      setError('Email, first name and last name are required');
      return;
    }
    if (!createForm.password) {
      setError('Password is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await adminApi.createUser(createForm);
      setSuccess('User created successfully');;
      setCreateModalOpen(false);
      setCreateForm(initialForm);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await adminApi.deleteUser(id);
      setSuccess('User deleted successfully');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      setSuccess(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update user');
    }
  };

  const openRolesModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles([...user.roles]);
    setRolesModalOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    if (selectedRoles.length === 0) {
      setError('At least one role is required');
      return;
    }

    setSavingRoles(true);
    setError('');
    try {
      await adminApi.assignRoles(selectedUser.id, selectedRoles);
      setSuccess('Roles updated successfully');
      setRolesModalOpen(false);
      setSelectedUser(null);
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to assign roles');
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleRole = (roleName: string) => {
    if (selectedRoles.includes(roleName)) {
      // Prevent removing the last role
      if (selectedRoles.length <= 1) {
        setError('At least one role is required');
        return;
      }
      setSelectedRoles(selectedRoles.filter((r) => r !== roleName));
    } else {
      setSelectedRoles([...selectedRoles, roleName]);
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPassword = prompt('Enter new password:');
    if (!newPassword || newPassword.length < 6) {
      if (newPassword) setError('Password must be at least 6 characters');
      return;
    }

    try {
      await adminApi.changePassword(userId, newPassword);
      setSuccess('Password reset successfully. User must change on next login.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to reset password');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => {
            setCreateForm(initialForm);
            setError('');
            setCreateModalOpen(true);
          }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          + New User
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

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Roles</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Groups</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                    {user.phoneNumber && (
                      <div className="text-xs text-gray-500">{user.phoneNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    {user.isOidcLinked ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        OIDC {user.oidcProvider ? `(${user.oidcProvider})` : ''}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        Local
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
                        <span className="text-xs text-gray-400">—</span>
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
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openRolesModal(user)}
                        className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                      >
                        Roles
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleResetPassword(user.id)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Reset Password
                      </button>
                      {currentUser?.id !== user.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          Delete
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
          <div className="p-8 text-center text-gray-500">No users found</div>
        )}
      </div>

      {/* Create User Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create User">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={createForm.firstName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, firstName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={createForm.lastName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, lastName: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm({ ...createForm, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm({ ...createForm, password: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <input
              type="text"
              value={createForm.phoneNumber}
              onChange={(e) =>
                setCreateForm({ ...createForm, phoneNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
              {roles.map((role) => (
                <label
                  key={role.name}
                  className="flex items-center gap-2 text-sm text-gray-700"
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
                  <span className="text-gray-500 text-xs">{role.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Roles Modal */}
      <Modal isOpen={rolesModalOpen} onClose={() => setRolesModalOpen(false)} title="Assign Roles">
        {selectedUser && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Manage roles for <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email})
            </p>

            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 space-y-2">
              {roles.map((role) => (
                <label
                  key={role.name}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.name)}
                    onChange={() => toggleRole(role.name)}
                    className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="font-medium">{role.name.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-500">{role.description}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setRolesModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={savingRoles}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {savingRoles ? 'Saving...' : 'Save Roles'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsers;

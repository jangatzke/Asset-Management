import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';

interface Group {
  id: string;
  name: string;
  description?: string;
  users?: any[];
  roles?: any[];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Role {
  id: string;
  name: string;
}

interface GroupForm {
  name: string;
  description: string;
}

const AdminGroups = () => {
  const { t } = useI18n();
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupForm>({
    name: '',
    description: '',
  });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsRes, usersRes, rolesRes] = await Promise.all([
        adminApi.listGroups(),
        adminApi.listUsers(),
        adminApi.getRoles(),
      ]);
      setGroups(groupsRes.data);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await adminApi.createGroup(form);
      setCreateModalOpen(false);
      setForm({ name: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedGroup) return;
    try {
      await adminApi.updateGroup(selectedGroup.id, form);
      setEditModalOpen(false);
      setSelectedGroup(null);
      loadData();
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await adminApi.deleteGroup(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  const handleAssignUsers = async () => {
    if (!selectedGroup) return;
    try {
      await adminApi.assignUsersToGroup(selectedGroup.id, selectedUserIds);
      setUsersModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to assign users:', error);
    }
  };

  const handleAssignRoles = async () => {
    if (!selectedGroup) return;
    try {
      await adminApi.assignRolesToGroup(selectedGroup.id, selectedRoleIds);
      setRolesModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to assign roles:', error);
    }
  };

  const openEditModal = (group: Group) => {
    setSelectedGroup(group);
    setForm({
      name: group.name,
      description: group.description || '',
    });
    setEditModalOpen(true);
  };

  const openUsersModal = (group: Group) => {
    setSelectedGroup(group);
    setSelectedUserIds(group.users?.map((u: any) => u.id) || []);
    setUsersModalOpen(true);
  };

  const openRolesModal = (group: Group) => {
    setSelectedGroup(group);
    setSelectedRoleIds(group.roles?.map((r: any) => r.id) || []);
    setRolesModalOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('navigation.groupManagement')}
        </h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          {t('common.createNew')} {t('common.group').toLowerCase()}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
      ) : (
        <div className="bg-white dark:bg-card rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">
                  {t('common.name')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">
                  {t('common.description')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">
                  {t('common.users')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">
                  {t('common.roles')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {groups.map((group) => (
                <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {group.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {group.description || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600 dark:text-gray-300">
                      {group.users?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600 dark:text-gray-300">
                      {group.roles?.length || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(group)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => openUsersModal(group)}
                        className="text-green-600 dark:text-green-400 hover:underline text-xs"
                      >
                        {t('groups.assignUsers')}
                      </button>
                      <button
                        onClick={() => openRolesModal(group)}
                        className="text-purple-600 dark:text-purple-400 hover:underline text-xs"
                      >
                        {t('groups.assignRoles')}
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        className="text-red-600 dark:text-red-400 hover:underline text-xs"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('groups.createGroup')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.name')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-card rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={t('groups.editGroup')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.name')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('common.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-card rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Users Modal */}
      <Modal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        title={t('groups.assignUsers')}
      >
        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-card rounded-md p-2">
            {users.map((user) => (
              <label key={user.id} className="flex items-center py-1">
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUserIds([...selectedUserIds, user.id]);
                    } else {
                      setSelectedUserIds(selectedUserIds.filter((id) => id !== user.id));
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {user.firstName} {user.lastName} ({user.email})
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setUsersModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-card rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAssignUsers}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Roles Modal */}
      <Modal
        isOpen={rolesModalOpen}
        onClose={() => setRolesModalOpen(false)}
        title={t('groups.assignRoles')}
      >
        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-card rounded-md p-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center py-1">
                <input
                  type="checkbox"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRoleIds([...selectedRoleIds, role.id]);
                    } else {
                      setSelectedRoleIds(selectedRoleIds.filter((id) => id !== role.id));
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {role.name}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setRolesModalOpen(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-card rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAssignRoles}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminGroups;

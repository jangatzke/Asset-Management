import { useState, useEffect, useMemo } from 'react';
import { adminApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';
import EntityPicker from '../components/EntityPicker';
import type { EntityPickerResult } from '../services/entityPickerApi';
import { useDirtyForm } from '../hooks/useDirtyForm';
import { useLocalSort } from '../hooks/useLocalSort';
import { SortableTh } from '../components/SortableTh';
import { DataTableShell, tableCellClass, useTableDensity } from '../components/DataTableShell';
import { exportCsv } from '../utils/csvExport';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorAlert } from '../components/ErrorAlert';

interface Group {
  id: string;
  name: string;
  description?: string;
  users?: User[];
  roles?: Role[];
  userGroups?: Array<{ user: User }>;
  groupRoles?: Array<{ roleName: string; roleId?: string | null }>;
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
  // Stage 10b (LT-3): cells follow the globally persisted density preference.
  const cellClass = tableCellClass(useTableDensity());
  const [groups, setGroups] = useState<Group[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  // Deletion confirmation owned by the styled ConfirmDialog (replaces the native browser dialog).
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [assignmentError, setAssignmentError] = useState(false);
  const [savingUsers, setSavingUsers] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const createForm = useDirtyForm<GroupForm>({ name: '', description: '' });
  const editForm = useDirtyForm<GroupForm>({ name: '', description: '' });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<EntityPickerResult[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsRes, rolesRes] = await Promise.all([
        adminApi.listGroups(),
        adminApi.getRoles(),
      ]);
      setGroups(groupsRes.data);
      setRoles(rolesRes.data);
      setLoadError(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await adminApi.createGroup(createForm.values);
      setCreateModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedGroup) return;
    try {
      await adminApi.updateGroup(selectedGroup.id, editForm.values);
      setEditModalOpen(false);
      setSelectedGroup(null);
      loadData();
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  };

  const handleDelete = (id: string, name: string) => setPendingDelete({ id, name });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
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
      setSavingUsers(true);
      setAssignmentError(false);
      await adminApi.assignUsersToGroup(selectedGroup.id, selectedUserIds);
      setUsersModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Failed to assign users:', error);
      setAssignmentError(true);
    } finally {
      setSavingUsers(false);
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
    editForm.setFormValues({
      name: group.name,
      description: group.description || '',
    });
    setEditModalOpen(true);
  };

  const openUsersModal = (group: Group) => {
    setSelectedGroup(group);
    const existingUsers = group.users ?? group.userGroups?.map((assignment) => assignment.user) ?? [];
    setSelectedUserIds(existingUsers.map((user) => user.id));
    setSelectedUsers(existingUsers.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName} (${user.email})` })));
    setAssignmentError(false);
    setUsersModalOpen(true);
  };

  const openRolesModal = (group: Group) => {
    setSelectedGroup(group);
    setSelectedRoleIds(group.roles?.map((r: any) => r.id) || []);
    setRolesModalOpen(true);
  };

  const handleCreateDiscard = () => { createForm.resetForm(); setCreateModalOpen(false); };
  const handleEditDiscard = () => { editForm.resetForm(); setEditModalOpen(false); };

  const { sort, toggleSort } = useLocalSort({ routeKey: 'admin-groups', defaultSort: { column: 'name', direction: 'asc' } });
  const sortedGroups = useMemo(() => {
    if (!sort.column) return groups;
    const dir = sort.direction === 'desc' ? -1 : 1;
    const get = (g: Group) => {
      if (sort.column === 'name') return (g.name ?? '').toLowerCase();
      if (sort.column === 'description') return (g.description ?? '').toLowerCase();
      if (sort.column === 'users') return String((g.users ?? g.userGroups ?? []).length);
      if (sort.column === 'roles') return String((g.roles ?? g.groupRoles ?? []).length);
      return '';
    };
    return [...groups].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
  }, [groups, sort]);

  const exportVisibleGroups = () => exportCsv('groups', [
    t('common.name'), t('common.description'), t('common.users'), t('common.roles'),
  ], sortedGroups.map((group) => [
    group.name,
    group.description || '',
    (group.users ?? group.userGroups ?? []).length,
    (group.roles ?? group.groupRoles ?? []).length,
  ]));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {t('navigation.groupManagement')}
        </h1>
        <button
          onClick={() => { createForm.setFormValues({ name: '', description: '' }); setCreateModalOpen(true); }}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
        >
          {t('groups.createGroup')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-muted">{t('common.loading')}</div>
      ) : loadError ? (
        <ErrorAlert message={t('common.noResults')} />
      ) : (
        <DataTableShell onExport={exportVisibleGroups} exportLabel="Export CSV">
          <table className="w-full divide-y divide-border-subtle">
            <thead className="bg-surface-sunken border-b border-border-subtle text-caption text-text-muted">
              <tr>
                <SortableTh column="name" label={t('common.name')} activeColumn={sort.column} direction={sort.column === 'name' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="description" label={t('common.description')} activeColumn={sort.column} direction={sort.column === 'description' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="users" label={t('common.users')} activeColumn={sort.column} direction={sort.column === 'users' ? sort.direction : ''} onSort={toggleSort} />
                <SortableTh column="roles" label={t('common.roles')} activeColumn={sort.column} direction={sort.column === 'roles' ? sort.direction : ''} onSort={toggleSort} />
                <th scope="col" className="px-4 py-2.5 text-left text-caption text-text-muted">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-surface-default divide-y divide-border-subtle">
              {sortedGroups.map((group) => (
                <tr key={group.id} className="transition-colors duration-fast hover:bg-surface-hover">
                  <td className={`${cellClass} text-body2 font-medium text-text-primary`}>
                    {group.name}
                  </td>
                  <td className={`${cellClass} text-body2 text-text-secondary`}>
                    {group.description || '-'}
                  </td>
                  <td className={`${cellClass} text-body2`}>
                    <span className="text-text-secondary tabular-nums">
                        {(group.users ?? group.userGroups ?? []).length}
                    </span>
                  </td>
                  <td className={`${cellClass} text-body2`}>
                    <span className="text-text-secondary tabular-nums">
                        {(group.roles ?? group.groupRoles ?? []).length}
                    </span>
                  </td>
                  <td className={`${cellClass}`}>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(group)}
                        className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => openUsersModal(group)}
                        className="text-primary-600 hover:underline text-xs"
                      >
                        {t('groups.assignUsers')}
                      </button>
                      <button
                        onClick={() => openRolesModal(group)}
                        className="text-primary-600 hover:underline text-xs"
                      >
                        {t('groups.assignRoles')}
                      </button>
                      <button
                        onClick={() => handleDelete(group.id, group.name)}
                        className="text-status-critical-fg hover:underline text-xs"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('groups.createGroup')}
        isDirty={createForm.isDirty}
        onDiscardConfirm={handleCreateDiscard}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('common.name')}
            </label>
            <input
              type="text"
              value={createForm.values.name}
              onChange={(e) => createForm.handleChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle   rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('common.description')}
            </label>
            <textarea
              value={createForm.values.description}
              onChange={(e) => createForm.handleChange({ description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border-subtle   rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => { if (createForm.isDirty) { handleCreateDiscard(); } else { setCreateModalOpen(false); } }}
              className="px-4 py-2 text-sm text-text-secondary border border-border-subtle  rounded-md hover:bg-surface-hover "
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
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
        isDirty={editForm.isDirty}
        onDiscardConfirm={handleEditDiscard}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('common.name')}
            </label>
            <input
              type="text"
              value={editForm.values.name}
              onChange={(e) => editForm.handleChange({ name: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle   rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              {t('common.description')}
            </label>
            <textarea
              value={editForm.values.description}
              onChange={(e) => editForm.handleChange({ description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border-subtle   rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => { if (editForm.isDirty) { handleEditDiscard(); } else { setEditModalOpen(false); } }}
              className="px-4 py-2 text-sm text-text-secondary border border-border-subtle  rounded-md hover:bg-surface-hover "
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Users Modal */}
      <Modal
        isOpen={usersModalOpen}
        onClose={() => { setUsersModalOpen(false); setAssignmentError(false); }}
        title={t('groups.assignUsers')}
      >
        <div className="space-y-4">
          <EntityPicker
            label={t('groups.assignUsers')}
            labelKey="groups.assignUsers"
            entityType="user"
            multiple
            values={selectedUsers}
            onValuesChange={(values: EntityPickerResult[]) => {
              setSelectedUsers(values);
              setSelectedUserIds(values.map((user) => user.id));
            }}
            disabled={savingUsers}
          />
          {assignmentError && <p role="alert" className="text-sm text-status-critical-fg">{t('common.noResults')}</p>}
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => { setUsersModalOpen(false); setAssignmentError(false); }}
              disabled={savingUsers}
              className="px-4 py-2 text-sm text-text-secondary border border-border-subtle  rounded-md hover:bg-surface-hover "
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAssignUsers}
              disabled={savingUsers}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              {savingUsers ? t('common.loading') : t('common.save')}
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
          <div className="max-h-60 overflow-y-auto border border-border-subtle  rounded-md p-2">
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
                <span className="text-sm text-text-secondary">
                  {role.name}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setRolesModalOpen(false)}
              className="px-4 py-2 text-sm text-text-secondary border border-border-subtle  rounded-md hover:bg-surface-hover "
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleAssignRoles}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        danger
        titleKey="common.confirmDelete"
        message={pendingDelete ? t('common.confirmDeleteNamed', { name: pendingDelete.name }) : undefined}
      />
    </div>
  );
};

export default AdminGroups;

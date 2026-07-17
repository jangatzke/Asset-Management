import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';

// Entity types and permission levels
const ENTITY_TYPES = [
  { key: 'assets', labelKey: 'entities.assets' },
  { key: 'risks', labelKey: 'entities.risks' },
  { key: 'controls', labelKey: 'entities.controls' },
  { key: 'incidents', labelKey: 'entities.incidents' },
] as const;

const PERMISSION_LEVELS = [
  { value: 'none', labelKey: 'permissions.none' },
  { value: 'readonly', labelKey: 'permissions.readonly' },
  { value: 'readwrite', labelKey: 'permissions.readwrite' },
] as const;

interface Role {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;
  permissions: any[];
  canAccessAdmin: boolean;
  entityPermissions?: {
    assets?: string;
    risks?: string;
    controls?: string;
    incidents?: string;
  };
}

interface RoleForm {
  name: string;
  description: string;
  canAccessAdmin: boolean;
  entityPermissions: {
    assets: string;
    risks: string;
    controls: string;
    incidents: string;
  };
}

const AdminRoles = () => {
  const { t } = useI18n();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>({
    name: '',
    description: '',
    canAccessAdmin: false,
    entityPermissions: {
      assets: 'none',
      risks: 'none',
      controls: 'none',
      incidents: 'none',
    },
  });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await adminApi.getRoles();
      setRoles(response.data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await adminApi.createRole({
        ...form,
        permissions: [],
        entityPermissions: form.entityPermissions,
      });
      setCreateModalOpen(false);
      setForm({
        name: '',
        description: '',
        canAccessAdmin: false,
        entityPermissions: {
          assets: 'none',
          risks: 'none',
          controls: 'none',
          incidents: 'none',
        },
      });
      loadRoles();
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRole) return;
    try {
      await adminApi.updateRole(selectedRole.id, {
        ...form,
        entityPermissions: form.entityPermissions,
      });
      setEditModalOpen(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await adminApi.deleteRole(id);
      loadRoles();
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setForm({
      name: role.name,
      description: role.description || '',
      canAccessAdmin: role.canAccessAdmin,
      entityPermissions: {
        assets: role.entityPermissions?.assets ?? 'none',
        risks: role.entityPermissions?.risks ?? 'none',
        controls: role.entityPermissions?.controls ?? 'none',
        incidents: role.entityPermissions?.incidents ?? 'none',
      },
    });
    setEditModalOpen(true);
  };

  const getPermissionLabel = (level: string | undefined) => {
    if (!level) return t('permissions.none');
    return t(`permissions.${level}`);
  };

  const getPermissionColor = (level: string | undefined) => {
    switch (level) {
      case 'readwrite':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'readonly':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('navigation.roleManagement')}
        </h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          {t('common.createNew')} {t('common.role').toLowerCase()}
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
                  {t('roles.entityPermissions')}
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300">
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {role.name}
                    </div>
                    {role.isBuiltIn && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('roles.builtIn')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {role.description || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {/* Admin Access */}
                      {role.canAccessAdmin && (
                        <span className="inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded mb-1">
                          {t('roles.adminAccess')}
                        </span>
                      )}
                      {/* Entity permissions */}
                      {Object.entries(role.entityPermissions || {}).map(([entity, level]) => (
                        <span
                          key={entity}
                          className={`inline-block px-2 py-0.5 text-xs ${getPermissionColor(level)} rounded mr-1`}
                        >
                          {t(`entities.${entity}`)}: {getPermissionLabel(level)}
                        </span>
                      ))}
                      {!role.entityPermissions && (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(role)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                        disabled={role.isBuiltIn}
                      >
                        {t('common.edit')}
                      </button>
                      {!role.isBuiltIn && (
                        <button
                          onClick={() => handleDelete(role.id)}
                          className="text-red-600 dark:text-red-400 hover:underline text-xs"
                        >
                          {t('common.delete')}
                        </button>
                      )}
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
        title={t('roles.createRole')}
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
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.canAccessAdmin}
                onChange={(e) => setForm({ ...form, canAccessAdmin: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('roles.adminAccess')}
              </span>
            </label>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('roles.entityPermissions')}
            </h3>
            <div className="space-y-2">
              {ENTITY_TYPES.map((entity) => (
                <div key={entity.key} className="flex items-center">
                  <label className="text-sm text-gray-700 dark:text-gray-300 w-24">
                    {t(entity.labelKey)}
                  </label>
                  <select
                    value={form.entityPermissions[entity.key as keyof typeof form.entityPermissions]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        entityPermissions: {
                          ...form.entityPermissions,
                          [entity.key]: e.target.value,
                        },
                      })
                    }
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PERMISSION_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {t(level.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
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
        title={t('roles.editRole')}
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
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={form.canAccessAdmin}
                onChange={(e) => setForm({ ...form, canAccessAdmin: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('roles.adminAccess')}
              </span>
            </label>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('roles.entityPermissions')}
            </h3>
            <div className="space-y-2">
              {ENTITY_TYPES.map((entity) => (
                <div key={entity.key} className="flex items-center">
                  <label className="text-sm text-gray-700 dark:text-gray-300 w-24">
                    {t(entity.labelKey)}
                  </label>
                  <select
                    value={form.entityPermissions[entity.key as keyof typeof form.entityPermissions]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        entityPermissions: {
                          ...form.entityPermissions,
                          [entity.key]: e.target.value,
                        },
                      })
                    }
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-card dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PERMISSION_LEVELS.map((level) => (
                      <option key={level.value} value={level.value}>
                        {t(level.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
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
    </div>
  );
};

export default AdminRoles;

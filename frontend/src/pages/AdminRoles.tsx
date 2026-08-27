import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../services/api';
import { useI18n } from '../context/I18nContext';
import { Modal } from '../components/Modal';
import { useToast } from '../components/useToast';
import { useDirtyForm } from '../hooks/useDirtyForm';

const PERMISSION_GROUPS = {
  Assets: ['assets.read', 'assets.write', 'assets.archive'],
  Risks: ['risks.read', 'risks.write', 'risks.assess', 'risks.approve', 'risks.accept'],
  Controls: ['controls.read', 'controls.write', 'controls.test', 'controls.approve'],
  Incidents: ['incidents.read', 'incidents.write', 'incidents.assess', 'incidents.report', 'incidents.close'],
  Suppliers: ['suppliers.read', 'suppliers.write', 'suppliers.approve'],
  BCM: ['bcm.read', 'bcm.write', 'bcm.approve'],
  Audits: ['audits.read', 'audits.write', 'audits.close'],
  'Corrective actions': ['correctiveActions.read', 'correctiveActions.write', 'correctiveActions.verify'],
  Training: ['training.read', 'training.manage'],
  Documents: ['documents.read', 'documents.write', 'documents.approve'],
  Evidence: ['evidence.read', 'evidence.write', 'evidence.export'],
  NIS2: ['nis2.read', 'nis2.write', 'nis2.approve'],
  Administration: ['administration.access'],
} as const;

type Role = { id: string; name: string; description?: string | null; isBuiltIn: boolean; canAccessAdmin: boolean; permissionNames: string[] };
type RoleForm = { name: string; description: string; permissionNames: string[] };
const emptyForm = (): RoleForm => ({ name: '', description: '', permissionNames: [] });
const messageFrom = (error: any, fallback: string) => error?.response?.data?.error?.message ?? error?.response?.data?.error ?? error?.message ?? fallback;

const AdminRoles = () => {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const form = useDirtyForm<RoleForm>(emptyForm());

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try { setRoles((await adminApi.getRoles()).data); }
    catch (error) { addToast('error', messageFrom(error, 'Failed to load roles.')); }
    finally { setLoading(false); }
  }, [addToast]);
  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const openCreate = () => { setSelectedRole(null); form.setFormValues(emptyForm()); setModalOpen(true); };
  const openEdit = async (role: Role) => {
    setSelectedRole(role);
    try {
      const loaded = (await adminApi.getRole(role.id)).data as Role;
      form.setFormValues({ name: loaded.name, description: loaded.description ?? '', permissionNames: loaded.permissionNames });
      setModalOpen(true);
    } catch (error) { addToast('error', messageFrom(error, 'Failed to load role.')); }
  };
  const togglePermission = (permission: string) => form.handleChange({ permissionNames: form.values.permissionNames.includes(permission) ? form.values.permissionNames.filter((value) => value !== permission) : [...form.values.permissionNames, permission] });
  const save = async () => {
    if (!form.values.name.trim()) { addToast('error', 'A role name is required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form.values, name: form.values.name.trim() };
      if (selectedRole) await adminApi.updateRole(selectedRole.id, payload); else await adminApi.createRole(payload);
      addToast('success', selectedRole ? 'Role updated successfully.' : 'Role created successfully.');
      setModalOpen(false); setSaving(false); await loadRoles();
    } catch (error) { addToast('error', messageFrom(error, 'Failed to save role.')); setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try { await adminApi.deleteRole(id); addToast('success', 'Role deleted successfully.'); await loadRoles(); }
    catch (error) { addToast('error', messageFrom(error, 'Failed to delete role.')); }
  };

  const handleModalClose = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleDiscard = () => {
    form.resetForm();
    setModalOpen(false);
  };

  return <div>
    <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('navigation.roleManagement')}</h1><button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">{t('common.createNew')} {t('common.role').toLowerCase()}</button></div>
    {loading ? <div className="text-center py-8 text-gray-500">{t('common.loading')}</div> : <div className="bg-white dark:bg-card rounded-lg shadow overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-4 py-3 text-left">{t('common.name')}</th><th className="px-4 py-3 text-left">{t('common.description')}</th><th className="px-4 py-3 text-left">Permissions</th><th className="px-4 py-3 text-left">{t('common.actions')}</th></tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-700">{roles.map((role) => <tr key={role.id}><td className="px-4 py-3 font-medium">{role.name}{role.isBuiltIn && <span className="ml-2 text-xs text-gray-500">{t('roles.builtIn')}</span>}</td><td className="px-4 py-3">{role.description || '-'}</td><td className="px-4 py-3">{role.permissionNames.length}</td><td className="px-4 py-3 space-x-2"><button onClick={() => void openEdit(role)} disabled={role.isBuiltIn} className="text-blue-600 hover:underline disabled:text-gray-400">{t('common.edit')}</button>{!role.isBuiltIn && <button onClick={() => void remove(role.id)} className="text-red-600 hover:underline">{t('common.delete')}</button>}</td></tr>)}</tbody></table></div>}
    <Modal isOpen={modalOpen} onClose={handleModalClose} title={selectedRole ? t('roles.editRole') : t('roles.createRole')} isDirty={form.isDirty && !saving} onDiscardConfirm={handleDiscard}>
      <div className="space-y-4">
        <input aria-label={t('common.name')} value={form.values.name} onChange={(event) => form.handleChange({ name: event.target.value })} className="w-full px-3 py-2 border rounded-md" placeholder={t('common.name')} />
        <textarea aria-label={t('common.description')} value={form.values.description} onChange={(event) => form.handleChange({ description: event.target.value })} className="w-full px-3 py-2 border rounded-md" placeholder={t('common.description')} />
        <div className="max-h-80 overflow-y-auto space-y-4">
          {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => <fieldset key={group}><legend className="font-medium">{group}</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{permissions.map((permission) => <label key={permission} className="flex gap-2 text-sm"><input type="checkbox" checked={form.values.permissionNames.includes(permission)} onChange={() => togglePermission(permission)} />{permission}</label>)}</div></fieldset>)}
        </div>
        <div className="flex justify-end gap-2">
          <button disabled={saving} onClick={() => { if (form.isDirty) { handleDiscard(); } else { handleModalClose(); } }} className="px-4 py-2 border rounded-md">{t('common.cancel')}</button>
          <button disabled={saving} onClick={() => void save()} className="px-4 py-2 bg-blue-600 text-white rounded-md">{t('common.save')}</button>
        </div>
      </div>
    </Modal>
  </div>;
};
export default AdminRoles;

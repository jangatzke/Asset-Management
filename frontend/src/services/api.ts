import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
  createFirstAdmin: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/create-first-admin', data),
  hasAdmin: () => api.get('/auth/has-admin'),
  me: () => api.get('/auth/me'),
  updatePreferences: (data: { language?: string; darkMode?: boolean }) =>
    api.patch('/auth/me/preferences', data),
  oidcAuthorize: () => api.get('/oidc/authorize'),
  oidcConfig: () => api.get('/auth/oidc/config'),
};

export const assetApi = {
  list: (params?: any) => api.get('/assets', { params }),
  getById: (id: string) => api.get(`/assets/${id}`),
  create: (data: any) => api.post('/assets', data),
  update: (id: string, data: any) => api.put(`/assets/${id}`, data),
  delete: (id: string) => api.delete(`/assets/${id}`),
  getTypes: () => api.get('/assets/types'),
  // AST-011: Graph & dependencies
  getGraph: (id?: string, params?: any) => id
    ? api.get(`/assets/${id}/graph`, { params })
    : api.get('/assets/graph', { params }),
  getImpactAnalysis: (id: string, params?: any) => api.get(`/assets/${id}/impact-analysis`, { params }),
  getDependencies: (id: string) => api.get(`/assets/${id}/dependencies`),
  getDownstream: (id: string) => api.get(`/assets/${id}/downstream`),
  getUpstream: (id: string) => api.get(`/assets/${id}/upstream`),
  getLifecycleLogs: (id: string) => api.get(`/assets/${id}/lifecycle-logs`),
  getRelations: (id: string) => api.get(`/assets/${id}/relations`),
  createRelation: (id: string, data: any) => api.post(`/assets/${id}/relations`, data),
  findIncomplete: () => api.get('/assets/incomplete'),
  confirmResponsibility: (id: string, data: { role?: string }) => api.post(`/assets/${id}/confirm-responsibility`, data),
};

export const riskApi = {
  list: (params?: any) => api.get('/risks', { params }),
  getById: (id: string) => api.get(`/risks/${id}`),
  create: (data: any) => api.post('/risks', data),
  update: (id: string, data: any) => api.put(`/risks/${id}`, data),
  delete: (id: string) => api.delete(`/risks/${id}`),
  createTreatmentPlan: (riskId: string, data: any) => api.post(`/risks/${riskId}/treatment`, data),
};

export const controlApi = {
  list: (params?: any) => api.get('/controls', { params }),
  getById: (id: string) => api.get(`/controls/${id}`),
  create: (data: any) => api.post('/controls', data),
  update: (id: string, data: any) => api.put(`/controls/${id}`, data),
  delete: (id: string) => api.delete(`/controls/${id}`),
  createImplementation: (data: any) => api.post('/controls/implementations', data),
  listSoA: (params?: any) => api.get('/controls/soa', { params }),
  createSoA: (data: any) => api.post('/controls/soa', data),
  submitSoA: (id: string) => api.post(`/controls/soa/${id}/submit`),
  approveSoA: (id: string, data?: any) => api.post(`/controls/soa/${id}/approve`, data ?? {}),
};

export const frameworkApi = {
  list: () => api.get('/frameworks'),
  import: (data: any) => api.post('/frameworks/import', data),
  getVersion: (id: string) => api.get(`/frameworks/versions/${id}`),
  compareVersions: (data: any) => api.post('/frameworks/versions/compare', data),
  mapControlRequirements: (controlId: string, data: any) => api.post(`/frameworks/controls/${controlId}/requirements`, data),
};

export const evidenceApi = {
  list: () => api.get('/evidence'),
  create: (data: any) => api.post('/evidence', data),
  exportAuditPackage: (data: any) => api.post('/evidence/audit-package', data),
  delete: (id: string) => api.delete(`/evidence/${id}`),
};

export const documentApi = {
  create: (data: any) => api.post('/documents', data),
  updateVersion: (versionId: string, data: any) => api.patch(`/documents/versions/${versionId}`, data),
  transition: (id: string, data: any) => api.post(`/documents/${id}/transition`, data),
  acknowledge: (id: string, data?: any) => api.post(`/documents/${id}/acknowledge`, data ?? {}),
  scheduleReview: (id: string, data: any) => api.post(`/documents/${id}/reviews`, data),
  completeReview: (reviewId: string, data: any) => api.post(`/documents/reviews/${reviewId}/complete`, data),
  escalateOverdueReviews: () => api.post('/documents/reviews/escalate-overdue'),
};

export const incidentApi = {
  list: (params?: any) => api.get('/incidents', { params }),
  getById: (id: string) => api.get(`/incidents/${id}`),
  create: (data: any) => api.post('/incidents', data),
  update: (id: string, data: any) => api.put(`/incidents/${id}`, data),
  delete: (id: string) => api.delete(`/incidents/${id}`),
  assess: (id: string, data: any) => api.post(`/incidents/${id}/assess`, data),
  changeKnowledgeTime: (id: string, data: any) => api.post(`/incidents/${id}/knowledge-time`, data),
  createReport: (id: string, data: any) => api.post(`/incidents/${id}/reports`, data),
  exportReport: (reportId: string) => api.get(`/incidents/reports/${reportId}/export`),
  createCommunication: (id: string, data: any) => api.post(`/incidents/${id}/communications`, data),
  close: (id: string, data: any) => api.post(`/incidents/${id}/close`, data),
};

export const nis2Api = {
  createQuestionnaire: (data: any) => api.post('/nis2/questionnaires', data),
  ensureDefaultQuestionnaire: () => api.post('/nis2/questionnaires/default'),
  createAssessment: (data: any) => api.post('/nis2/assessments', data),
  submitAssessment: (id: string) => api.post(`/nis2/assessments/${id}/submit`),
  approveAssessment: (id: string, data?: any) => api.post(`/nis2/assessments/${id}/approve`, data ?? {}),
  createRegistration: (data: any) => api.post('/nis2/registrations', data),
  recordRegistrationChange: (id: string, data: any) => api.post(`/nis2/registrations/${id}/changes`, data),
  ensureMeasuresCatalogue: () => api.post('/nis2/measures-catalogue/ensure'),
};

export const adminApi = {
  // User Management
  listUsers: () => api.get('/admin/users'),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  createUser: (data: { email: string; password: string; firstName: string; lastName: string; phoneNumber?: string; roles?: string[] }) =>
    api.post('/admin/users', data),
  updateUser: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  changePassword: (id: string, newPassword: string) =>
    api.post(`/admin/users/${id}/change-password`, { newPassword }),
  // Role Management (User Assignment)
  assignRoles: (id: string, roles: string[]) =>
    api.put(`/admin/users/${id}/roles`, { roles }),
  // Role CRUD
  getRoles: () => api.get('/admin/roles'),
  createRole: (data: { name: string; description?: string; permissions: any[]; canAccessAdmin?: boolean; entityPermissions?: any }) =>
    api.post('/admin/roles', data),
  updateRole: (id: string, data: any) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id: string) => api.delete(`/admin/roles/${id}`),
  // Group Management
  listGroups: () => api.get('/admin/groups'),
  createGroup: (data: { name: string; description?: string }) =>
    api.post('/admin/groups', data),
  updateGroup: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/admin/groups/${id}`, data),
  deleteGroup: (id: string) => api.delete(`/admin/groups/${id}`),
  assignUsersToGroup: (groupId: string, userIds: string[]) =>
    api.put(`/admin/groups/${groupId}/users`, { userIds }),
  assignRolesToGroup: (groupId: string, roleIds: string[]) =>
    api.put(`/admin/groups/${groupId}/roles`, { roleIds }),
  // OIDC Configuration
  getOidcConfig: () => api.get('/admin/oidc/config'),
  updateOidcConfig: (data: any) => api.put('/admin/oidc/config', data),
  // Asset Type Management
  listAssetTypes: () => api.get('/admin/asset-types'),
  createAssetType: (data: { name: string; description?: string; category: string }) =>
    api.post('/admin/asset-types', data),
  updateAssetType: (id: string, data: { name?: string; description?: string; category?: string }) =>
    api.put(`/admin/asset-types/${id}`, data),
  deleteAssetType: (id: string) => api.delete(`/admin/asset-types/${id}`),
  archiveAssetType: (id: string) => api.post(`/admin/asset-types/${id}/archive`),
};

export const intuneApi = {
  // Credentials Management
  getCredentials: () => api.get('/intune/credentials'),
  createCredentials: (data: any) => api.post('/intune/credentials', data),
  updateCredentials: (data: any) => api.put('/intune/credentials', data),
  deleteCredentials: () => api.delete('/intune/credentials'),
};

export const vmwareApi = {
  // Credentials
  getCredentials: () => api.get('/admin/vmware/credentials'),
  createCredential: (data: { name: string; username: string; password: string }) =>
    api.post('/admin/vmware/credentials', data),
  updateCredential: (id: string, data: { name?: string; username?: string; password?: string; isDefault?: boolean }) =>
    api.put(`/admin/vmware/credentials/${id}`, data),
  deleteCredential: (id: string) => api.delete(`/admin/vmware/credentials/${id}`),
  // vCenter Servers
  getServers: () => api.get('/admin/vmware/vcenters'),
  createServer: (data: { name: string; host: string; port?: number; credentialId: string }) =>
    api.post('/admin/vmware/vcenters', data),
  updateServer: (id: string, data: { name?: string; host?: string; port?: number; credentialId?: string; enabled?: boolean }) =>
    api.put(`/admin/vmware/vcenters/${id}`, data),
  deleteServer: (id: string) => api.delete(`/admin/vmware/vcenters/${id}`),
  importVMs: (id: string, dryRun?: boolean) => api.post(`/admin/vmware/vcenters/${id}/import`, { dryRun }),
  testConnection: (id: string) => api.post(`/admin/vmware/vcenters/${id}/test-connection`),
};

// Contract API
export const contractApi = {
  list: (params?: any) => api.get('/contracts', { params }),
  getById: (id: string) => api.get(`/contracts/${id}`),
  create: (data: any) => api.post('/contracts', data),
  update: (id: string, data: any) => api.patch(`/contracts/${id}`, data),
  delete: (id: string) => api.delete(`/contracts/${id}`),
};

// License API
export const licenseApi = {
  list: (params?: any) => api.get('/licenses', { params }),
  getById: (id: string) => api.get(`/licenses/${id}`),
  create: (data: any) => api.post('/licenses', data),
  update: (id: string, data: any) => api.patch(`/licenses/${id}`, data),
  delete: (id: string) => api.delete(`/licenses/${id}`),
  getAssets: (id: string) => api.get(`/licenses/${id}/assets`),
};

// Business Process API (backend uses /processes)
export const processApi = {
  list: (params?: any) => api.get('/processes', { params }),
  getById: (id: string) => api.get(`/processes/${id}`),
  create: (data: any) => api.post('/processes', data),
  update: (id: string, data: any) => api.patch(`/processes/${id}`, data),
  delete: (id: string) => api.delete(`/processes/${id}`),
  getRisks: (id: string) => api.get(`/processes/${id}/risks`),
};

// Risk Treatment API
export const treatmentApi = {
  list: (params?: any) => api.get('/treatments', { params }),
  getById: (id: string) => api.get(`/treatments/${id}`),
  create: (data: any) => api.post('/treatments', data),
  update: (id: string, data: any) => api.patch(`/treatments/${id}`, data),
  delete: (id: string) => api.delete(`/treatments/${id}`),
  approve: (id: string) => api.post(`/treatments/${id}/approve`),
};

// Risk Method API
export const methodApi = {
  list: (params?: any) => api.get('/methods', { params }),
  getById: (id: string) => api.get(`/methods/${id}`),
  create: (data: any) => api.post('/methods', data),
  update: (id: string, data: any) => api.patch(`/methods/${id}`, data),
  delete: (id: string) => api.delete(`/methods/${id}`),
  recalculatePreview: (id: string) => api.post(`/methods/${id}/recalculate-preview`),
};

// Risk Aggregation API (RSK-011)
export const riskAggregationApi = {
  byOrgUnit: () => api.get('/risks/aggregated/by-org-unit'),
  byLocation: () => api.get('/risks/aggregated/by-location'),
  byAssetType: () => api.get('/risks/aggregated/by-asset-type'),
  byProcess: () => api.get('/risks/aggregated/by-process'),
  byScope: () => api.get('/risks/aggregated/by-scope'),
  dashboardSummary: () => api.get('/risks/dashboard-summary'),
};

// Phase 6 ISMS API
export const phase6Api = {
  resources: () => api.get('/phase6/resources'),
  list: (resource: string, params?: any) => api.get(`/phase6/${resource}`, { params }),
  getById: (resource: string, id: string) => api.get(`/phase6/${resource}/${id}`),
  create: (resource: string, data: any) => api.post(`/phase6/${resource}`, data),
  update: (resource: string, id: string, data: any) => api.patch(`/phase6/${resource}/${id}`, data),
  delete: (resource: string, id: string) => api.delete(`/phase6/${resource}/${id}`),
  export: (resource: string, params?: any) => api.get(`/phase6/${resource}/export`, { params }),
  runReminders: (resource: string) => api.post(`/phase6/${resource}/reminders/run`),
  createCorrectiveActionFromSource: (data: any) => api.post('/phase6/corrective-actions/from-source', data),
  completeTrainingAssignment: (id: string, data: any) => api.post(`/phase6/training-assignments/${id}/complete`, data),
  startWorkflow: (data: any) => api.post('/phase6/workflows/start', data),
  transitionWorkflow: (id: string, data: any) => api.post(`/phase6/workflows/${id}/transition`, data),
  runReport: (data: any) => api.post('/phase6/reports/run', data),
};

// Organization API
export const orgApi = {
  listUnits: (params?: any) => api.get('/org/units', { params }),
  createUnit: (data: any) => api.post('/org/units', data),
  listScopes: () => api.get('/org/scopes'),
  createScope: (data: any) => api.post('/org/scopes', data),
  listParties: () => api.get('/org/parties'),
};

// User search API (for EntitySearchSelect)
export const userApi = {
  list: (params?: any) => api.get('/admin/users', { params }),
};

export const proxmoxApi = {
  // Credentials
  getCredentials: () => api.get('/admin/proxmox/credentials'),
  createCredential: (data: { name: string; username: string; password?: string; apiToken?: string }) =>
    api.post('/admin/proxmox/credentials', data),
  updateCredential: (id: string, data: { name?: string; username?: string; password?: string; apiToken?: string; isDefault?: boolean }) =>
    api.put(`/admin/proxmox/credentials/${id}`, data),
  deleteCredential: (id: string) => api.delete(`/admin/proxmox/credentials/${id}`),
  // Proxmox Servers
  getServers: () => api.get('/admin/proxmox/servers'),
  createServer: (data: { name: string; host: string; port?: number; nodeId?: string; credentialId: string }) =>
    api.post('/admin/proxmox/servers', data),
  updateServer: (id: string, data: { name?: string; host?: string; port?: number; nodeId?: string; credentialId?: string; enabled?: boolean }) =>
    api.put(`/admin/proxmox/servers/${id}`, data),
  deleteServer: (id: string) => api.delete(`/admin/proxmox/servers/${id}`),
  importVMs: (id: string, dryRun?: boolean) => api.post(`/admin/proxmox/servers/${id}/import`, { dryRun }),
  testConnection: (id: string) => api.post(`/admin/proxmox/servers/${id}/test-connection`),
};

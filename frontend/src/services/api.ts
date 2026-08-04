import axios from 'axios';
import { getAccessToken, setAccessToken } from '../store/accessToken';
import type {
  ArchiveAssetDTO,
  AssetQueryDTO,
  AssessIncidentDTO,
  ChangeKnowledgeTimeDTO,
  CloseIncidentDTO,
  ControlImplementationDTO,
  CreateAssetDTO,
  CreateAssetSubtypeDTO,
  CreateControlDTO,
  CreateControlTestDTO,
  CreateIncidentCommunicationDTO,
  CreateIncidentDTO,
  CreateIncidentReportDTO,
  CreateNestedRiskControlAssessmentDTO,
  CreateNestedRiskControlDTO,
  CreateRiskAssessmentDTO,
  CreateRiskControlAssessmentDTO,
  CreateRiskControlDTO,
  CreateRiskDTO,
  CreateSoADTO,
  DisposalProofDTO,
  JsonValue,
  LifecycleTransitionDTO,
  RiskAggregationQueryDTO,
  RiskControlAssessmentListQueryDTO,
  RiskControlDto,
  RiskControlListQueryDTO,
  AssetRelationCreateDTO,
  UpdateAssetDTO,
  UpdateControlDTO,
  UpdateIncidentDTO,
  UpdateRiskControlDTO,
  UpdateRiskDTO,
} from '../../../shared/src';

export interface PaginatedApiResponse<T> {
  data: T[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

/** Standardized API error types for client-side error handling */
export interface ApiErrorDetail {
  message: string;
  code?: string;
  field?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: ApiErrorDetail[];
    stack?: string;
  };
}

export type ApiEntity = Record<string, JsonValue | undefined>;

/** Typed response wrappers for specific entity types */
export type AssetResponse = Record<string, unknown> & { type?: string; criticality?: string; displayId?: string };
export type RiskResponse = Record<string, unknown> & { riskLevel?: string; status?: string };
export type ControlResponse = Record<string, unknown> & { status?: string; catalogId?: string };
export type IncidentResponse = Record<string, unknown> & { severity?: string; status?: string };
export type DeleteResponse = { success: boolean };

export interface EntityHistoryFieldChange {
  old?: unknown;
  new?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  from?: unknown;
  to?: unknown;
  [key: string]: unknown;
}

export interface EntityHistoryEntry {
  id: string;
  entityType?: string;
  entityId?: string;
  action: string;
  fieldChanges?: Record<string, EntityHistoryFieldChange | unknown>;
  summary?: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt?: string;
}

export type EntityHistoryParams = { action?: string; limit?: number; offset?: number };

export type DatabaseImportMode = 'dryRun' | 'append' | 'replace';

export interface SafeDatabaseConfig {
  provider: string;
  databaseUrlSource: string;
  providerSwitchingMode: string;
  portableBackupFormat: string;
  prismaSchema: string;
  jsonCompatibilityMode: string;
  limitations: string[];
}

export interface DatabaseImportResult {
  format: string;
  mode: 'append' | 'replace';
  dryRun: boolean;
  rowCounts: Record<string, number>;
  checksum: string;
}

/** Parameters for graph and impact analysis API calls */
export type AssetGraphParams = { depth?: number; maxDepth?: number; direction?: string; relationTypes?: string };
export type AssetImpactParams = { depth?: number; includeProcesses?: boolean; includeServices?: boolean };

/** Generic wrapper for single-entity API responses */
export interface ApiResponse<T> {
  data: T | null;
  [key: string]: unknown;
}

/** Generic wrapper for paginated API responses */
export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = api.post('/auth/refresh').then((response) => {
      const token = response.data.token;
      setAccessToken(token);
      return token;
    }).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/refresh') || originalRequest?.url?.includes('/auth/login');
    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const token = await refreshAccessToken();
    originalRequest.headers.Authorization = `Bearer ${token}`;
    return api(originalRequest);
  },
);

export default api;

export const authApi = {
  login: (email: string, password: string, mfaToken?: string) => api.post('/auth/login', { email, password, mfaToken }),
  verifyMfaLogin: (preAuthToken: string, token: string) => api.post('/auth/login/mfa', { preAuthToken, token }),
  beginPreAuthMfaSetup: (preAuthToken: string) => api.post('/auth/preauth/mfa/setup', { preAuthToken }),
  confirmPreAuthMfaSetup: (preAuthToken: string, token: string) => api.post('/auth/preauth/mfa/confirm', { preAuthToken, token }),
  changePreAuthPassword: (preAuthToken: string, newPassword: string) => api.post('/auth/preauth/password/change', { preAuthToken, newPassword }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
  createFirstAdmin: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/create-first-admin', data),
  hasAdmin: () => api.get('/auth/has-admin'),
  me: () => api.get('/auth/me'),
  refresh: async () => ({ data: { token: await refreshAccessToken() } }),
  logout: () => api.post('/auth/logout'),
  changeOwnPassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/me/change-password', data),
  beginMfaSetup: () => api.post('/auth/me/mfa/setup'),
  confirmMfaSetup: (token: string) => api.post('/auth/me/mfa/confirm', { token }),
  disableMfa: (token: string) => api.post('/auth/me/mfa/disable', { token }),
  updatePreferences: (data: { language?: string; darkMode?: boolean }) =>
    api.patch('/auth/me/preferences', data),
  oidcAuthorize: () => api.get('/oidc/authorize'),
  oidcConfig: () => api.get('/auth/oidc/config'),
};

export const assetApi = {
  list: (params?: Partial<AssetQueryDTO> & { q?: string }) => api.get('/assets', { params }),
  getById: (id: string) => api.get(`/assets/${id}`),
  create: (data: CreateAssetDTO) => api.post('/assets', data),
  update: (id: string, data: UpdateAssetDTO) => api.put(`/assets/${id}`, data),
  delete: (id: string) => api.delete<DeleteResponse>(`/assets/${id}`),
  getTypes: () => api.get('/assets/types'),
  createSubtype: (typeId: string, data: CreateAssetSubtypeDTO) => api.post(`/assets/types/${typeId}/subtypes`, data),
  previewInventoryNumber: (assetTypeId: string, assetSubtypeId?: string) => api.get('/assets/inventory/preview', { params: { assetTypeId, assetSubtypeId } }),
  // AST-011: Graph & dependencies
  getGraph: (id?: string, params?: AssetGraphParams) => id
    ? api.get(`/assets/${id}/graph`, { params })
    : api.get('/assets/graph', { params }),
  getImpactAnalysis: (id: string, params?: AssetImpactParams) => api.get(`/assets/${id}/impact-analysis`, { params }),
  getDependencies: (id: string) => api.get(`/assets/${id}/dependencies`),
  getDownstream: (id: string) => api.get(`/assets/${id}/downstream`),
  getUpstream: (id: string) => api.get(`/assets/${id}/upstream`),
  getLifecycleLogs: (id: string) => api.get(`/assets/${id}/lifecycle-logs`),
  getRelations: (id: string) => api.get(`/assets/${id}/relations`),
  createRelation: (id: string, data: AssetRelationCreateDTO) => api.post(`/assets/${id}/relations`, data),
  findIncomplete: () => api.get('/assets/incomplete'),
  confirmResponsibility: (id: string, data: { role?: string }) => api.post(`/assets/${id}/confirm-responsibility`, data),
  archive: (id: string, data: ArchiveAssetDTO) => api.post(`/assets/${id}/archive`, data),
  restore: (id: string, data: ArchiveAssetDTO) => api.post(`/assets/${id}/restore`, data),
  transitionLifecycle: (id: string, data: LifecycleTransitionDTO) => api.post(`/assets/${id}/lifecycle-transition`, data),
  setDisposalProof: (id: string, data: DisposalProofDTO) => api.post(`/assets/${id}/disposal-proof`, data),
  history: (id: string, params?: EntityHistoryParams) => api.get<PaginatedResponse<EntityHistoryEntry> | EntityHistoryEntry[]>(`/assets/${id}/history`, { params }),
};

export const riskApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; organizationUnitId?: string; riskOwnerId?: string }) => api.get('/risks', { params }),
  getById: (id: string) => api.get(`/risks/${id}`),
  create: (data: CreateRiskDTO) => api.post('/risks', data),
  update: (id: string, data: UpdateRiskDTO) => api.put(`/risks/${id}`, data),
  delete: (id: string) => api.delete<DeleteResponse>(`/risks/${id}`),
  createTreatmentPlan: (riskId: string, data: any) => api.post(`/risks/${riskId}/treatment`, data),
  createAssessment: (data: CreateRiskAssessmentDTO) => api.post('/risks/assessments', data),
  listAssessments: (riskId: string) => api.get(`/risks/${riskId}/assessments`),
  getCurrentAssessment: (riskId: string, type?: 'inherent' | 'current' | 'target') => api.get(`/risks/${riskId}/assessments/current`, { params: { type } }),
  listControls: (riskId: string, params?: RiskControlListQueryDTO) => api.get<RiskControlDto[]>(`/risks/${riskId}/controls`, { params }),
  linkControl: (riskId: string, data: CreateNestedRiskControlDTO | { controlImplementationId: string; role: string; mitigationDimension: string; isKeyControl?: boolean; status?: string }) => api.post<RiskControlDto>(`/risks/${riskId}/controls`, data),
  updateControl: (riskId: string, riskControlId: string, data: UpdateRiskControlDTO | { role?: string; mitigationDimension?: string; isKeyControl?: boolean; status?: string }) => api.patch<RiskControlDto>(`/risks/${riskId}/controls/${riskControlId}`, data),
  removeControl: (riskId: string, riskControlId: string) => api.delete(`/risks/${riskId}/controls/${riskControlId}`),
  listControlAssessments: (riskId: string, params?: RiskControlAssessmentListQueryDTO) => api.get(`/risks/${riskId}/control-assessments`, { params }),
  listRiskControlAssessments: (riskId: string, riskControlId: string, params?: RiskControlAssessmentListQueryDTO) => api.get(`/risks/${riskId}/controls/${riskControlId}/assessments`, { params }),
  assessRiskControl: (riskId: string, riskControlId: string, data: CreateNestedRiskControlAssessmentDTO) => api.post(`/risks/${riskId}/controls/${riskControlId}/assessments`, data),
  linkRiskControl: (data: CreateRiskControlDTO) => api.post('/risks/risk-controls', data),
  assessRiskControlFlat: (data: CreateRiskControlAssessmentDTO) => api.post('/risks/risk-control-assessments', data),
  closeAssessmentVersion: (id: string) => api.post(`/risks/assessment-versions/${id}/close`),
  history: (id: string, params?: EntityHistoryParams) => api.get<PaginatedResponse<EntityHistoryEntry> | EntityHistoryEntry[]>(`/risks/${id}/history`, { params }),
};

export const controlApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; implementationStatus?: string; catalogId?: string }) => api.get('/controls', { params }),
  getById: (id: string) => api.get(`/controls/${id}`),
  create: (data: CreateControlDTO | { catalogId: string; catalogVersion: string; title: string; description: string; controlGoal: string; applicability?: string }) => api.post('/controls', data),
  update: (id: string, data: UpdateControlDTO) => api.put(`/controls/${id}`, data),
  delete: (id: string) => api.delete<DeleteResponse>(`/controls/${id}`),
  createImplementation: (data: ControlImplementationDTO) => api.post('/controls/implementations', data),
  listImplementationRisks: (implementationId: string, params?: RiskControlAssessmentListQueryDTO) => api.get(`/controls/implementations/${implementationId}/risks`, { params }),
  createTest: (data: CreateControlTestDTO) => api.post('/controls/tests', data),
  listSoA: (params?: any) => api.get('/controls/soa', { params }),
  createSoA: (data: CreateSoADTO) => api.post('/controls/soa', data),
  submitSoA: (id: string) => api.post(`/controls/soa/${id}/submit`),
  approveSoA: (id: string, data?: any) => api.post(`/controls/soa/${id}/approve`, data ?? {}),
  history: (id: string, params?: EntityHistoryParams) => api.get<PaginatedResponse<EntityHistoryEntry> | EntityHistoryEntry[]>(`/controls/${id}/history`, { params }),
};

export const catalogApi = {
  listOptions: () => api.get('/catalogs/options'),
  list: (params?: any) => api.get('/catalogs', { params }),
  getById: (id: string) => api.get(`/catalogs/${id}`),
  create: (data: any) => api.post('/catalogs', data),
  update: (id: string, data: any) => api.patch(`/catalogs/${id}`, data),
  delete: (id: string) => api.delete(`/catalogs/${id}`),
  listItems: (params?: any) => api.get('/catalogs/items', { params }),
  getItem: (catalogId: string, controlId: string) => api.get(`/catalogs/items/${catalogId}/${controlId}`),
  createItem: (data: any) => api.post('/catalogs/items', data),
  updateItem: (catalogId: string, controlId: string, data: any) => api.patch(`/catalogs/items/${catalogId}/${controlId}`, data),
  deleteItem: (catalogId: string, controlId: string) => api.delete(`/catalogs/items/${catalogId}/${controlId}`),
  getForControl: (controlId: string) => api.get(`/controls/${controlId}/catalogs`),
};

export const userSearchApi = {
  list: (params?: any) => api.get('/users', { params }),
  search: (query: string) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  owners: (query?: string) => api.get(`/users/owners${query ? `?q=${encodeURIComponent(query)}` : ''}`),
};

export const organizationApi = {
  listUnits: (params?: { q?: string; limit?: number }) => api.get('/organization/units', { params }),
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
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; severity?: string }) => api.get('/incidents', { params }),
  getById: (id: string) => api.get(`/incidents/${id}`),
  create: (data: CreateIncidentDTO) => api.post('/incidents', data),
  update: (id: string, data: UpdateIncidentDTO) => api.put(`/incidents/${id}`, data),
  delete: (id: string) => api.delete<DeleteResponse>(`/incidents/${id}`),
  assess: (id: string, data: AssessIncidentDTO) => api.post(`/incidents/${id}/assess`, data),
  changeKnowledgeTime: (id: string, data: ChangeKnowledgeTimeDTO) => api.post(`/incidents/${id}/knowledge-time`, data),
  createReport: (id: string, data: CreateIncidentReportDTO) => api.post(`/incidents/${id}/reports`, data),
  exportReport: (reportId: string) => api.get(`/incidents/reports/${reportId}/export`),
  createCommunication: (id: string, data: CreateIncidentCommunicationDTO) => api.post(`/incidents/${id}/communications`, data),
  close: (id: string, data: CloseIncidentDTO) => api.post(`/incidents/${id}/close`, data),
  history: (id: string, params?: { action?: string; limit?: number; offset?: number }) => api.get(`/incidents/${id}/history`, { params }),
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
  createAssetType: (data: { name: string; description?: string; category: string; inventoryEnabled?: boolean; inventoryPattern?: string }) =>
    api.post('/admin/asset-types', data),
  updateAssetType: (id: string, data: { name?: string; description?: string; category?: string; inventoryEnabled?: boolean; inventoryPattern?: string }) =>
    api.put(`/admin/asset-types/${id}`, data),
  deleteAssetType: (id: string) => api.delete(`/admin/asset-types/${id}`),
  archiveAssetType: (id: string) => api.post(`/admin/asset-types/${id}/archive`),
  // Organization Unit Management
  listOrganizationUnits: (includeArchived = false) => api.get('/admin/organization-units', { params: { includeArchived } }),
  getOrganizationUnit: (id: string) => api.get(`/admin/organization-units/${id}`),
  createOrganizationUnit: (data: { name: string; description?: string; parentId?: string; type?: string }) =>
    api.post('/admin/organization-units', data),
  updateOrganizationUnit: (id: string, data: { name?: string; description?: string; parentId?: string; type?: string }) =>
    api.put(`/admin/organization-units/${id}`, data),
  archiveOrganizationUnit: (id: string) => api.post(`/admin/organization-units/${id}/archive`),
  restoreOrganizationUnit: (id: string) => api.post(`/admin/organization-units/${id}/restore`),
  searchOrganizationUnits: (q = '', limit = 50) => api.get('/admin/organization-units/search', { params: { q, limit } }),
  getFiscalYearConfig: () => api.get('/admin/fiscal-year-config'),
  updateFiscalYearConfig: (data: { startMonth: number; startDay: number; timezone?: string }) =>
    api.put('/admin/fiscal-year-config', data),
  getAuthSettings: () => api.get('/admin/auth-settings'),
  updateAuthSettings: (data: any) => api.put('/admin/auth-settings', data),
  getDatabaseConfig: () => api.get<SafeDatabaseConfig>('/admin/database/config'),
  exportDatabase: () => api.get('/admin/database/export', { responseType: 'blob' }),
  importDatabase: (backup: File, mode: DatabaseImportMode) => {
    const formData = new FormData();
    formData.append('backup', backup);
    const dryRun = mode === 'dryRun';
    return api.post<DatabaseImportResult>('/admin/database/import', formData, {
      params: { mode: dryRun ? 'replace' : mode, dryRun: dryRun ? 'true' : undefined },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const costPlanningApi = {
  years: () => api.get('/cost-planning/years'),
  listPlans: (params?: any) => api.get('/cost-planning/plans', { params }),
  createPlan: (data: { fiscalYearLabel: string; ownerUserId?: string }) => api.post('/cost-planning/plans', data),
  getPlan: (id: string, params?: any) => api.get(`/cost-planning/plans/${id}`, { params }),
  updatePlan: (id: string, data: any) => api.patch(`/cost-planning/plans/${id}`, data),
  candidates: (params: any) => api.get('/cost-planning/candidates', { params }),
  takeOverCandidates: (planId: string, candidateKeys: string[]) => api.post(`/cost-planning/plans/${planId}/items/from-candidates`, { candidateKeys }),
  createManualItem: (planId: string, data: any) => api.post(`/cost-planning/plans/${planId}/items`, data),
  updateItem: (itemId: string, data: any) => api.patch(`/cost-planning/items/${itemId}`, data),
  markAcquired: (itemId: string, data: any) => api.post(`/cost-planning/items/${itemId}/mark-acquired`, data),
  markDone: (itemId: string, data?: any) => api.post(`/cost-planning/items/${itemId}/mark-done`, data ?? {}),
  exportCsv: (planId: string, params?: any) => api.get(`/cost-planning/plans/${planId}/export.csv`, { params, responseType: 'blob' }),
  dashboardReport: () => api.get('/cost-planning/reports/dashboard'),
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
  history: (id: string, params?: EntityHistoryParams) => api.get<PaginatedResponse<EntityHistoryEntry> | EntityHistoryEntry[]>(`/contracts/${id}/history`, { params }),
};

// License API
export const licenseApi = {
  list: (params?: any) => api.get('/licenses', { params }),
  getById: (id: string) => api.get(`/licenses/${id}`),
  create: (data: any) => api.post('/licenses', data),
  update: (id: string, data: any) => api.patch(`/licenses/${id}`, data),
  delete: (id: string) => api.delete(`/licenses/${id}`),
  getAssets: (id: string) => api.get(`/licenses/${id}/assets`),
  history: (id: string, params?: EntityHistoryParams) => api.get<PaginatedResponse<EntityHistoryEntry> | EntityHistoryEntry[]>(`/licenses/${id}/history`, { params }),
};

// Business Process API (backend uses /processes)
export const processApi = {
  list: (params?: any) => api.get('/processes', { params }),
  getById: (id: string) => api.get(`/processes/${id}`),
  create: (data: any) => api.post('/processes', data),
  update: (id: string, data: any) => api.patch(`/processes/${id}`, data),
  delete: (id: string) => api.delete(`/processes/${id}`),
  getRisks: (id: string) => api.get(`/processes/${id}/risks`),
  history: (id: string, params?: EntityHistoryParams) => api.get<PaginatedResponse<EntityHistoryEntry> | EntityHistoryEntry[]>(`/processes/${id}/history`, { params }),
};

// Risk Treatment API
export const treatmentApi = {
  list: (params?: any) => api.get('/treatments', { params }),
  getById: (id: string) => api.get(`/treatments/${id}`),
  create: (data: any) => api.post('/treatments', data),
  update: (id: string, data: any) => api.patch(`/treatments/${id}`, data),
  delete: (id: string) => api.delete(`/treatments/${id}`),
  approve: (id: string, data?: any) => api.post(`/treatments/${id}/approve`, data ?? {}),
  recordEffectivenessReview: (id: string, data: any) => api.post(`/treatments/${id}/effectiveness-review`, data),
  complete: (id: string, data: any) => api.post(`/treatments/${id}/complete`, data),
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
  byOrgUnit: (params?: RiskAggregationQueryDTO) => api.get('/risks/aggregated/by-org-unit', { params }),
  byLocation: (params?: RiskAggregationQueryDTO) => api.get('/risks/aggregated/by-location', { params }),
  byAssetType: (params?: RiskAggregationQueryDTO) => api.get('/risks/aggregated/by-asset-type', { params }),
  byProcess: (params?: RiskAggregationQueryDTO) => api.get('/risks/aggregated/by-process', { params }),
  byScope: (params?: RiskAggregationQueryDTO) => api.get('/risks/aggregated/by-scope', { params }),
  dashboardSummary: (params?: RiskAggregationQueryDTO) => api.get('/risks/dashboard-summary', { params }),
};

// ISMS operations API; /phase6 remains a backend compatibility alias.
export const phase6Api = {
  resources: () => api.get('/isms-operations/resources'),
  list: (resource: string, params?: any) => api.get(`/isms-operations/${resource}`, { params }),
  getById: (resource: string, id: string) => api.get(`/isms-operations/${resource}/${id}`),
  create: (resource: string, data: any) => api.post(`/isms-operations/${resource}`, data),
  update: (resource: string, id: string, data: any) => api.patch(`/isms-operations/${resource}/${id}`, data),
  delete: (resource: string, id: string) => api.delete(`/isms-operations/${resource}/${id}`),
  runReminders: (resource: string) => api.post(`/isms-operations/${resource}/reminders/run`),
  export: (resource: string, params?: any) => api.get(`/isms-operations/${resource}/export`, { params }),
};

export const reminderAdminApi = {
  getConfig: () => api.get('/admin/reminders/config'),
  updateConfig: (data: any) => api.put('/admin/reminders/config', data),
  testSmtp: () => api.post('/admin/reminders/test-smtp'),
  runNow: () => api.post('/admin/reminders/run-now'),
  logs: (limit = 50) => api.get('/admin/reminders/logs', { params: { limit } }),
};

// Proxmox API
export const proxmoxApi = {
  getCredentials: () => api.get('/admin/proxmox/credentials'),
  createCredential: (data: { name: string; username: string; password?: string; apiToken?: string; isDefault?: boolean }) => api.post('/admin/proxmox/credentials', data),
  updateCredential: (id: string, data: { name?: string; username?: string; password?: string; apiToken?: string; isDefault?: boolean }) => api.put(`/admin/proxmox/credentials/${id}`, data),
  deleteCredential: (id: string) => api.delete(`/admin/proxmox/credentials/${id}`),
  getServers: () => api.get('/admin/proxmox/servers'),
  createServer: (data: { name: string; host: string; port?: number; credentialId: string; nodeId?: string }) => api.post('/admin/proxmox/servers', data),
  updateServer: (id: string, data: { name?: string; host?: string; port?: number; credentialId?: string; enabled?: boolean; nodeId?: string }) => api.put(`/admin/proxmox/servers/${id}`, data),
  deleteServer: (id: string) => api.delete(`/admin/proxmox/servers/${id}`),
  testConnection: (id: string) => api.post(`/admin/proxmox/servers/${id}/test-connection`),
  importVMs: (id: string, dryRun?: boolean) => api.post(`/admin/proxmox/servers/${id}/import`, { dryRun }),
};

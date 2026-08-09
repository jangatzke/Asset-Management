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

export type ActionCenterScope = 'mine' | 'authorized' | 'all';
export type ActionCenterUrgency = 'overdue' | 'critical' | 'upcoming' | 'planned';
export type ActionCenterSourceType =
  | 'workflowTask' | 'notificationDeadline' | 'correctiveAction' | 'riskReviewTask'
  | 'trainingAssignment' | 'auditFinding' | 'managementReviewAction' | 'documentReview'
  | 'supplier' | 'supplierAssessment' | 'businessImpactAnalysis' | 'businessContinuityPlan'
  | 'bcpExercise' | 'auditPlan' | 'managementReview' | 'incidentNonReportableApproval';

export interface ActionCenterItem {
  id: string;
  sourceType: ActionCenterSourceType;
  title: string;
  status: string;
  dueDate: string;
  urgency: ActionCenterUrgency;
  assignment: 'mine' | 'authorized';
  href?: string;
}

export interface ActionCenterResponse {
  data: ActionCenterItem[];
  summary: Record<ActionCenterUrgency, number>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ActionCenterParams {
  scope?: ActionCenterScope;
  sourceType?: ActionCenterSourceType;
  urgency?: ActionCenterUrgency;
  status?: string;
  dueBefore?: string;
  page?: number;
  limit?: number;
}

export type Nis2Answer = string | number | boolean;
export interface Nis2Question { key: string; label: string; type: 'string' | 'number' | 'boolean'; required?: boolean; }
export interface Nis2Questionnaire { id: string; version: string; title: string; questions: Nis2Question[]; effectiveFrom: string; }
export interface Nis2Assessment { id: string; organizationUnitId?: string | null; questionnaireVersion: string; answers?: Record<string, Nis2Answer>; preliminaryResult?: string | null; result?: string | null; justification?: string | null; status: string; submittedForApprovalAt?: string | null; approvedAt?: string | null; createdAt: string; updatedAt: string; }
export interface Nis2RegistrationChange { id: string; registrationId: string; changeType: string; description: string; changedData: Record<string, string>; notificationDeadline?: string | null; submittedAt?: string | null; submissionProof?: string | null; status: string; createdAt: string; }
export interface Nis2Registration { id: string; assessmentId?: string | null; entityType: string; registrationDate?: string | null; deadline?: string | null; contactPerson?: string | null; contactDetails?: string | null; submissionProof?: string | null; bsiConfirmation?: string | null; status: string; createdAt: string; updatedAt: string; assessment?: Pick<Nis2Assessment, 'id' | 'organizationUnitId' | 'questionnaireVersion' | 'result' | 'status'> | null; changes?: Nis2RegistrationChange[]; }

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

export type IncidentReportType = 'early_warning_24h' | 'incident_notification_72h' | 'interim_report' | 'monthly_final_report';

export interface IncidentDeadlineResponse {
  id: string;
  notificationType: IncidentReportType;
  deadlineDate: string;
  knowledgeTimeReference: string;
  status: string;
  sentAt?: string | null;
  submissionProof?: string | null;
}

export interface IncidentDetailResponse extends IncidentResponse {
  id: string;
  displayId: string;
  title: string;
  description: string;
  detectionTime: string;
  knowledgeTime: string;
  incidentManagerId: string;
  isSignificant: boolean;
  significanceReasons: string[];
  notificationDeadlines: IncidentDeadlineResponse[];
  assessments: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
  communications: Array<Record<string, unknown>>;
  knowledgeTimeChanges: Array<Record<string, unknown>>;
  incidentAssets: Array<{ asset: { id: string; displayId: string; name: string } }>;
  serviceLinks: Array<{ service: { id: string; displayId: string; name: string } }>;
  processLinks: Array<{ process: { id: string; displayId: string; name: string } }>;
}

export interface SupplierFinding { title: string; severity: 'low' | 'medium' | 'high' | 'critical'; description?: string; recommendedAction?: string; }
export interface SupplierAction { title: string; owner?: string; dueDate?: string; status?: string; }
export interface SupplierAssessment { id: string; supplierId: string; assessorId: string; assessmentDate: string; assessmentType: 'initial' | 'periodic' | 'ad_hoc'; questionnaire: Record<string, string | number | boolean | null>; findings: SupplierFinding[]; actions: SupplierAction[]; score?: number | null; rating: string; status: string; nextAssessmentDate?: string | null; createdAt: string; updatedAt: string; }
export interface SupplierDetail { supplier: Record<string, unknown>; assessments: SupplierAssessment[]; contracts: Array<Record<string, unknown>>; risks: Array<Record<string, unknown>>; correctiveActions: Array<Record<string, unknown>>; history: EntityHistoryEntry[]; }

export type BcmSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface BiaAssetLink { assetId: string; role: 'dependency' | 'primary' | 'supporting'; }
export interface BiaDetail { bia: Record<string, unknown>; assets: BiaAssetLink[]; plans: Array<Record<string, unknown>>; }
export interface BcpExerciseFinding { title: string; description: string; severity: BcmSeverity; recommendedAction?: string; }
export interface BcpExercise { id: string; bcpId: string; exerciseType: string; plannedAt: string; executedAt?: string; participants: Array<{ userId: string; role: string; attended: boolean }>; results: Array<{ objective: string; outcome: 'met' | 'partially_met' | 'not_met'; notes?: string }>; findings: BcpExerciseFinding[]; status: string; }
export interface BcpDetail { bcp: Record<string, unknown>; bia: Record<string, unknown> | null; exercises: BcpExercise[]; correctiveActions: Array<Record<string, unknown>>; }

export type AuditStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type AuditFindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface AuditProgram { id: string; displayId: string; title: string; year: number; scope: string; objectives: string[]; criteria: string[]; ownerId: string; status: string; }
export interface AuditPlan { id: string; displayId: string; programId?: string | null; auditType: string; title: string; scope: string; criteria: string[]; auditorIds: string[]; auditeeIds: string[]; plannedStart: string; plannedEnd: string; status: AuditStatus; }
export interface AuditFinding { id: string; displayId: string; auditPlanId: string; findingType: string; severity: AuditFindingSeverity; title: string; description: string; requirementIds: string[]; controlIds: string[]; assetIds: string[]; riskIds: string[]; ownerId?: string | null; dueDate?: string | null; status: string; correctiveActionId?: string | null; }
export interface CorrectiveAction { id: string; displayId: string; title: string; description: string; sourceType: string; sourceId?: string | null; ownerId: string; dueDate: string; priority: AuditFindingSeverity; status: string; effectivenessStatus?: string | null; effectivenessReview?: string | null; effectivenessCriteria?: string | null; }
export interface AuditFindingDetail { finding: AuditFinding; audit: AuditPlan; evidenceRelations: Array<{ id: string; evidenceId: string; relationType: string; evidence: { id: string; title: string; evidenceType: string; classification?: string | null } | null }>; correctiveAction: CorrectiveAction | null; }
export interface AuditDetail { audit: AuditPlan; program: AuditProgram | null; findings: AuditFinding[]; }
export interface AuditProgramDetail { program: AuditProgram; audits: AuditPlan[]; }

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
  details?: string;
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
  getById: (id: string) => api.get<IncidentDetailResponse>(`/incidents/${id}`),
  create: (data: CreateIncidentDTO) => api.post('/incidents', data),
  update: (id: string, data: UpdateIncidentDTO) => api.put(`/incidents/${id}`, data),
  delete: (id: string) => api.delete<DeleteResponse>(`/incidents/${id}`),
  assess: (id: string, data: AssessIncidentDTO) => api.post(`/incidents/${id}/assess`, data),
  decideNonReportableApproval: (id: string, data: { decision: 'approve' | 'reject'; returnReason?: string }) => api.post(`/incidents/${id}/non-reportable-approval`, data),
  changeKnowledgeTime: (id: string, data: ChangeKnowledgeTimeDTO) => api.post(`/incidents/${id}/knowledge-time`, data),
  recalculateDeadlines: (id: string) => api.post<IncidentDeadlineResponse[]>(`/incidents/${id}/recalculate-deadlines`),
  createReport: (id: string, data: CreateIncidentReportDTO) => api.post(`/incidents/${id}/reports`, data),
  exportReport: (reportId: string) => api.get(`/incidents/reports/${reportId}/export`),
  createCommunication: (id: string, data: CreateIncidentCommunicationDTO) => api.post(`/incidents/${id}/communications`, data),
  close: (id: string, data: CloseIncidentDTO) => api.post(`/incidents/${id}/close`, data),
  history: (id: string, params?: { action?: string; limit?: number; offset?: number }) => api.get(`/incidents/${id}/history`, { params }),
};

export const actionCenterApi = {
  list: (params?: ActionCenterParams) => api.get<ActionCenterResponse>('/action-center', { params }),
};

export const nis2Api = {
  listActiveQuestionnaires: () => api.get<Nis2Questionnaire[]>('/nis2/questionnaires/active'),
  listAssessments: () => api.get<Nis2Assessment[]>('/nis2/assessments'),
  getAssessment: (id: string) => api.get<Nis2Assessment>(`/nis2/assessments/${id}`),
  listRegistrations: () => api.get<Nis2Registration[]>('/nis2/registrations'),
  getRegistration: (id: string) => api.get<Nis2Registration>(`/nis2/registrations/${id}`),
  createQuestionnaire: (data: any) => api.post('/nis2/questionnaires', data),
  ensureDefaultQuestionnaire: () => api.post('/nis2/questionnaires/default'),
  createAssessment: (data: { organizationUnitId?: string; questionnaireVersion: string; answers: Record<string, Nis2Answer>; justification?: string }) => api.post<Nis2Assessment>('/nis2/assessments', data),
  submitAssessment: (id: string) => api.post(`/nis2/assessments/${id}/submit`),
  approveAssessment: (id: string, data?: any) => api.post(`/nis2/assessments/${id}/approve`, data ?? {}),
  createRegistration: (data: { assessmentId: string; entityType: string; deadline: string; registrationDate?: string; contactPerson?: string; contactDetails?: string; submissionProof?: string; bsiConfirmation?: string }) => api.post<Nis2Registration>('/nis2/registrations', data),
  recordRegistrationChange: (id: string, data: { changeType: string; description: string; changedData: Record<string, string>; notificationDeadline?: string; submittedAt?: string; submissionProof?: string }) => api.post<Nis2RegistrationChange>(`/nis2/registrations/${id}/changes`, data),
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
  getRole: (id: string) => api.get(`/admin/roles/${id}`),
  createRole: (data: { name: string; description?: string; permissionNames: string[]; canAccessAdmin?: boolean }) =>
    api.post('/admin/roles', data),
  updateRole: (id: string, data: { name?: string; description?: string; permissionNames?: string[]; canAccessAdmin?: boolean }) => api.put(`/admin/roles/${id}`, data),
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
    // The group API's canonical request field is `roles`.  Values may be role
    // IDs (the admin UI) or legacy role names (external clients).
    api.put(`/admin/groups/${groupId}/roles`, { roles: roleIds }),
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
  searchSuppliers: (params?: { search?: string; limit?: number }) => api.get('/cost-planning/suppliers', { params }),
  createSupplier: (data: { legalName: string }) => api.post('/cost-planning/suppliers', data),
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
  completeTraining: (assignmentId: string, data: { score?: number; result?: 'passed' | 'failed' | 'completed'; certificateUrl?: string; expiresAt?: string }) => api.post(`/isms-operations/training-assignments/${assignmentId}/complete`, data),
  acknowledgeTraining: (data: { courseId: string; comment?: string }) => api.post('/isms-operations/training-acknowledgements', data),
  createMetricDefinition: (data: Record<string, unknown>) => api.post('/isms-operations/metric-definitions', data),
  enterMetricValue: (data: { metricId: string; value: number; measuredAt?: string; source?: string; comment?: string }) => api.post('/isms-operations/metric-values', data),
  createManagementReview: (data: Record<string, unknown>) => api.post('/isms-operations/management-reviews', data),
  addManagementReviewAction: (data: Record<string, unknown>) => api.post('/isms-operations/management-review-actions', data),
  approveManagementReview: (id: string, approved: boolean) => api.post(`/isms-operations/management-reviews/${id}/approval`, { approved }),
  startWorkflow: (data: { definitionId: string; entityType: string; entityId: string; context?: Record<string, unknown> }) => api.post('/isms-operations/workflows/start', data),
  workflowActions: (id: string) => api.get<{ data: Array<{ key: string; label: string }> }>(`/isms-operations/workflows/${id}/actions`),
  transitionWorkflow: (id: string, data: { transition: string; comment?: string; assigneeId?: string }) => api.post(`/isms-operations/workflows/${id}/transition`, data),
  createReportDefinition: (data: Record<string, unknown>) => api.post('/isms-operations/report-definitions', data),
  runReport: (data: { definitionId?: string; module: string; filters?: Record<string, string>; format?: 'json' | 'csv' }) => api.post('/isms-operations/reports/run', data),
};

export const bcmApi = {
  getBiaDetail: (id: string) => api.get<BiaDetail>(`/isms-operations/bias/${id}/detail`),
  getBcpDetail: (id: string) => api.get<BcpDetail>(`/isms-operations/bcps/${id}/detail`),
  getExerciseDetail: (id: string) => api.get<{ exercise: BcpExercise; bcp: Record<string, unknown>; correctiveActions: Array<Record<string, unknown>> }>(`/isms-operations/bcp-exercises/${id}/detail`),
  createBia: (data: Record<string, unknown>) => api.post('/isms-operations/bias', data),
  updateBia: (id: string, data: Record<string, unknown>) => api.patch(`/isms-operations/bias/${id}`, data),
  createBcp: (data: Record<string, unknown>) => api.post('/isms-operations/bcps', data),
  updateBcp: (id: string, data: Record<string, unknown>) => api.patch(`/isms-operations/bcps/${id}`, data),
  createExercise: (data: Record<string, unknown>) => api.post('/isms-operations/bcp-exercises', data),
  updateExercise: (id: string, data: Record<string, unknown>) => api.patch(`/isms-operations/bcp-exercises/${id}`, data),
  createCapaFromExercise: (id: string, data: Record<string, unknown>) => api.post(`/isms-operations/bcp-exercises/${id}/corrective-actions`, data),
};

export const auditWorkflowApi = {
  listPrograms: () => api.get<AuditProgram[]>('/isms-operations/audit-programs'),
  createProgram: (data: Omit<AuditProgram, 'id' | 'displayId'>) => api.post<AuditProgram>('/isms-operations/audit-programs', data),
  updateProgram: (id: string, data: Partial<Omit<AuditProgram, 'id' | 'displayId'>>) => api.patch<AuditProgram>(`/isms-operations/audit-programs/${id}`, data),
  getProgramDetail: (id: string) => api.get<AuditProgramDetail>(`/isms-operations/audit-programs/${id}/detail`),
  createAudit: (programId: string, data: Omit<AuditPlan, 'id' | 'displayId' | 'programId'>) => api.post<AuditPlan>(`/isms-operations/audit-programs/${programId}/audits`, data),
  getAuditDetail: (id: string) => api.get<AuditDetail>(`/isms-operations/audits/${id}/detail`),
  createFinding: (auditId: string, data: Omit<AuditFinding, 'id' | 'displayId' | 'auditPlanId' | 'correctiveActionId'>) => api.post<AuditFinding>(`/isms-operations/audits/${auditId}/findings`, data),
  updateFinding: (id: string, data: Partial<Omit<AuditFinding, 'id' | 'displayId' | 'auditPlanId' | 'correctiveActionId'>>) => api.patch<AuditFinding>(`/isms-operations/audit-findings/${id}`, data),
  getFindingDetail: (id: string) => api.get<AuditFindingDetail>(`/isms-operations/audit-findings/${id}/detail`),
  addEvidence: (findingId: string, data: { evidenceId: string; relationType?: 'supports' | 'demonstrates' | 'contradicts' }) => api.post(`/isms-operations/audit-findings/${findingId}/evidence-relations`, data),
  removeEvidence: (findingId: string, relationId: string) => api.delete(`/isms-operations/audit-findings/${findingId}/evidence-relations/${relationId}`),
  createCapa: (findingId: string, data: Pick<CorrectiveAction, 'title' | 'description' | 'ownerId' | 'dueDate' | 'priority' | 'effectivenessCriteria'> & { rootCause?: string; containmentActions?: string[]; correctiveActions?: string[] }) => api.post<CorrectiveAction>(`/isms-operations/audit-findings/${findingId}/corrective-actions`, data),
  updateCapa: (id: string, data: Partial<Pick<CorrectiveAction, 'title' | 'description' | 'ownerId' | 'dueDate' | 'priority' | 'status' | 'effectivenessCriteria'>>) => api.patch<CorrectiveAction>(`/isms-operations/corrective-actions/${id}`, data),
  reviewEffectiveness: (id: string, data: { effectivenessStatus: 'effective' | 'partially_effective' | 'ineffective'; effectivenessReview: string; effectivenessCriteria?: string }) => api.post<CorrectiveAction>(`/isms-operations/corrective-actions/${id}/effectiveness`, data),
  closeCapa: (id: string) => api.post<CorrectiveAction>(`/isms-operations/corrective-actions/${id}/close`),
  reopenCapa: (id: string, justification: string) => api.post<CorrectiveAction>(`/isms-operations/corrective-actions/${id}/reopen`, { justification }),
};

export const supplierApi = {
  getDetail: (id: string) => api.get<SupplierDetail>(`/isms-operations/suppliers/${id}/detail`),
  getAssessment: (id: string) => api.get<SupplierAssessment>(`/isms-operations/supplier-assessments/${id}`),
  createAssessment: (supplierId: string, data: Omit<Partial<SupplierAssessment>, 'id' | 'supplierId' | 'createdAt' | 'updatedAt'> & { assessorId: string }) => api.post<SupplierAssessment>(`/isms-operations/suppliers/${supplierId}/assessments`, data),
  updateAssessment: (id: string, data: Partial<SupplierAssessment>) => api.patch<SupplierAssessment>(`/isms-operations/supplier-assessments/${id}`, data),
  addContract: (supplierId: string, data: { contractId: string; relationType?: string; status?: 'active' | 'inactive' }) => api.post(`/isms-operations/suppliers/${supplierId}/contracts`, data),
  removeContract: (supplierId: string, relationId: string) => api.delete(`/isms-operations/suppliers/${supplierId}/contracts/${relationId}`),
  addRisk: (supplierId: string, data: { riskId: string; relationType?: string; status?: 'active' | 'inactive' }) => api.post(`/isms-operations/suppliers/${supplierId}/risks`, data),
  removeRisk: (supplierId: string, relationId: string) => api.delete(`/isms-operations/suppliers/${supplierId}/risks/${relationId}`),
  createCapa: (supplierId: string, data: Record<string, unknown>) => api.post('/isms-operations/corrective-actions/from-source', { sourceType: 'supplier', sourceId: supplierId, data }),
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

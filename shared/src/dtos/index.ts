// Request/Response DTOs with Zod schemas for API validation
// Centralized in shared/ for consistency between frontend and backend

import { z } from 'zod';

// ==========================================
// Common DTOs
// ==========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const EntityIdSchema = z.union([
  z.string().uuid('Invalid UUID format'),
  z.string().regex(/^demo-[A-Za-z0-9][A-Za-z0-9_-]{0,186}$/, 'Invalid deterministic demo ID format'),
]);

export const IdParamSchema = z.object({
  id: EntityIdSchema,
});

export type IdParam = z.infer<typeof IdParamSchema>;

// ==========================================
// Auth DTOs
// ==========================================

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});

export type RegisterDTO = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

export const CreateFirstAdminSchema = RegisterSchema.extend({
  // Same fields as register, but semantically distinct
});

export type CreateFirstAdminDTO = z.infer<typeof CreateFirstAdminSchema>;

// ==========================================
// Asset DTOs
// ==========================================

export const RatingLevelSchema = z.enum(['low', 'medium', 'high']);
export const CriticalitySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const CIANeedSchema = z.enum(['low', 'medium', 'high']);
export const LifecycleStatusSchema = z.enum(['planned', 'ordered', 'in_stock', 'active', 'maintenance', 'isolated', 'decommissioned', 'disposed', 'destroyed', 'lost', 'unknown']);
export const AssessmentTypeSchema = z.enum(['inherent', 'current', 'target']);
export const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonValue = z.infer<typeof JsonPrimitiveSchema> | JsonValue[] | { [key: string]: JsonValue };
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(JsonValueSchema)]));

export const NetworkAddressTypeSchema = z.enum(['ipv4', 'ipv6', 'cidr', 'hostname']);

export const NetworkAddressCreateSchema = z.object({
  address: z.string().min(1, 'Network address is required'),
  type: NetworkAddressTypeSchema.default('ipv4'),
  primary: z.boolean().default(false),
});

export type NetworkAddressCreateDTO = z.input<typeof NetworkAddressCreateSchema>;

export const AssetRelationCreateSchema = z.object({
  targetAssetId: EntityIdSchema,
  relationshipType: z.string().min(1, 'Relationship type is required').max(100),
  description: z.string().max(500).optional(),
});
export type AssetRelationCreateDTO = z.infer<typeof AssetRelationCreateSchema>;

export const AssetRelationUpdateSchema = AssetRelationCreateSchema.extend({
  id: EntityIdSchema.optional(),
});
export type AssetRelationUpdateDTO = z.infer<typeof AssetRelationUpdateSchema>;

export const ConfirmAssetResponsibilitySchema = z.object({
  role: z.string().max(100).optional(),
});
export type ConfirmAssetResponsibilityDTO = z.infer<typeof ConfirmAssetResponsibilitySchema>;

export const CreateAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  assetTypeId: EntityIdSchema,
  assetSubtypeId: EntityIdSchema.or(z.literal('')).optional().transform((value) => value || undefined),
  inventoryNumber: z.string().max(100).optional(),
  subType: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  model: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  externalId: z.string().max(100).optional(),
  organizationUnitId: EntityIdSchema.or(z.literal('')).optional().transform((value) => value || undefined),
  locationId: EntityIdSchema.or(z.literal('')).optional().transform((value) => value || undefined),
  technicalOperatorId: EntityIdSchema.or(z.literal('')).optional().transform((value) => value || undefined),
  businessOwnerId: EntityIdSchema.or(z.literal('')).optional().transform((value) => value || undefined),
  informationSecurityResponsibleId: EntityIdSchema.or(z.literal('')).optional().transform((value) => value || undefined),

  // Junction table relations (M:N) — arrays of IDs
  processIds: z.array(EntityIdSchema).optional(),
  serviceIds: z.array(EntityIdSchema).optional(),
  contractIds: z.array(EntityIdSchema).optional(),
  licenseIds: z.array(EntityIdSchema).optional(),

  // Contract/License info (AST-002) — legacy convenience fields
  licenseInfo: z.string().max(500).optional(),
  contractEndsAt: z.coerce.date().optional(),
  licenseExpiresAt: z.coerce.date().optional(),

  // Extended rating dimensions (AST-004)
  personnelSafetyRelevance: RatingLevelSchema.default('low'),
  regulatoryRelevance: RatingLevelSchema.default('low'),
  financialDamagePotential: RatingLevelSchema.default('low'),
  productionDowntimeImpact: RatingLevelSchema.default('low'),

  lifecycleStatus: LifecycleStatusSchema.default('planned'),

  // Dates
  purchaseDate: z.coerce.date().optional(),
  commissioningDate: z.coerce.date().optional(),
  endOfSaleDate: z.coerce.date().optional(),
  endOfLifeDate: z.coerce.date().optional(),
  endOfSupportDate: z.coerce.date().optional(),

  // CIA triad needs
  confidentialityNeed: CIANeedSchema.default('low'),
  integrityNeed: CIANeedSchema.default('low'),
  availabilityNeed: CIANeedSchema.default('low'),

  dataProtectionRelevance: z.boolean().default(false),
  criticality: CriticalitySchema.default('low'),
  complianceRelevance: z.boolean().default(false), // AST-004

  // Network addresses (normalized) — replaces comma-separated string
  networkAddresses: z.array(NetworkAddressCreateSchema).optional(),
  assetRelations: z.array(AssetRelationUpdateSchema).optional(),

  dataSource: z.string().max(100).optional(),
  lastDetectedAt: z.coerce.date().optional(),
});

export type CreateAssetDTO = z.input<typeof CreateAssetSchema>;

export const UpdateAssetSchema = CreateAssetSchema.partial();

export type UpdateAssetDTO = z.infer<typeof UpdateAssetSchema>;

// Lifecycle transition DTO — validates allowed transitions
export const LifecycleTransitionSchema = z.object({
  newStatus: z.enum(['planned', 'ordered', 'in_stock', 'active', 'maintenance', 'isolated', 'decommissioned', 'disposed', 'destroyed', 'lost', 'unknown']),
  reason: z.string().max(500).optional(),
});

export type LifecycleTransitionDTO = z.infer<typeof LifecycleTransitionSchema>;

// Archive/Restore DTOs
export const ArchiveAssetSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type ArchiveAssetDTO = z.infer<typeof ArchiveAssetSchema>;

// Disposal proof DTO (AST-031)
export const DisposalProofSchema = z.object({
  disposalDate: z.coerce.date(),
  disposalMethod: z.string().min(1, 'Disposal method is required').max(200),
  disposalResponsible: z.string().min(1, 'Disposal responsible person is required').max(200),
});

export type DisposalProofDTO = z.infer<typeof DisposalProofSchema>;

// Asset query filters
export const AssetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  assetTypeId: EntityIdSchema.optional(),
  assetSubtypeId: EntityIdSchema.optional(),
  lifecycleStatus: z.string().optional(),
  criticality: CriticalitySchema.optional(),
  organizationUnitId: EntityIdSchema.optional(),
  archived: z.coerce.boolean().default(false), // include archived assets?
});

export type AssetQueryDTO = z.infer<typeof AssetQuerySchema>;

export const CreateAssetSubtypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  inventoryEnabled: z.boolean().optional(),
  inventoryPattern: z.string().max(50).optional(),
});
export type CreateAssetSubtypeDTO = z.infer<typeof CreateAssetSubtypeSchema>;

// ==========================================
// Phase 6 ISMS DTOs
// ==========================================

export const Phase6ResourceSchema = z.enum([
  'suppliers', 'supplierAssessments', 'bias', 'bcps', 'bcpExercises', 'auditPrograms', 'auditPlans', 'auditFindings',
  'correctiveActions', 'trainingCourses', 'trainingAssignments', 'trainingCompletions', 'trainingAcknowledgements',
  'managementReviews', 'managementReviewActions', 'securityObjectives', 'metricDefinitions', 'metricValues',
  'workflowDefinitions', 'workflowInstances', 'workflowTasks', 'reportDefinitions', 'reportRuns', 'exportJobs',
]);
export type Phase6ResourceDTO = z.infer<typeof Phase6ResourceSchema>;

export const Phase6ListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  ownerId: z.string().optional(),
  dueBefore: z.coerce.date().optional(),
  overdue: z.coerce.boolean().optional(),
});

export const SupplierCreateSchema = z.object({
  legalName: z.string().min(1),
  description: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
  servicesProvided: z.string().optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  dataProtectionRelevant: z.boolean().default(false),
  nis2Relevant: z.boolean().default(false),
  nextReviewDate: z.coerce.date().optional(),
});
export type SupplierCreateDTO = z.infer<typeof SupplierCreateSchema>;

// ==========================================
// Cost Planning DTOs
// ==========================================

export const CostPlanningSupplierSearchSchema = z.object({
  search: z.string().trim().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CostPlanningSupplierSearchDTO = z.infer<typeof CostPlanningSupplierSearchSchema>;

export const CostPlanningSupplierCreateSchema = z.object({
  legalName: z.string().trim().min(1).max(255),
});
export type CostPlanningSupplierCreateDTO = z.infer<typeof CostPlanningSupplierCreateSchema>;

export const CostPlanningManualItemSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  investmentType: z.string().min(1),
  plannedAmount: z.coerce.number().finite().positive(),
  knownAmount: z.coerce.number().finite().nonnegative().optional(),
  currency: z.string().trim().length(3).default('EUR'),
  plannedDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  supplierId: EntityIdSchema.optional(),
  supplierName: z.string().trim().max(255).optional(),
  quoteNumber: z.string().trim().max(100).optional(),
  remark: z.string().max(2000).optional(),
});
export type CostPlanningManualItemDTO = z.infer<typeof CostPlanningManualItemSchema>;

export const CorrectiveActionCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  sourceType: z.enum(['audit', 'incident', 'risk', 'control', 'supplier']),
  sourceId: z.string().optional(),
  ownerId: z.string().min(1),
  dueDate: z.coerce.date(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  rootCause: z.string().optional(),
});
export type CorrectiveActionCreateDTO = z.infer<typeof CorrectiveActionCreateSchema>;

export const WorkflowDefinitionCreateSchema = z.object({
  name: z.string().min(1),
  version: z.string().default('1.0.0'),
  entityType: z.string().min(1),
  states: z.array(z.record(z.any())).min(1),
  transitions: z.array(z.record(z.any())).min(1),
  approvalRules: z.record(z.any()).default({}),
  dueDateRules: z.record(z.any()).default({}),
});
export type WorkflowDefinitionCreateDTO = z.infer<typeof WorkflowDefinitionCreateSchema>;

export const ExportQuerySchema = z.object({ format: z.enum(['json', 'csv']).default('json') });
export type ExportQueryDTO = z.infer<typeof ExportQuerySchema>;

// ==========================================
// Risk DTOs
// ==========================================

export const CreateRiskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  possibleImpact: z.string().min(1, 'Possible impact is required'),
  organizationUnitId: z.string().uuid('Invalid organization unit ID').optional(),
  scenarioId: z.string().uuid('Invalid scenario ID').optional(),
  threatId: z.string().uuid('Invalid threat ID').optional(),
  vulnerabilityId: z.string().uuid('Invalid vulnerability ID').optional(),
  causeIds: z.array(z.string().uuid()).optional(),
  impactIds: z.array(z.string().uuid()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
  processIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  riskMethodVersionId: z.string().uuid('Invalid risk method version ID').optional(),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  assessorId: z.string().min(1, 'Assessor is required'),
  riskOwnerId: z.string().min(1, 'Risk owner is required'),
  nextReviewDate: z.coerce.date(),
  justification: z.string().min(1, 'Justification is required'),
  residualRisk: z.string().optional(),
  targetRisk: z.string().optional(),
});

export type CreateRiskDTO = z.infer<typeof CreateRiskSchema>;

export const UpdateRiskSchema = CreateRiskSchema.partial();

export type UpdateRiskDTO = z.infer<typeof UpdateRiskSchema>;

// ==========================================
// Control DTOs
// ==========================================

const DeprecatedDirectRiskControlFields = z.object({
  relatedRiskIds: z.never().optional(),
  riskIds: z.never().optional(),
  evidenceIds: z.never().optional(),
  controls: z.never().optional(),
  existingControls: z.never().optional(),
});

export const CreateControlSchema = z.object({
  catalogId: z.string().min(1, 'Catalog is required'),
  catalogVersion: z.string().min(1, 'Catalog version is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  controlGoal: z.string().min(1, 'Control goal is required'),
  responsibleId: z.string().optional(),
  applicability: z.enum(['applicable', 'not_applicable', 'under_review']).default('under_review'),
  applicabilityJustification: z.string().optional(),
  implementationStatus: z.string().default('planned'),
  maturityLevel: z.number().int().min(0).max(5).default(0),
  implementationDescription: z.string().optional(),
  affectedAssetIds: z.array(z.string().uuid()).optional(),
  affectedProcessIds: z.array(z.string().uuid()).optional(),
  affectedSiteIds: z.array(z.string().uuid()).optional(),
  testMethod: z.string().optional(),
  testFrequency: z.string().optional(),
}).merge(DeprecatedDirectRiskControlFields);

export type CreateControlDTO = z.input<typeof CreateControlSchema>;
export const UpdateControlSchema = CreateControlSchema.partial().extend({ status: z.string().optional() });
export type UpdateControlDTO = z.infer<typeof UpdateControlSchema>;

export const FrameworkRequirementImportSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
  section: z.string().optional(),
  clauseNumber: z.string().optional(),
  parentKey: z.string().optional(),
  sortOrder: z.number().int().optional(),
  licenseNotice: z.string().optional(),
});

export const ImportFrameworkSchema = z.object({
  framework: z.object({ name: z.string().min(1), code: z.string().min(1), description: z.string().optional(), publisher: z.string().optional() }),
  version: z.string().min(1),
  publicationDate: z.coerce.date().optional(),
  source: z.string().optional(),
  licenseInfo: z.string().min(1, 'License information is required'),
  changelog: z.string().optional(),
  requirements: z.array(FrameworkRequirementImportSchema).min(1),
});
export type ImportFrameworkDTO = z.infer<typeof ImportFrameworkSchema>;

export const CompareFrameworkVersionsSchema = z.object({ fromVersionId: z.string().uuid(), toVersionId: z.string().uuid() });
export type CompareFrameworkVersionsDTO = z.infer<typeof CompareFrameworkVersionsSchema>;

export const ControlImplementationSchema = z.object({
  controlId: z.string().uuid(),
  scopeId: z.string().uuid().optional(),
  organizationUnitId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  responsibleUserId: z.string().min(1),
  implementationStatus: z.string().default('planned'),
  maturityLevel: z.number().int().min(0).max(5).default(0),
  implementationDescription: z.string().optional(),
  testMethod: z.string().optional(),
  testFrequency: z.string().optional(),
  lastTestDate: z.coerce.date().optional(),
  nextTestDate: z.coerce.date().optional(),
  requirementIds: z.array(z.string().uuid()).default([]),
  findings: z.array(z.object({ title: z.string().min(1), description: z.string().optional(), severity: z.string().optional(), dueDate: z.coerce.date().optional() })).optional(),
  actions: z.array(z.object({ title: z.string().min(1), description: z.string().optional(), responsibleUserId: z.string().optional(), dueDate: z.coerce.date().optional() })).optional(),
}).refine((data) => Boolean(data.scopeId || data.organizationUnitId || data.siteId), { message: 'Scope, organization unit, or site is required' });
export type ControlImplementationDTO = z.input<typeof ControlImplementationSchema>;

export const RiskControlRoleSchema = z.enum(['preventive', 'detective', 'corrective', 'recovery', 'compensating']);
export const RiskControlMitigationDimensionSchema = z.enum(['likelihood', 'impact', 'both']);
export const RiskControlStatusSchema = z.enum(['active', 'inactive', 'planned', 'retired']);
export const RiskControlEffectivenessStatusSchema = z.enum(['effective', 'partially_effective', 'ineffective', 'not_tested', 'not_applicable']);

export const RiskControlNestedParamsSchema = z.object({
  riskId: z.string().uuid(),
  riskControlId: z.string().uuid().optional(),
  assessmentId: z.string().uuid().optional(),
});

export const ControlImplementationRiskParamsSchema = z.object({
  implementationId: z.string().uuid(),
});

export const RiskControlListQuerySchema = z.object({
  status: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
});
export type RiskControlListQueryDTO = z.infer<typeof RiskControlListQuerySchema>;

export const RiskControlAssessmentListQuerySchema = z.object({
  riskAssessmentVersionId: z.string().uuid().optional(),
  status: z.string().optional(),
});
export type RiskControlAssessmentListQueryDTO = z.infer<typeof RiskControlAssessmentListQuerySchema>;

export const CreateRiskControlSchema = z.object({
  riskId: z.string().uuid(),
  controlImplementationId: z.string().uuid(),
  role: RiskControlRoleSchema,
  mitigationDimension: RiskControlMitigationDimensionSchema,
  isKeyControl: z.boolean().default(false),
  status: RiskControlStatusSchema.default('active'),
}).merge(DeprecatedDirectRiskControlFields);
export type CreateRiskControlDTO = z.input<typeof CreateRiskControlSchema>;

export const CreateNestedRiskControlSchema = CreateRiskControlSchema.omit({ riskId: true });
export type CreateNestedRiskControlDTO = z.input<typeof CreateNestedRiskControlSchema>;

export const UpdateRiskControlSchema = z.object({
  role: RiskControlRoleSchema.optional(),
  mitigationDimension: RiskControlMitigationDimensionSchema.optional(),
  isKeyControl: z.boolean().optional(),
  status: RiskControlStatusSchema.optional(),
}).merge(DeprecatedDirectRiskControlFields).refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateRiskControlDTO = z.infer<typeof UpdateRiskControlSchema>;

export const CreateRiskControlAssessmentSchema = z.object({
  riskControlId: z.string().uuid(),
  riskAssessmentVersionId: z.string().uuid(),
  effectivenessStatus: RiskControlEffectivenessStatusSchema,
  effectivenessRating: z.number().int().min(0).max(100).optional(),
  likelihoodReduction: z.number().int().min(0).max(100).optional(),
  impactReduction: z.number().int().min(0).max(100).optional(),
  justification: z.string().min(1),
  assessedBy: z.string().min(1),
  evidenceLinks: z.array(z.object({ evidenceId: z.string().uuid(), relationType: z.string().optional() })).default([]),
});
export type CreateRiskControlAssessmentDTO = z.input<typeof CreateRiskControlAssessmentSchema>;

export const CreateNestedRiskControlAssessmentSchema = CreateRiskControlAssessmentSchema.omit({ riskControlId: true, assessedBy: true }).extend({
  assessedBy: z.string().min(1).optional(),
});
export type CreateNestedRiskControlAssessmentDTO = z.input<typeof CreateNestedRiskControlAssessmentSchema>;

export interface ControlImplementationDto {
  id: string;
  controlId: string;
  implementationStatus: string;
  status: string;
  isArchived?: boolean;
  control?: { id: string; title: string; description?: string | null };
}

export interface RiskAssessmentVersionDto {
  id: string;
  riskId: string;
  versionNumber: number;
  assessmentType: string;
  status: string;
  isCurrent: boolean;
  isClosed: boolean;
}

export interface RiskControlAssessmentDto {
  id: string;
  riskControlId: string;
  riskAssessmentVersionId: string;
  effectivenessStatus: string;
  effectivenessRating?: number | null;
  likelihoodReduction?: number | null;
  impactReduction?: number | null;
  justification: string;
  assessedBy: string;
  assessedAt: string | Date;
  status: string;
  isClosed: boolean;
  riskAssessmentVersion?: RiskAssessmentVersionDto;
}

export interface RiskControlDto {
  id: string;
  riskId: string;
  controlImplementationId: string;
  role: string;
  mitigationDimension: string;
  isKeyControl: boolean;
  status: string;
  createdAt: string | Date;
  createdBy?: string | null;
  controlImplementation?: ControlImplementationDto;
  assessments?: RiskControlAssessmentDto[];
}

export interface ControlImplementationRiskDto {
  riskControlId: string;
  riskId: string;
  displayId?: string | null;
  title: string;
  status: string;
  role: string;
  mitigationDimension: string;
  isKeyControl: boolean;
  relationshipStatus: string;
  latestAssessment?: RiskControlAssessmentDto | null;
}

export const CreateControlTestSchema = z.object({
  controlImplementationId: z.string().uuid(),
  testType: z.string().min(1),
  testMethod: z.string().optional(),
  testedBy: z.string().min(1),
  testedAt: z.coerce.date().optional(),
  result: z.string().min(1),
  effectivenessRating: z.number().int().min(0).max(100).optional(),
  findings: z.string().optional(),
  evidenceRequired: z.boolean().default(false),
  nextTestDate: z.coerce.date().optional(),
  evidenceLinks: z.array(z.object({ evidenceId: z.string().uuid(), relationType: z.string().optional() })).default([]),
});
export type CreateControlTestDTO = z.infer<typeof CreateControlTestSchema>;

export const CreateSoAItemSchema = z.object({
  requirementId: z.string().uuid().optional(),
  controlId: z.string().uuid().optional(),
  applicability: z.enum(['applicable', 'not_applicable', 'under_review']).default('under_review'),
  justification: z.string().min(1),
  implementationStatus: z.string().default('planned'),
  controlImplementationIds: z.array(z.string().uuid()).default([]),
}).merge(DeprecatedDirectRiskControlFields);

export const CreateSoASchema = z.object({
  frameworkId: z.string().uuid(),
  frameworkVersion: z.string().min(1),
  scopeId: z.string().min(1),
  items: z.array(CreateSoAItemSchema).default([]),
});
export type CreateSoADTO = z.infer<typeof CreateSoASchema>;

export const UpdateSoAItemSchema = CreateSoAItemSchema.partial();
export type UpdateSoAItemDTO = z.infer<typeof UpdateSoAItemSchema>;

export const CreateEvidenceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  evidenceType: z.string().min(1),
  source: z.string().optional(),
  classification: z.string().min(1),
  responsibleId: z.string().min(1),
  fileHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  hashAlgorithm: z.string().default('sha256'),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
  retentionPeriod: z.string().optional(),
  retentionUntil: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  deleteProtected: z.boolean().default(false),
  links: z.array(z.object({ entityType: z.enum(['Control', 'Risk', 'Asset', 'SoAItem', 'Document', 'RiskControlAssessment', 'ControlTest']), entityId: z.string().min(1), relationType: z.string().optional() })).default([]),
});
export type CreateEvidenceDTO = z.infer<typeof CreateEvidenceSchema>;

export const CreatePolicyDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  documentType: z.string().min(1),
  ownerId: z.string().min(1),
  reviewerId: z.string().optional(),
  approverId: z.string().optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  nextReviewDate: z.coerce.date().optional(),
  reviewIntervalDays: z.number().int().positive().optional(),
  content: z.string().min(1),
  changeLog: z.string().optional(),
});
export type CreatePolicyDocumentDTO = z.infer<typeof CreatePolicyDocumentSchema>;

// ==========================================
// Incident DTOs
// ==========================================

export const CreateIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  detectionTime: z.coerce.date(),
  knowledgeTime: z.coerce.date(),
  reporterId: z.string().optional(),
  reporterSource: z.string().optional(),
  affectedAssetIds: z.array(z.string().uuid()).default([]),
  affectedServiceIds: z.array(z.string().uuid()).default([]),
  affectedProcessIds: z.array(z.string().uuid()).default([]),
  confidentialityImpact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  integrityImpact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  availabilityImpact: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  operationalImpact: z.string().optional(),
  financialImpact: z.number().optional(),
  legalImpact: z.string().optional(),
  personalDataImpact: z.boolean().default(false),
  affectedCustomers: z.array(z.string()).default([]),
  affectedThirdParties: z.array(z.string()).default([]),
  suspectedCause: z.string().optional(),
  isIntentional: z.boolean().optional(),
  hasCrossBorderImpact: z.boolean().optional(),
  indicatorsOfCompromise: z.array(z.string()).default([]),
  immediateActions: z.array(z.string()).default([]),
  incidentManagerId: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type CreateIncidentDTO = z.input<typeof CreateIncidentSchema>;

export const UpdateIncidentSchema = CreateIncidentSchema.partial().extend({
  status: z.string().optional(),
  notificationStatus: z.string().optional(),
});
export type UpdateIncidentDTO = z.infer<typeof UpdateIncidentSchema>;

export const AssessIncidentSchema = z.object({
  isReportable: z.boolean(),
  reportingJustification: z.string().optional(),
  decisionNotToReport: z.string().optional(),
  // This is the requested approver assignment, never an approval attribution.
  decisionApprovedBy: z.string().uuid().optional(),
}).superRefine((data, ctx) => {
  if (!data.isReportable && !data.decisionNotToReport) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['decisionNotToReport'], message: 'Decision not to report requires justification' });
  if (!data.isReportable && !data.decisionApprovedBy) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['decisionApprovedBy'], message: 'Decision not to report requires approval' });
});
export type AssessIncidentDTO = z.infer<typeof AssessIncidentSchema>;

export const DecideIncidentNonReportableApprovalSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  returnReason: z.string().trim().min(1, 'A return reason is required').optional(),
}).superRefine((data, ctx) => {
  if (data.decision === 'reject' && !data.returnReason) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['returnReason'], message: 'A return reason is required' });
});
export type DecideIncidentNonReportableApprovalDTO = z.infer<typeof DecideIncidentNonReportableApprovalSchema>;

export const ChangeKnowledgeTimeSchema = z.object({
  knowledgeTime: z.coerce.date(),
  reason: z.string().min(1, 'Changing knowledge time requires a reason'),
});
export type ChangeKnowledgeTimeDTO = z.infer<typeof ChangeKnowledgeTimeSchema>;

export const IncidentReportTypeSchema = z.enum(['early_warning_24h', 'incident_notification_72h', 'interim_report', 'monthly_final_report']);

export const CreateIncidentReportSchema = z.object({
  reportType: IncidentReportTypeSchema,
  title: z.string().optional(),
  content: z.record(JsonValueSchema),
  recipient: z.string().optional(),
  submissionMethod: z.string().optional(),
  submissionProof: z.string().optional(),
});
export type CreateIncidentReportDTO = z.infer<typeof CreateIncidentReportSchema>;

export const CreateIncidentCommunicationSchema = z.object({
  channel: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']),
  recipient: z.string().min(1),
  sender: z.string().optional(),
  message: z.string().min(1),
  scheduledAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
});
export type CreateIncidentCommunicationDTO = z.infer<typeof CreateIncidentCommunicationSchema>;

export const CloseIncidentSchema = z.object({
  rootCause: z.string().min(1).optional(),
  lessonsLearned: z.string().optional(),
  measuresEvaluation: z.string().min(1).optional(),
  closureSummary: z.string().optional(),
});
export type CloseIncidentDTO = z.infer<typeof CloseIncidentSchema>;

// ==========================================
// Incident History DTOs (AUDIT-001)
// ==========================================

export const IncidentHistoryActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'ASSESSMENT',
  'KNOWLEDGE_TIME_CHANGE',
  'CLOSE',
  'REOPEN',
]);

export type IncidentHistoryActionDTO = z.infer<typeof IncidentHistoryActionSchema>;

export const IncidentHistoryEntrySchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  action: IncidentHistoryActionSchema,
  fieldChanges: z.any().optional(),
  summary: z.string().optional(),
  actorId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.date(),
});

export type IncidentHistoryEntryDTO = z.infer<typeof IncidentHistoryEntrySchema>;

export const IncidentHistoryQuerySchema = z.object({
  action: IncidentHistoryActionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type IncidentHistoryQueryDTO = z.infer<typeof IncidentHistoryQuerySchema>;
export const CreateSignificanceRuleVersionSchema = z.object({
  version: z.string().min(1),
  rules: z.array(z.record(JsonValueSchema)).min(1),
  effectiveFrom: z.coerce.date().optional(),
});
export type CreateSignificanceRuleVersionDTO = z.infer<typeof CreateSignificanceRuleVersionSchema>;

// ==========================================
// NIS-2 DTOs
// ==========================================

export const CreateNis2QuestionnaireVersionSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  questions: z.array(z.record(z.any())).min(1),
  scoringRules: z.record(z.any()),
  effectiveFrom: z.coerce.date().optional(),
});
export type CreateNis2QuestionnaireVersionDTO = z.infer<typeof CreateNis2QuestionnaireVersionSchema>;

export const CreateNis2AssessmentSchema = z.object({
  organizationUnitId: z.string().uuid().optional(),
  questionnaireVersion: z.string().optional(),
  answers: z.record(z.any()),
  justification: z.string().optional(),
});
export type CreateNis2AssessmentDTO = z.infer<typeof CreateNis2AssessmentSchema>;

export const ApproveNis2AssessmentSchema = z.object({
  result: z.enum(['essential_entity', 'important_entity', 'not_in_scope']).optional(),
  justification: z.string().optional(),
});
export type ApproveNis2AssessmentDTO = z.infer<typeof ApproveNis2AssessmentSchema>;

export const CreateNis2RegistrationSchema = z.object({
  assessmentId: z.string().uuid().optional(),
  entityType: z.string().min(1),
  registrationDate: z.coerce.date().optional(),
  deadline: z.coerce.date(),
  contactPerson: z.string().optional(),
  contactDetails: z.string().optional(),
  submittedData: z.record(z.any()).optional(),
  submissionProof: z.string().optional(),
  bsiConfirmation: z.string().optional(),
});
export type CreateNis2RegistrationDTO = z.infer<typeof CreateNis2RegistrationSchema>;

export const CreateNis2RegistrationChangeSchema = z.object({
  changeType: z.string().min(1),
  description: z.string().min(1),
  changedData: z.record(z.any()),
  notificationDeadline: z.coerce.date().optional(),
  submittedAt: z.coerce.date().optional(),
  submissionProof: z.string().optional(),
});
export type CreateNis2RegistrationChangeDTO = z.infer<typeof CreateNis2RegistrationChangeSchema>;

// ==========================================
// Contract DTOs
// ==========================================

export const CreateContractSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  contractType: z.string().min(1, 'Contract type is required'),
  supplierId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  renewalDate: z.coerce.date().optional(),
  value: z.number().positive().optional(),
  currency: z.string().optional(),
  status: z.string().default('active'),
});

export type CreateContractDTO = z.infer<typeof CreateContractSchema>;

// ==========================================
// License DTOs
// ==========================================

export const CreateLicenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  licenseType: z.string().min(1, 'License type is required'),
  vendor: z.string().optional(),
  productId: z.string().optional(),
  licenseKey: z.string().optional(),
  seats: z.number().int().positive().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  renewalDate: z.coerce.date().optional(),
  cost: z.number().positive().optional(),
  currency: z.string().optional(),
  status: z.string().default('active'),
});

export type CreateLicenseDTO = z.infer<typeof CreateLicenseSchema>;

// ==========================================
// Business Process DTOs
// ==========================================

export const CreateBusinessProcessSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  processOwner: z.string().min(1, 'Process owner is required'),
  category: z.enum(['core', 'supporting', 'management']).optional(),
  siacControlled: z.boolean().default(false),
  criticality: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.string().default('active'),
});

export type CreateBusinessProcessDTO = z.infer<typeof CreateBusinessProcessSchema>;

// ==========================================
// Risk Treatment DTOs
// ==========================================

const RiskTreatmentBaseSchema = z.object({
  riskId: z.string().uuid(),
  assessmentId: z.string().uuid('Invalid assessment ID').optional(),
  treatmentOption: z.enum(['reduce', 'mitigate', 'transfer', 'accept', 'avoid']),
  plannedActions: z.string().max(2000).optional(),
  responsibleUserId: z.string().uuid().optional(),
  targetDate: z.coerce.date().optional(),
  budget: z.number().positive().optional(),
  expectedReduction: z.string().max(1000).optional(),
  dependencies: z.string().max(2000).optional(),
  implementationStatus: z.string().optional(),
  justification: z.string().max(2000).optional(),
  expiryDate: z.coerce.date().optional(),
  approverId: z.string().uuid('Invalid approver ID').optional(),
  actions: z.array(z.object({
    actionType: z.enum(['create', 'extend', 'replace', 'improve']),
    title: z.string().min(1),
    description: z.string().optional(),
    controlImplementationId: z.string().uuid().optional(),
    responsibleUserId: z.string().uuid().optional(),
    targetDate: z.coerce.date().optional(),
  })).default([]),
});

const validateRiskTreatmentAcceptance = (data: z.infer<typeof RiskTreatmentBaseSchema>, ctx: z.RefinementCtx) => {
  if (data.treatmentOption === 'accept') {
    if (!data.assessmentId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['assessmentId'], message: 'Acceptance requires a concrete risk assessment version' });
    if (!data.justification || data.justification.trim().length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['justification'], message: 'Acceptance requires justification' });
    if (!data.expiryDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiryDate'], message: 'Acceptance requires expiry date' });
    if (!data.approverId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['approverId'], message: 'Acceptance requires approver' });
  }
};

export const CreateRiskTreatmentSchema = RiskTreatmentBaseSchema.superRefine(validateRiskTreatmentAcceptance);

export type CreateRiskTreatmentDTO = z.infer<typeof CreateRiskTreatmentSchema>;

export const UpdateRiskTreatmentSchema = RiskTreatmentBaseSchema.partial().superRefine((data, ctx) => {
  validateRiskTreatmentAcceptance(data as z.infer<typeof RiskTreatmentBaseSchema>, ctx);
});
export type UpdateRiskTreatmentDTO = z.infer<typeof UpdateRiskTreatmentSchema>;

export const ApproveRiskTreatmentSchema = z.object({
  decision: z.enum(['approved', 'rejected']).default('approved'),
  comment: z.string().max(2000).optional(),
});

export type ApproveRiskTreatmentDTO = z.infer<typeof ApproveRiskTreatmentSchema>;

export const EffectivenessReviewSchema = z.object({
  result: z.string().min(1, 'Effectiveness review result is required').max(2000),
  reviewDate: z.coerce.date(),
  reviewerId: z.string().uuid('Invalid reviewer ID').optional(),
  notes: z.string().max(2000).optional(),
});

export type EffectivenessReviewDTO = z.infer<typeof EffectivenessReviewSchema>;

export const CompleteRiskTreatmentSchema = z.object({
  residualAssessmentId: z.string().uuid('Invalid residual assessment ID').optional(),
  targetAssessment: z.object({
    riskMethodVersionId: z.string().uuid('Invalid method version ID').optional(),
    likelihood: z.number().int().positive('Likelihood must be a positive integer'),
    impact: z.number().int().positive('Impact must be a positive integer'),
    inherentRisk: z.string().min(1).optional(),
    residualRisk: z.string().min(1).optional(),
    targetRisk: z.string().min(1).optional(),
    score: z.number().int().optional(),
    assessorId: z.string().uuid('Invalid assessor ID').optional(),
    nextReviewDate: z.coerce.date(),
    justification: z.string().min(1, 'Target assessment justification is mandatory').max(2000),
  }).optional(),
}).refine((data) => Boolean(data.residualAssessmentId || data.targetAssessment), {
  message: 'Treatment completion requires residual/target assessment confirmation or creation',
});

export type CompleteRiskTreatmentDTO = z.infer<typeof CompleteRiskTreatmentSchema>;

// ==========================================
// Risk Method DTOs (Paket 3.1 — versionierte Risikomethoden)
// ==========================================

const CalculationTypeSchema = z.enum(['product', 'sum', 'max', 'matrix']);

export const CreateRiskMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  version: z.string().min(1, 'Version is required'),
  likelihoodScale: z.record(z.any()).refine((v) => v && Object.keys(v).length > 0, { message: 'Likelihood scale is required' }),
  impactScale: z.record(z.any()).refine((v) => v && Object.keys(v).length > 0, { message: 'Impact scale is required' }),
  ratingDimensions: z.record(z.any()),
  calculationType: CalculationTypeSchema.default('product'),
  formulaExpression: z.string().optional(),
  riskClasses: z.record(z.any()).refine((v) => v && Object.keys(v).length > 0, { message: 'Risk classes are required' }),
  acceptanceThresholds: z.record(z.any()).optional(),
  escalationThresholds: z.record(z.any()).optional(),
  approvalRules: z.record(z.any()).optional(),
  reviewInterval: z.number().int().positive().optional(),
  isActive: z.boolean().default(false),
});

export type CreateRiskMethodDTO = z.infer<typeof CreateRiskMethodSchema>;

export const UpdateRiskMethodSchema = CreateRiskMethodSchema.partial();

export type UpdateRiskMethodDTO = z.infer<typeof UpdateRiskMethodSchema>;

// Recalculation Preview DTO
export const RecalculatePreviewSchema = z.object({
  riskIds: z.array(z.string().uuid()).optional(),
  likelihoodOverrides: z.record(z.string(), z.number().int().positive()).optional(),
  impactOverrides: z.record(z.string(), z.number().int().positive()).optional(),
});

export type RecalculatePreviewDTO = z.infer<typeof RecalculatePreviewSchema>;

// Confirm Recalculation DTO
export const ConfirmRecalculationSchema = z.object({
  riskId: z.string().uuid('Invalid risk ID'),
  riskMethodVersionId: z.string().uuid('Invalid method version ID'),
  assessorId: z.string().min(1, 'Assessor ID is required'),
  justification: z.string().max(2000).optional(),
  nextReviewDate: z.coerce.date().optional(),
});

export type ConfirmRecalculationDTO = z.infer<typeof ConfirmRecalculationSchema>;

// Bulk Confirm Recalculation DTO
export const BulkConfirmRecalculationSchema = z.object({
  riskIds: z.array(z.string().uuid()).min(1, 'At least one risk ID is required'),
  riskMethodVersionId: z.string().uuid('Invalid method version ID'),
  assessorId: z.string().min(1, 'Assessor ID is required'),
  justification: z.string().max(2000).optional(),
  nextReviewDate: z.coerce.date().optional(),
});

export type BulkConfirmRecalculationDTO = z.infer<typeof BulkConfirmRecalculationSchema>;

// Calculate Risk Score DTO
export const CalculateRiskScoreSchema = z.object({
  likelihood: z.number().int().positive('Likelihood must be a positive integer'),
  impact: z.number().int().positive('Impact must be a positive integer'),
});

export type CalculateRiskScoreDTO = z.infer<typeof CalculateRiskScoreSchema>;

// ==========================================
// User Preferences DTOs
// ==========================================

export const UpdatePreferencesSchema = z.object({
  language: z.enum(['en', 'de']).optional(),
  darkMode: z.boolean().optional(),
});

export type UpdatePreferencesDTO = z.infer<typeof UpdatePreferencesSchema>;

// ==========================================
// Paket 3.2 — Risikobewertung DTOs
// ==========================================

// AssessmentTypeSchema is exported in common DTOs for route/query reuse.
const ReviewTaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'overdue', 'cancelled']);
const ReviewTaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
const ReviewTaskTriggerTypeSchema = z.enum(['scheduled', 'unplanned_event', 'ad_hoc']);

// --- RiskScenario DTOs ---
export const CreateRiskScenarioSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  threatId: z.string().uuid('Invalid threat ID'),
  vulnerabilityId: z.string().uuid('Invalid vulnerability ID').optional(),
});

export type CreateRiskScenarioDTO = z.infer<typeof CreateRiskScenarioSchema>;

export const UpdateRiskScenarioSchema = CreateRiskScenarioSchema.partial();

export type UpdateRiskScenarioDTO = z.infer<typeof UpdateRiskScenarioSchema>;

// --- RiskCause DTOs ---
export const CreateRiskCauseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
});

export type CreateRiskCauseDTO = z.infer<typeof CreateRiskCauseSchema>;

export const UpdateRiskCauseSchema = CreateRiskCauseSchema.partial();

export type UpdateRiskCauseDTO = z.infer<typeof UpdateRiskCauseSchema>;

// --- RiskImpact DTOs ---
export const CreateRiskImpactSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  severity: z.enum(['low', 'medium', 'high', 'very_high']).default('low'),
});

export type CreateRiskImpactDTO = z.infer<typeof CreateRiskImpactSchema>;

export const UpdateRiskImpactSchema = CreateRiskImpactSchema.partial();

export type UpdateRiskImpactDTO = z.infer<typeof UpdateRiskImpactSchema>;

// --- RiskAssessmentVersion DTOs (Paket 3.2) ---
export const CreateRiskAssessmentSchema = z.object({
  riskId: z.string().uuid('Invalid risk ID'),
  riskMethodVersionId: z.string().uuid('Invalid method version ID'),
  assessmentType: AssessmentTypeSchema.default('current'),
  likelihood: z.number().int().positive('Likelihood must be a positive integer'),
  impact: z.number().int().positive('Impact must be a positive integer'),
  inherentRisk: z.string().min(1, 'Inherent risk level is required'),
  residualRisk: z.string().min(1, 'Residual risk level is required'),
  targetRisk: z.string().min(1, 'Target risk level is required'),
  score: z.number().int().optional(),
  assessorId: z.string().min(1, 'Assessor ID is required'),
  nextReviewDate: z.coerce.date(),
  justification: z.string().min(1, 'Justification is mandatory for every assessment').max(2000),
});

export type CreateRiskAssessmentDTO = z.infer<typeof CreateRiskAssessmentSchema>;

export const UpdateRiskAssessmentSchema = CreateRiskAssessmentSchema.partial();

export type UpdateRiskAssessmentDTO = z.infer<typeof UpdateRiskAssessmentSchema>;

// --- ReviewTask DTOs ---
export const CreateReviewTaskSchema = z.object({
  riskId: z.string().uuid('Invalid risk ID'),
  scheduledDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  priority: ReviewTaskPrioritySchema.default('medium'),
  assignedTo: z.string().uuid('Invalid assignee ID').optional(),
  triggerType: ReviewTaskTriggerTypeSchema.default('scheduled'),
  triggerEventId: z.string().optional(),
  triggerSource: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateReviewTaskDTO = z.infer<typeof CreateReviewTaskSchema>;

export const UpdateReviewTaskSchema = z.object({
  status: ReviewTaskStatusSchema.optional(),
  priority: ReviewTaskPrioritySchema.optional(),
  assignedTo: z.string().uuid('Invalid assignee ID').optional().nullable(),
  notes: z.string().max(2000).optional(),
  dueDate: z.coerce.date().optional(),
});

export type UpdateReviewTaskDTO = z.infer<typeof UpdateReviewTaskSchema>;

// --- Unplanned Review Event DTO ---
const UnplannedEventTypeSchema = z.enum([
  'security_incident',
  'technical_change',
  'new_critical_supplier',
  'new_vulnerability',
  'regulatory_change',
  'criticality_change',
  'kpi_threshold_exceeded',
  'risk_approval_expiring'
]);

const SeveritySchema = z.enum(['low', 'medium', 'high', 'very_high']);

export const UnplannedReviewEventSchema = z.object({
  type: UnplannedEventTypeSchema,
  severity: SeveritySchema.optional(),
  assetId: z.string().uuid().optional(),
  riskId: z.string().uuid().optional(),
  details: z.string().max(2000).optional(),
});

export type UnplannedReviewEventDTO = z.infer<typeof UnplannedReviewEventSchema>;

// --- Risk Aggregation DTOs (Paket 3.4) ---
export const RiskAggregationGroupBySchema = z.enum(['orgUnit', 'location', 'assetType', 'process', 'service', 'scope', 'riskClass', 'status', 'assessmentType']);

export const RiskAggregationQuerySchema = z.object({
  groupBy: RiskAggregationGroupBySchema.default('orgUnit'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  scope: z.string().optional().transform((v) => v ? v.split(',').filter(Boolean) : undefined),
  organizationUnitId: z.string().uuid().optional(),
  status: z.string().optional(),
  riskClass: z.string().optional(),
  assessmentType: AssessmentTypeSchema.optional(),
  methodVersionId: z.string().uuid().optional(),
  isCurrent: z.coerce.boolean().optional(),
});

export type RiskAggregationQueryDTO = z.infer<typeof RiskAggregationQuerySchema>;

// --- Enhanced CreateRisk DTO with relational building blocks ---
export const CreateRiskEnhancedSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().min(1, 'Description is required'),
  organizationUnitId: z.string().uuid().optional(),
  // Relational building blocks
  scenarioId: z.string().uuid('Invalid scenario ID').optional(),
  threatId: z.string().uuid('Invalid threat ID').optional(),
  vulnerabilityId: z.string().uuid('Invalid vulnerability ID').optional(),
  causeIds: z.array(z.string().uuid()).optional(),
  impactIds: z.array(z.string().uuid()).optional(),
  // Asset/Process/Service junction relations
  assetIds: z.array(z.string().uuid()).optional(),
  processIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  // Assessment data
  riskMethodVersionId: z.string().uuid('Invalid method version ID').optional(),
  likelihood: z.number().int().positive('Likelihood must be a positive integer'),
  impact: z.number().int().positive('Impact must be a positive integer'),
  assessorId: z.string().min(1, 'Assessor ID is required'),
  riskOwnerId: z.string().min(1, 'Risk owner ID is required'),
  nextReviewDate: z.coerce.date(),
  // Assessment justification (mandatory)
  justification: z.string().min(1, 'Justification is mandatory').max(2000),
});

export type CreateRiskEnhancedDTO = z.infer<typeof CreateRiskEnhancedSchema>;

// ==========================================
// Phase 7 — Domain DTOs for ISMS business rules
// ==========================================

// --- Supplier domain schemas ---
export const SupplierUpdateSchema = z.object({
  legalName: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  contactPerson: z.string().max(200).optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().max(50).optional(),
  servicesProvided: z.string().max(500).optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  dataProtectionRelevant: z.boolean().optional(),
  nis2Relevant: z.boolean().optional(),
  securityRequirements: z.record(z.any()).optional(),
  certifications: z.array(z.string()).optional(),
  exitStrategy: z.string().max(2000).optional(),
  assessmentScore: z.number().int().min(0).max(100).nullable().optional(),
  assessmentRating: z.string().max(50).nullable().optional(),
  nextReviewDate: z.coerce.date().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

export type SupplierUpdateDTO = z.infer<typeof SupplierUpdateSchema>;

// --- Supplier Assessment schemas ---
export const SupplierAssessmentCreateSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  assessmentType: z.enum(['initial', 'periodic', 'triggered']).default('initial'),
  questionnaire: z.record(z.any()).default({}),
  assessorId: z.string().min(1, 'Assessor is required'),
});

export type SupplierAssessmentCreateDTO = z.infer<typeof SupplierAssessmentCreateSchema>;

// --- BIA (Business Impact Analysis) schemas ---
export const BiACreateSchema = z.object({
  title: z.string().min(1).max(255),
  processId: z.string().uuid('Invalid process ID').optional(),
  serviceId: z.string().uuid('Invalid service ID').optional(),
  ownerId: z.string().min(1, 'Owner is required'),
  mtpdMinutes: z.number().int().positive('MTPD must be a positive integer'),
  rtoMinutes: z.number().int().positive('RTO must be a positive integer'),
  rpoMinutes: z.number().int().nonnegative('RPO must be non-negative'),
  impactCategories: z.array(z.string()).default([]),
  timeDependentImpacts: z.record(z.any()).default({}),
  minimumOperatingLevel: z.string().max(500).optional(),
  requiredResources: z.record(z.any()).default({}),
}).refine((data) => data.mtpdMinutes >= data.rtoMinutes, {
  message: 'MTPD must be greater than or equal to RTO',
  path: ['mtpdMinutes'],
});

export type BiACreateDTO = z.infer<typeof BiACreateSchema>;

export const BIAUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  processId: z.string().uuid('Invalid process ID').optional(),
  serviceId: z.string().uuid('Invalid service ID').optional(),
  mtpdMinutes: z.number().int().positive().optional(),
  rtoMinutes: z.number().int().positive().optional(),
  rpoMinutes: z.number().int().nonnegative().optional(),
  impactCategories: z.array(z.string()).optional(),
  timeDependentImpacts: z.record(z.any()).optional(),
  minimumOperatingLevel: z.string().max(500).optional(),
  requiredResources: z.record(z.any()).optional(),
  status: z.enum(['draft', 'under_review', 'approved', 'rejected', 'archived']).optional(),
}).refine((data) => {
  if (data.mtpdMinutes !== undefined && data.rtoMinutes !== undefined && data.mtpdMinutes < data.rtoMinutes) return false;
  return true;
}, {
  message: 'MTPD must be greater than or equal to RTO',
  path: ['mtpdMinutes'],
});

export type BIAUpdateDTO = z.infer<typeof BIAUpdateSchema>;

// --- BCP (Business Continuity Plan) schemas ---
export const BCPCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  biaId: z.string().uuid('Invalid BIA ID').optional(),
  scope: z.string().max(500).optional(),
  ownerId: z.string().min(1, 'Owner is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  nextTestDate: z.coerce.date().optional(),
});

export type BCPCreateDTO = z.infer<typeof BCPCreateSchema>;

export const BCPUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  biaId: z.string().uuid('Invalid BIA ID').optional(),
  scope: z.string().max(500).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  nextTestDate: z.coerce.date().optional(),
  status: z.enum(['draft', 'under_review', 'approved', 'rejected', 'archived']).optional(),
});

export type BCPUpdateDTO = z.infer<typeof BCPUpdateSchema>;

// --- BCP Exercise schemas ---
export const BCPExerciseCreateSchema = z.object({
  bcpId: z.string().uuid('Invalid BCP ID'),
  exerciseType: z.enum(['tabletop', 'simulation', 'full_scale', 'functional']).default('tabletop'),
  plannedAt: z.coerce.date(),
  ownerId: z.string().min(1, 'Owner is required'),
  title: z.string().min(1).max(255),
});

export type BCPExerciseCreateDTO = z.infer<typeof BCPExerciseCreateSchema>;

// --- Audit Finding schemas ---
export const AuditFindingUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'deferred', 'completed', 'cancelled']).optional(),
  dueDate: z.coerce.date().optional(),
  ownerId: z.string().uuid('Invalid owner ID').optional(),
  correctiveActionId: z.string().uuid('Invalid CAPA ID').nullable().optional(),
});

export type AuditFindingUpdateDTO = z.infer<typeof AuditFindingUpdateSchema>;

// --- Corrective Action schemas ---
export const CapaUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  ownerId: z.string().uuid('Invalid owner ID').optional(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'deferred', 'completed', 'closed', 'reopened', 'cancelled']).optional(),
  rootCause: z.string().max(2000).optional(),
  containmentActions: z.array(z.record(z.any())).optional(),
  correctiveActions: z.array(z.record(z.any())).optional(),
  effectivenessCriteria: z.string().max(2000).optional(),
  effectivenessReview: z.string().max(2000).optional(),
  effectivenessStatus: z.enum(['not_reviewed', 'effective', 'partially_effective', 'ineffective']).optional(),
  effectivenessReviewedAt: z.coerce.date().optional(),
});

export type CapaUpdateDTO = z.infer<typeof CapaUpdateSchema>;

// CAPA transition-specific schema (requires justification for certain transitions)
export const CapaTransitionSchema = z.object({
  status: z.enum(['open', 'in_progress', 'deferred', 'completed', 'closed', 'reopened', 'cancelled']),
  justification: z.string().max(2000).optional(),
});

export type CapaTransitionDTO = z.infer<typeof CapaTransitionSchema>;

// Effectiveness review schema
export const CapaEffectivenessReviewSchema = z.object({
  effectivenessStatus: z.enum(['effective', 'partially_effective', 'ineffective']),
  effectivenessReview: z.string().min(1, 'Effectiveness review requires a comment').max(2000),
  effectivenessCriteria: z.string().max(2000).optional(),
});

export type CapaEffectivenessReviewDTO = z.infer<typeof CapaEffectivenessReviewSchema>;

// --- Training schemas ---
export const TrainingCourseUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(['security_awareness', 'compliance', 'technical', 'process', 'other']).optional(),
  mandatory: z.boolean().optional(),
  validityMonths: z.number().int().positive().nullable().optional(),
  acknowledgementRequired: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export type TrainingCourseUpdateDTO = z.infer<typeof TrainingCourseUpdateSchema>;

export const TrainingAssignmentCreateSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  userId: z.string().uuid('Invalid user ID'),
  dueDate: z.coerce.date(),
});

export type TrainingAssignmentCreateDTO = z.infer<typeof TrainingAssignmentCreateSchema>;

export const TrainingAssignmentUpdateSchema = z.object({
  status: z.enum(['assigned', 'in_progress', 'overdue', 'completed', 'expired', 'cancelled']).optional(),
  dueDate: z.coerce.date().optional(),
});

export type TrainingAssignmentUpdateDTO = z.infer<typeof TrainingAssignmentUpdateSchema>;

// Training completion schema
export const TrainingCompletionCreateSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
  courseId: z.string().uuid('Invalid course ID').optional(),
  userId: z.string().uuid('Invalid user ID').optional(),
  score: z.number().min(0).max(100).optional(),
  result: z.enum(['passed', 'failed', 'waived']).default('passed'),
  certificateUrl: z.string().url().nullable().optional(),
  evidenceId: z.string().uuid('Invalid evidence ID').optional(),
  expiresAt: z.coerce.date().optional(),
});

export type TrainingCompletionCreateDTO = z.infer<typeof TrainingCompletionCreateSchema>;

// Training acknowledgement schema
export const TrainingAcknowledgementCreateSchema = z.object({
  courseId: z.string().uuid('Invalid course ID'),
  userId: z.string().min(1, 'User is required'),
  comment: z.string().max(2000).optional(),
});

export type TrainingAcknowledgementCreateDTO = z.infer<typeof TrainingAcknowledgementCreateSchema>;

// --- Management Review schemas ---
export const ManagementReviewCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  scheduledDate: z.coerce.date(),
  ownerId: z.string().min(1, 'Owner is required'),
  nextReviewDate: z.coerce.date().optional(),
});

export type ManagementReviewCreateDTO = z.infer<typeof ManagementReviewCreateSchema>;

// --- Security Objective schemas ---
export const SecurityObjectiveCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  ownerId: z.string().min(1, 'Owner is required'),
  targetDate: z.coerce.date().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type SecurityObjectiveCreateDTO = z.infer<typeof SecurityObjectiveCreateSchema>;

// --- Metric Definition schemas ---
export const MetricDefinitionCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  metricType: z.enum(['count', 'percentage', 'ratio', 'datetime']).default('count'),
  ownerId: z.string().min(1, 'Owner is required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  status: z.enum(['draft', 'active', 'deprecated']).default('draft'),
  thresholds: z.record(z.any()).optional(),
});

export type MetricDefinitionCreateDTO = z.infer<typeof MetricDefinitionCreateSchema>;

// --- Status Transition Schemas (cross-cutting) ---
export const StatusTransitionSchema = z.object({
  status: z.string().min(1, 'Target status is required'),
  reason: z.string().max(500).optional(),
});

export type StatusTransitionDTO = z.infer<typeof StatusTransitionSchema>;

// --- Phase 7 resource enum (subset of Phase6ResourceSchema) ---
export const Phase7DomainResourceSchema = z.enum([
  'suppliers', 'supplierAssessments',
  'bias', 'bcps', 'bcpExercises',
  'auditFindings',
  'correctiveActions',
  'trainingCourses', 'trainingAssignments', 'trainingCompletions', 'trainingAcknowledgements',
  'managementReviews', 'managementReviewActions',
  'securityObjectives', 'metricDefinitions',
]);

export type Phase7DomainResourceDTO = z.infer<typeof Phase7DomainResourceSchema>;

"use strict";
// Request/Response DTOs with Zod schemas for API validation
// Centralized in shared/ for consistency between frontend and backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmRecalculationSchema = exports.RecalculatePreviewSchema = exports.UpdateRiskMethodSchema = exports.CreateRiskMethodSchema = exports.CompleteRiskTreatmentSchema = exports.EffectivenessReviewSchema = exports.ApproveRiskTreatmentSchema = exports.UpdateRiskTreatmentSchema = exports.CreateRiskTreatmentSchema = exports.CreateBusinessProcessSchema = exports.CreateLicenseSchema = exports.CreateContractSchema = exports.CreateNis2RegistrationChangeSchema = exports.CreateNis2RegistrationSchema = exports.ApproveNis2AssessmentSchema = exports.CreateNis2AssessmentSchema = exports.CreateNis2QuestionnaireVersionSchema = exports.CreateSignificanceRuleVersionSchema = exports.CloseIncidentSchema = exports.CreateIncidentCommunicationSchema = exports.CreateIncidentReportSchema = exports.IncidentReportTypeSchema = exports.ChangeKnowledgeTimeSchema = exports.AssessIncidentSchema = exports.UpdateIncidentSchema = exports.CreateIncidentSchema = exports.CreatePolicyDocumentSchema = exports.CreateEvidenceSchema = exports.CreateSoASchema = exports.CreateSoAItemSchema = exports.ControlImplementationSchema = exports.CompareFrameworkVersionsSchema = exports.ImportFrameworkSchema = exports.FrameworkRequirementImportSchema = exports.CreateControlSchema = exports.UpdateRiskSchema = exports.CreateRiskSchema = exports.AssetQuerySchema = exports.DisposalProofSchema = exports.ArchiveAssetSchema = exports.LifecycleTransitionSchema = exports.UpdateAssetSchema = exports.CreateAssetSchema = exports.NetworkAddressCreateSchema = exports.NetworkAddressTypeSchema = exports.CreateFirstAdminSchema = exports.LoginSchema = exports.RegisterSchema = exports.IdParamSchema = exports.PaginationQuerySchema = void 0;
exports.CreateRiskEnhancedSchema = exports.RiskAggregationQuerySchema = exports.RiskAggregationGroupBySchema = exports.UnplannedReviewEventSchema = exports.UpdateReviewTaskSchema = exports.CreateReviewTaskSchema = exports.UpdateRiskAssessmentSchema = exports.CreateRiskAssessmentSchema = exports.UpdateRiskImpactSchema = exports.CreateRiskImpactSchema = exports.UpdateRiskCauseSchema = exports.CreateRiskCauseSchema = exports.UpdateRiskScenarioSchema = exports.CreateRiskScenarioSchema = exports.UpdatePreferencesSchema = exports.CalculateRiskScoreSchema = exports.BulkConfirmRecalculationSchema = void 0;
const zod_1 = require("zod");
// ==========================================
// Common DTOs
// ==========================================
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('asc'),
});
exports.IdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid UUID format'),
});
// ==========================================
// Auth DTOs
// ==========================================
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.CreateFirstAdminSchema = exports.RegisterSchema.extend({
// Same fields as register, but semantically distinct
});
// ==========================================
// Asset DTOs
// ==========================================
const RatingLevelSchema = zod_1.z.enum(['low', 'medium', 'high']);
const CriticalitySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
const CIANeedSchema = zod_1.z.enum(['low', 'medium', 'high']);
exports.NetworkAddressTypeSchema = zod_1.z.enum(['ipv4', 'ipv6', 'cidr', 'hostname']);
exports.NetworkAddressCreateSchema = zod_1.z.object({
    address: zod_1.z.string().min(1, 'Network address is required'),
    type: exports.NetworkAddressTypeSchema.default('ipv4'),
    primary: zod_1.z.boolean().default(false),
});
exports.CreateAssetSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255),
    description: zod_1.z.string().max(2000).optional(),
    assetTypeId: zod_1.z.string().uuid('Invalid asset type ID'),
    subType: zod_1.z.string().max(100).optional(),
    manufacturer: zod_1.z.string().max(200).optional(),
    model: zod_1.z.string().max(200).optional(),
    serialNumber: zod_1.z.string().max(100).optional(),
    externalId: zod_1.z.string().max(100).optional(),
    organizationUnitId: zod_1.z.string().uuid('Invalid organization unit ID').optional(),
    locationId: zod_1.z.string().uuid('Invalid location ID').optional(),
    technicalOperatorId: zod_1.z.string().uuid('Invalid operator ID').optional(),
    businessOwnerId: zod_1.z.string().uuid('Invalid owner ID').optional(),
    informationSecurityResponsibleId: zod_1.z.string().uuid('Invalid security responsible ID').optional(),
    // Junction table relations (M:N) — arrays of IDs
    processIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    serviceIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    contractIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    licenseIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    // Contract/License info (AST-002) — legacy convenience fields
    licenseInfo: zod_1.z.string().max(500).optional(),
    contractEndsAt: zod_1.z.coerce.date().optional(),
    licenseExpiresAt: zod_1.z.coerce.date().optional(),
    // Extended rating dimensions (AST-004)
    personnelSafetyRelevance: RatingLevelSchema.default('low'),
    regulatoryRelevance: RatingLevelSchema.default('low'),
    financialDamagePotential: RatingLevelSchema.default('low'),
    productionDowntimeImpact: RatingLevelSchema.default('low'),
    lifecycleStatus: zod_1.z.enum(['planned', 'ordered', 'in_stock', 'active', 'maintenance', 'isolated', 'decommissioned', 'disposed', 'destroyed', 'lost', 'unknown']).default('planned'),
    // Dates
    purchaseDate: zod_1.z.coerce.date().optional(),
    commissioningDate: zod_1.z.coerce.date().optional(),
    endOfSaleDate: zod_1.z.coerce.date().optional(),
    endOfLifeDate: zod_1.z.coerce.date().optional(),
    endOfSupportDate: zod_1.z.coerce.date().optional(),
    // CIA triad needs
    confidentialityNeed: CIANeedSchema.default('low'),
    integrityNeed: CIANeedSchema.default('low'),
    availabilityNeed: CIANeedSchema.default('low'),
    dataProtectionRelevance: zod_1.z.boolean().default(false),
    criticality: CriticalitySchema.default('low'),
    complianceRelevance: zod_1.z.boolean().default(false), // AST-004
    // Network addresses (normalized) — replaces comma-separated string
    networkAddresses: zod_1.z.array(exports.NetworkAddressCreateSchema).optional(),
    dataSource: zod_1.z.string().max(100).optional(),
    lastDetectedAt: zod_1.z.coerce.date().optional(),
});
exports.UpdateAssetSchema = exports.CreateAssetSchema.partial();
// Lifecycle transition DTO — validates allowed transitions
exports.LifecycleTransitionSchema = zod_1.z.object({
    newStatus: zod_1.z.enum(['planned', 'ordered', 'in_stock', 'active', 'maintenance', 'isolated', 'decommissioned', 'disposed', 'destroyed', 'lost', 'unknown']),
    reason: zod_1.z.string().max(500).optional(),
});
// Archive/Restore DTOs
exports.ArchiveAssetSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500).optional(),
});
// Disposal proof DTO (AST-031)
exports.DisposalProofSchema = zod_1.z.object({
    disposalDate: zod_1.z.coerce.date(),
    disposalMethod: zod_1.z.string().min(1, 'Disposal method is required').max(200),
    disposalResponsible: zod_1.z.string().min(1, 'Disposal responsible person is required').max(200),
});
// Asset query filters
exports.AssetQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().optional(),
    assetTypeId: zod_1.z.string().uuid().optional(),
    lifecycleStatus: zod_1.z.string().optional(),
    criticality: CriticalitySchema.optional(),
    organizationUnitId: zod_1.z.string().uuid().optional(),
    archived: zod_1.z.boolean().default(false), // include archived assets?
});
// ==========================================
// Risk DTOs
// ==========================================
exports.CreateRiskSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    likelihood: zod_1.z.enum(['low', 'medium', 'high']).default('medium'),
    impact: zod_1.z.enum(['low', 'medium', 'high']).default('medium'),
    status: zod_1.z.string().default('identified'),
});
exports.UpdateRiskSchema = exports.CreateRiskSchema.partial();
// ==========================================
// Control DTOs
// ==========================================
exports.CreateControlSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    controlType: zod_1.z.string().optional(),
    implementationStatus: zod_1.z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']).default('not_started'),
});
exports.FrameworkRequirementImportSchema = zod_1.z.object({
    key: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    text: zod_1.z.string().min(1),
    section: zod_1.z.string().optional(),
    clauseNumber: zod_1.z.string().optional(),
    parentKey: zod_1.z.string().optional(),
    sortOrder: zod_1.z.number().int().optional(),
    licenseNotice: zod_1.z.string().optional(),
});
exports.ImportFrameworkSchema = zod_1.z.object({
    framework: zod_1.z.object({ name: zod_1.z.string().min(1), code: zod_1.z.string().min(1), description: zod_1.z.string().optional(), publisher: zod_1.z.string().optional() }),
    version: zod_1.z.string().min(1),
    publicationDate: zod_1.z.coerce.date().optional(),
    source: zod_1.z.string().optional(),
    licenseInfo: zod_1.z.string().min(1, 'License information is required'),
    changelog: zod_1.z.string().optional(),
    requirements: zod_1.z.array(exports.FrameworkRequirementImportSchema).min(1),
});
exports.CompareFrameworkVersionsSchema = zod_1.z.object({ fromVersionId: zod_1.z.string().uuid(), toVersionId: zod_1.z.string().uuid() });
exports.ControlImplementationSchema = zod_1.z.object({
    controlId: zod_1.z.string().uuid(),
    scopeId: zod_1.z.string().uuid().optional(),
    organizationUnitId: zod_1.z.string().uuid().optional(),
    siteId: zod_1.z.string().uuid().optional(),
    responsibleUserId: zod_1.z.string().min(1),
    implementationStatus: zod_1.z.string().default('planned'),
    maturityLevel: zod_1.z.number().int().min(0).max(5).default(0),
    implementationDescription: zod_1.z.string().optional(),
    testMethod: zod_1.z.string().optional(),
    testFrequency: zod_1.z.string().optional(),
    lastTestDate: zod_1.z.coerce.date().optional(),
    nextTestDate: zod_1.z.coerce.date().optional(),
    requirementIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    findings: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string().min(1), description: zod_1.z.string().optional(), severity: zod_1.z.string().optional(), dueDate: zod_1.z.coerce.date().optional() })).optional(),
    actions: zod_1.z.array(zod_1.z.object({ title: zod_1.z.string().min(1), description: zod_1.z.string().optional(), responsibleUserId: zod_1.z.string().optional(), dueDate: zod_1.z.coerce.date().optional() })).optional(),
}).refine((data) => Boolean(data.scopeId || data.organizationUnitId || data.siteId), { message: 'Scope, organization unit, or site is required' });
exports.CreateSoAItemSchema = zod_1.z.object({
    requirementId: zod_1.z.string().uuid().optional(),
    controlId: zod_1.z.string().uuid().optional(),
    applicability: zod_1.z.enum(['applicable', 'not_applicable', 'under_review']).default('under_review'),
    justification: zod_1.z.string().min(1),
    implementationStatus: zod_1.z.string().default('planned'),
    controlImplementationIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    riskIds: zod_1.z.array(zod_1.z.string()).default([]),
    evidenceIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
exports.CreateSoASchema = zod_1.z.object({
    frameworkId: zod_1.z.string().uuid(),
    frameworkVersion: zod_1.z.string().min(1),
    scopeId: zod_1.z.string().min(1),
    items: zod_1.z.array(exports.CreateSoAItemSchema).default([]),
});
exports.CreateEvidenceSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    evidenceType: zod_1.z.string().min(1),
    source: zod_1.z.string().optional(),
    classification: zod_1.z.string().min(1),
    responsibleId: zod_1.z.string().min(1),
    fileHash: zod_1.z.string().regex(/^[a-fA-F0-9]{64}$/),
    hashAlgorithm: zod_1.z.string().default('sha256'),
    fileName: zod_1.z.string().optional(),
    mimeType: zod_1.z.string().optional(),
    fileSize: zod_1.z.number().int().positive().optional(),
    retentionPeriod: zod_1.z.string().optional(),
    retentionUntil: zod_1.z.coerce.date().optional(),
    expiresAt: zod_1.z.coerce.date().optional(),
    deleteProtected: zod_1.z.boolean().default(false),
    links: zod_1.z.array(zod_1.z.object({ entityType: zod_1.z.enum(['Control', 'Risk', 'Asset', 'SoAItem', 'Document']), entityId: zod_1.z.string().min(1), relationType: zod_1.z.string().optional() })).default([]),
});
exports.CreatePolicyDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    documentType: zod_1.z.string().min(1),
    ownerId: zod_1.z.string().min(1),
    reviewerId: zod_1.z.string().optional(),
    approverId: zod_1.z.string().optional(),
    validFrom: zod_1.z.coerce.date().optional(),
    validUntil: zod_1.z.coerce.date().optional(),
    nextReviewDate: zod_1.z.coerce.date().optional(),
    reviewIntervalDays: zod_1.z.number().int().positive().optional(),
    content: zod_1.z.string().min(1),
    changeLog: zod_1.z.string().optional(),
});
// ==========================================
// Incident DTOs
// ==========================================
exports.CreateIncidentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().min(1, 'Description is required'),
    detectionTime: zod_1.z.coerce.date(),
    knowledgeTime: zod_1.z.coerce.date(),
    reporterId: zod_1.z.string().optional(),
    reporterSource: zod_1.z.string().optional(),
    affectedAssetIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    affectedServiceIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    affectedProcessIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
    confidentialityImpact: zod_1.z.enum(['none', 'low', 'medium', 'high']).default('none'),
    integrityImpact: zod_1.z.enum(['none', 'low', 'medium', 'high']).default('none'),
    availabilityImpact: zod_1.z.enum(['none', 'low', 'medium', 'high']).default('none'),
    operationalImpact: zod_1.z.string().optional(),
    financialImpact: zod_1.z.number().optional(),
    legalImpact: zod_1.z.string().optional(),
    personalDataImpact: zod_1.z.boolean().default(false),
    affectedCustomers: zod_1.z.array(zod_1.z.string()).default([]),
    affectedThirdParties: zod_1.z.array(zod_1.z.string()).default([]),
    suspectedCause: zod_1.z.string().optional(),
    isIntentional: zod_1.z.boolean().optional(),
    hasCrossBorderImpact: zod_1.z.boolean().optional(),
    indicatorsOfCompromise: zod_1.z.array(zod_1.z.string()).default([]),
    immediateActions: zod_1.z.array(zod_1.z.string()).default([]),
    incidentManagerId: zod_1.z.string().min(1),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});
exports.UpdateIncidentSchema = exports.CreateIncidentSchema.partial().extend({
    status: zod_1.z.string().optional(),
    notificationStatus: zod_1.z.string().optional(),
});
exports.AssessIncidentSchema = zod_1.z.object({
    assessorId: zod_1.z.string().min(1),
    isReportable: zod_1.z.boolean(),
    reportingJustification: zod_1.z.string().optional(),
    decisionNotToReport: zod_1.z.string().optional(),
    decisionApprovedBy: zod_1.z.string().optional(),
}).superRefine((data, ctx) => {
    if (!data.isReportable && !data.decisionNotToReport)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['decisionNotToReport'], message: 'Decision not to report requires justification' });
    if (!data.isReportable && !data.decisionApprovedBy)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['decisionApprovedBy'], message: 'Decision not to report requires approval' });
});
exports.ChangeKnowledgeTimeSchema = zod_1.z.object({
    knowledgeTime: zod_1.z.coerce.date(),
    reason: zod_1.z.string().min(1, 'Changing knowledge time requires a reason'),
});
exports.IncidentReportTypeSchema = zod_1.z.enum(['early_warning_24h', 'incident_notification_72h', 'interim_report', 'monthly_final_report']);
exports.CreateIncidentReportSchema = zod_1.z.object({
    reportType: exports.IncidentReportTypeSchema,
    title: zod_1.z.string().optional(),
    content: zod_1.z.record(zod_1.z.any()),
    authorId: zod_1.z.string().min(1),
    recipient: zod_1.z.string().optional(),
    submissionMethod: zod_1.z.string().optional(),
    submissionProof: zod_1.z.string().optional(),
});
exports.CreateIncidentCommunicationSchema = zod_1.z.object({
    channel: zod_1.z.string().min(1),
    direction: zod_1.z.enum(['inbound', 'outbound']),
    recipient: zod_1.z.string().min(1),
    sender: zod_1.z.string().optional(),
    message: zod_1.z.string().min(1),
    scheduledAt: zod_1.z.coerce.date().optional(),
    sentAt: zod_1.z.coerce.date().optional(),
});
exports.CloseIncidentSchema = zod_1.z.object({
    rootCause: zod_1.z.string().min(1).optional(),
    lessonsLearned: zod_1.z.string().optional(),
    measuresEvaluation: zod_1.z.string().min(1).optional(),
    closureSummary: zod_1.z.string().optional(),
});
exports.CreateSignificanceRuleVersionSchema = zod_1.z.object({
    version: zod_1.z.string().min(1),
    rules: zod_1.z.array(zod_1.z.record(zod_1.z.any())).min(1),
    effectiveFrom: zod_1.z.coerce.date().optional(),
});
// ==========================================
// NIS-2 DTOs
// ==========================================
exports.CreateNis2QuestionnaireVersionSchema = zod_1.z.object({
    version: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    questions: zod_1.z.array(zod_1.z.record(zod_1.z.any())).min(1),
    scoringRules: zod_1.z.record(zod_1.z.any()),
    effectiveFrom: zod_1.z.coerce.date().optional(),
});
exports.CreateNis2AssessmentSchema = zod_1.z.object({
    organizationUnitId: zod_1.z.string().uuid().optional(),
    questionnaireVersion: zod_1.z.string().optional(),
    answers: zod_1.z.record(zod_1.z.any()),
    justification: zod_1.z.string().optional(),
});
exports.ApproveNis2AssessmentSchema = zod_1.z.object({
    result: zod_1.z.enum(['essential_entity', 'important_entity', 'not_in_scope']).optional(),
    justification: zod_1.z.string().optional(),
});
exports.CreateNis2RegistrationSchema = zod_1.z.object({
    assessmentId: zod_1.z.string().uuid().optional(),
    entityType: zod_1.z.string().min(1),
    registrationDate: zod_1.z.coerce.date().optional(),
    deadline: zod_1.z.coerce.date(),
    contactPerson: zod_1.z.string().optional(),
    contactDetails: zod_1.z.string().optional(),
    submittedData: zod_1.z.record(zod_1.z.any()).optional(),
    submissionProof: zod_1.z.string().optional(),
    bsiConfirmation: zod_1.z.string().optional(),
});
exports.CreateNis2RegistrationChangeSchema = zod_1.z.object({
    changeType: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    changedData: zod_1.z.record(zod_1.z.any()),
    notificationDeadline: zod_1.z.coerce.date().optional(),
    submittedAt: zod_1.z.coerce.date().optional(),
    submissionProof: zod_1.z.string().optional(),
});
// ==========================================
// Contract DTOs
// ==========================================
exports.CreateContractSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    contractType: zod_1.z.string().min(1, 'Contract type is required'),
    supplierId: zod_1.z.string().optional(),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
    renewalDate: zod_1.z.coerce.date().optional(),
    value: zod_1.z.number().positive().optional(),
    currency: zod_1.z.string().optional(),
    status: zod_1.z.string().default('active'),
});
// ==========================================
// License DTOs
// ==========================================
exports.CreateLicenseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional(),
    licenseType: zod_1.z.string().min(1, 'License type is required'),
    vendor: zod_1.z.string().optional(),
    productId: zod_1.z.string().optional(),
    licenseKey: zod_1.z.string().optional(),
    seats: zod_1.z.number().int().positive().optional(),
    startDate: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().optional(),
    renewalDate: zod_1.z.coerce.date().optional(),
    cost: zod_1.z.number().positive().optional(),
    currency: zod_1.z.string().optional(),
    status: zod_1.z.string().default('active'),
});
// ==========================================
// Business Process DTOs
// ==========================================
exports.CreateBusinessProcessSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    processOwner: zod_1.z.string().min(1, 'Process owner is required'),
    category: zod_1.z.enum(['core', 'supporting', 'management']).optional(),
    siacControlled: zod_1.z.boolean().default(false),
    criticality: zod_1.z.enum(['low', 'medium', 'high']).default('medium'),
    status: zod_1.z.string().default('active'),
});
// ==========================================
// Risk Treatment DTOs
// ==========================================
exports.CreateRiskTreatmentSchema = zod_1.z.object({
    riskId: zod_1.z.string().uuid(),
    assessmentId: zod_1.z.string().uuid('Invalid assessment ID').optional(),
    treatmentOption: zod_1.z.enum(['reduce', 'mitigate', 'transfer', 'accept', 'avoid']),
    plannedActions: zod_1.z.string().max(2000).optional(),
    responsibleUserId: zod_1.z.string().uuid().optional(),
    targetDate: zod_1.z.coerce.date().optional(),
    budget: zod_1.z.number().positive().optional(),
    expectedReduction: zod_1.z.string().max(1000).optional(),
    dependencies: zod_1.z.string().max(2000).optional(),
    implementationStatus: zod_1.z.string().optional(),
    justification: zod_1.z.string().max(2000).optional(),
    expiryDate: zod_1.z.coerce.date().optional(),
    approverId: zod_1.z.string().uuid('Invalid approver ID').optional(),
}).superRefine((data, ctx) => {
    if (data.treatmentOption === 'accept') {
        if (!data.assessmentId)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['assessmentId'], message: 'Acceptance requires a concrete risk assessment version' });
        if (!data.justification || data.justification.trim().length === 0)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['justification'], message: 'Acceptance requires justification' });
        if (!data.expiryDate)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['expiryDate'], message: 'Acceptance requires expiry date' });
        if (!data.approverId)
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['approverId'], message: 'Acceptance requires approver' });
    }
});
exports.UpdateRiskTreatmentSchema = exports.CreateRiskTreatmentSchema.partial();
exports.ApproveRiskTreatmentSchema = zod_1.z.object({
    decision: zod_1.z.enum(['approved', 'rejected']).default('approved'),
    comment: zod_1.z.string().max(2000).optional(),
});
exports.EffectivenessReviewSchema = zod_1.z.object({
    result: zod_1.z.string().min(1, 'Effectiveness review result is required').max(2000),
    reviewDate: zod_1.z.coerce.date(),
    reviewerId: zod_1.z.string().uuid('Invalid reviewer ID').optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
exports.CompleteRiskTreatmentSchema = zod_1.z.object({
    residualAssessmentId: zod_1.z.string().uuid('Invalid residual assessment ID').optional(),
    targetAssessment: zod_1.z.object({
        riskMethodVersionId: zod_1.z.string().uuid('Invalid method version ID').optional(),
        likelihood: zod_1.z.number().int().positive('Likelihood must be a positive integer'),
        impact: zod_1.z.number().int().positive('Impact must be a positive integer'),
        inherentRisk: zod_1.z.string().min(1).optional(),
        residualRisk: zod_1.z.string().min(1).optional(),
        targetRisk: zod_1.z.string().min(1).optional(),
        score: zod_1.z.number().int().optional(),
        assessorId: zod_1.z.string().uuid('Invalid assessor ID').optional(),
        nextReviewDate: zod_1.z.coerce.date(),
        justification: zod_1.z.string().min(1, 'Target assessment justification is mandatory').max(2000),
    }).optional(),
}).refine((data) => Boolean(data.residualAssessmentId || data.targetAssessment), {
    message: 'Treatment completion requires residual/target assessment confirmation or creation',
});
// ==========================================
// Risk Method DTOs (Paket 3.1 — versionierte Risikomethoden)
// ==========================================
const CalculationTypeSchema = zod_1.z.enum(['product', 'sum', 'max', 'matrix']);
exports.CreateRiskMethodSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    description: zod_1.z.string().optional(),
    version: zod_1.z.string().min(1, 'Version is required'),
    likelihoodScale: zod_1.z.record(zod_1.z.any()).refine((v) => v && Object.keys(v).length > 0, { message: 'Likelihood scale is required' }),
    impactScale: zod_1.z.record(zod_1.z.any()).refine((v) => v && Object.keys(v).length > 0, { message: 'Impact scale is required' }),
    ratingDimensions: zod_1.z.record(zod_1.z.any()),
    calculationType: CalculationTypeSchema.default('product'),
    formulaExpression: zod_1.z.string().optional(),
    riskClasses: zod_1.z.record(zod_1.z.any()).refine((v) => v && Object.keys(v).length > 0, { message: 'Risk classes are required' }),
    acceptanceThresholds: zod_1.z.record(zod_1.z.any()).optional(),
    escalationThresholds: zod_1.z.record(zod_1.z.any()).optional(),
    approvalRules: zod_1.z.record(zod_1.z.any()).optional(),
    reviewInterval: zod_1.z.number().int().positive().optional(),
    isActive: zod_1.z.boolean().default(false),
});
exports.UpdateRiskMethodSchema = exports.CreateRiskMethodSchema.partial();
// Recalculation Preview DTO
exports.RecalculatePreviewSchema = zod_1.z.object({
    riskIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    likelihoodOverrides: zod_1.z.record(zod_1.z.string(), zod_1.z.number().int().positive()).optional(),
    impactOverrides: zod_1.z.record(zod_1.z.string(), zod_1.z.number().int().positive()).optional(),
});
// Confirm Recalculation DTO
exports.ConfirmRecalculationSchema = zod_1.z.object({
    riskId: zod_1.z.string().uuid('Invalid risk ID'),
    riskMethodVersionId: zod_1.z.string().uuid('Invalid method version ID'),
    assessorId: zod_1.z.string().min(1, 'Assessor ID is required'),
    justification: zod_1.z.string().max(2000).optional(),
    nextReviewDate: zod_1.z.coerce.date().optional(),
});
// Bulk Confirm Recalculation DTO
exports.BulkConfirmRecalculationSchema = zod_1.z.object({
    riskIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'At least one risk ID is required'),
    riskMethodVersionId: zod_1.z.string().uuid('Invalid method version ID'),
    assessorId: zod_1.z.string().min(1, 'Assessor ID is required'),
    justification: zod_1.z.string().max(2000).optional(),
    nextReviewDate: zod_1.z.coerce.date().optional(),
});
// Calculate Risk Score DTO
exports.CalculateRiskScoreSchema = zod_1.z.object({
    likelihood: zod_1.z.number().int().positive('Likelihood must be a positive integer'),
    impact: zod_1.z.number().int().positive('Impact must be a positive integer'),
});
// ==========================================
// User Preferences DTOs
// ==========================================
exports.UpdatePreferencesSchema = zod_1.z.object({
    language: zod_1.z.enum(['en', 'de']).optional(),
    darkMode: zod_1.z.boolean().optional(),
});
// ==========================================
// Paket 3.2 — Risikobewertung DTOs
// ==========================================
const AssessmentTypeSchema = zod_1.z.enum(['inherent', 'current', 'target']);
const ReviewTaskStatusSchema = zod_1.z.enum(['pending', 'in_progress', 'completed', 'overdue', 'cancelled']);
const ReviewTaskPrioritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
const ReviewTaskTriggerTypeSchema = zod_1.z.enum(['scheduled', 'unplanned_event', 'ad_hoc']);
// --- RiskScenario DTOs ---
exports.CreateRiskScenarioSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(500),
    description: zod_1.z.string().max(2000).optional(),
    threatId: zod_1.z.string().uuid('Invalid threat ID'),
    vulnerabilityId: zod_1.z.string().uuid('Invalid vulnerability ID').optional(),
});
exports.UpdateRiskScenarioSchema = exports.CreateRiskScenarioSchema.partial();
// --- RiskCause DTOs ---
exports.CreateRiskCauseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(500),
    description: zod_1.z.string().max(2000).optional(),
    category: zod_1.z.string().max(100).optional(),
});
exports.UpdateRiskCauseSchema = exports.CreateRiskCauseSchema.partial();
// --- RiskImpact DTOs ---
exports.CreateRiskImpactSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(500),
    description: zod_1.z.string().max(2000).optional(),
    category: zod_1.z.string().max(100).optional(),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'very_high']).default('low'),
});
exports.UpdateRiskImpactSchema = exports.CreateRiskImpactSchema.partial();
// --- RiskAssessment DTOs (Paket 3.2) ---
exports.CreateRiskAssessmentSchema = zod_1.z.object({
    riskId: zod_1.z.string().uuid('Invalid risk ID'),
    riskMethodVersionId: zod_1.z.string().uuid('Invalid method version ID'),
    assessmentType: AssessmentTypeSchema.default('current'),
    likelihood: zod_1.z.number().int().positive('Likelihood must be a positive integer'),
    impact: zod_1.z.number().int().positive('Impact must be a positive integer'),
    inherentRisk: zod_1.z.string().min(1, 'Inherent risk level is required'),
    residualRisk: zod_1.z.string().min(1, 'Residual risk level is required'),
    targetRisk: zod_1.z.string().min(1, 'Target risk level is required'),
    score: zod_1.z.number().int().optional(),
    assessorId: zod_1.z.string().min(1, 'Assessor ID is required'),
    nextReviewDate: zod_1.z.coerce.date(),
    justification: zod_1.z.string().min(1, 'Justification is mandatory for every assessment').max(2000),
});
exports.UpdateRiskAssessmentSchema = exports.CreateRiskAssessmentSchema.partial();
// --- ReviewTask DTOs ---
exports.CreateReviewTaskSchema = zod_1.z.object({
    riskId: zod_1.z.string().uuid('Invalid risk ID'),
    scheduledDate: zod_1.z.coerce.date(),
    dueDate: zod_1.z.coerce.date(),
    priority: ReviewTaskPrioritySchema.default('medium'),
    assignedTo: zod_1.z.string().uuid('Invalid assignee ID').optional(),
    triggerType: ReviewTaskTriggerTypeSchema.default('scheduled'),
    triggerEventId: zod_1.z.string().optional(),
    triggerSource: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
exports.UpdateReviewTaskSchema = zod_1.z.object({
    status: ReviewTaskStatusSchema.optional(),
    priority: ReviewTaskPrioritySchema.optional(),
    assignedTo: zod_1.z.string().uuid('Invalid assignee ID').optional().nullable(),
    notes: zod_1.z.string().max(2000).optional(),
    dueDate: zod_1.z.coerce.date().optional(),
});
// --- Unplanned Review Event DTO ---
const UnplannedEventTypeSchema = zod_1.z.enum([
    'security_incident',
    'technical_change',
    'new_critical_supplier',
    'new_vulnerability',
    'regulatory_change',
    'criticality_change',
    'kpi_threshold_exceeded',
    'risk_approval_expiring'
]);
const SeveritySchema = zod_1.z.enum(['low', 'medium', 'high', 'very_high']);
exports.UnplannedReviewEventSchema = zod_1.z.object({
    type: UnplannedEventTypeSchema,
    severity: SeveritySchema.optional(),
    assetId: zod_1.z.string().uuid().optional(),
    riskId: zod_1.z.string().uuid().optional(),
    details: zod_1.z.string().max(2000).optional(),
});
// --- Risk Aggregation DTOs (Paket 3.4) ---
exports.RiskAggregationGroupBySchema = zod_1.z.enum(['orgUnit', 'location', 'assetType', 'process', 'service', 'scope', 'riskClass', 'status', 'assessmentType']);
exports.RiskAggregationQuerySchema = zod_1.z.object({
    groupBy: exports.RiskAggregationGroupBySchema.default('orgUnit'),
    from: zod_1.z.coerce.date().optional(),
    to: zod_1.z.coerce.date().optional(),
    scope: zod_1.z.string().optional().transform((v) => v ? v.split(',').filter(Boolean) : undefined),
    organizationUnitId: zod_1.z.string().uuid().optional(),
    status: zod_1.z.string().optional(),
    riskClass: zod_1.z.string().optional(),
    assessmentType: AssessmentTypeSchema.optional(),
    methodVersionId: zod_1.z.string().uuid().optional(),
    isCurrent: zod_1.z.coerce.boolean().optional(),
});
// --- Enhanced CreateRisk DTO with relational building blocks ---
exports.CreateRiskEnhancedSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(500),
    description: zod_1.z.string().min(1, 'Description is required'),
    organizationUnitId: zod_1.z.string().uuid().optional(),
    // Relational building blocks
    scenarioId: zod_1.z.string().uuid('Invalid scenario ID').optional(),
    threatId: zod_1.z.string().uuid('Invalid threat ID').optional(),
    vulnerabilityId: zod_1.z.string().uuid('Invalid vulnerability ID').optional(),
    causeIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    impactIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    // Asset/Process/Service junction relations
    assetIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    processIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    serviceIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    // Assessment data
    riskMethodVersionId: zod_1.z.string().uuid('Invalid method version ID').optional(),
    likelihood: zod_1.z.number().int().positive('Likelihood must be a positive integer'),
    impact: zod_1.z.number().int().positive('Impact must be a positive integer'),
    assessorId: zod_1.z.string().min(1, 'Assessor ID is required'),
    riskOwnerId: zod_1.z.string().min(1, 'Risk owner ID is required'),
    nextReviewDate: zod_1.z.coerce.date(),
    // Assessment justification (mandatory)
    justification: zod_1.z.string().min(1, 'Justification is mandatory').max(2000),
});
//# sourceMappingURL=index.js.map
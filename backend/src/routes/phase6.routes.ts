import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMappedReadPermission, requireMappedWritePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { phase6Service, PHASE6_MODEL_MAP } from '../services/phase6.service';
import { supplierService } from '../services/supplier.service';
import { bcmService } from '../services/bcm.service';
import { correctiveActionService } from '../services/correctiveaction.service';
import { auditWorkflowService } from '../services/auditWorkflow.service';
import { trainingService } from '../services/training.service';
import { AppError } from '../middleware/errorHandler';


export const phase6Router = Router();

const AnyBodySchema = z.record(z.any());
const SourceCapaSchema = z.object({ sourceType: z.enum(['audit', 'incident', 'risk', 'control', 'supplier', 'bcp']), sourceId: z.string().uuid(), data: z.record(z.any()) });
const EntityIdSchema = z.string().uuid();
const AuditProgramWriteSchema = z.object({ title: z.string().trim().min(1).max(250), year: z.number().int().min(2000).max(2100), scope: z.string().trim().min(1).max(4000), objectives: z.array(z.string().trim().min(1).max(1000)).default([]), criteria: z.array(z.string().trim().min(1).max(1000)).default([]), ownerId: EntityIdSchema, status: z.enum(['draft', 'active', 'completed', 'archived']).optional() });
const AuditPlanWriteSchema = z.object({ programId: EntityIdSchema, auditType: z.enum(['internal', 'external', 'combined', 'surveillance', 'certification']), title: z.string().trim().min(1).max(250), scope: z.string().trim().min(1).max(4000), criteria: z.array(z.string().trim().min(1).max(1000)).default([]), auditorIds: z.array(EntityIdSchema).default([]), auditeeIds: z.array(EntityIdSchema).default([]), plannedStart: z.coerce.date(), plannedEnd: z.coerce.date(), status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional() });
const AuditFindingWriteSchema = z.object({ findingType: z.enum(['nonconformity', 'observation', 'opportunity_for_improvement']), severity: z.enum(['low', 'medium', 'high', 'critical']).optional(), title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(8000), requirementIds: z.array(EntityIdSchema).default([]), controlIds: z.array(EntityIdSchema).default([]), assetIds: z.array(EntityIdSchema).default([]), riskIds: z.array(EntityIdSchema).default([]), ownerId: EntityIdSchema.optional(), dueDate: z.coerce.date().optional(), status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional() });
const AuditEvidenceRelationWriteSchema = z.object({ evidenceId: EntityIdSchema, relationType: z.enum(['supports', 'demonstrates', 'contradicts']).optional() });
const CapaFromFindingSchema = z.object({ title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(4000), ownerId: EntityIdSchema, dueDate: z.coerce.date(), priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'), rootCause: z.string().trim().max(4000).optional(), containmentActions: z.array(z.string().trim().min(1).max(2000)).default([]), correctiveActions: z.array(z.string().trim().min(1).max(2000)).default([]), effectivenessCriteria: z.string().trim().max(4000).optional() });
const CapaWriteSchema = z.object({ title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(4000), sourceType: z.enum(['audit', 'incident', 'risk', 'control', 'supplier', 'bcp']), sourceId: EntityIdSchema.optional(), ownerId: EntityIdSchema, dueDate: z.coerce.date(), priority: z.enum(['low', 'medium', 'high', 'critical']).optional(), rootCause: z.string().trim().max(4000).optional(), containmentActions: z.array(z.string().trim().min(1).max(2000)).optional(), correctiveActions: z.array(z.string().trim().min(1).max(2000)).optional(), effectivenessCriteria: z.string().trim().max(4000).optional(), status: z.enum(['open', 'in_progress', 'completed', 'closed', 'reopened', 'cancelled']).optional() });
const CapaEffectivenessSchema = z.object({ effectivenessStatus: z.enum(['effective', 'partially_effective', 'ineffective']), effectivenessReview: z.string().trim().min(1).max(4000), effectivenessCriteria: z.string().trim().max(4000).optional() });
const CapaReopenSchema = z.object({ justification: z.string().trim().min(1).max(4000) });
const BiaAssetSchema = z.object({ assetId: EntityIdSchema, role: z.enum(['dependency', 'primary', 'supporting']).default('dependency') });
const BiaWriteSchema = z.object({
  title: z.string().trim().min(1).max(250), ownerId: EntityIdSchema, processId: EntityIdSchema.optional(), serviceId: EntityIdSchema.optional(),
  mtpdMinutes: z.number().int().positive(), rtoMinutes: z.number().int().positive(), rpoMinutes: z.number().int().nonnegative(),
  impactCategories: z.array(z.object({ category: z.string().trim().min(1).max(100), level: z.enum(['low', 'medium', 'high', 'critical']), rationale: z.string().trim().max(2000).optional() })).default([]),
  timeDependentImpacts: z.array(z.object({ elapsedMinutes: z.number().int().positive(), impact: z.string().trim().min(1).max(2000) })).default([]),
  minimumOperatingLevel: z.string().trim().max(1000).optional(), requiredResources: z.array(z.object({ resource: z.string().trim().min(1).max(250), quantity: z.string().trim().max(100).optional(), rationale: z.string().trim().max(1000).optional() })).default([]),
  assetLinks: z.array(BiaAssetSchema).default([]), lastReviewDate: z.coerce.date().optional(), nextReviewDate: z.coerce.date().optional(), status: z.enum(['draft', 'active', 'under_review', 'archived']).optional(),
});
const RecoveryStrategySchema = z.object({ name: z.string().trim().min(1).max(250), priority: z.enum(['primary', 'alternate', 'fallback']).default('primary'), steps: z.array(z.string().trim().min(1).max(2000)).min(1), recoveryTargetMinutes: z.number().int().positive().optional() });
const CommunicationSchema = z.object({ audience: z.string().trim().min(1).max(250), channel: z.string().trim().min(1).max(250), message: z.string().trim().min(1).max(4000), timing: z.string().trim().max(500).optional(), ownerId: EntityIdSchema.optional() });
const BcpWriteSchema = z.object({
  title: z.string().trim().min(1).max(250), ownerId: EntityIdSchema, biaId: EntityIdSchema.optional(), version: z.string().trim().min(1).max(50).optional(), scope: z.string().trim().max(4000).optional(),
  recoveryStrategies: z.array(RecoveryStrategySchema).min(1), communicationPlan: z.array(CommunicationSchema).min(1), activationCriteria: z.string().trim().max(4000).optional(), nextTestDate: z.coerce.date().optional(), status: z.enum(['draft', 'active', 'under_review', 'approved', 'archived']).optional(),
});
const ExerciseFindingSchema = z.object({ title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(4000), severity: z.enum(['low', 'medium', 'high', 'critical']), recommendedAction: z.string().trim().max(4000).optional() });
const ExerciseWriteSchema = z.object({
  bcpId: EntityIdSchema, exerciseType: z.enum(['tabletop', 'simulation', 'technical_recovery', 'call_tree']), plannedAt: z.coerce.date(), executedAt: z.coerce.date().optional(),
  participants: z.array(z.object({ userId: EntityIdSchema, role: z.string().trim().min(1).max(250), attended: z.boolean().default(true) })).default([]),
  results: z.array(z.object({ objective: z.string().trim().min(1).max(1000), outcome: z.enum(['met', 'partially_met', 'not_met']), notes: z.string().trim().max(4000).optional() })).default([]), findings: z.array(ExerciseFindingSchema).default([]), status: z.enum(['planned', 'scheduled', 'in_progress', 'executed', 'completed', 'cancelled']).optional(),
});
const CapaFromExerciseSchema = z.object({ title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(4000), ownerId: EntityIdSchema, dueDate: z.coerce.date(), priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'), findingIndex: z.number().int().nonnegative().optional() });
const SupplierAssessmentSchema = z.object({
  assessorId: z.string().min(1), assessmentDate: z.coerce.date().optional(), assessmentType: z.enum(['initial', 'periodic', 'ad_hoc']).optional(),
  questionnaire: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  findings: z.array(z.object({ title: z.string().min(1), severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'), description: z.string().optional(), recommendedAction: z.string().optional() })).default([]),
  actions: z.array(z.object({ title: z.string().min(1), owner: z.string().optional(), dueDate: z.coerce.date().optional(), status: z.string().optional() })).default([]),
  score: z.number().int().min(0).max(100).optional(), rating: z.enum(['low', 'medium', 'high', 'critical']).optional(), status: z.enum(['draft', 'under_review', 'approved', 'rejected', 'completed']).optional(), nextAssessmentDate: z.coerce.date().optional(), approvedBy: z.string().optional(), approvedAt: z.coerce.date().optional(),
});
const SupplierRelationSchema = z.object({ contractId: z.string().min(1).optional(), riskId: z.string().min(1).optional(), relationType: z.string().min(1).max(100).optional(), status: z.enum(['active', 'inactive']).optional() });
const WorkflowStartSchema = z.object({ definitionId: z.string().uuid(), entityType: z.string().optional(), entityId: z.string().min(1), initialState: z.string().optional(), context: z.record(z.any()).optional() });
const WorkflowTransitionSchema = z.object({ transition: z.string().min(1), comment: z.string().optional(), assigneeId: z.string().optional() });
const TrainingCourseWriteSchema = z.object({ title: z.string().trim().min(1).max(250), description: z.string().trim().max(4000).optional(), category: z.string().trim().max(120).optional(), mandatory: z.boolean().optional(), validityMonths: z.number().int().positive().optional(), acknowledgementRequired: z.boolean().optional(), ownerId: EntityIdSchema.optional(), status: z.enum(['draft', 'active', 'archived']).optional() });
const TrainingAssignmentWriteSchema = z.object({ courseId: EntityIdSchema, userId: EntityIdSchema, dueDate: z.coerce.date(), assignedAt: z.coerce.date().optional(), notes: z.string().trim().max(4000).optional() });
const TrainingCompletionSchema = z.object({ score: z.number().min(0).max(100).optional(), result: z.enum(['passed', 'failed', 'completed']).default('passed'), certificateUrl: z.string().url().optional(), expiresAt: z.coerce.date().optional() });
const TrainingAcknowledgementSchema = z.object({ courseId: EntityIdSchema, comment: z.string().trim().max(2000).optional() });
const MetricDefinitionWriteSchema = z.object({ objectiveId: EntityIdSchema.optional(), name: z.string().trim().min(1).max(250), metricType: z.enum(['KPI', 'KRI', 'KCI']).default('KPI'), description: z.string().trim().max(4000).optional(), unit: z.string().trim().max(50).optional(), aggregation: z.enum(['latest', 'sum', 'average', 'minimum', 'maximum']).default('latest'), thresholds: z.object({ warningMin: z.number().optional(), criticalMin: z.number().optional(), warningMax: z.number().optional(), criticalMax: z.number().optional() }).default({}), ownerId: EntityIdSchema, status: z.enum(['active', 'inactive', 'archived']).optional() });
const MetricValueWriteSchema = z.object({ metricId: EntityIdSchema, measuredAt: z.coerce.date().optional(), value: z.number(), source: z.string().trim().max(250).optional(), comment: z.string().trim().max(2000).optional() });
const ManagementReviewWriteSchema = z.object({ title: z.string().trim().min(1).max(250), reviewDate: z.coerce.date(), chairId: EntityIdSchema, participants: z.array(EntityIdSchema).default([]), agenda: z.array(z.object({ topic: z.string().trim().min(1).max(500), presenter: z.string().trim().max(250).optional() })).default([]), inputs: z.record(z.string()).default({}), decisions: z.array(z.object({ decision: z.string().trim().min(1).max(2000), rationale: z.string().trim().max(2000).optional() })).default([]), minutes: z.string().trim().max(8000).optional(), nextReviewDate: z.coerce.date().optional(), status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']).optional() });
const ManagementReviewActionSchema = z.object({ reviewId: EntityIdSchema, title: z.string().trim().min(1).max(500), ownerId: EntityIdSchema, dueDate: z.coerce.date(), status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional() });
const ManagementReviewApproveSchema = z.object({ approved: z.boolean() });
const ReportDefinitionWriteSchema = z.object({ name: z.string().trim().min(1).max(250), description: z.string().trim().max(4000).optional(), module: z.string().trim().min(1).max(100), filters: z.record(z.string()).default({}), columns: z.array(z.string().trim().min(1).max(100)).default([]), format: z.enum(['json', 'csv']).default('json'), ownerId: EntityIdSchema, status: z.enum(['active', 'inactive', 'archived']).optional() });
const ReportRunSchema = z.object({ definitionId: EntityIdSchema.optional(), module: z.string().trim().min(1).max(100), filters: z.record(z.string()).default({}), format: z.enum(['json', 'csv']).default('json') });

function ensureResource(resource: string) {
  if (!PHASE6_MODEL_MAP[resource]) throw new AppError(`Unknown Phase 6 resource ${resource}`, 404);
}

const RESOURCE_PERMISSION_ALIAS: Record<string, string> = {
  supplierAssessments: 'suppliers',
  bias: 'bias',
  bcps: 'bcps',
  bcpExercises: 'bcps',
  auditPrograms: 'auditPlans',
  auditPlans: 'auditPlans',
  auditFindings: 'auditPlans',
  correctiveActions: 'correctiveActions',
  trainingCourses: 'trainingAssignments',
  trainingAssignments: 'trainingAssignments',
  trainingCompletions: 'trainingAssignments',
  trainingAcknowledgements: 'trainingAssignments',
  managementReviews: 'auditPlans',
  managementReviewActions: 'correctiveActions',
  securityObjectives: 'auditPlans',
  metricDefinitions: 'auditPlans',
  metricValues: 'auditPlans',
  workflowDefinitions: 'auditPlans',
  workflowInstances: 'auditPlans',
  workflowTasks: 'auditPlans',
  reportDefinitions: 'auditPlans',
  reportRuns: 'auditPlans',
  exportJobs: 'evidence',
};

function permissionResource(resource: string) {
  return RESOURCE_PERMISSION_ALIAS[resource] ?? resource;
}

async function requireResourceRead(req: AuthRequest, _res: any, next: any) {
  try { ensureResource(req.params.resource); return requireMappedReadPermission(permissionResource(req.params.resource) as any)(req, _res, next); } catch (error) { return next(error); }
}

async function requireResourceWrite(req: AuthRequest, _res: any, next: any) {
  try { ensureResource(req.params.resource); return requireMappedWritePermission(permissionResource(req.params.resource) as any)(req, _res, next); } catch (error) { return next(error); }
}

phase6Router.get('/resources', authenticate, (_req, res) => {
  res.json({ resources: Object.keys(PHASE6_MODEL_MAP) });
});

phase6Router.post('/corrective-actions/from-source', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(SourceCapaSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.createCorrectiveActionFromSource(req.body.sourceType, req.body.sourceId, req.body.data, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/training-assignments/:id/complete', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(TrainingCompletionSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.completeTrainingAssignment(req.params.id, req.body, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/workflows/start', authenticate, requireMappedWritePermission('auditPlans'), validateBody(WorkflowStartSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.startWorkflow(req.body.definitionId, req.body, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/workflows/:id/transition', authenticate, requireMappedWritePermission('auditPlans'), validateBody(WorkflowTransitionSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.transitionWorkflow(req.params.id, req.body.transition, req.body, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.get('/workflows/:id/actions', authenticate, requireMappedReadPermission('auditPlans'), async (req: AuthRequest, res, next) => {
  try {
    res.json({ data: await phase6Service.getWorkflowActions(req.params.id) });
  } catch (error) { next(error); }
});

phase6Router.post('/reports/run', authenticate, requireMappedWritePermission('auditPlans'), validateBody(ReportRunSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.createReportRun(req.body, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// ===========================================================================
// Phase 7 — Explicit domain routes (before generic catch-all)
// ===========================================================================

// --- Supplier routes ---
phase6Router.get('/suppliers', authenticate, requireMappedReadPermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.list(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/suppliers', authenticate, requireMappedWritePermission('suppliers'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await supplierService.create(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/suppliers/:id', authenticate, requireMappedWritePermission('suppliers'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.update(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/suppliers/:id/archive', authenticate, requireMappedWritePermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.archive(req.params.id, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.get('/suppliers/:id/detail', authenticate, requireMappedReadPermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.getDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/suppliers/:id/contracts', authenticate, requireMappedWritePermission('suppliers'), validateBody(SupplierRelationSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await supplierService.addContractRelation(req.params.id, req.body.contractId, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.delete('/suppliers/:id/contracts/:relationId', authenticate, requireMappedWritePermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { await supplierService.removeContractRelation(req.params.id, req.params.relationId, req.userId ?? 'system'); res.status(204).send(); } catch (error) { next(error); }
});
phase6Router.post('/suppliers/:id/risks', authenticate, requireMappedWritePermission('suppliers'), validateBody(SupplierRelationSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await supplierService.addRiskRelation(req.params.id, req.body.riskId, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.delete('/suppliers/:id/risks/:relationId', authenticate, requireMappedWritePermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { await supplierService.removeRiskRelation(req.params.id, req.params.relationId, req.userId ?? 'system'); res.status(204).send(); } catch (error) { next(error); }
});

// --- Supplier Assessment routes ---
phase6Router.get('/suppliers/:supplierId/assessments', authenticate, requireMappedReadPermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.listAssessments(req.params.supplierId, req.query)); } catch (error) { next(error); }
});
phase6Router.post('/suppliers/:supplierId/assessments', authenticate, requireMappedWritePermission('suppliers'), validateBody(SupplierAssessmentSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await supplierService.createAssessment(req.params.supplierId, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.get('/supplier-assessments/:id', authenticate, requireMappedReadPermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.getAssessment(req.params.id)); } catch (error) { next(error); }
});
phase6Router.patch('/supplier-assessments/:id', authenticate, requireMappedWritePermission('suppliers'), validateBody(SupplierAssessmentSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.updateAssessment(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- BIA routes ---
phase6Router.get('/bias', authenticate, requireMappedReadPermission('bias'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.listBia(req.query)); } catch (error) { next(error); }
});
phase6Router.get('/bias/:id/detail', authenticate, requireMappedReadPermission('bias'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.getBiaDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/bias', authenticate, requireMappedWritePermission('bias'), validateBody(BiaWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createBia(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/bias/:id', authenticate, requireMappedWritePermission('bias'), validateBody(BiaWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.updateBia(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- BCP routes ---
phase6Router.get('/bcps', authenticate, requireMappedReadPermission('bcps'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.listBcp(req.query)); } catch (error) { next(error); }
});
phase6Router.get('/bcps/:id/detail', authenticate, requireMappedReadPermission('bcps'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.getBcpDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/bcps', authenticate, requireMappedWritePermission('bcps'), validateBody(BcpWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createBcp(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/bcps/:id', authenticate, requireMappedWritePermission('bcps'), validateBody(BcpWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.updateBcp(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- BCP Exercise routes ---
phase6Router.get('/bcp-exercises', authenticate, requireMappedReadPermission('bcps'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.listExercises(req.query)); } catch (error) { next(error); }
});
phase6Router.get('/bcp-exercises/:id/detail', authenticate, requireMappedReadPermission('bcps'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.getExerciseDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/bcp-exercises', authenticate, requireMappedWritePermission('bcps'), validateBody(ExerciseWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createExercise(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/bcp-exercises/:id', authenticate, requireMappedWritePermission('bcps'), validateBody(ExerciseWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.updateExercise(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/bcp-exercises/:id/corrective-actions', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(CapaFromExerciseSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createCorrectiveActionFromExercise(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Corrective Action routes ---
phase6Router.get('/corrective-actions', authenticate, requireMappedReadPermission('correctiveActions'), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.list(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(CapaWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await correctiveActionService.create(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/corrective-actions/:id', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(CapaWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.update(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions/:id/effectiveness', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(CapaEffectivenessSchema), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.reviewEffectiveness(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions/:id/close', authenticate, requireMappedWritePermission('correctiveActions'), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.close(req.params.id, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions/:id/reopen', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(CapaReopenSchema), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.reopen(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Audit and CAPA workflow routes ---
phase6Router.get('/audit-programs', authenticate, requireMappedReadPermission('auditPlans'), async (_req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.listPrograms()); } catch (error) { next(error); }
});
phase6Router.post('/audit-programs', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditProgramWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await auditWorkflowService.createProgram(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/audit-programs/:id', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditProgramWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.updateProgram(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.get('/audit-programs/:id/detail', authenticate, requireMappedReadPermission('auditPlans'), async (req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.getProgramDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/audit-programs/:id/audits', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditPlanWriteSchema.omit({ programId: true })), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await auditWorkflowService.createAudit({ ...req.body, programId: req.params.id }, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/audits/:id', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditPlanWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.updateAudit(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.get('/audits/:id/detail', authenticate, requireMappedReadPermission('auditPlans'), async (req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.getAuditDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/audits/:id/findings', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditFindingWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await auditWorkflowService.createFinding(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/audit-findings/:id', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditFindingWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.updateFinding(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.get('/audit-findings/:id/detail', authenticate, requireMappedReadPermission('auditPlans'), async (req: AuthRequest, res, next) => {
  try { res.json(await auditWorkflowService.getFindingDetail(req.params.id)); } catch (error) { next(error); }
});
phase6Router.post('/audit-findings/:id/evidence-relations', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AuditEvidenceRelationWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await auditWorkflowService.addEvidenceRelation(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.delete('/audit-findings/:id/evidence-relations/:relationId', authenticate, requireMappedWritePermission('auditPlans'), async (req: AuthRequest, res, next) => {
  try { await auditWorkflowService.removeEvidenceRelation(req.params.id, req.params.relationId, req.userId ?? 'system'); res.status(204).send(); } catch (error) { next(error); }
});
phase6Router.post('/audit-findings/:id/corrective-actions', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(CapaFromFindingSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await auditWorkflowService.createCapaFromFinding(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Course routes ---
phase6Router.get('/training-courses', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listCourses(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-courses', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(TrainingCourseWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createCourse(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/training-courses/:id', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(TrainingCourseWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.updateCourse(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Assignment routes ---
phase6Router.get('/training-assignments', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listAssignments(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-assignments', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(TrainingAssignmentWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createAssignment(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/training-assignments/:id', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(TrainingAssignmentWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.updateAssignment(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Completion routes ---
phase6Router.get('/training-completions', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listCompletions(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-completions', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(z.object({ assignmentId: EntityIdSchema, score: z.number().min(0).max(100).optional(), result: z.enum(['passed', 'failed', 'completed']).default('passed'), certificateUrl: z.string().url().optional(), expiresAt: z.coerce.date().optional() })), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createCompletion(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Acknowledgement routes ---
phase6Router.get('/training-acknowledgements', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listAcknowledgements(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-acknowledgements', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(TrainingAcknowledgementSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createAcknowledgement(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Operational workspace routes: typed contracts for normal-user workflows ---
phase6Router.post('/metric-definitions', authenticate, requireMappedWritePermission('auditPlans'), validateBody(MetricDefinitionWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await phase6Service.create('metricDefinitions', req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.patch('/metric-definitions/:id', authenticate, requireMappedWritePermission('auditPlans'), validateBody(MetricDefinitionWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await phase6Service.update('metricDefinitions', req.params.id, req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.post('/metric-values', authenticate, requireMappedWritePermission('auditPlans'), validateBody(MetricValueWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await phase6Service.create('metricValues', req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.post('/management-reviews', authenticate, requireMappedWritePermission('auditPlans'), validateBody(ManagementReviewWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await phase6Service.create('managementReviews', req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.patch('/management-reviews/:id', authenticate, requireMappedWritePermission('auditPlans'), validateBody(ManagementReviewWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await phase6Service.update('managementReviews', req.params.id, req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.post('/management-review-actions', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(ManagementReviewActionSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await phase6Service.create('managementReviewActions', req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.post('/management-reviews/:id/approval', authenticate, requireMappedWritePermission('auditPlans'), validateBody(ManagementReviewApproveSchema), async (req: AuthRequest, res, next) => {
  try {
    const review = await phase6Service.update('managementReviews', req.params.id, req.body.approved
      ? { approvalStatus: 'approved', approvedBy: req.userId, approvedAt: new Date(), status: 'completed' }
      : { approvalStatus: 'rejected', approvedBy: undefined, approvedAt: undefined }, req.userId);
    res.json(review);
  } catch (error) { next(error); }
});
phase6Router.post('/report-definitions', authenticate, requireMappedWritePermission('auditPlans'), validateBody(ReportDefinitionWriteSchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await phase6Service.create('reportDefinitions', req.body, req.userId)); } catch (error) { next(error); }
});
phase6Router.patch('/report-definitions/:id', authenticate, requireMappedWritePermission('auditPlans'), validateBody(ReportDefinitionWriteSchema.partial()), async (req: AuthRequest, res, next) => {
  try { res.json(await phase6Service.update('reportDefinitions', req.params.id, req.body, req.userId)); } catch (error) { next(error); }
});

// ===========================================================================

phase6Router.post('/:resource/reminders/run', authenticate, requireResourceWrite, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    const result = await phase6Service.runReminders(req.params.resource, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/reminders/:resource', authenticate, requireResourceWrite, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    const result = await phase6Service.runReminders(req.params.resource, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.get('/:resource/export', authenticate, requireResourceRead, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    const result = await phase6Service.export(req.params.resource, req.query, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.get('/:resource', authenticate, requireResourceRead, async (req, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.list(req.params.resource, req.query));
  } catch (error) { next(error); }
});

phase6Router.get('/:resource/:id', authenticate, requireResourceRead, async (req, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.get(req.params.resource, req.params.id));
  } catch (error) { next(error); }
});

phase6Router.post('/:resource', authenticate, requireResourceWrite, validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.status(201).json(await phase6Service.create(req.params.resource, req.body, req.userId ?? 'system'));
  } catch (error) { next(error); }
});

phase6Router.patch('/:resource/:id', authenticate, requireResourceWrite, validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.update(req.params.resource, req.params.id, req.body, req.userId ?? 'system'));
  } catch (error) { next(error); }
});

phase6Router.delete('/:resource/:id', authenticate, requireResourceWrite, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.remove(req.params.resource, req.params.id, req.userId ?? 'system'));
  } catch (error) { next(error); }
});

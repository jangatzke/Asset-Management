import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { authorizeEntityRead, authorizeEntityWrite, authorizeEntityDelete, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { riskService } from '../services/risk.service';
import { riskAggregationService } from '../services/risk.aggregation';
import { authorizationService } from '../services/authorization.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import {
  CreateNestedRiskControlAssessmentSchema,
  CreateNestedRiskControlSchema,
  CreateRiskControlAssessmentSchema,
  CreateRiskControlSchema,
  RiskControlAssessmentListQuerySchema,
  RiskControlListQuerySchema,
  RiskControlNestedParamsSchema,
  UpdateRiskControlSchema,
} from 'shared';



export const riskRouter = Router();

const CreateRiskRouteSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  possibleImpact: z.string().min(1),
  organizationUnitId: z.string().uuid().optional(),
  scenarioId: z.string().uuid().optional(),
  threatId: z.string().uuid().optional(),
  vulnerabilityId: z.string().uuid().optional(),
  causeIds: z.array(z.string().uuid()).optional(),
  impactIds: z.array(z.string().uuid()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
  processIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  riskMethodVersionId: z.string().uuid().optional(),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  assessorId: z.string().min(1),
  riskOwnerId: z.string().min(1),
  nextReviewDate: z.coerce.date(),
  justification: z.string().min(1),
  residualRisk: z.string().optional(),
  targetRisk: z.string().optional(),
});

const UpdateRiskRouteSchema = CreateRiskRouteSchema.partial().extend({
  status: z.string().optional(),
  assessmentType: z.enum(['inherent', 'current', 'target']).optional(),
});

const parseAggregationFilters = (query: any) => ({
  from: query.from ? new Date(String(query.from)) : undefined,
  to: query.to ? new Date(String(query.to)) : undefined,
  scope: query.scope ? String(query.scope).split(',').filter(Boolean) : undefined,
  organizationUnitId: query.organizationUnitId ? String(query.organizationUnitId) : undefined,
  status: query.status ? String(query.status) : undefined,
  riskClass: query.riskClass ? String(query.riskClass) : undefined,
  assessmentType: query.assessmentType ? String(query.assessmentType) as any : undefined,
  methodVersionId: query.methodVersionId ? String(query.methodVersionId) : undefined,
  isCurrent: query.isCurrent === undefined ? undefined : String(query.isCurrent) !== 'false',
});

// ==========================================
// Static routes MUST come BEFORE parametric routes (/id)
// ==========================================

riskRouter.get('/', authenticate, requirePermission('risks.read'), async (req: AuthRequest, res, next) => {
  try {
    const result = await riskService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'risks') as any);
    res.json(result);
  } catch (error) {
    return next(error);
  }
});

riskRouter.post('/', authenticate, requirePermission('risks.write'), validateBody(CreateRiskRouteSchema), async (req: AuthRequest, res, next) => {
  try {
    await authorizationService.require(req.userId!, 'risks.write');
    const risk = await riskService.create(req.body, req.userId);
    res.status(201).json(risk);
  } catch (error) {
    return next(error);
  }
});

// ==========================================
// Assessment Routes (Paket 3.2)
// ==========================================

riskRouter.post('/assessments', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const assessments = await riskService.createAssessment({ ...req.body, assessorId: req.userId! });
    res.status(201).json(assessments);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/risk-controls', authenticate, authorizeEntityWrite('risks'), validateBody(CreateRiskControlSchema), async (req: AuthRequest, res, next) => {
  try {
    const link = await riskService.linkRiskControl(req.body, req.userId);
    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/risk-control-assessments', authenticate, authorizeEntityWrite('risks'), validateBody(CreateRiskControlAssessmentSchema), async (req: AuthRequest, res, next) => {
  try {
    const assessment = await riskService.assessRiskControl(req.body, req.userId);
    res.status(201).json(assessment);
  } catch (error) {
    next(error);
  }
});

// Canonical nested RiskControl workflow routes.
riskRouter.get('/:riskId/controls', authenticate, authorizeEntityRead('risks'), validateParams(RiskControlNestedParamsSchema), validateQuery(RiskControlListQuerySchema), async (req, res, next) => {
  try {
    res.json(await riskService.listRiskControls(req.params.riskId, req.query as any));
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:riskId/controls', authenticate, authorizeEntityWrite('risks'), validateParams(RiskControlNestedParamsSchema), validateBody(CreateNestedRiskControlSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await riskService.createRiskControl(req.params.riskId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/control-assessments', authenticate, authorizeEntityRead('risks'), validateParams(RiskControlNestedParamsSchema), validateQuery(RiskControlAssessmentListQuerySchema), async (req, res, next) => {
  try {
    res.json(await riskService.listControlAssessmentsForRisk(req.params.riskId, req.query as any));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/controls/:riskControlId', authenticate, authorizeEntityRead('risks'), validateParams(RiskControlNestedParamsSchema), async (req, res, next) => {
  try {
    res.json(await riskService.getRiskControl(req.params.riskId, req.params.riskControlId));
  } catch (error) {
    next(error);
  }
});

riskRouter.patch('/:riskId/controls/:riskControlId', authenticate, authorizeEntityWrite('risks'), validateParams(RiskControlNestedParamsSchema), validateBody(UpdateRiskControlSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await riskService.updateRiskControl(req.params.riskId, req.params.riskControlId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.delete('/:riskId/controls/:riskControlId', authenticate, authorizeEntityWrite('risks'), validateParams(RiskControlNestedParamsSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await riskService.removeRiskControl(req.params.riskId, req.params.riskControlId, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/controls/:riskControlId/assessments', authenticate, authorizeEntityRead('risks'), validateParams(RiskControlNestedParamsSchema), validateQuery(RiskControlAssessmentListQuerySchema), async (req, res, next) => {
  try {
    res.json(await riskService.listRiskControlAssessments(req.params.riskId, req.params.riskControlId, req.query as any));
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:riskId/controls/:riskControlId/assessments', authenticate, authorizeEntityWrite('risks'), validateParams(RiskControlNestedParamsSchema), validateBody(CreateNestedRiskControlAssessmentSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await riskService.createRiskControlAssessment(req.params.riskId, req.params.riskControlId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/controls/:riskControlId/assessments/:assessmentId', authenticate, authorizeEntityRead('risks'), validateParams(RiskControlNestedParamsSchema), async (req, res, next) => {
  try {
    res.json(await riskService.getRiskControlAssessment(req.params.riskId, req.params.riskControlId, req.params.assessmentId));
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/assessment-versions/:id/close', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await riskService.closeAssessmentVersion(req.params.id, req.userId));
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Review Task Routes (Paket 3.2)
// ==========================================

riskRouter.get('/review-tasks', authenticate, async (req, res, next) => {
  try {
    const tasks = await riskService.listReviewTasks(req.query as any);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/review-tasks', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const task = await riskService.createReviewTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Aggregation Routes (existing)
// ==========================================

riskRouter.get('/aggregated/by-org-unit', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByOrganizationUnit(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-location', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByLocation(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-asset-type', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByAssetType(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-process', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByBusinessProcess(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-scope', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByScope(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const groupBy = String(req.query.groupBy || 'orgUnit') as any;
    const result = await riskAggregationService.getUnifiedAggregation(groupBy, parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-service', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByService(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-risk-class', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByRiskClass(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-status', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByStatus(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/dashboard-summary', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskAggregationService.getDashboardSummary(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-024: Check if an event triggers an unplanned risk review
riskRouter.post('/check-unplanned-review', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await riskService.checkUnplannedReviewTrigger(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Legacy aliases for backward compatibility
riskRouter.get('/aggregate/by-org-unit', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByOrganizationUnit();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregate/by-asset-type', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByAssetType();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregate/by-business-process', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByBusinessProcess();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Parametric routes - /:id must come AFTER all static routes
// ==========================================

riskRouter.get('/:id', authenticate, requireEntityPermission('risks.read', 'risks'), async (req, res, next) => {
  try {
    const risk = await riskService.getById(req.params.id);
    res.json(risk);
  } catch (error) {
    next(error);
  }
});

riskRouter.put('/:id', authenticate, authorizeEntityWrite('risks'), validateBody(UpdateRiskRouteSchema), async (req: AuthRequest, res, next) => {
  try {
    const risk = await riskService.update(req.params.id, req.body, req.userId);
    res.json(risk);
  } catch (error) {
    next(error);
  }
});

riskRouter.delete('/:id', authenticate, authorizeEntityDelete('risks'), async (req: AuthRequest, res, next) => {
  try {
    const result = await riskService.delete(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Assessment history for a specific risk
riskRouter.get('/:id/assessments', authenticate, async (req, res, next) => {
  try {
    const assessments = await riskService.getAssessments(req.params.id);
    res.json(assessments);
  } catch (error) {
    next(error);
  }
});

// Current assessment for a specific risk
riskRouter.get('/:id/assessments/current', authenticate, async (req, res, next) => {
  try {
    const assessment = await riskService.getCurrentAssessment(req.params.id, req.query.type as any);
    if (!assessment) {
      return res.status(404).json({ error: 'No current assessment found' });
    }
    return res.json(assessment);
  } catch (error) {
    return next(error);
  }
});

// Review tasks for a specific risk
riskRouter.get('/:id/review-tasks', authenticate, async (req, res, next) => {
  try {
    const tasks = await riskService.getReviewTasks(req.params.id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Update a specific review task
riskRouter.put('/review-tasks/:taskId', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const task = await riskService.updateReviewTask(req.params.taskId, req.body, req.userId);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:id/treatment', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const plan = await riskService.createTreatmentPlan(req.params.id, req.body);
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
});


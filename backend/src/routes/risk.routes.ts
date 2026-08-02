import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { authorizeEntityWrite, authorizeEntityDelete, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { riskService } from '../services/risk.service';
import { riskAggregationService } from '../services/risk.aggregation';
import { authorizationService } from '../services/authorization.service';
import { getEntityHistory } from '../services/entityHistory.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import {
  CreateReviewTaskSchema,
  CreateRiskSchema,
  CreateRiskAssessmentSchema,
  CreateNestedRiskControlAssessmentSchema,
  CreateNestedRiskControlSchema,
  CreateRiskControlAssessmentSchema,
  CreateRiskControlSchema,
  RiskAggregationQuerySchema,
  RiskControlAssessmentListQuerySchema,
  RiskControlListQuerySchema,
  RiskControlNestedParamsSchema,
  UnplannedReviewEventSchema,
  UpdateReviewTaskSchema,
  UpdateRiskSchema,
  UpdateRiskControlSchema,
} from 'shared';



export const riskRouter = Router();

const parseAggregationFilters = (query: unknown) => RiskAggregationQuerySchema.parse(query);

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

riskRouter.post('/', authenticate, requirePermission('risks.write'), validateBody(CreateRiskSchema), async (req: AuthRequest, res, next) => {
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

riskRouter.post('/assessments', authenticate, requirePermission('risks.assess'), validateBody(CreateRiskAssessmentSchema), async (req: AuthRequest, res, next) => {
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

riskRouter.post('/risk-control-assessments', authenticate, requirePermission('risks.assess'), validateBody(CreateRiskControlAssessmentSchema), async (req: AuthRequest, res, next) => {
  try {
    const assessment = await riskService.assessRiskControl(req.body, req.userId);
    res.status(201).json(assessment);
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

riskRouter.post('/review-tasks', authenticate, authorizeEntityWrite('risks'), validateBody(CreateReviewTaskSchema), async (req: AuthRequest, res, next) => {
  try {
    const task = await riskService.createReviewTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

// Update a specific review task
riskRouter.put('/review-tasks/:taskId', authenticate, authorizeEntityWrite('risks'), validateBody(UpdateReviewTaskSchema), async (req: AuthRequest, res, next) => {
  try {
    const task = await riskService.updateReviewTask(req.params.taskId, req.body, req.userId);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Aggregation Routes (existing)
// ==========================================

riskRouter.get('/aggregated/by-org-unit', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByOrganizationUnit(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-location', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByLocation(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-asset-type', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByAssetType(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-process', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByBusinessProcess(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-scope', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByScope(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const { groupBy } = RiskAggregationQuerySchema.parse(req.query);
    const result = await riskAggregationService.getUnifiedAggregation(groupBy, parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-service', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByService(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-risk-class', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByRiskClass(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregated/by-status', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByStatus(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/dashboard-summary', authenticate, requireAdminAccess, validateQuery(RiskAggregationQuerySchema), async (req, res, next) => {
  try {
    const result = await riskAggregationService.getDashboardSummary(parseAggregationFilters(req.query));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-024: Check if an event triggers an unplanned risk review
riskRouter.post('/check-unplanned-review', authenticate, requireAdminAccess, validateBody(UnplannedReviewEventSchema), async (req: AuthRequest, res, next) => {
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

// Canonical nested RiskControl workflow routes.
riskRouter.get('/:riskId/controls', authenticate, requireEntityPermission('risks.read', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), validateQuery(RiskControlListQuerySchema), async (req, res, next) => {
  try {
    res.json(await riskService.listRiskControls(req.params.riskId, req.query as any));
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:riskId/controls', authenticate, requireEntityPermission('risks.write', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), validateBody(CreateNestedRiskControlSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await riskService.createRiskControl(req.params.riskId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/control-assessments', authenticate, requireEntityPermission('risks.read', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), validateQuery(RiskControlAssessmentListQuerySchema), async (req, res, next) => {
  try {
    res.json(await riskService.listControlAssessmentsForRisk(req.params.riskId, req.query as any));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/controls/:riskControlId', authenticate, requireEntityPermission('risks.read', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), async (req, res, next) => {
  try {
    res.json(await riskService.getRiskControl(req.params.riskId, req.params.riskControlId));
  } catch (error) {
    next(error);
  }
});

riskRouter.patch('/:riskId/controls/:riskControlId', authenticate, requireEntityPermission('risks.write', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), validateBody(UpdateRiskControlSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await riskService.updateRiskControl(req.params.riskId, req.params.riskControlId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.delete('/:riskId/controls/:riskControlId', authenticate, requireEntityPermission('risks.write', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await riskService.removeRiskControl(req.params.riskId, req.params.riskControlId, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/controls/:riskControlId/assessments', authenticate, requireEntityPermission('risks.read', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), validateQuery(RiskControlAssessmentListQuerySchema), async (req, res, next) => {
  try {
    res.json(await riskService.listRiskControlAssessments(req.params.riskId, req.params.riskControlId, req.query as any));
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:riskId/controls/:riskControlId/assessments', authenticate, requireEntityPermission('risks.assess', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), validateBody(CreateNestedRiskControlAssessmentSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await riskService.createRiskControlAssessment(req.params.riskId, req.params.riskControlId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:riskId/controls/:riskControlId/assessments/:assessmentId', authenticate, requireEntityPermission('risks.read', 'risks', 'riskId'), validateParams(RiskControlNestedParamsSchema), async (req, res, next) => {
  try {
    res.json(await riskService.getRiskControlAssessment(req.params.riskId, req.params.riskControlId, req.params.assessmentId));
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

// GET /api/v1/risks/:id/history - Get risk history
riskRouter.get('/:id/history', authenticate, requireEntityPermission('risks.read', 'risks'), async (req: AuthRequest, res, next) => {
  try {
    await riskService.getById(req.params.id);
    const history = await getEntityHistory('Risk', req.params.id, {
      action: req.query.action as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

riskRouter.put('/:id', authenticate, requireEntityPermission('risks.write', 'risks'), validateBody(UpdateRiskSchema), async (req: AuthRequest, res, next) => {
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
riskRouter.get('/:id/assessments', authenticate, requireEntityPermission('risks.read', 'risks'), async (req, res, next) => {
  try {
    const assessments = await riskService.getAssessments(req.params.id);
    res.json(assessments);
  } catch (error) {
    next(error);
  }
});

// Current assessment for a specific risk
riskRouter.get('/:id/assessments/current', authenticate, requireEntityPermission('risks.read', 'risks'), async (req, res, next) => {
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
riskRouter.get('/:id/review-tasks', authenticate, requireEntityPermission('risks.read', 'risks'), async (req, res, next) => {
  try {
    const tasks = await riskService.getReviewTasks(req.params.id);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:id/treatment', authenticate, requireEntityPermission('risks.write', 'risks'), async (req: AuthRequest, res, next) => {
  try {
    const plan = await riskService.createTreatmentPlan(req.params.id, req.body);
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
});


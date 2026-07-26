import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireMappedReadPermission, requireMappedWritePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { phase6Service, PHASE6_MODEL_MAP } from '../services/phase6.service';
import { supplierService } from '../services/supplier.service';
import { bcmService } from '../services/bcm.service';
import { correctiveActionService } from '../services/correctiveaction.service';
import { trainingService } from '../services/training.service';
import { AppError } from '../middleware/errorHandler';


export const phase6Router = Router();

const AnyBodySchema = z.record(z.any());
const SourceCapaSchema = z.object({ sourceType: z.enum(['audit', 'incident', 'risk', 'control', 'supplier']), sourceId: z.string().min(1), data: z.record(z.any()) });
const WorkflowStartSchema = z.object({ definitionId: z.string().uuid(), entityType: z.string().optional(), entityId: z.string().min(1), initialState: z.string().optional(), context: z.record(z.any()).optional() });
const WorkflowTransitionSchema = z.object({ transition: z.string().min(1), comment: z.string().optional(), assigneeId: z.string().optional() });

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

phase6Router.post('/training-assignments/:id/complete', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
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

phase6Router.post('/reports/run', authenticate, requireMappedWritePermission('auditPlans'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
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

// --- Supplier Assessment routes ---
phase6Router.get('/suppliers/:supplierId/assessments', authenticate, requireMappedReadPermission('suppliers'), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.listAssessments(req.params.supplierId, req.query)); } catch (error) { next(error); }
});
phase6Router.post('/suppliers/:supplierId/assessments', authenticate, requireMappedWritePermission('suppliers'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await supplierService.createAssessment(req.params.supplierId, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/supplier-assessments/:id', authenticate, requireMappedWritePermission('suppliers'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await supplierService.updateAssessment(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- BIA routes ---
phase6Router.get('/bias', authenticate, requireMappedReadPermission('bias'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.listBia(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/bias', authenticate, requireMappedWritePermission('bias'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createBia(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/bias/:id', authenticate, requireMappedWritePermission('bias'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.updateBia(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- BCP routes ---
phase6Router.get('/bcps', authenticate, requireMappedReadPermission('bcps'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.listBcp(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/bcps', authenticate, requireMappedWritePermission('bcps'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createBcp(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/bcps/:id', authenticate, requireMappedWritePermission('bcps'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.updateBcp(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- BCP Exercise routes ---
phase6Router.get('/bcp-exercises', authenticate, requireMappedReadPermission('bcps'), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.listExercises(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/bcp-exercises', authenticate, requireMappedWritePermission('bcps'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await bcmService.createExercise(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/bcp-exercises/:id', authenticate, requireMappedWritePermission('bcps'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await bcmService.updateExercise(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Corrective Action routes ---
phase6Router.get('/corrective-actions', authenticate, requireMappedReadPermission('correctiveActions'), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.list(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await correctiveActionService.create(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/corrective-actions/:id', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.update(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions/:id/effectiveness', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.reviewEffectiveness(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions/:id/close', authenticate, requireMappedWritePermission('correctiveActions'), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.close(req.params.id, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.post('/corrective-actions/:id/reopen', authenticate, requireMappedWritePermission('correctiveActions'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await correctiveActionService.reopen(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Course routes ---
phase6Router.get('/training-courses', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listCourses(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-courses', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createCourse(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/training-courses/:id', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.updateCourse(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Assignment routes ---
phase6Router.get('/training-assignments', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listAssignments(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-assignments', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createAssignment(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});
phase6Router.patch('/training-assignments/:id', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.updateAssignment(req.params.id, req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Completion routes ---
phase6Router.get('/training-completions', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listCompletions(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-completions', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createCompletion(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
});

// --- Training Acknowledgement routes ---
phase6Router.get('/training-acknowledgements', authenticate, requireMappedReadPermission('trainingAssignments'), async (req: AuthRequest, res, next) => {
  try { res.json(await trainingService.listAcknowledgements(req.query)); } catch (error) { next(error); }
});
phase6Router.post('/training-acknowledgements', authenticate, requireMappedWritePermission('trainingAssignments'), validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await trainingService.createAcknowledgement(req.body, req.userId ?? 'system')); } catch (error) { next(error); }
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

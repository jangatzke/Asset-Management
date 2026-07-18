import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireWritePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { phase6Service, PHASE6_MODEL_MAP } from '../services/phase6.service';
import { AppError } from '../middleware/errorHandler';

export const phase6Router = Router();

const AnyBodySchema = z.record(z.any());
const SourceCapaSchema = z.object({ sourceType: z.enum(['audit', 'incident', 'risk', 'control', 'supplier']), sourceId: z.string().min(1), data: z.record(z.any()) });
const WorkflowStartSchema = z.object({ definitionId: z.string().uuid(), entityType: z.string().optional(), entityId: z.string().min(1), initialState: z.string().optional(), context: z.record(z.any()).optional() });
const WorkflowTransitionSchema = z.object({ transition: z.string().min(1), comment: z.string().optional(), assigneeId: z.string().optional() });

function ensureResource(resource: string) {
  if (!PHASE6_MODEL_MAP[resource]) throw new AppError(`Unknown Phase 6 resource ${resource}`, 404);
}

phase6Router.get('/resources', authenticate, (_req, res) => {
  res.json({ resources: Object.keys(PHASE6_MODEL_MAP) });
});

phase6Router.post('/corrective-actions/from-source', authenticate, requireWritePermission, validateBody(SourceCapaSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.createCorrectiveActionFromSource(req.body.sourceType, req.body.sourceId, req.body.data, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/training-assignments/:id/complete', authenticate, requireWritePermission, validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.completeTrainingAssignment(req.params.id, req.body, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/workflows/start', authenticate, requireWritePermission, validateBody(WorkflowStartSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.startWorkflow(req.body.definitionId, req.body, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/workflows/:id/transition', authenticate, requireWritePermission, validateBody(WorkflowTransitionSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.transitionWorkflow(req.params.id, req.body.transition, req.body, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/reports/run', authenticate, requireWritePermission, validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await phase6Service.createReportRun(req.body, req.userId ?? 'system');
    res.status(201).json(result);
  } catch (error) { next(error); }
});

phase6Router.post('/:resource/reminders/run', authenticate, requireWritePermission, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    const result = await phase6Service.runReminders(req.params.resource, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.get('/:resource/export', authenticate, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    const result = await phase6Service.export(req.params.resource, req.query, req.userId ?? 'system');
    res.json(result);
  } catch (error) { next(error); }
});

phase6Router.get('/:resource', authenticate, async (req, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.list(req.params.resource, req.query));
  } catch (error) { next(error); }
});

phase6Router.get('/:resource/:id', authenticate, async (req, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.get(req.params.resource, req.params.id));
  } catch (error) { next(error); }
});

phase6Router.post('/:resource', authenticate, requireWritePermission, validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.status(201).json(await phase6Service.create(req.params.resource, req.body, req.userId ?? 'system'));
  } catch (error) { next(error); }
});

phase6Router.patch('/:resource/:id', authenticate, requireWritePermission, validateBody(AnyBodySchema), async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.update(req.params.resource, req.params.id, req.body, req.userId ?? 'system'));
  } catch (error) { next(error); }
});

phase6Router.delete('/:resource/:id', authenticate, requireWritePermission, async (req: AuthRequest, res, next) => {
  try {
    ensureResource(req.params.resource);
    res.json(await phase6Service.remove(req.params.resource, req.params.id, req.userId ?? 'system'));
  } catch (error) { next(error); }
});

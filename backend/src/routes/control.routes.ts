import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { controlService } from '../services/control.service';
import { authorizationService } from '../services/authorization.service';
import { getEntityHistory } from '../services/entityHistory.service';
import { validateBody, validateParams } from '../middleware/validation';
import { ApproveRiskTreatmentSchema, ControlImplementationRiskParamsSchema, ControlImplementationSchema, CreateControlSchema, CreateControlTestSchema, CreateSoASchema, UpdateControlSchema, UpdateSoAItemSchema } from 'shared';

export const controlRouter = Router();

// ==========================================
// Static routes MUST come BEFORE parametric routes (/id)
// ==========================================

controlRouter.get('/', authenticate, requirePermission('controls.read'), async (req: AuthRequest, res, next) => {
  try {
    const result = await controlService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'controls') as any, await authorizationService.buildControlImplementationReadFilter(req.userId!));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/', authenticate, authorizeEntityWrite('controls'), validateBody(CreateControlSchema), async (req: AuthRequest, res, next) => {
  try {
    const control = await controlService.create(req.body, req.userId);
    res.status(201).json(control);
  } catch (error) {
    next(error);
  }
});

// Static route /soa must be before /:id
controlRouter.get('/soa', authenticate, async (req, res, next) => {
  try {
    const soa = await controlService.getSOA(req.query.scopeId as string);
    res.json(soa);
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/soa', authenticate, authorizeEntityWrite('controls'), validateBody(CreateSoASchema), async (req: AuthRequest, res, next) => {
  try {
    const soa = await controlService.createSOA(req.body, req.userId);
    res.status(201).json(soa);
  } catch (error) {
    next(error);
  }
});

controlRouter.patch('/soa/items/:itemId', authenticate, authorizeEntityWrite('controls'), validateBody(UpdateSoAItemSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await controlService.updateSOAItem(req.params.itemId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/soa/:id/submit', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await controlService.submitSOA(req.params.id, req.userId!));
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/soa/:id/approve', authenticate, requirePermission('controls.approve'), validateBody(ApproveRiskTreatmentSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await controlService.approveSOA(req.params.id, req.userId!, req.body.decision ?? 'approved', req.body.comment));
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/implementations', authenticate, authorizeEntityWrite('controls'), validateBody(ControlImplementationSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await controlService.createImplementation(req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

controlRouter.get('/implementations/:implementationId/risks', authenticate, requireEntityPermission('controls.read', 'controls', 'implementationId'), validateParams(ControlImplementationRiskParamsSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await controlService.listImplementationRisks(req.params.implementationId, req.userId));
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/tests', authenticate, requirePermission('controls.test'), validateBody(CreateControlTestSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await controlService.createControlTest(req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Parametric routes - /:id must come AFTER all static routes
// ==========================================

controlRouter.get('/:id', authenticate, requirePermission('controls.read'), async (req: AuthRequest, res, next) => {
  try {
    const control = await controlService.getById(req.params.id, req.userId);
    res.json(control);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/controls/:id/history - Get control history
controlRouter.get('/:id/history', authenticate, requirePermission('controls.read'), async (req: AuthRequest, res, next) => {
  try {
    await controlService.getById(req.params.id, req.userId);
    const history = await getEntityHistory('Control', req.params.id, {
      action: req.query.action as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

controlRouter.put('/:id', authenticate, authorizeEntityWrite('controls'), validateBody(UpdateControlSchema), async (req: AuthRequest, res, next) => {
  try {
    const control = await controlService.update(req.params.id, req.body, req.userId);
    res.json(control);
  } catch (error) {
    next(error);
  }
});

controlRouter.delete('/:id', authenticate, authorizeEntityDelete('controls'), async (req: AuthRequest, res, next) => {
  try {
    const result = await controlService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

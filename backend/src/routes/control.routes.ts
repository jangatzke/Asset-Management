import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete } from '../middleware/entityAuth';
import { controlService } from '../services/control.service';

export const controlRouter = Router();

// ==========================================
// Static routes MUST come BEFORE parametric routes (/id)
// ==========================================

controlRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await controlService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

controlRouter.post('/', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
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

controlRouter.post('/soa', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try {
    const soa = await controlService.createSOA(req.body);
    res.status(201).json(soa);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Parametric routes - /:id must come AFTER all static routes
// ==========================================

controlRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const control = await controlService.getById(req.params.id);
    res.json(control);
  } catch (error) {
    next(error);
  }
});

controlRouter.put('/:id', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
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

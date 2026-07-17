import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { riskMethodService } from '../services/riskmethod.service';

const requireAdminAccess = authorize('system_admin');

export const riskMethodRouter = Router();

// GET /api/v1/methods - List risk methods
riskMethodRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await riskMethodService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/methods - Create risk method
riskMethodRouter.post('/', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const method = await riskMethodService.create(req.body);
    res.status(201).json(method);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/methods/:id - Get risk method by ID
riskMethodRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const method = await riskMethodService.findById(req.params.id);
    res.json(method);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/methods/:id - Update risk method
riskMethodRouter.patch('/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const method = await riskMethodService.update(req.params.id, req.body);
    res.json(method);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/methods/:id - Soft delete risk method
riskMethodRouter.delete('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskMethodService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/methods/:id/recalculate-preview - RSK-004 recalculation preview
riskMethodRouter.post('/:id/recalculate-preview', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const preview = await riskMethodService.recalculatePreview(req.params.id);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

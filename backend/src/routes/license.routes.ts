import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { licenseService } from '../services/license.service';
import { getEntityHistory } from '../services/entityHistory.service';



export const licenseRouter = Router();

// GET /api/v1/licenses - List licenses with filtering
licenseRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await licenseService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/licenses - Create license
licenseRouter.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const license = await licenseService.create(req.body, req.userId);
    res.status(201).json(license);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/licenses/:id - Get license by ID
licenseRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const license = await licenseService.findById(req.params.id);
    res.json(license);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/licenses/:id/history - Get license history
licenseRouter.get('/:id/history', authenticate, async (req, res, next) => {
  try {
    await licenseService.findById(req.params.id);
    const history = await getEntityHistory('License', req.params.id, {
      action: req.query.action as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/licenses/:id - Update license
licenseRouter.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const license = await licenseService.update(req.params.id, req.body, req.userId);
    res.json(license);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/licenses/:id - Soft delete license
licenseRouter.delete('/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await licenseService.delete(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/licenses/:id/assets - List linked assets
licenseRouter.get('/:id/assets', authenticate, async (req, res, next) => {
  try {
    const assets = await licenseService.getAssets(req.params.id);
    res.json(assets);
  } catch (error) {
    next(error);
  }
});

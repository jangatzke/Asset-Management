import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { licenseService } from '../services/license.service';

const requireAdminAccess = authorize('system_admin');

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
licenseRouter.delete('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await licenseService.delete(req.params.id);
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

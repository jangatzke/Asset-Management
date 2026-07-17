import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { riskTreatmentService } from '../services/risktreatment.service';

const requireAdminAccess = authorize('system_admin');

export const riskTreatmentRouter = Router();

// GET /api/v1/treatments - List risk treatments
riskTreatmentRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await riskTreatmentService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/treatments - Create risk treatment
riskTreatmentRouter.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const treatment = await riskTreatmentService.create(req.body, req.userId);
    res.status(201).json(treatment);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/treatments/:id - Get risk treatment by ID
riskTreatmentRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const treatment = await riskTreatmentService.findById(req.params.id);
    res.json(treatment);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/treatments/:id - Update risk treatment
riskTreatmentRouter.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const treatment = await riskTreatmentService.update(req.params.id, req.body, req.userId);
    res.json(treatment);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/treatments/:id - Soft delete risk treatment
riskTreatmentRouter.delete('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await riskTreatmentService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/treatments/:id/approve - Approve treatment plan
riskTreatmentRouter.post('/:id/approve', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const treatment = await riskTreatmentService.approve(req.params.id, req.userId!);
    res.json(treatment);
  } catch (error) {
    next(error);
  }
});

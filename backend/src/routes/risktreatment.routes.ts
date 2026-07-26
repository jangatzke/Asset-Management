import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { authorizeEntityWrite } from '../middleware/entityAuth';
import { riskTreatmentService } from '../services/risktreatment.service';



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
riskTreatmentRouter.post('/', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
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
riskTreatmentRouter.patch('/:id', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
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
    const result = await riskTreatmentService.delete(req.params.id, (req as AuthRequest).userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/treatments/:id/approve - Approve treatment plan
riskTreatmentRouter.post('/:id/approve', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const treatment = await riskTreatmentService.approve(req.params.id, req.userId!, req.body);
    res.json(treatment);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/treatments/:id/effectiveness-review - Record effectiveness review
riskTreatmentRouter.post('/:id/effectiveness-review', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const review = await riskTreatmentService.recordEffectivenessReview(req.params.id, req.body, req.userId!);
    res.status(201).json(review);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/treatments/:id/complete - Complete treatment with target/residual assessment
riskTreatmentRouter.post('/:id/complete', authenticate, authorizeEntityWrite('risks'), async (req: AuthRequest, res, next) => {
  try {
    const treatment = await riskTreatmentService.complete(req.params.id, req.body, req.userId!);
    res.json(treatment);
  } catch (error) {
    next(error);
  }
});

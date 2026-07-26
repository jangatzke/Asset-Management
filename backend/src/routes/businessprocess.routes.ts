import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { businessProcessService } from '../services/businessprocess.service';



export const businessProcessRouter = Router();

// GET /api/v1/processes - List business processes
businessProcessRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await businessProcessService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/processes - Create business process
businessProcessRouter.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const process = await businessProcessService.create(req.body, req.userId);
    res.status(201).json(process);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/processes/:id - Get business process by ID
businessProcessRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const process = await businessProcessService.findById(req.params.id);
    res.json(process);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/processes/:id - Update business process
businessProcessRouter.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const process = await businessProcessService.update(req.params.id, req.body, req.userId);
    res.json(process);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/processes/:id - Soft delete business process
businessProcessRouter.delete('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await businessProcessService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/processes/:id/risks - List linked risks
businessProcessRouter.get('/:id/risks', authenticate, async (req, res, next) => {
  try {
    const risks = await businessProcessService.getRisks(req.params.id);
    res.json(risks);
  } catch (error) {
    next(error);
  }
});

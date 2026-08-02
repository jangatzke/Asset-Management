import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { contractService } from '../services/contract.service';
import { getEntityHistory } from '../services/entityHistory.service';



export const contractRouter = Router();

// GET /api/v1/contracts - List contracts with filtering
contractRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await contractService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/contracts - Create contract
contractRouter.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const contract = await contractService.create(req.body, req.userId);
    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/contracts/:id - Get contract by ID
contractRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const contract = await contractService.findById(req.params.id);
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/contracts/:id/history - Get contract history
contractRouter.get('/:id/history', authenticate, async (req, res, next) => {
  try {
    await contractService.findById(req.params.id);
    const history = await getEntityHistory('Contract', req.params.id, {
      action: req.query.action as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/contracts/:id - Update contract
contractRouter.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const contract = await contractService.update(req.params.id, req.body, req.userId);
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/contracts/:id - Soft delete contract
contractRouter.delete('/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await contractService.delete(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/contracts/:id/assets - List linked assets
contractRouter.get('/:id/assets', authenticate, async (req, res, next) => {
  try {
    const assets = await contractService.getAssets(req.params.id);
    res.json(assets);
  } catch (error) {
    next(error);
  }
});

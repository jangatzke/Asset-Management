import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { contractService } from '../services/contract.service';

const requireAdminAccess = authorize('system_admin');

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
contractRouter.delete('/:id', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const result = await contractService.delete(req.params.id);
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

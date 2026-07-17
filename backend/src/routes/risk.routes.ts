import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { riskService } from '../services/risk.service';
import { riskAggregationService } from '../services/risk.aggregation';

const requireAdminAccess = authorize('system_admin');

export const riskRouter = Router();

riskRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await riskService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const risk = await riskService.getById(req.params.id);
    res.json(risk);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const risk = await riskService.create(req.body, req.userId);
    res.status(201).json(risk);
  } catch (error) {
    next(error);
  }
});

riskRouter.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const risk = await riskService.update(req.params.id, req.body, req.userId);
    res.json(risk);
  } catch (error) {
    next(error);
  }
});

riskRouter.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await riskService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:id/treatment', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const plan = await riskService.createTreatmentPlan(req.params.id, req.body);
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/:id/accept', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const risk = await riskService.acceptRisk(req.params.id, req.userId!);
    res.json(risk);
  } catch (error) {
    next(error);
  }
});

// RSK-011: Aggregated views - by organization unit
riskRouter.get('/aggregated/by-org-unit', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByOrganizationUnit();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-011: Aggregated views - by location/site
riskRouter.get('/aggregated/by-location', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByLocation();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-011: Aggregated views - by asset type
riskRouter.get('/aggregated/by-asset-type', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByAssetType();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-010/RSK-011: Aggregated views - by business process
riskRouter.get('/aggregated/by-process', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByBusinessProcess();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-011: Aggregated views - by ISMS scope
riskRouter.get('/aggregated/by-scope', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByScope();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// RSK-011: Risk dashboard summary
riskRouter.get('/dashboard-summary', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.getDashboardSummary();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Legacy aliases for backward compatibility
riskRouter.get('/aggregate/by-org-unit', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByOrganizationUnit();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregate/by-asset-type', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByAssetType();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

riskRouter.get('/aggregate/by-business-process', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await riskAggregationService.aggregateByBusinessProcess();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
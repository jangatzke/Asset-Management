import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { riskMethodService } from '../services/riskmethod.service';



export const riskMethodRouter = Router();

// ==========================================
// Risk Method CRUD
// ==========================================

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
    const method = await riskMethodService.create(req.body, req.userId);
    res.status(201).json(method);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Version Management
// ==========================================

// POST /api/v1/methods/:id/versions - Create new snapshot version
riskMethodRouter.post('/:id/versions', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const version = await riskMethodService.createVersion(req.params.id);
    res.status(201).json(version);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/methods/:id/versions - List all versions for a method
riskMethodRouter.get('/:id/versions', authenticate, async (req, res, next) => {
  try {
    const versions = await riskMethodService.listVersions(req.params.id);
    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/methods/versions/:versionId - Get specific version
riskMethodRouter.get('/versions/:versionId', authenticate, async (req, res, next) => {
  try {
    const version = await riskMethodService.findVersion(req.params.versionId);
    res.json(version);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Safe Calculation
// ==========================================

// POST /api/v1/methods/versions/:versionId/calculate - Calculate risk score safely
riskMethodRouter.post('/versions/:versionId/calculate', authenticate, async (req, res, next) => {
  try {
    const { likelihood, impact } = req.body;
    if (typeof likelihood !== 'number' || typeof impact !== 'number') {
      res.status(400).json({ error: 'likelihood and impact must be numbers' });
      return;
    }
    const result = await riskMethodService.calculateRiskScore(req.params.versionId, likelihood, impact);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Recalculation Preview (RSK-004)
// ==========================================

// POST /api/v1/methods/versions/:versionId/recalculate-preview - Preview recalculation
riskMethodRouter.post('/versions/:versionId/recalculate-preview', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const preview = await riskMethodService.recalculatePreview(req.params.versionId, req.body);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

// Legacy endpoint for backward compatibility
riskMethodRouter.post('/:id/recalculate-preview', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const preview = await riskMethodService.recalculatePreviewLegacy(req.params.id);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Confirmed Recalculation
// ==========================================

// POST /api/v1/methods/versions/:versionId/recalculate - Confirm recalculation for a single risk
riskMethodRouter.post('/versions/:versionId/recalculate', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const { riskId, assessorId, justification, nextReviewDate } = req.body;
    if (!riskId || !assessorId) {
      res.status(400).json({ error: 'riskId and assessorId are required' });
      return;
    }

    const assessment = await riskMethodService.confirmRecalculation(riskId, {
      riskMethodVersionId: req.params.versionId,
      assessorId,
      justification,
      nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : undefined,
    }, req.userId);

    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/methods/versions/:versionId/recalculate-bulk - Bulk recalculation
riskMethodRouter.post('/versions/:versionId/recalculate-bulk', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const { riskIds, assessorId, justification, nextReviewDate } = req.body;
    if (!Array.isArray(riskIds) || !assessorId) {
      res.status(400).json({ error: 'riskIds (array) and assessorId are required' });
      return;
    }

    const results = await riskMethodService.bulkConfirmRecalculation(riskIds, {
      riskMethodVersionId: req.params.versionId,
      assessorId,
      justification,
      nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : undefined,
    }, req.userId);

    res.json(results);
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
    const method = await riskMethodService.update(req.params.id, req.body, req.userId);
    res.json(method);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/methods/:id - Soft delete risk method
riskMethodRouter.delete('/:id', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    const result = await riskMethodService.delete(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

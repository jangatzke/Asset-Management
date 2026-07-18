import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete, authorizeEntityRead } from '../middleware/entityAuth';
import { assetService } from '../services/asset.service';
import { assetGraphService } from '../services/asset.graph';

const requireAdminAccess = authorize('system_admin');

export const assetRouter = Router();

// ==========================================
// Static routes MUST come BEFORE parametric routes (/id)
// to avoid Express matching 'types', 'graph', etc. as :id
// ==========================================

assetRouter.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await assetService.list(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

assetRouter.post('/', authenticate, authorizeEntityWrite('assets'), async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.create(req.body, req.userId);
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
});

// Static routes - must be before /:id
assetRouter.get('/types', authenticate, async (_req, res, next) => {
  try {
    const types = await assetService.getAssetTypes();
    res.json(types);
  } catch (error) {
    next(error);
  }
});

// TODO: Implement bulk import - placeholder returns 501
assetRouter.post('/import', authenticate, authorizeEntityWrite('assets'), (_req, res, _next) => {
  res.status(501).json({ error: 'Not Implemented', message: 'Asset bulk import endpoint is not yet implemented' });
});

// AST-011: Graph visualization data - full graph
assetRouter.get('/graph', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const graph = await assetGraphService.getAssetGraph();
    res.json(graph);
  } catch (error) {
    next(error);
  }
});

// AST-032: Find assets with incomplete data (missing owner, criticality, audit status)
assetRouter.get('/incomplete', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    const result = await assetService.findIncompleteAssets();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Parametric routes - /:id must come AFTER all static routes
// ==========================================

assetRouter.get('/:id', authenticate, async (req, res, next) => {
  try {
    const asset = await assetService.getById(req.params.id);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

assetRouter.put('/:id', authenticate, authorizeEntityWrite('assets'), async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.update(req.params.id, req.body, req.userId);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

assetRouter.delete('/:id', authenticate, authorizeEntityDelete('assets'), async (req: AuthRequest, res, next) => {
  try {
    const result = await assetService.delete(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

assetRouter.get('/:id/relations', authenticate, async (req, res, next) => {
  try {
    const relations = await assetService.getRelations(req.params.id);
    res.json(relations);
  } catch (error) {
    next(error);
  }
});

assetRouter.post('/:id/relations', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const relation = await assetService.createRelation(req.params.id, req.body);
    res.status(201).json(relation);
  } catch (error) {
    next(error);
  }
});

// AST-011: Graph visualization data - centered on specific asset with BFS traversal and options
assetRouter.get('/:id/graph', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : undefined;
    const direction = ['both', 'upstream', 'downstream'].includes(req.query.direction as string)
      ? req.query.direction as 'both' | 'upstream' | 'downstream'
      : 'both';
    const relationTypes = req.query.relationTypes ? (req.query.relationTypes as string).split(',') : undefined;
    const assetTypes = req.query.assetTypes ? (req.query.assetTypes as string).split(',') : undefined;

    const graph = await assetGraphService.getDependencyGraph(req.params.id, {
      maxDepth,
      direction,
      relationTypes,
      assetTypes,
    });
    res.json(graph);
  } catch (error) {
    next(error);
  }
});

// AST-012: Impact analysis - calculate blast radius along dependencies
assetRouter.get('/:id/impact-analysis', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : undefined;
    const result = await assetGraphService.analyzeImpact(req.params.id, { maxDepth });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// AST-011, AST-012: List all upstream/downstream dependencies
assetRouter.get('/:id/dependencies', authenticate, async (req, res, next) => {
  try {
    const deps = await assetGraphService.getDependencies(req.params.id);
    res.json(deps);
  } catch (error) {
    next(error);
  }
});

// AST-012: Downstream dependencies (what would be affected if this asset fails)
assetRouter.get('/:id/downstream', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const deps = await assetGraphService.getDownstreamDependencies(req.params.id);
    res.json(deps);
  } catch (error) {
    next(error);
  }
});

// AST-012: Upstream dependencies (what could cause this asset to fail)
assetRouter.get('/:id/upstream', authenticate, requireAdminAccess, async (req, res, next) => {
  try {
    const deps = await assetGraphService.getUpstreamDependencies(req.params.id);
    res.json(deps);
  } catch (error) {
    next(error);
  }
});

// AST-030: List lifecycle logs for an asset
assetRouter.get('/:id/lifecycle-logs', authenticate, async (req, res, next) => {
  try {
    const logs = await assetService.getLifecycleLogs(req.params.id);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// AST-033: Confirm responsibility for an asset
assetRouter.post('/:id/confirm-responsibility', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;
    const result = await assetService.confirmResponsibility(req.params.id, req.userId!, role);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

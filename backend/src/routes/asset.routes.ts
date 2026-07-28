import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { authorizeEntityWrite, authorizeEntityDelete, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { assetService } from '../services/asset.service';
import { assetGraphService } from '../services/asset.graph';
import { authorizationService } from '../services/authorization.service';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { ArchiveAssetSchema, AssetQuerySchema, AssetRelationCreateSchema, ConfirmAssetResponsibilitySchema, CreateAssetSchema, DisposalProofSchema, IdParamSchema, LifecycleTransitionSchema, UpdateAssetSchema, CreateAssetSubtypeSchema } from 'shared';



export const assetRouter = Router();

// ==========================================
// Static routes MUST come BEFORE parametric routes (/id)
// to avoid Express matching 'types', 'graph', etc. as :id
// ==========================================

assetRouter.get('/', authenticate, requirePermission('assets.read'), validateQuery(AssetQuerySchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await assetService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'assets') as any);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

assetRouter.post('/', authenticate, authorizeEntityWrite('assets'), validateBody(CreateAssetSchema), async (req: AuthRequest, res, next) => {
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

assetRouter.post('/types/:typeId/subtypes', authenticate, requireAdminAccess, validateBody(CreateAssetSubtypeSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await assetService.createAssetSubtype(req.params.typeId, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

assetRouter.get('/inventory/preview', authenticate, async (req, res, next) => {
  try {
    res.json(await assetService.generateInventoryPreview(String(req.query.assetTypeId), req.query.assetSubtypeId ? String(req.query.assetSubtypeId) : undefined));
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

assetRouter.get('/:id', authenticate, requireEntityPermission('assets.read', 'assets'), validateParams(IdParamSchema), async (req, res, next) => {
  try {
    const asset = await assetService.getById(req.params.id);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

assetRouter.put('/:id', authenticate, authorizeEntityWrite('assets'), validateParams(IdParamSchema), validateBody(UpdateAssetSchema), async (req: AuthRequest, res, next) => {
  try {
    const asset = await assetService.update(req.params.id, req.body, req.userId);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

// Delete delegates to archive (soft-delete)
assetRouter.delete('/:id', authenticate, authorizeEntityDelete('assets'), validateParams(IdParamSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await assetService.delete(req.params.id, req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Archive / Restore — Admin only endpoints
// ==========================================

// Archive an asset (soft-delete with lifecycle change to decommissioned)
assetRouter.post('/:id/archive', authenticate, requireEntityPermission('assets.archive', 'assets'), validateParams(IdParamSchema), validateBody(ArchiveAssetSchema), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    const result = await assetService.archive(req.params.id, req.userId, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Restore an archived asset (un-archive with lifecycle reset to planned)
assetRouter.post('/:id/restore', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(ArchiveAssetSchema), async (req: AuthRequest, res, next) => {
  try {
    const { reason } = req.body;
    const result = await assetService.restore(req.params.id, req.userId, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Lifecycle Transition — AST-030
// ==========================================

// Transition lifecycle status with validation of allowed transitions
assetRouter.post('/:id/lifecycle-transition', authenticate, authorizeEntityWrite('assets'), validateParams(IdParamSchema), validateBody(LifecycleTransitionSchema), async (req: AuthRequest, res, next) => {
  try {
    const { newStatus, reason } = req.body;
    const asset = await assetService.transitionLifecycle(req.params.id, newStatus, req.userId, reason);
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Disposal Proof — AST-031
// ==========================================

// Record disposal proof for an asset
assetRouter.post('/:id/disposal-proof', authenticate, authorizeEntityWrite('assets'), validateParams(IdParamSchema), validateBody(DisposalProofSchema), async (req: AuthRequest, res, next) => {
  try {
    const { disposalDate, disposalMethod, disposalResponsible } = req.body;
    const asset = await assetService.setDisposalProof(
      req.params.id,
      new Date(disposalDate),
      disposalMethod,
      disposalResponsible,
      req.userId,
    );
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Relations
// ==========================================

assetRouter.get('/:id/relations', authenticate, requireEntityPermission('assets.read', 'assets'), async (req, res, next) => {
  try {
    const relations = await assetService.getRelations(req.params.id);
    res.json(relations);
  } catch (error) {
    next(error);
  }
});

assetRouter.post('/:id/relations', authenticate, requireEntityPermission('assets.write', 'assets'), validateBody(AssetRelationCreateSchema), async (req: AuthRequest, res, next) => {
  try {
    const relation = await assetService.createRelation(req.params.id, req.body);
    res.status(201).json(relation);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Graph & Impact Analysis — AST-011, AST-012
// ==========================================

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
assetRouter.get('/:id/dependencies', authenticate, requireEntityPermission('assets.read', 'assets'), async (req, res, next) => {
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

// ==========================================
// Lifecycle Logs — AST-030
// ==========================================

assetRouter.get('/:id/lifecycle-logs', authenticate, requireEntityPermission('assets.read', 'assets'), async (req, res, next) => {
  try {
    const logs = await assetService.getLifecycleLogs(req.params.id);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Responsibility Confirmation — AST-033
// ==========================================

assetRouter.post('/:id/confirm-responsibility', authenticate, requireEntityPermission('assets.write', 'assets'), validateBody(ConfirmAssetResponsibilitySchema), async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;
    const result = await assetService.confirmResponsibility(req.params.id, req.userId!, role);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

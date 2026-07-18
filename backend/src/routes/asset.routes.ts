import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete } from '../middleware/entityAuth';
import { assetService } from '../services/asset.service';
import { assetGraphService } from '../services/asset.graph';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';

const IdParamSchema = z.object({ id: z.string().uuid('Invalid UUID format') });
const RatingLevelSchema = z.enum(['low', 'medium', 'high']);
const CriticalitySchema = z.enum(['low', 'medium', 'high', 'critical']);
const CIANeedSchema = z.enum(['low', 'medium', 'high']);
const NetworkAddressCreateSchema = z.object({
  address: z.string().min(1),
  type: z.enum(['ipv4', 'ipv6', 'cidr', 'hostname']).default('ipv4'),
  primary: z.boolean().default(false),
});
const CreateAssetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  assetTypeId: z.string().uuid(),
  subType: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  model: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  externalId: z.string().max(100).optional(),
  organizationUnitId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  technicalOperatorId: z.string().uuid().optional(),
  businessOwnerId: z.string().uuid().optional(),
  informationSecurityResponsibleId: z.string().uuid().optional(),
  processIds: z.array(z.string().uuid()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  contractIds: z.array(z.string().uuid()).optional(),
  licenseIds: z.array(z.string().uuid()).optional(),
  licenseInfo: z.string().max(500).optional(),
  contractEndsAt: z.coerce.date().optional(),
  licenseExpiresAt: z.coerce.date().optional(),
  personnelSafetyRelevance: RatingLevelSchema.default('low'),
  regulatoryRelevance: RatingLevelSchema.default('low'),
  financialDamagePotential: RatingLevelSchema.default('low'),
  productionDowntimeImpact: RatingLevelSchema.default('low'),
  lifecycleStatus: z.enum(['planned', 'ordered', 'in_stock', 'active', 'maintenance', 'isolated', 'decommissioned', 'disposed', 'destroyed', 'lost', 'unknown']).default('planned'),
  purchaseDate: z.coerce.date().optional(),
  commissioningDate: z.coerce.date().optional(),
  endOfSaleDate: z.coerce.date().optional(),
  endOfLifeDate: z.coerce.date().optional(),
  endOfSupportDate: z.coerce.date().optional(),
  confidentialityNeed: CIANeedSchema.default('low'),
  integrityNeed: CIANeedSchema.default('low'),
  availabilityNeed: CIANeedSchema.default('low'),
  dataProtectionRelevance: z.boolean().default(false),
  criticality: CriticalitySchema.default('low'),
  complianceRelevance: z.boolean().default(false),
  networkAddresses: z.array(NetworkAddressCreateSchema).optional(),
  dataSource: z.string().max(100).optional(),
  lastDetectedAt: z.coerce.date().optional(),
});
const UpdateAssetSchema = CreateAssetSchema.partial();
const ArchiveAssetSchema = z.object({ reason: z.string().max(500).optional() });
const LifecycleTransitionSchema = z.object({
  newStatus: z.enum(['planned', 'ordered', 'in_stock', 'active', 'maintenance', 'isolated', 'decommissioned', 'disposed', 'destroyed', 'lost', 'unknown']),
  reason: z.string().max(500).optional(),
});
const DisposalProofSchema = z.object({
  disposalDate: z.coerce.date(),
  disposalMethod: z.string().min(1).max(200),
  disposalResponsible: z.string().min(1).max(200),
});
const AssetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  assetTypeId: z.string().uuid().optional(),
  lifecycleStatus: z.string().optional(),
  criticality: CriticalitySchema.optional(),
  organizationUnitId: z.string().uuid().optional(),
  archived: z.coerce.boolean().default(false),
});

const requireAdminAccess = authorize('system_admin');

export const assetRouter = Router();

// ==========================================
// Static routes MUST come BEFORE parametric routes (/id)
// to avoid Express matching 'types', 'graph', etc. as :id
// ==========================================

assetRouter.get('/', authenticate, validateQuery(AssetQuerySchema), async (req, res, next) => {
  try {
    const result = await assetService.list(req.query);
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

assetRouter.get('/:id', authenticate, validateParams(IdParamSchema), async (req, res, next) => {
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
assetRouter.post('/:id/archive', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(ArchiveAssetSchema), async (req: AuthRequest, res, next) => {
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

// ==========================================
// Lifecycle Logs — AST-030
// ==========================================

assetRouter.get('/:id/lifecycle-logs', authenticate, async (req, res, next) => {
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

assetRouter.post('/:id/confirm-responsibility', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;
    const result = await assetService.confirmResponsibility(req.params.id, req.userId!, role);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

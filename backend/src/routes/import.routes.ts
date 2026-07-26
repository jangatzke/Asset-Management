import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { importService } from '../services/import.service';


const IdParamSchema = z.object({ id: z.string().uuid() });
const SourceSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  config: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});
const UpdateSourceSchema = SourceSchema.partial();
const NetworkAddressSchema = z.object({
  address: z.string().min(1),
  type: z.string().default('ipv4'),
  primary: z.boolean().default(false),
});
const ImportRecordSchema = z.object({
  sourceRecordId: z.string().min(1).max(300),
  data: z.record(z.unknown()).and(z.object({ networkAddresses: z.array(NetworkAddressSchema).optional() })),
});
const ExecuteImportSchema = z.object({
  dryRun: z.boolean().default(false),
  records: z.array(ImportRecordSchema).min(1),
  staleStrategy: z.enum(['none', 'mark']).default('none'),
});
const RunsQuerySchema = z.object({ integrationSourceId: z.string().uuid().optional() });
const LockFieldSchema = z.object({ fieldName: z.string().min(1).max(100), reason: z.string().max(500).optional() });
const PrioritySchema = z.object({ fieldName: z.string().min(1).max(100), priority: z.number().int().min(1).max(1000) });
const ResolveConflictSchema = z.object({ resolution: z.string().min(1).max(1000) });

export const importRouter = Router();

importRouter.get('/sources', authenticate, requireAdminAccess, async (_req, res, next) => {
  try {
    res.json(await importService.listSources());
  } catch (error) {
    next(error);
  }
});

importRouter.post('/sources', authenticate, requireAdminAccess, validateBody(SourceSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await importService.createSource(req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

importRouter.put('/sources/:id', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(UpdateSourceSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await importService.updateSource(req.params.id, req.body, req.userId));
  } catch (error) {
    next(error);
  }
});

importRouter.post('/sources/:id/runs', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(ExecuteImportSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await importService.execute({ integrationSourceId: req.params.id, ...req.body }, req.userId));
  } catch (error) {
    next(error);
  }
});

importRouter.get('/runs', authenticate, requireAdminAccess, validateQuery(RunsQuerySchema), async (req, res, next) => {
  try {
    res.json(await importService.listRuns(req.query.integrationSourceId as string | undefined));
  } catch (error) {
    next(error);
  }
});

importRouter.get('/runs/:id', authenticate, requireAdminAccess, validateParams(IdParamSchema), async (req, res, next) => {
  try {
    res.json(await importService.getRun(req.params.id));
  } catch (error) {
    next(error);
  }
});

importRouter.post('/assets/:id/locks', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(LockFieldSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await importService.lockField(req.params.id, req.body.fieldName, req.userId ?? 'system', req.body.reason));
  } catch (error) {
    next(error);
  }
});

importRouter.delete('/assets/:id/locks/:fieldName', authenticate, requireAdminAccess, async (req: AuthRequest, res, next) => {
  try {
    res.json(await importService.unlockField(req.params.id, req.params.fieldName, req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

importRouter.put('/sources/:id/priorities', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(PrioritySchema), async (req, res, next) => {
  try {
    res.json(await importService.setSourcePriority(req.params.id, req.body.fieldName, req.body.priority));
  } catch (error) {
    next(error);
  }
});

importRouter.post('/conflicts/:id/resolve', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(ResolveConflictSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await importService.resolveConflict(req.params.id, req.body.resolution, req.userId ?? 'system'));
  } catch (error) {
    next(error);
  }
});

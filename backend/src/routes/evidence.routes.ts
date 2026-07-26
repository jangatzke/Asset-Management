import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { authorizeEntityWrite, authorizeEntityDelete } from '../middleware/entityAuth';
import { evidenceService } from '../services/evidence.service';

export const evidenceRouter = Router();

evidenceRouter.get('/', authenticate, async (_req, res, next) => {
  try { res.json(await evidenceService.list()); } catch (error) { next(error); }
});

evidenceRouter.post('/', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await evidenceService.create(req.body, req.userId)); } catch (error) { next(error); }
});

evidenceRouter.post('/audit-package', authenticate, async (req: AuthRequest, res, next) => {
  try { res.json(await evidenceService.exportAuditPackage(req.body ?? {}, req.userId)); } catch (error) { next(error); }
});

evidenceRouter.delete('/:id', authenticate, authorizeEntityDelete('controls'), async (req: AuthRequest, res, next) => {
  try { res.json(await evidenceService.delete(req.params.id, req.userId)); } catch (error) { next(error); }
});

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite } from '../middleware/entityAuth';
import { frameworkService } from '../services/framework.service';

export const frameworkRouter = Router();

frameworkRouter.get('/', authenticate, async (_req, res, next) => {
  try { res.json(await frameworkService.list()); } catch (error) { next(error); }
});

frameworkRouter.post('/import', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await frameworkService.importFramework(req.body, req.userId)); } catch (error) { next(error); }
});

frameworkRouter.get('/versions/:id', authenticate, async (req, res, next) => {
  try { res.json(await frameworkService.getVersion(req.params.id)); } catch (error) { next(error); }
});

frameworkRouter.post('/versions/compare', authenticate, async (req, res, next) => {
  try { res.json(await frameworkService.compareVersions(req.body.fromVersionId, req.body.toVersionId)); } catch (error) { next(error); }
});

frameworkRouter.post('/controls/:controlId/requirements', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try { res.json(await frameworkService.mapControlToRequirements(req.params.controlId, req.body.requirementIds ?? [], req.body.mappingType, req.userId)); } catch (error) { next(error); }
});

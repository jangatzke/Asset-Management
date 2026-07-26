import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite } from '../middleware/entityAuth';
import { documentControlService } from '../services/document.service';

export const documentRouter = Router();

documentRouter.post('/', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await documentControlService.create(req.body, req.userId)); } catch (error) { next(error); }
});

documentRouter.patch('/versions/:versionId', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try { res.json(await documentControlService.updateVersion(req.params.versionId, req.body, req.userId)); } catch (error) { next(error); }
});

documentRouter.post('/:id/transition', authenticate, authorizeEntityWrite('controls'), async (req: AuthRequest, res, next) => {
  try { res.json(await documentControlService.transition(req.params.id, req.body.status, req.userId!, req.body.comment)); } catch (error) { next(error); }
});

documentRouter.post('/:id/acknowledge', authenticate, async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await documentControlService.acknowledge(req.params.id, req.userId!, req.body.versionId, req.body.comment)); } catch (error) { next(error); }
});

documentRouter.post('/:id/reviews', authenticate, authorizeEntityWrite('controls'), async (req, res, next) => {
  try { res.status(201).json(await documentControlService.scheduleReview(req.params.id, req.body.reviewerId, new Date(req.body.dueDate))); } catch (error) { next(error); }
});

documentRouter.post('/reviews/:reviewId/complete', authenticate, async (req: AuthRequest, res, next) => {
  try { res.json(await documentControlService.completeReview(req.params.reviewId, req.userId!, req.body.result)); } catch (error) { next(error); }
});

documentRouter.post('/reviews/escalate-overdue', authenticate, authorizeEntityWrite('controls'), async (_req, res, next) => {
  try { res.json(await documentControlService.escalateOverdueReviews()); } catch (error) { next(error); }
});

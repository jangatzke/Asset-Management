import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, authorizeEntityDelete, requirePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { knowledgeService } from '../services/knowledge.service';
import { CreateKnowledgeArticleSchema, UpdateKnowledgeArticleSchema } from 'shared';

export const knowledgeRouter = Router();

knowledgeRouter.get('/', authenticate, requirePermission('documents.read'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await knowledgeService.list(req.query as any));
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.post('/', authenticate, authorizeEntityWrite('documents'), validateBody(CreateKnowledgeArticleSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await knowledgeService.create(req.body, req.userId!));
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.get('/:id', authenticate, requirePermission('documents.read'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await knowledgeService.getForReader(req.params.id!, req.userId!));
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.patch('/:id', authenticate, authorizeEntityWrite('documents'), validateBody(UpdateKnowledgeArticleSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await knowledgeService.update(req.params.id!, req.body, req.userId!));
  } catch (error) {
    next(error);
  }
});

knowledgeRouter.delete('/:id', authenticate, authorizeEntityDelete('documents'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await knowledgeService.remove(req.params.id!, req.userId!));
  } catch (error) {
    next(error);
  }
});

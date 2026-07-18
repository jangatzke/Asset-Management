import { Router } from 'express';
import { authenticate } from '../middleware/auth';

export const orgRouter = Router();

orgRouter.get('/units', authenticate, (_req, res, _next) => {
  // TODO: Implement organization units listing
  res.status(501).json({ error: 'Not Implemented', message: 'List org units endpoint is not yet implemented' });
});

orgRouter.post('/units', authenticate, (_req, res, _next) => {
  // TODO: Implement create organization unit
  res.status(501).json({ error: 'Not Implemented', message: 'Create org unit endpoint is not yet implemented' });
});

orgRouter.get('/scopes', authenticate, (_req, res, _next) => {
  // TODO: Implement ISMS scopes listing
  res.status(501).json({ error: 'Not Implemented', message: 'List scopes endpoint is not yet implemented' });
});

orgRouter.post('/scopes', authenticate, (_req, res, _next) => {
  // TODO: Implement create ISMS scope
  res.status(501).json({ error: 'Not Implemented', message: 'Create scope endpoint is not yet implemented' });
});

orgRouter.get('/parties', authenticate, (_req, res, _next) => {
  // TODO: Implement interested parties listing
  res.status(501).json({ error: 'Not Implemented', message: 'List interested parties endpoint is not yet implemented' });
});

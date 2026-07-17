import { Router } from 'express';
import { authenticate } from '../middleware/auth';

export const orgRouter = Router();

orgRouter.get('/units', authenticate, (_req, res, _next) => { res.json({ message: 'List org units' }); });
orgRouter.post('/units', authenticate, (_req, res, _next) => { res.json({ message: 'Create org unit' }); });
orgRouter.get('/scopes', authenticate, (_req, res, _next) => { res.json({ message: 'List scopes' }); });
orgRouter.post('/scopes', authenticate, (_req, res, _next) => { res.json({ message: 'Create scope' }); });
orgRouter.get('/parties', authenticate, (_req, res, _next) => { res.json({ message: 'List interested parties' }); });
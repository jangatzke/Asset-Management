import { Router } from 'express';
import { authenticate } from '../middleware/auth';

export const auditLogRouter = Router();

auditLogRouter.get('/', authenticate, (_req, res, _next) => { res.json({ message: 'List audit logs' }); });
auditLogRouter.get('/:id', authenticate, (_req, res, _next) => { res.json({ message: 'Get audit log entry' }); });
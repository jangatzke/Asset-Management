import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

export const orgRouter = Router();

orgRouter.get('/units', authenticate, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limitParam = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const take = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 50);
    const units = await prisma.organizationUnit.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      take,
      select: { id: true, name: true },
    });
    res.json({ data: units.map((unit) => ({ id: unit.id, label: unit.name, name: unit.name })) });
  } catch (error) {
    next(error);
  }
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

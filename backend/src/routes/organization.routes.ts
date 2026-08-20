import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

export const orgRouter = Router();

/**
 * GET /organization/units
 * Picker/search endpoint for selecting organization units in forms.
 * Returns non-archived units by default. Supports optional ?q=search query
 * and ?limit=N (default 20, max 50).
 */
orgRouter.get('/units', authenticate, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limitParam = Number.parseInt(String(req.query.limit ?? '20'), 10);
    const take = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1), 50);
    const units = await prisma.organizationUnit.findMany({
      where: q
        ? { isArchived: false, name: { contains: q, mode: 'insensitive' } }
        : { isArchived: false },
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

orgRouter.get('/scopes', authenticate, async (_req, res, next) => {
  try {
    const scopes = await prisma.ismsScope.findMany({
      where: { isArchived: false, approvalStatus: 'approved' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, version: true, nextReviewDate: true },
    });
    res.json({ data: scopes });
  } catch (error) {
    next(error);
  }
});

orgRouter.post('/scopes', authenticate, (_req, res, _next) => {
  // TODO: Implement create ISMS scope
  res.status(501).json({ error: 'Not Implemented', message: 'Create scope endpoint is not yet implemented' });
});

orgRouter.get('/parties', authenticate, (_req, res, _next) => {
  // TODO: Implement interested parties listing
  res.status(501).json({ error: 'Not Implemented', message: 'List interested parties endpoint is not yet implemented' });
});

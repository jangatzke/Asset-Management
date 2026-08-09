import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ACTION_CENTER_SOURCE_TYPES, actionCenterService, type ActionCenterQuery } from '../services/actionCenter.service';

export const actionCenterRouter = Router();
const scopes = new Set(['mine', 'authorized', 'all']);
const urgencies = new Set(['overdue', 'critical', 'upcoming', 'planned']);

actionCenterRouter.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    if (q.scope && !scopes.has(q.scope)) throw new AppError('scope must be mine, authorized, or all', 400);
    if (q.sourceType && !ACTION_CENTER_SOURCE_TYPES.includes(q.sourceType as any)) throw new AppError('Unknown sourceType', 400);
    if (q.urgency && !urgencies.has(q.urgency)) throw new AppError('Unknown urgency', 400);
    if (q.dueBefore && Number.isNaN(Date.parse(q.dueBefore))) throw new AppError('dueBefore must be an ISO date', 400);
    const page = q.page ? Number(q.page) : undefined;
    const limit = q.limit ? Number(q.limit) : undefined;
    if ((page && (!Number.isInteger(page) || page < 1)) || (limit && (!Number.isInteger(limit) || limit < 1 || limit > 100))) throw new AppError('Invalid pagination', 400);
    res.json(await actionCenterService.list(req.userId!, { scope: q.scope as ActionCenterQuery['scope'], sourceType: q.sourceType as ActionCenterQuery['sourceType'], urgency: q.urgency as ActionCenterQuery['urgency'], status: q.status, dueBefore: q.dueBefore, page, limit }));
  } catch (error) { next(error); }
});

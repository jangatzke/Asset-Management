import { NextFunction, Response, Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/audit.service';
import { prisma } from '../config/database';

export const auditLogRouter = Router();

// All audit log routes require system_admin role
const adminGuard = [authenticate, authorize('system_admin')];

/**
 * GET /audit-log
 * List audit log entries with filtering and pagination.
 * Query params: userId, entityType, action, from, to, page, pageSize
 */
auditLogRouter.get('/', adminGuard, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, entityType, action, from, to, page = '1', pageSize = '50' } = req.query;

    const filters: any = {};
    if (userId && typeof userId === 'string') filters.userId = userId;
    if (entityType && typeof entityType === 'string') filters.entityType = entityType;
    if (action && typeof action === 'string') filters.action = action;
    if (from) filters.from = new Date(from as string);
    if (to) filters.to = new Date(to as string);

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const pageSizeNum = Math.min(Math.max(1, parseInt(pageSize as string, 10)), 500);

    const result = await auditService.queryAuditLog(prisma, filters, pageNum, pageSizeNum);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /audit-log/:id
 * Get a single audit log entry by ID.
 */
auditLogRouter.get('/:id', adminGuard, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.auditLog.findUnique({
      where: { id: _req.params.id },
    });

    if (!entry) {
      res.status(404).json({ error: 'Audit log entry not found' });
      return;
    }

    res.json(entry);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /audit-log/export?format=json|csv
 * Export audit log entries as JSON or CSV.
 */
auditLogRouter.get('/export', adminGuard, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId, entityType, action, from, to } = req.query;
    const format = (req.query.format as string) ?? 'json';

    const filters: any = {};
    if (userId && typeof userId === 'string') filters.userId = userId;
    if (entityType && typeof entityType === 'string') filters.entityType = entityType;
    if (action && typeof action === 'string') filters.action = action;
    if (from) filters.from = new Date(from as string);
    if (to) filters.to = new Date(to as string);

    if (format === 'csv') {
      const csvContent = await auditService.exportAuditLogAsCSV(prisma, filters);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
      res.send(csvContent);
      return;
    }

    // Default: JSON export
    const entries = await auditService.exportAuditLog(prisma, filters);
    res.json(entries);
  } catch (error) {
    next(error);
  }
});

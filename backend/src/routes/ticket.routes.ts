import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, requireAdminAccess, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { validateBody, validateParams } from '../middleware/validation';
import { authorizationService } from '../services/authorization.service';
import { ticketService } from '../services/ticket.service';
import { auditService } from '../services/audit.service';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import { setPaginationHeader } from '../utils/pagination';
import { idempotency } from '../middleware/idempotency';
import {
  AssignTicketSchema, BulkArchiveIdsSchema, BulkTransitionTicketsSchema, ChangeTicketStatusSchema,
  IdParamSchema, RestoreEntitySchema,
  ChangeTicketTypeSchema, CloseTicketSchema, ConvertTicketSchema,
  CreateTicketCommentSchema, CreateTicketLinkSchema, CreateTicketSchema, CreateServiceCatalogItemSchema,
  EscalateTicketSchema, LinkChangeRiskSchema, RequesterCommentSchema, TicketAssetIdsSchema,
  UpdateChangeExtensionSchema, UpdateProblemExtensionSchema, UpdateServiceCatalogItemSchema, UpdateTicketSchema,
  getAllowedTicketTransitions, type TicketType,
} from 'shared';

export const ticketRouter = Router();

const handle = (fn: (req: AuthRequest, res: any) => Promise<void>) => async (req: AuthRequest, res: any, next: any) => {
  try { await fn(req, res); } catch (error) { next(error); }
};

ticketRouter.get('/types', authenticate, requirePermission('tickets.read'), handle(async (_req, res) => { res.json(await ticketService.listTypes()); }));
// Service catalog (ITIL request fulfillment). Read is available to any ticket reader;
// management requires the dedicated serviceCatalog.manage permission.
ticketRouter.get('/service-catalog', authenticate, requirePermission('serviceCatalog.read'), handle(async (_req, res) => { res.json(await ticketService.listCatalog()); }));
ticketRouter.get('/service-catalog/all', authenticate, requirePermission('serviceCatalog.manage'), handle(async (_req, res) => { res.json(await ticketService.listCatalog(true)); }));
ticketRouter.post('/service-catalog', authenticate, requirePermission('serviceCatalog.manage'), validateBody(CreateServiceCatalogItemSchema), handle(async (req, res) => { res.status(201).json(await ticketService.createCatalogItem(req.body, req.userId!)); }));
ticketRouter.put('/service-catalog/:id', authenticate, requirePermission('serviceCatalog.manage'), validateBody(UpdateServiceCatalogItemSchema), handle(async (req, res) => { res.json(await ticketService.updateCatalogItem(req.params.id, req.body, req.userId!)); }));
ticketRouter.delete('/service-catalog/:id', authenticate, requirePermission('serviceCatalog.manage'), handle(async (req, res) => { res.json(await ticketService.deleteCatalogItem(req.params.id, req.userId!)); }));
ticketRouter.get('/', authenticate, requirePermission('tickets.read'), handle(async (req, res) => {
  const result = await ticketService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'tickets') as any, req.userId!);
  setPaginationHeader(res, result);
  res.json(result);
}));
ticketRouter.get('/workload', authenticate, requirePermission('tickets.read'), handle(async (req, res) => { res.json(await ticketService.workload(req.query, await authorizationService.buildReadFilter(req.userId!, 'tickets') as any)); }));
ticketRouter.post('/', authenticate, authorizeEntityWrite('tickets'), idempotency(), validateBody(CreateTicketSchema), handle(async (req, res) => { res.status(201).json(await ticketService.create(req.body, req.userId!)); }));

// Bulk archive (soft-delete) — Phase 2.1 / D4. Mirrors the Assets bulk archive
// pattern (asset.routes.ts). Per-item authorization + per-item archive so a
// single failure never aborts the other ids. Placed before the parametric
// /:id routes so the static path is matched first.
ticketRouter.post('/bulk-archive', authenticate, requirePermission('tickets.write'), idempotency(), validateBody(BulkArchiveIdsSchema), handle(async (req, res) => {
  const { ids } = req.body as { ids: string[] };
  const succeeded: Array<{ id: string; status: number }> = [];
  const failed: Array<{ id: string; error: string; status: number }> = [];

  for (const id of ids) {
    try {
      // Mirror the single write guard: entity-scoped tickets.write permission.
      await authorizationService.requireForEntity(req.userId!, 'tickets.write', 'tickets', id);
      const ticket = await (prisma as any).ticket.findUnique({ where: { id }, select: { id: true, displayId: true, isArchived: true } });
      if (!ticket || ticket.isArchived) throw new AppError('Ticket not found', 404);
      await (prisma as any).ticket.update({ where: { id }, data: { isArchived: true, updatedBy: req.userId! } });
      await auditService.logEventStandalone(prisma, {
        userId: req.userId!,
        action: 'TICKET_UPDATE',
        entityType: 'Ticket',
        entityId: id,
        details: `Archived ${ticket.displayId}`,
      });
      succeeded.push({ id, status: 200 });
    } catch (error: any) {
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      failed.push({ id, error: error?.message ?? 'Archive failed', status });
    }
  }

  res.status(200).json({
    succeeded,
    failed,
    total: ids.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
  });
}));

// Bulk ticket status transition — Phase 2.1 / D4. The shared state machine
// (ticketTransitions.ts) is the single source of truth: the whole request is
// rejected with 400 when ANY id cannot legally move to `toStatus`.
ticketRouter.post('/bulk-transition', authenticate, requirePermission('tickets.write'), idempotency(), validateBody(BulkTransitionTicketsSchema), handle(async (req, res) => {
  const { ids, toStatus, justification } = req.body as { ids: string[]; toStatus: string; justification?: string };
  const tickets = await (prisma as any).ticket.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, status: true, isArchived: true },
  });
  const byId = new Map<string, { type: TicketType; status: string; isArchived: boolean }>(
    tickets.map((t: any) => [t.id, { type: t.type as TicketType, status: t.status as string, isArchived: Boolean(t.isArchived) }]),
  );

  // Whole-request validation: unknown id, archived ticket, or a transition that
  // does not exist in the shared matrix → reject with 400 before any write.
  const invalid: Array<{ id: string; reason: string }> = [];
  for (const id of ids) {
    const ticket = byId.get(id);
    if (!ticket) { invalid.push({ id, reason: 'Ticket not found' }); continue; }
    if (ticket.isArchived) { invalid.push({ id, reason: 'Ticket is archived' }); continue; }
    if (!getAllowedTicketTransitions(ticket.type, ticket.status).includes(toStatus)) {
      invalid.push({ id, reason: `Transition from ${ticket.status} to ${toStatus} is not allowed` });
    }
  }
  if (invalid.length > 0) {
    throw new AppError(
      `Bulk transition rejected: ${invalid.map((entry) => `${entry.id}: ${entry.reason}`).join('; ')}`,
      400,
    );
  }

  const succeeded: Array<{ id: string; status: number }> = [];
  const failed: Array<{ id: string; error: string; status: number }> = [];

  for (const id of ids) {
    try {
      await authorizationService.requireForEntity(req.userId!, 'tickets.write', 'tickets', id);
      await ticketService.changeStatus(id, toStatus, justification, req.userId!);
      succeeded.push({ id, status: 200 });
    } catch (error: any) {
      const status = typeof error?.statusCode === 'number' ? error.statusCode : 500;
      failed.push({ id, error: error?.message ?? 'Transition failed', status });
    }
  }

  res.status(200).json({
    succeeded,
    failed,
    total: ids.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
  });
}));

ticketRouter.get('/:id', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.getById(req.params.id)); }));
ticketRouter.put('/:id', authenticate, requireEntityPermission('tickets.write', 'tickets'), idempotency(), validateBody(UpdateTicketSchema), handle(async (req, res) => { res.json(await ticketService.update(req.params.id, req.body, req.userId!)); }));
ticketRouter.post('/:id/type', authenticate, requireEntityPermission('tickets.write', 'tickets'), idempotency({ includeRouteParams: true }), validateBody(ChangeTicketTypeSchema), handle(async (req, res) => { res.json(await ticketService.changeType(req.params.id, req.body.type, req.userId!)); }));
// Guided Incident → Problem / Change conversion: creates a linked follow-up
// ticket instead of mutating the incident (changeType() refuses incidents).
ticketRouter.post('/:id/convert', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(ConvertTicketSchema), handle(async (req, res) => { res.status(201).json(await ticketService.convertFromIncident(req.params.id, req.body.targetType, req.body.title, req.userId!)); }));
// Type-specific extension editing (extensions are excluded from UpdateTicketSchema).
ticketRouter.put('/:id/problem', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(UpdateProblemExtensionSchema), handle(async (req, res) => { res.json(await ticketService.updateProblem(req.params.id, req.body, req.userId!)); }));
ticketRouter.put('/:id/change', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(UpdateChangeExtensionSchema), handle(async (req, res) => { res.json(await ticketService.updateChange(req.params.id, req.body, req.userId!)); }));
// Change → Risk links (ISO 27001 A.8.32 change management).
ticketRouter.post('/:id/risks', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(LinkChangeRiskSchema), handle(async (req, res) => { res.json(await ticketService.linkRisk(req.params.id, req.body.riskId, req.userId!)); }));
ticketRouter.delete('/:id/risks/:riskId', authenticate, requireEntityPermission('tickets.write', 'tickets'), handle(async (req, res) => { res.json(await ticketService.unlinkRisk(req.params.id, req.params.riskId, req.userId!)); }));
ticketRouter.post('/:id/status', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(ChangeTicketStatusSchema), handle(async (req, res) => { res.json(await ticketService.changeStatus(req.params.id, req.body.status, req.body.justification, req.userId!)); }));
ticketRouter.post('/:id/assign', authenticate, requireEntityPermission('tickets.assign', 'tickets'), validateBody(AssignTicketSchema), handle(async (req, res) => { res.json(await ticketService.assign(req.params.id, req.body.assigneeId, req.userId!)); }));
ticketRouter.post('/:id/comments', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(CreateTicketCommentSchema), handle(async (req, res) => { res.status(201).json(await ticketService.comment(req.params.id, req.body, req.userId!)); }));
// Requester (end user) feedback channel: only tickets.read is required, and the
// service enforces req.userId === ticket.requesterId (isInternal is forced to
// false) — ITIL 4 requester communication, ISO 27001 A.8.2 attribution.
ticketRouter.post('/:id/requester-comment', authenticate, requirePermission('tickets.read'), validateBody(RequesterCommentSchema), handle(async (req, res) => { res.status(201).json(await ticketService.requesterComment(req.params.id, req.body.body, req.userId!)); }));
ticketRouter.post('/:id/close', authenticate, requireEntityPermission('tickets.close', 'tickets'), validateBody(CloseTicketSchema), handle(async (req, res) => { res.json(await ticketService.close(req.params.id, req.body.summary, req.userId!)); }));
ticketRouter.post('/:id/escalations', authenticate, requireEntityPermission('tickets.escalate', 'tickets'), validateBody(EscalateTicketSchema), handle(async (req, res) => { res.status(201).json(await ticketService.escalate(req.params.id, req.body, req.userId!)); }));
ticketRouter.post('/:id/links', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(CreateTicketLinkSchema), handle(async (req, res) => { res.status(201).json(await ticketService.link(req.params.id, req.body, req.userId!)); }));
ticketRouter.get('/:id/history', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.historyList(req.params.id, req.query)); }));
// Restore an archived ticket (undo of archive). Admin-only, mirroring the Assets
// restore endpoint semantics (404 missing / 409 already active).
ticketRouter.post('/:id/restore', authenticate, requireAdminAccess, validateParams(IdParamSchema), validateBody(RestoreEntitySchema), handle(async (req, res) => { res.json(await ticketService.restore(req.params.id, req.userId, req.body?.reason)); }));
ticketRouter.get('/:id/assets', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.getAssetContext(req.params.id)); }));
ticketRouter.post('/:id/assets', authenticate, requireEntityPermission('tickets.context', 'tickets'), validateBody(TicketAssetIdsSchema), handle(async (req, res) => { res.json(await ticketService.addAssets(req.params.id, req.body.assetIds, req.userId!)); }));
ticketRouter.delete('/:id/assets', authenticate, requireEntityPermission('tickets.context', 'tickets'), validateBody(TicketAssetIdsSchema), handle(async (req, res) => { res.json(await ticketService.removeAssets(req.params.id, req.body.assetIds, req.userId!)); }));

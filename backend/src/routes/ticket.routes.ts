import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { authorizationService } from '../services/authorization.service';
import { ticketService } from '../services/ticket.service';
import {
  AssignTicketSchema, ChangeTicketStatusSchema, CloseTicketSchema, CreateTicketCommentSchema,
  CreateTicketLinkSchema, CreateTicketSchema, EscalateTicketSchema, RequesterCommentSchema,
  TicketAssetIdsSchema, UpdateTicketSchema,
} from 'shared';

export const ticketRouter = Router();

const handle = (fn: (req: AuthRequest, res: any) => Promise<void>) => async (req: AuthRequest, res: any, next: any) => {
  try { await fn(req, res); } catch (error) { next(error); }
};

ticketRouter.get('/types', authenticate, requirePermission('tickets.read'), handle(async (_req, res) => { res.json(await ticketService.listTypes()); }));
ticketRouter.get('/service-catalog', authenticate, requirePermission('serviceCatalog.read'), handle(async (_req, res) => { res.json(await ticketService.listCatalog()); }));
ticketRouter.get('/', authenticate, requirePermission('tickets.read'), handle(async (req, res) => { res.json(await ticketService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'tickets') as any, req.userId!)); }));
ticketRouter.post('/', authenticate, authorizeEntityWrite('tickets'), validateBody(CreateTicketSchema), handle(async (req, res) => { res.status(201).json(await ticketService.create(req.body, req.userId!)); }));
ticketRouter.get('/:id', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.getById(req.params.id)); }));
ticketRouter.put('/:id', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(UpdateTicketSchema), handle(async (req, res) => { res.json(await ticketService.update(req.params.id, req.body, req.userId!)); }));
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
ticketRouter.get('/:id/assets', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.getAssetContext(req.params.id)); }));
ticketRouter.post('/:id/assets', authenticate, requireEntityPermission('tickets.context', 'tickets'), validateBody(TicketAssetIdsSchema), handle(async (req, res) => { res.json(await ticketService.addAssets(req.params.id, req.body.assetIds, req.userId!)); }));
ticketRouter.delete('/:id/assets', authenticate, requireEntityPermission('tickets.context', 'tickets'), validateBody(TicketAssetIdsSchema), handle(async (req, res) => { res.json(await ticketService.removeAssets(req.params.id, req.body.assetIds, req.userId!)); }));

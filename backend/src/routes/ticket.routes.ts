import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeEntityWrite, requireEntityPermission, requirePermission } from '../middleware/entityAuth';
import { validateBody } from '../middleware/validation';
import { authorizationService } from '../services/authorization.service';
import { ticketService } from '../services/ticket.service';
import {
  AssignTicketSchema, ChangeTicketStatusSchema, ChangeTicketTypeSchema, CloseTicketSchema, ConvertTicketSchema,
  CreateTicketCommentSchema, CreateTicketLinkSchema, CreateTicketSchema, CreateServiceCatalogItemSchema,
  EscalateTicketSchema, LinkChangeRiskSchema, RequesterCommentSchema, TicketAssetIdsSchema,
  UpdateChangeExtensionSchema, UpdateProblemExtensionSchema, UpdateServiceCatalogItemSchema, UpdateTicketSchema,
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
ticketRouter.get('/', authenticate, requirePermission('tickets.read'), handle(async (req, res) => { res.json(await ticketService.list(req.query, await authorizationService.buildReadFilter(req.userId!, 'tickets') as any, req.userId!)); }));
ticketRouter.get('/workload', authenticate, requirePermission('tickets.read'), handle(async (req, res) => { res.json(await ticketService.workload(req.query, await authorizationService.buildReadFilter(req.userId!, 'tickets') as any)); }));
ticketRouter.post('/', authenticate, authorizeEntityWrite('tickets'), validateBody(CreateTicketSchema), handle(async (req, res) => { res.status(201).json(await ticketService.create(req.body, req.userId!)); }));
ticketRouter.get('/:id', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.getById(req.params.id)); }));
ticketRouter.put('/:id', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(UpdateTicketSchema), handle(async (req, res) => { res.json(await ticketService.update(req.params.id, req.body, req.userId!)); }));
ticketRouter.post('/:id/type', authenticate, requireEntityPermission('tickets.write', 'tickets'), validateBody(ChangeTicketTypeSchema), handle(async (req, res) => { res.json(await ticketService.changeType(req.params.id, req.body.type, req.userId!)); }));
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
ticketRouter.get('/:id/assets', authenticate, requireEntityPermission('tickets.read', 'tickets'), handle(async (req, res) => { res.json(await ticketService.getAssetContext(req.params.id)); }));
ticketRouter.post('/:id/assets', authenticate, requireEntityPermission('tickets.context', 'tickets'), validateBody(TicketAssetIdsSchema), handle(async (req, res) => { res.json(await ticketService.addAssets(req.params.id, req.body.assetIds, req.userId!)); }));
ticketRouter.delete('/:id/assets', authenticate, requireEntityPermission('tickets.context', 'tickets'), validateBody(TicketAssetIdsSchema), handle(async (req, res) => { res.json(await ticketService.removeAssets(req.params.id, req.body.assetIds, req.userId!)); }));

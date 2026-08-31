import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { nextDisplayId } from './displayId.service';
import { computePriority, getAllowedTicketTransitions, INITIAL_TICKET_STATUS, type TicketType } from 'shared';

type Data = Record<string, any>;
const userSelect = { id: true, displayId: true, email: true, firstName: true, lastName: true, isActive: true } as const;
const include = {
  assets: { include: { asset: { select: { id: true, displayId: true, name: true } } } },
  comments: { orderBy: { createdAt: 'asc' } },
  linksFrom: { include: { toTicket: { select: { id: true, displayId: true, title: true, type: true, status: true } } } },
  linksTo: { include: { fromTicket: { select: { id: true, displayId: true, title: true, type: true, status: true } } } },
  incident: true,
  problem: true,
  change: true,
  serviceRequest: { include: { catalogItem: true } },
  escalations: { orderBy: { createdAt: 'desc' } },
  requester: { select: userSelect },
  assignee: { select: userSelect },
  manager: { select: userSelect },
} as const;

/**
 * Validate that the provided user reference ids (requester / assignee / manager)
 * point to existing, active users. Returns a map of field -> user id.
 */
async function validateUserReferences(tx: any, refs: { requesterId?: string | null; assigneeId?: string | null; managerId?: string | null }) {
  const ids = [refs.requesterId, refs.assigneeId, refs.managerId].filter((v): v is string => Boolean(v));
  if (!ids.length) return refs;
  const users = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, isActive: true } });
  const byId = new Map(users.map((u: any) => [u.id, u.isActive]));
  for (const field of ['requesterId', 'assigneeId', 'managerId'] as const) {
    const id = refs[field];
    if (id && !byId.has(id)) throw new AppError(`${field} references a user that does not exist`, 400);
    if (id && byId.get(id) === false) throw new AppError(`${field} references an inactive user`, 409);
  }
  return refs;
}

/** Validate that the provided asset ids point to existing assets. */
async function validateAssetReferences(tx: any, assetIds?: string[]) {
  if (!assetIds?.length) return;
  const assets = await tx.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true } });
  const found = new Set(assets.map((a: any) => a.id));
  const missing = assetIds.filter((id) => !found.has(id));
  if (missing.length) throw new AppError(`Unknown asset id(s): ${missing.join(', ')}`, 400);
}

export class TicketService {
  async list(query: Data, authzWhere: Prisma.TicketWhereInput = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const where: any = {
      ...authzWhere,
      isArchived: false,
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { displayId: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      (prisma as any).ticket.findMany({ where, include, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      (prisma as any).ticket.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const ticket = await (prisma as any).ticket.findUnique({ where: { id }, include });
    if (!ticket || ticket.isArchived) throw new AppError('Ticket not found', 404);
    return ticket;
  }

  async create(data: Data, actorId: string) {
    const type = data.type as TicketType;
    const status = INITIAL_TICKET_STATUS[type];
    if (!status) throw new AppError('Unsupported ticket type', 400);
    const priority = data.priority ?? computePriority(data.urgency ?? 'medium', data.impact ?? 'medium');
    const config = await (prisma as any).ticketTypeConfig.findUnique({ where: { type } });
    if (config && !config.enabled) throw new AppError('This ticket type is disabled', 409);
    const sla = (config?.slaPolicy as any)?.byPriority?.[priority];
    const now = new Date();
    const ticket = await prisma.$transaction(async (tx: any) => {
      // Enforce that requester / assignee / manager are existing (active) users
      await validateUserReferences(tx, { requesterId: data.requesterId, assigneeId: data.assigneeId, managerId: data.managerId });
      // Enforce that referenced assets exist
      await validateAssetReferences(tx, data.assetIds);
      const created = await tx.ticket.create({
        data: {
          displayId: await nextDisplayId(tx, 'Ticket'), type, title: data.title, description: data.description, status, priority,
          urgency: data.urgency ?? 'medium', impact: data.impact ?? 'medium',
          // An explicit null requester (e.g. unknown e-mail sender) is preserved;
          // only an omitted (undefined) requester defaults to the acting user.
          requesterId: data.requesterId !== undefined ? data.requesterId : actorId,
          assigneeId: data.assigneeId, managerId: data.managerId,
          firstResponseDueAt: sla && new Date(now.getTime() + sla.firstResponseHours * 3600000),
          resolutionDueAt: sla && new Date(now.getTime() + sla.resolutionHours * 3600000),
          slaTargetAt: sla && new Date(now.getTime() + sla.resolutionHours * 3600000),
          createdBy: actorId, updatedBy: actorId,
          assets: data.assetIds?.length ? { create: data.assetIds.map((assetId: string) => ({ assetId })) } : undefined,
          ...(type === 'problem' && { problem: { create: data.problem ?? {} } }),
          ...(type === 'change' && { change: { create: data.change ?? {} } }),
          ...(type === 'service_request' && { serviceRequest: { create: data.serviceRequest ?? {} } }),
        },
      });
      await this.history(tx, created.id, 'CREATE', `Created ${created.displayId}`, {}, actorId);
      await this.audit(tx, actorId, 'TICKET_CREATE', created.id, `Created ${created.displayId}`);
      return created;
    });
    return this.getById(ticket.id);
  }

  async update(id: string, data: Data, actorId: string) {
    const current = await this.getById(id);
    const banned = ['status', 'type', 'assetIds', 'incident', 'problem', 'change', 'serviceRequest'];
    const changes: Data = Object.fromEntries(Object.entries(data).filter(([key, value]) => !banned.includes(key) && value !== undefined));
    if (data.urgency || data.impact) changes.priority = data.priority ?? computePriority(data.urgency ?? current.urgency, data.impact ?? current.impact);
    await prisma.$transaction(async (tx: any) => {
      // Enforce that any user reference (re)assigned here points to an existing user
      await validateUserReferences(tx, { requesterId: data.requesterId ?? current.requesterId, assigneeId: data.assigneeId ?? current.assigneeId, managerId: data.managerId ?? current.managerId });
      await validateAssetReferences(tx, data.assetIds);
      await tx.ticket.update({ where: { id }, data: { ...changes, updatedBy: actorId, version: { increment: 1 } } });
      if (data.assetIds) {
        await tx.ticketAsset.deleteMany({ where: { ticketId: id } });
        if (data.assetIds.length) await tx.ticketAsset.createMany({ data: data.assetIds.map((assetId: string) => ({ ticketId: id, assetId })), skipDuplicates: true });
      }
      await this.history(tx, id, 'UPDATE', `Updated ${current.displayId}`, changes, actorId);
      await this.audit(tx, actorId, 'TICKET_UPDATE', id, `Updated ${current.displayId}`);
    });
    return this.getById(id);
  }

  async changeStatus(id: string, status: string, justification: string | undefined, actorId: string) {
    const ticket = await this.getById(id);
    if (!getAllowedTicketTransitions(ticket.type, ticket.status).includes(status)) throw new AppError(`Transition from ${ticket.status} to ${status} is not allowed`, 409);
    if (ticket.type === 'change' && status === 'approved' && !ticket.change?.cabApproved) throw new AppError('CAB approval is required before approving a change', 409);
    await prisma.$transaction(async (tx: any) => {
      await tx.ticket.update({ where: { id }, data: {
        status, resolvedAt: ['resolved', 'fulfilled', 'implemented'].includes(status) ? new Date() : undefined,
        firstResponseAt: ticket.firstResponseAt ?? new Date(),
        slaBreachedAt: ticket.resolutionDueAt && new Date() > ticket.resolutionDueAt ? new Date() : undefined,
        updatedBy: actorId, version: { increment: 1 },
      } });
      await this.history(tx, id, 'STATUS_CHANGE', `Changed ${ticket.status} to ${status}`, { status: { old: ticket.status, new: status }, justification }, actorId);
      await this.audit(tx, actorId, 'TICKET_STATUS_CHANGE', id, `Status ${ticket.status} → ${status}`);
    });
    return this.getById(id);
  }

  async assign(id: string, assigneeId: string | null, actorId: string) {
    const ticket = await this.getById(id);
    const target = assigneeId ?? ticket.assigneeId;
    if (target) {
      const user = await prisma.user.findUnique({ where: { id: target }, select: { id: true, isActive: true } });
      if (!user) throw new AppError('Assignee references a user that does not exist', 400);
      if (!user.isActive) throw new AppError('Assignee references an inactive user', 409);
    }
    return this.mutate(id, actorId, 'ASSIGN', 'TICKET_ASSIGN', `Assigned to ${target ?? 'unassigned'}`, (tx) => tx.ticket.update({ where: { id }, data: { assigneeId: target, updatedBy: actorId } }));
  }

  async comment(id: string, data: Data, actorId: string) {
    await this.getById(id);
    return this.mutate(id, actorId, 'COMMENT', 'TICKET_COMMENT', data.isInternal ? 'Added internal work note' : 'Added comment', (tx) => tx.ticketComment.create({ data: { ticketId: id, authorId: actorId, body: data.body, isInternal: data.isInternal ?? false } }));
  }

  async close(id: string, summary: string, actorId: string) {
    const ticket = await this.getById(id);
    if (!['resolved', 'fulfilled', 'implemented'].includes(ticket.status)) throw new AppError('Ticket must be resolved or fulfilled before closing', 409);
    return this.mutate(id, actorId, 'CLOSE', 'TICKET_CLOSE', summary, (tx) => tx.ticket.update({ where: { id }, data: { status: 'closed', closedAt: new Date(), closedBy: actorId, updatedBy: actorId } }));
  }

  async escalate(id: string, data: Data, actorId: string) {
    await this.getById(id);
    return this.mutate(id, actorId, 'ESCALATE', 'TICKET_ESCALATE', data.reason, (tx) => tx.ticketEscalation.create({ data: { ticketId: id, escalationType: 'manual', reason: data.reason, level: data.level ?? 1, dueAt: data.dueAt, escalatedTo: data.escalatedTo, createdBy: actorId } }));
  }

  async link(id: string, data: Data, actorId: string) {
    if (id === data.toTicketId) throw new AppError('A ticket cannot link to itself', 400);
    await Promise.all([this.getById(id), this.getById(data.toTicketId)]);
    return this.mutate(id, actorId, 'LINK', 'TICKET_LINK', `Linked ticket (${data.linkType})`, (tx) => tx.ticketLink.create({ data: { fromTicketId: id, toTicketId: data.toTicketId, linkType: data.linkType } }));
  }

  async historyList(id: string, query: Data) {
    await this.getById(id);
    const where = { ticketId: id, ...(query.action && { action: query.action }) };
    const [data, total] = await Promise.all([
      (prisma as any).ticketHistoryEntry.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Number(query.limit) || 100, 200), skip: Number(query.offset) || 0 }),
      (prisma as any).ticketHistoryEntry.count({ where }),
    ]);
    return { data, total };
  }

  async listCatalog() { return (prisma as any).serviceCatalogItem.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } }); }
  async listTypes() { return (prisma as any).ticketTypeConfig.findMany({ where: { enabled: true }, orderBy: { type: 'asc' } }); }

  private async mutate(id: string, actorId: string, action: string, auditAction: any, summary: string, operation: (tx: any) => Promise<any>) {
    await prisma.$transaction(async (tx: any) => {
      await operation(tx);
      await this.history(tx, id, action, summary, {}, actorId);
      await this.audit(tx, actorId, auditAction, id, summary);
    });
    return this.getById(id);
  }

  private history(tx: any, ticketId: string, action: string, summary: string, fieldChanges: any, actorId: string) { return tx.ticketHistoryEntry.create({ data: { ticketId, action, summary, fieldChanges, actorId } }); }
  private audit(tx: any, userId: string, action: any, entityId: string, details: string) { return auditService.logEvent(tx, { userId, action, entityType: 'Ticket', entityId, details }); }
}

export const ticketService = new TicketService();

/**
 * Corrective Action Domain Service — Phase 7
 *
 * Handles corrective action (CAPA) lifecycle with explicit business rules:
 * - Source type validation (audit, incident, risk, control, supplier)
 * - Status transition validation via statusTransition automaton
 * - Effectiveness review requires completion first
 * - Reopening completed CAPA requires justification
 * - Audit logging
 */

import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService, AuditAction } from './audit.service';
import { validateTransition } from './statusTransition';

type AnyObject = Record<string, any>;

const CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const UPDATE_ACTION: AuditAction = 'CONFIG_CHANGE';

// Allowed source types for corrective actions
const ALLOWED_SOURCE_TYPES = ['audit', 'incident', 'risk', 'control', 'supplier'];

export class CorrectiveActionService {
  private displayId(): string {
    return `CAPA-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  /**
   * Create a corrective action with source validation.
   */
  async create(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate source type
    const sourceType = data.sourceType;
    if (sourceType && !ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      throw new AppError(`Unsupported corrective action source type: ${sourceType}. Allowed: ${ALLOWED_SOURCE_TYPES.join(', ')}`, 400);
    }

    // Validate source reference exists if provided
    if (data.sourceId) {
      await this.validateSource(data.sourceType, data.sourceId);
    }

    const createData: AnyObject = { ...data, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId();
    if (!createData.status) createData.status = 'open';

    const capa = await prisma.correctiveAction.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: CREATE_ACTION,
      entityType: 'CorrectiveAction',
      entityId: capa.id,
      details: `Created corrective action ${capa.displayId}`,
      newValue: capa as any,
    });
    return capa;
  }

  /**
   * Update a corrective action with status transition validation.
   */
  async update(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.get(id);

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('correctiveActions', existing.status, data.status, data);
      if (!result.allowed) {
        throw new AppError(
          `Corrective action status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }

      // Special handling for closed -> reopened (must go through completed first)
      if (existing.status === 'closed' && data.status !== 'reopened') {
        throw new AppError('Closed corrective actions must be reopened before any other transition', 400);
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const capa = await prisma.correctiveAction.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: UPDATE_ACTION,
      entityType: 'CorrectiveAction',
      entityId: id,
      details: `Updated corrective action ${existing.displayId}`,
      oldValue: existing as any,
      newValue: capa as any,
    });
    return capa;
  }

  /**
   * Get a single corrective action by ID.
   */
  async get(id: string): Promise<AnyObject> {
    const capa = await prisma.correctiveAction.findUnique({ where: { id } });
    if (!capa) throw new AppError('Corrective action not found', 404);
    return capa;
  }

  /**
   * List corrective actions with pagination and filters.
   */
  async list(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.sourceType) where.sourceType = String(query.sourceType);
    if (query.ownerId) where.ownerId = String(query.ownerId);
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search), mode: 'insensitive' } },
        { description: { contains: String(query.search), mode: 'insensitive' } },
        { sourceType: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }
    if (query.dueBefore) {
      where.dueDate = { lte: new Date(String(query.dueBefore)) };
    }
    if (query.overdue === 'true') {
      where.dueDate = { lte: new Date() };
      where.status = { notIn: ['completed', 'closed', 'cancelled'] };
    }

    const [data, total] = await Promise.all([
      prisma.correctiveAction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' as const } }),
      prisma.correctiveAction.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Create a corrective action from a source (audit finding, incident, risk, etc.).
   */
  async createFromSource(sourceType: string, sourceId: string, data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate source type is allowed
    if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      throw new AppError(`Unsupported corrective action source type: ${sourceType}. Allowed: ${ALLOWED_SOURCE_TYPES.join(', ')}`, 400);
    }

    // Validate source reference exists
    await this.validateSource(sourceType, sourceId);

    const createData: AnyObject = { ...data, sourceType, sourceId, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId();
    if (!createData.status) createData.status = 'open';

    const capa = await prisma.correctiveAction.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: CREATE_ACTION,
      entityType: 'CorrectiveAction',
      entityId: capa.id,
      details: `Created corrective action ${capa.displayId} from ${sourceType} ${sourceId}`,
      newValue: capa as any,
    });
    return capa;
  }

  /**
   * Validate that a source reference exists.
   */
  async validateSource(sourceType: string, sourceId: string): Promise<void> {
    switch (sourceType) {
      case 'audit':
      case 'auditFinding': {
        const finding = await prisma.auditFinding.findUnique({ where: { id: sourceId } });
        if (!finding) throw new AppError(`Audit finding ${sourceId} not found`, 404);
        break;
      }
      case 'incident': {
        const incident = await prisma.incident.findUnique({ where: { id: sourceId } });
        if (!incident) throw new AppError(`Incident ${sourceId} not found`, 404);
        break;
      }
      case 'risk': {
        const risk = await prisma.risk.findUnique({ where: { id: sourceId } });
        if (!risk) throw new AppError(`Risk ${sourceId} not found`, 404);
        break;
      }
      case 'control': {
        const control = await prisma.control.findUnique({ where: { id: sourceId } });
        if (!control) throw new AppError(`Control ${sourceId} not found`, 404);
        break;
      }
      case 'supplier': {
        const supplier = await prisma.supplier.findUnique({ where: { id: sourceId } });
        if (!supplier) throw new AppError(`Supplier ${sourceId} not found`, 404);
        break;
      }
      default:
        throw new AppError(`Unknown source type: ${sourceType}`, 400);
    }
  }

  /**
   * Perform effectiveness review on a completed corrective action.
   */
  async reviewEffectiveness(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.get(id);

    // Effectiveness review requires the CAPA to be in completed or closed state
    if (existing.status !== 'completed' && existing.status !== 'closed') {
      throw new AppError('Effectiveness review can only be performed on completed or closed corrective actions', 400);
    }

    const effectivenessStatus = data.effectivenessStatus;
    if (!effectivenessStatus) {
      throw new AppError('Effectiveness status is required', 400);
    }

    const updateData: AnyObject = {
      effectivenessStatus,
      effectivenessReview: data.effectivenessReview,
      effectivenessCriteria: data.effectivenessCriteria ?? existing.effectivenessCriteria,
      effectivenessReviewedAt: new Date(),
      updatedBy: userId,
    };

    // Auto-close if effective
    if (effectivenessStatus === 'effective' && existing.status === 'completed') {
      updateData.status = 'closed';
      updateData.closedAt = new Date();
    }

    const capa = await prisma.correctiveAction.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: UPDATE_ACTION,
      entityType: 'CorrectiveAction',
      entityId: id,
      details: `Reviewed effectiveness of ${existing.displayId}: ${effectivenessStatus}`,
      oldValue: existing as any,
      newValue: capa as any,
    });
    return capa;
  }

  /**
   * Close a corrective action (requires effectiveness review first).
   */
  async close(id: string, userId: string): Promise<AnyObject> {
    const existing = await this.get(id);

    if (existing.status !== 'completed') {
      throw new AppError('Only completed corrective actions can be closed', 400);
    }

    if (!existing.effectivenessStatus || existing.effectivenessStatus === 'not_reviewed') {
      throw new AppError('Effectiveness review is required before closing', 400);
    }

    const capa = await prisma.correctiveAction.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date(), updatedBy: userId },
    });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: UPDATE_ACTION,
      entityType: 'CorrectiveAction',
      entityId: id,
      details: `Closed corrective action ${existing.displayId}`,
      oldValue: existing as any,
      newValue: capa as any,
    });
    return capa;
  }

  /**
   * Reopen a closed or completed corrective action.
   */
  async reopen(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.get(id);

    if (existing.status === 'closed' || existing.status === 'completed') {
      // Reopening requires justification
      if (!data?.justification) {
        throw new AppError('Reopening a corrective action requires a justification', 400);
      }
    }

    const capa = await prisma.correctiveAction.update({
      where: { id },
      data: { status: 'reopened', updatedBy: userId },
    });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: UPDATE_ACTION,
      entityType: 'CorrectiveAction',
      entityId: id,
      details: `Reopened corrective action ${existing.displayId}: ${data?.justification ?? 'no reason provided'}`,
      oldValue: existing as any,
      newValue: capa as any,
    });
    return capa;
  }
}

export const correctiveActionService = new CorrectiveActionService();

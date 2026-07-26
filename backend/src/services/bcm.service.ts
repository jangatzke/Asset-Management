/**
 * Business Continuity Management (BCM) Domain Service — Phase 7
 *
 * Handles BIA, BCP, and BCP Exercise lifecycle with explicit business rules:
 * - MTPD >= RTO validation for BIA
 * - Status transition validation via statusTransition automaton
 * - BCP references validated BIA
 * - BCP Exercise references validated BCP
 * - Audit logging
 */

import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService, AuditAction } from './audit.service';
import { validateTransition } from './statusTransition';

type AnyObject = Record<string, any>;

const BIA_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const BCP_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const EXERCISE_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';

export class BcmService {
  private displayId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  // =========================================================================
  // Business Impact Analysis (BIA)
  // =========================================================================

  async createBia(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate MTPD >= RTO
    const mtpd = Number(data.mtpdMinutes);
    const rto = Number(data.rtoMinutes);
    if (mtpd < rto) {
      throw new AppError('MTPD must be greater than or equal to RTO', 400);
    }

    const createData: AnyObject = { ...data, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId('BIA');
    if (!createData.status) createData.status = 'draft';

    const bia = await prisma.businessImpactAnalysis.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: BIA_CREATE_ACTION,
      entityType: 'BusinessImpactAnalysis',
      entityId: bia.id,
      details: `Created BIA ${bia.displayId}`,
      newValue: bia as any,
    });
    return bia;
  }

  async updateBia(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.getBia(id);

    // Validate MTPD >= RTO if either is being updated
    const mtpd = data.mtpdMinutes ?? Number(existing.mtpdMinutes);
    const rto = data.rtoMinutes ?? Number(existing.rtoMinutes);
    if (mtpd < rto) {
      throw new AppError('MTPD must be greater than or equal to RTO', 400);
    }

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('bias', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `BIA status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const bia = await prisma.businessImpactAnalysis.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'BusinessImpactAnalysis',
      entityId: id,
      details: `Updated BIA ${existing.displayId}`,
      oldValue: existing as any,
      newValue: bia as any,
    });
    return bia;
  }

  async getBia(id: string): Promise<AnyObject> {
    const bia = await prisma.businessImpactAnalysis.findUnique({ where: { id } });
    if (!bia) throw new AppError('Business impact analysis not found', 404);
    return bia;
  }

  async listBia(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }
    if (query.dueBefore) {
      where.nextReviewDate = { lte: new Date(String(query.dueBefore)) };
    }

    const [data, total] = await Promise.all([
      prisma.businessImpactAnalysis.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' as const } }),
      prisma.businessImpactAnalysis.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // =========================================================================
  // Business Continuity Plan (BCP)
  // =========================================================================

  async createBcp(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate BIA reference if provided
    if (data.biaId) {
      const bia = await prisma.businessImpactAnalysis.findUnique({ where: { id: data.biaId } });
      if (!bia) throw new AppError('Referenced BIA not found', 400);
    }

    const createData: AnyObject = { ...data, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId('BCP');
    if (!createData.status) createData.status = 'draft';

    const bcp = await prisma.businessContinuityPlan.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: BCP_CREATE_ACTION,
      entityType: 'BusinessContinuityPlan',
      entityId: bcp.id,
      details: `Created BCP ${bcp.displayId}`,
      newValue: bcp as any,
    });
    return bcp;
  }

  async updateBcp(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.getBcp(id);

    // Validate BIA reference if being changed
    if (data.biaId && data.biaId !== existing.biaId) {
      const bia = await prisma.businessImpactAnalysis.findUnique({ where: { id: data.biaId } });
      if (!bia) throw new AppError('Referenced BIA not found', 400);
    }

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('bcps', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `BCP status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const bcp = await prisma.businessContinuityPlan.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'BusinessContinuityPlan',
      entityId: id,
      details: `Updated BCP ${existing.displayId}`,
      oldValue: existing as any,
      newValue: bcp as any,
    });
    return bcp;
  }

  async getBcp(id: string): Promise<AnyObject> {
    const bcp = await prisma.businessContinuityPlan.findUnique({ where: { id } });
    if (!bcp) throw new AppError('Business continuity plan not found', 404);
    return bcp;
  }

  async listBcp(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.search) {
      where.OR = [
        { title: { contains: String(query.search), mode: 'insensitive' } },
        { scope: { contains: String(query.search), mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.businessContinuityPlan.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' as const } }),
      prisma.businessContinuityPlan.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // =========================================================================
  // BCP Exercise
  // =========================================================================

  async createExercise(data: AnyObject, userId: string): Promise<AnyObject> {
    // Validate BCP reference
    const bcp = await prisma.businessContinuityPlan.findUnique({ where: { id: data.bcpId } });
    if (!bcp) throw new AppError('Referenced BCP not found', 400);

    const createData: AnyObject = { ...data, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId('BCX');
    if (!createData.status) createData.status = 'scheduled';

    const exercise = await prisma.bCPExercise.create({ data: createData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: EXERCISE_CREATE_ACTION,
      entityType: 'BCPExercise',
      entityId: exercise.id,
      details: `Created BCP exercise for BCP ${bcp.title}`,
      newValue: exercise as any,
    });
    return exercise;
  }

  async updateExercise(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.getExercise(id);

    // Validate status transition
    if (data.status && data.status !== existing.status) {
      const result = validateTransition('bcpExercises', existing.status, data.status);
      if (!result.allowed) {
        throw new AppError(
          `BCP exercise status transition from "${existing.status}" to "${data.status}" is not allowed: ${result.message}`,
          400,
        );
      }
    }

    const updateData = { ...data, updatedBy: userId };
    const exercise = await prisma.bCPExercise.update({ where: { id }, data: updateData as any });

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'BCPExercise',
      entityId: id,
      details: `Updated BCP exercise ${existing.displayId}`,
      oldValue: existing as any,
      newValue: exercise as any,
    });
    return exercise;
  }

  async getExercise(id: string): Promise<AnyObject> {
    const exercise = await prisma.bCPExercise.findUnique({ where: { id } });
    if (!exercise) throw new AppError('BCP exercise not found', 404);
    return exercise;
  }

  async listExercises(query: AnyObject = {}): Promise<AnyObject> {
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.bcpId) where.bcpId = String(query.bcpId);

    const [data, total] = await Promise.all([
      prisma.bCPExercise.findMany({ where, skip, take: limit, orderBy: { plannedAt: 'asc' as const } }),
      prisma.bCPExercise.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

export const bcmService = new BcmService();

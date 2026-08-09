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
import { correctiveActionService } from './correctiveaction.service';

type AnyObject = Record<string, any>;

const BIA_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const BCP_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const EXERCISE_CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';

export class BcmService {
  private displayId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  private async validateBiaLinks(data: AnyObject): Promise<void> {
    if (data.processId && !await prisma.businessProcess.findUnique({ where: { id: data.processId } })) throw new AppError('Referenced business process not found', 400);
    if (data.serviceId && !await prisma.businessService.findUnique({ where: { id: data.serviceId } })) throw new AppError('Referenced business service not found', 400);
    if (data.ownerId && !await prisma.user.findUnique({ where: { id: data.ownerId } })) throw new AppError('Referenced owner not found', 400);
    for (const link of data.assetLinks ?? []) {
      if (!await prisma.asset.findUnique({ where: { id: link.assetId } })) throw new AppError(`Referenced asset ${link.assetId} not found`, 400);
    }
  }

  private async replaceBiaAssetLinks(biaId: string, assetLinks: AnyObject[]): Promise<void> {
    await prisma.bIAAssetRelation.deleteMany({ where: { biaId } });
    if (assetLinks.length) await prisma.bIAAssetRelation.createMany({ data: assetLinks.map(({ assetId, role }) => ({ biaId, assetId, role })) });
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

    await this.validateBiaLinks(data);
    const { assetLinks = [], ...biaData } = data;
    const createData: AnyObject = { ...biaData, createdBy: userId };
    if (!createData.displayId) createData.displayId = this.displayId('BIA');
    if (!createData.status) createData.status = 'draft';

    const bia = await prisma.businessImpactAnalysis.create({ data: createData as any });
    await this.replaceBiaAssetLinks(bia.id, assetLinks);

    await auditService.logEventStandalone(prisma, {
      userId,
      action: BIA_CREATE_ACTION,
      entityType: 'BusinessImpactAnalysis',
      entityId: bia.id,
      details: `Created BIA ${bia.displayId}`,
      newValue: bia as any,
    });
    return this.getBiaDetail(bia.id);
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

    await this.validateBiaLinks(data);
    const { assetLinks, ...biaData } = data;
    const updateData = { ...biaData, updatedBy: userId };
    const bia = await prisma.businessImpactAnalysis.update({ where: { id }, data: updateData as any });
    if (assetLinks !== undefined) await this.replaceBiaAssetLinks(id, assetLinks);

    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'CONFIG_CHANGE',
      entityType: 'BusinessImpactAnalysis',
      entityId: id,
      details: `Updated BIA ${existing.displayId}`,
      oldValue: existing as any,
      newValue: bia as any,
    });
    return this.getBiaDetail(bia.id);
  }

  async getBia(id: string): Promise<AnyObject> {
    const bia = await prisma.businessImpactAnalysis.findUnique({ where: { id } });
    if (!bia) throw new AppError('Business impact analysis not found', 404);
    return bia;
  }

  async getBiaDetail(id: string): Promise<AnyObject> {
    const bia = await this.getBia(id);
    const [assets, plans] = await Promise.all([
      prisma.bIAAssetRelation.findMany({ where: { biaId: id } }),
      prisma.businessContinuityPlan.findMany({ where: { biaId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { bia, assets, plans };
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

    if (!await prisma.user.findUnique({ where: { id: data.ownerId } })) throw new AppError('Referenced owner not found', 400);
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
    return this.getBcpDetail(bcp.id);
  }

  async updateBcp(id: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const existing = await this.getBcp(id);

    // Validate BIA reference if being changed
    if (data.biaId && data.biaId !== existing.biaId) {
      const bia = await prisma.businessImpactAnalysis.findUnique({ where: { id: data.biaId } });
      if (!bia) throw new AppError('Referenced BIA not found', 400);
    }
    if (data.ownerId && !await prisma.user.findUnique({ where: { id: data.ownerId } })) throw new AppError('Referenced owner not found', 400);

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
    return this.getBcpDetail(bcp.id);
  }

  async getBcp(id: string): Promise<AnyObject> {
    const bcp = await prisma.businessContinuityPlan.findUnique({ where: { id } });
    if (!bcp) throw new AppError('Business continuity plan not found', 404);
    return bcp;
  }

  async getBcpDetail(id: string): Promise<AnyObject> {
    const bcp = await this.getBcp(id);
    const [bia, exercises, correctiveActions] = await Promise.all([
      bcp.biaId ? this.getBia(bcp.biaId) : null,
      prisma.bCPExercise.findMany({ where: { bcpId: id }, orderBy: { plannedAt: 'desc' } }),
      prisma.correctiveAction.findMany({ where: { sourceType: 'bcp', sourceId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { bcp, bia, exercises, correctiveActions };
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
    return this.getExerciseDetail(exercise.id);
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
    return this.getExerciseDetail(exercise.id);
  }

  async getExercise(id: string): Promise<AnyObject> {
    const exercise = await prisma.bCPExercise.findUnique({ where: { id } });
    if (!exercise) throw new AppError('BCP exercise not found', 404);
    return exercise;
  }

  async getExerciseDetail(id: string): Promise<AnyObject> {
    const exercise = await this.getExercise(id);
    const [bcp, correctiveActions] = await Promise.all([
      this.getBcp(exercise.bcpId),
      prisma.correctiveAction.findMany({ where: { sourceType: 'bcp', sourceId: exercise.bcpId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { exercise, bcp, correctiveActions };
  }

  async createCorrectiveActionFromExercise(exerciseId: string, data: AnyObject, userId: string): Promise<AnyObject> {
    const exercise = await this.getExercise(exerciseId);
    if (!['executed', 'completed'].includes(exercise.status)) throw new AppError('Corrective actions can only be created for executed exercises', 400);
    const finding = data.findingIndex === undefined ? undefined : (exercise.findings as AnyObject[])[data.findingIndex];
    if (data.findingIndex !== undefined && !finding) throw new AppError('Exercise finding not found', 404);
    return correctiveActionService.createFromSource('bcp', exercise.bcpId, {
      ...data,
      title: data.title ?? finding?.title,
      description: data.description ?? finding?.description,
      priority: data.priority ?? finding?.severity ?? 'medium',
    }, userId);
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

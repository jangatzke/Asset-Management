import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export interface CreateRiskData {
  title: string;
  description: string;
  organizationUnitId?: string;
  affectedAssetIds?: string[];
  affectedProcessIds?: string[];
  affectedServiceIds?: string[];
  threatId?: string;
  vulnerabilityId?: string;
  possibleImpact: string;
  existingControls?: string[];
  likelihood: number;
  impact: number;
  inherentRisk: string;
  residualRisk: string;
  targetRisk: string;
  riskOwnerId: string;
  assessorId: string;
  nextReviewDate: Date;
  evaluationJustification?: string;
}

export interface UpdateRiskData extends Partial<CreateRiskData> {
  status?: string;
}

export interface ListRisksQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  organizationUnitId?: string;
  riskOwnerId?: string;
}

export interface CreateTreatmentPlanData {
  treatmentOption: string;
  responsibleId: string;
  budget?: number;
  targetDate: Date;
  expectedRiskReduction: string;
  dependencies?: string[];
}

export class RiskService {
  async list(query: ListRisksQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.RiskWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.organizationUnitId) {
      where.organizationUnitId = query.organizationUnitId;
    }

    if (query.riskOwnerId) {
      where.riskOwnerId = query.riskOwnerId;
    }

    const [risks, total] = await Promise.all([
      prisma.risk.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organizationUnit: true,
        },
      }),
      prisma.risk.count({ where }),
    ]);

    return {
      data: risks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const risk = await prisma.risk.findUnique({
      where: { id },
      include: {
        organizationUnit: true,
      },
    });

    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    return risk;
  }

  async create(data: CreateRiskData, createdBy?: string) {
    const displayId = `RSK-${Date.now()}`;

    const risk = await prisma.risk.create({
      data: {
        ...data,
        displayId,
        inherentRisk: this.calculateRiskLevel(data.likelihood, data.impact),
        createdBy,
      },
      include: {
        organizationUnit: true,
      },
    });

    // Audit log for risk creation
    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'RISK_CREATE',
        entityType: 'Risk',
        entityId: risk.id,
        details: `Created risk: ${data.title}`,
      });
    }

    return risk;
  }

  async update(id: string, data: UpdateRiskData, updatedBy?: string) {
    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk not found', 404);
    }

    // Audit log for risk update (if status or risk level changed)
    if (updatedBy && (data.status !== undefined || data.likelihood !== undefined || data.impact !== undefined)) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'RISK_UPDATE',
        entityType: 'Risk',
        entityId: id,
        details: `Updated risk: ${existing.title}`,
        oldValue: { status: existing.status, likelihood: existing.likelihood, impact: existing.impact },
        newValue: { status: data.status ?? existing.status, likelihood: data.likelihood ?? existing.likelihood, impact: data.impact ?? existing.impact },
      });
    }

    const risk = await prisma.risk.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
      include: {
        organizationUnit: true,
      },
    });

    return risk;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk not found', 404);
    }

    // Audit log for risk deletion (archiving)
    if (deletedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: deletedBy,
        action: 'RISK_DELETE',
        entityType: 'Risk',
        entityId: id,
        details: `Archived risk: ${existing.title}`,
      });
    }

    await prisma.risk.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async createTreatmentPlan(riskId: string, data: CreateTreatmentPlanData) {
    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    const displayId = `RT-${Date.now()}`;
    const treatmentPlan = await prisma.riskTreatment.create({
      data: {
        displayId,
        riskId,
        treatmentOption: data.treatmentOption,
        responsibleUserId: data.responsibleId,
        budget: data.budget ? new (require('@prisma/client/runtime/client').Decimal)(data.budget) : undefined,
        targetDate: data.targetDate,
        expectedReduction: data.expectedRiskReduction,
        dependencies: Array.isArray(data.dependencies) ? data.dependencies.join(',') : data.dependencies,
      },
    });

    return treatmentPlan;
  }

  async acceptRisk(riskId: string, userId: string) {
    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    // Audit log for risk acceptance (security-relevant action)
    await auditService.logEventStandalone(prisma, {
      userId,
      action: 'RISK_ACCEPT',
      entityType: 'Risk',
      entityId: riskId,
      details: `Accepted risk: ${risk.title}`,
      oldValue: { status: risk.status },
      newValue: { status: 'accepted' },
    });

    const updated = await prisma.risk.update({
      where: { id: riskId },
      data: {
        status: 'accepted',
        updatedBy: userId,
      },
    });

    return updated;
  }

  // RSK-024: Check if an event triggers an unplanned risk review
  // Events that should trigger a review:
  //   - Security incident (severe)
  //   - Technical change on critical asset
  //   - New critical supplier
  //   - New vulnerability
  //   - Regulatory change
  //   - Criticality change
  //   - KPI threshold exceeded
  //   - Risk approval expiring
  async checkUnplannedReviewTrigger(event: {
    type: 'security_incident' | 'technical_change' | 'new_critical_supplier' | 'new_vulnerability' | 'regulatory_change' | 'criticality_change' | 'kpi_threshold_exceeded' | 'risk_approval_expiring';
    severity?: 'low' | 'medium' | 'high' | 'very_high';
    assetId?: string;
    riskId?: string;
    details?: string;
  }) {
    const severeIncidents = ['security_incident', 'new_vulnerability', 'regulatory_change'];
    const criticalEvents = ['technical_change', 'criticality_change', 'kpi_threshold_exceeded'];

    let requiresReview = false;
    let reason = '';

    // Security incidents always require review when severity is high or very_high
    if (severeIncidents.includes(event.type)) {
      if (event.severity === 'high' || event.severity === 'very_high') {
        requiresReview = true;
        reason = `Severe ${event.type} detected requiring immediate risk reassessment`;
      } else {
        requiresReview = true;
        reason = `${event.type} detected - review recommended`;
      }
    }

    // Technical changes on critical assets require review
    if (criticalEvents.includes(event.type)) {
      if (event.assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: event.assetId } });
        if (asset && ['high', 'very_high'].includes(asset.criticality)) {
          requiresReview = true;
          reason = `${event.type} on critical asset ${asset.displayId} (${asset.name})`;
        }
      } else {
        requiresReview = true;
        reason = `${event.type} detected - review recommended`;
      }
    }

    // New critical supplier always triggers review
    if (event.type === 'new_critical_supplier') {
      requiresReview = true;
      reason = 'New critical supplier identified requiring supply chain risk assessment';
    }

    // Risk approval expiring triggers review
    if (event.type === 'risk_approval_expiring' && event.riskId) {
      const risk = await prisma.risk.findUnique({ where: { id: event.riskId } });
      if (risk && risk.status === 'accepted') {
        requiresReview = true;
        reason = `Accepted risk ${risk.displayId} (${risk.title}) approval is expiring`;
      }
    }

    // If review is required, find affected risks
    let affectedRisks: any[] = [];
    if (requiresReview) {
      const where: Prisma.RiskWhereInput = { status: { notIn: ['accepted', 'closed'] } };
      if (event.assetId) {
        where.affectedAssetIds = { has: event.assetId };
      }
      affectedRisks = await prisma.risk.findMany({
        where,
        include: { organizationUnit: true },
      });
    }

    return {
      requiresReview,
      reason,
      eventType: event.type,
      affectedRiskCount: affectedRisks.length,
      affectedRisks: affectedRisks.map(r => ({
        id: r.id,
        displayId: r.displayId,
        title: r.title,
        status: r.status,
        inherentRisk: r.inherentRisk,
      })),
    };
  }

  private calculateRiskLevel(likelihood: number, impact: number): string {
    const score = likelihood * impact;
    if (score >= 16) return 'very_high';
    if (score >= 9) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
}

export const riskService = new RiskService();
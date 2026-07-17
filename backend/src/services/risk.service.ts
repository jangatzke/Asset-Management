import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

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

    return risk;
  }

  async update(id: string, data: UpdateRiskData, updatedBy?: string) {
    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk not found', 404);
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

  async delete(id: string) {
    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk not found', 404);
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

    const treatmentPlan = await prisma.riskTreatmentPlan.create({
      data: {
        riskId,
        ...data,
        budget: data.budget ? new (require('@prisma/client/runtime/client').Decimal)(data.budget) : undefined,
      },
    });

    return treatmentPlan;
  }

  async acceptRisk(riskId: string, userId: string) {
    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    const updated = await prisma.risk.update({
      where: { id: riskId },
      data: {
        status: 'accepted',
        updatedBy: userId,
      },
    });

    return updated;
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
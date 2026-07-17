import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateRiskMethodData {
  name: string;
  description?: string | null;
  version: string;
  likelihoodScale: Record<string, unknown>;
  impactScale: Record<string, unknown>;
  ratingDimensions: Record<string, unknown>;
  formula: string;
  riskClasses: Record<string, unknown>;
  acceptanceThresholds?: Record<string, unknown> | null;
  escalationThresholds?: Record<string, unknown> | null;
  approvalRules?: Record<string, unknown> | null;
  reviewInterval?: number | null;
  isActive?: boolean;
}

export interface UpdateRiskMethodData extends Partial<CreateRiskMethodData> {}

export interface ListRiskMethodsQuery {
  page?: string;
  limit?: string;
  search?: string;
  isActive?: string;
}

export class RiskMethodService {
  async list(query: ListRiskMethodsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.RiskMethodWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    }

    const [methods, total] = await Promise.all([
      prisma.riskMethod.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.riskMethod.count({ where }),
    ]);

    return {
      data: methods,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const method = await prisma.riskMethod.findUnique({ where: { id } });
    if (!method) throw new AppError('Risk method not found', 404);
    return method;
  }

  async create(data: CreateRiskMethodData) {
    const displayId = `RM-${Date.now()}`;

    const method = await prisma.$transaction(async (tx) => {
      if (data.isActive) {
        await tx.riskMethod.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }
      return tx.riskMethod.create({
        data: {
          ...data,
          displayId,
          likelihoodScale: JSON.parse(JSON.stringify(data.likelihoodScale)),
          impactScale: JSON.parse(JSON.stringify(data.impactScale)),
          ratingDimensions: JSON.parse(JSON.stringify(data.ratingDimensions)),
          riskClasses: JSON.parse(JSON.stringify(data.riskClasses)),
          acceptanceThresholds: data.acceptanceThresholds
            ? JSON.parse(JSON.stringify(data.acceptanceThresholds)) : null,
          escalationThresholds: data.escalationThresholds
            ? JSON.parse(JSON.stringify(data.escalationThresholds)) : null,
          approvalRules: data.approvalRules
            ? JSON.parse(JSON.stringify(data.approvalRules)) : null,
        },
      });
    });

    return method;
  }

  async update(id: string, data: UpdateRiskMethodData) {
    const existing = await prisma.riskMethod.findUnique({ where: { id } });
    if (!existing) throw new AppError('Risk method not found', 404);

    if (data.isActive) {
      await prisma.riskMethod.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }

    const updateData: Record<string, unknown> = { ...data };
    if (updateData.likelihoodScale) updateData.likelihoodScale = JSON.parse(JSON.stringify(updateData.likelihoodScale));
    if (updateData.impactScale) updateData.impactScale = JSON.parse(JSON.stringify(updateData.impactScale));
    if (updateData.ratingDimensions) updateData.ratingDimensions = JSON.parse(JSON.stringify(updateData.ratingDimensions));
    if (updateData.riskClasses) updateData.riskClasses = JSON.parse(JSON.stringify(updateData.riskClasses));
    if (updateData.acceptanceThresholds !== undefined) {
      updateData.acceptanceThresholds = updateData.acceptanceThresholds
        ? JSON.parse(JSON.stringify(updateData.acceptanceThresholds)) : null;
    }
    if (updateData.escalationThresholds !== undefined) {
      updateData.escalationThresholds = updateData.escalationThresholds
        ? JSON.parse(JSON.stringify(updateData.escalationThresholds)) : null;
    }
    if (updateData.approvalRules !== undefined) {
      updateData.approvalRules = updateData.approvalRules
        ? JSON.parse(JSON.stringify(updateData.approvalRules)) : null;
    }

    const method = await prisma.riskMethod.update({ where: { id }, data: updateData as any });
    return method;
  }

  async delete(id: string) {
    const existing = await prisma.riskMethod.findUnique({ where: { id } });
    if (!existing) throw new AppError('Risk method not found', 404);
    await prisma.riskMethod.update({ where: { id }, data: { isArchived: true } });
    return { success: true };
  }

  async calculateRiskScore(methodId: string, likelihood: number, impact: number): Promise<number> {
    const method = await this.findById(methodId);
    try {
      const formula = method.formula;
      if (formula.includes('likelihood') && formula.includes('impact')) {
        return likelihood * impact;
      } else if (formula.includes('+')) {
        return likelihood + impact;
      }
      return likelihood * impact;
    } catch {
      throw new AppError('Failed to evaluate risk formula', 500);
    }
  }

  // RSK-004: Preview recalculation of existing risks with this method
  async recalculatePreview(methodId: string): Promise<Array<{
    riskId: string; title: string; currentInherentRisk: string; newScore: number; newRiskClass: string;
  }>> {
    const method = await this.findById(methodId);

    let riskClasses: Record<string, unknown> = {};
    try {
      riskClasses = typeof method.riskClasses === 'string'
        ? JSON.parse(method.riskClasses as unknown as string) : method.riskClasses;
    } catch {
      riskClasses = { critical: { min: 16, max: 25 }, high: { min: 9, max: 15 }, medium: { min: 4, max: 8 }, low: { min: 1, max: 3 } };
    }

    const risks = await prisma.risk.findMany({
      where: { isArchived: false },
      select: { id: true, title: true, likelihood: true, impact: true, inherentRisk: true },
      take: 100,
    });

    return risks.map((risk) => ({
      riskId: risk.id,
      title: risk.title,
      currentInherentRisk: risk.inherentRisk,
      newScore: risk.likelihood * risk.impact,
      newRiskClass: this.classifyRisk(risk.likelihood * risk.impact, riskClasses),
    }));
  }

  private classifyRisk(score: number, classes: Record<string, unknown>): string {
    for (const [className, range] of Object.entries(classes)) {
      const r = range as { min?: number; max?: number };
      if ((r.min === undefined || score >= r.min) && (r.max === undefined || score <= r.max)) {
        return className;
      }
    }
    return 'unknown';
  }
}

export const riskMethodService = new RiskMethodService();

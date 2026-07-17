import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface CreateRiskTreatmentData {
  riskId: string;
  treatmentOption: string; // avoid, reduce, transfer, accept
  plannedActions?: string | null;
  responsibleUserId?: string | null;
  budget?: number | null;
  targetDate?: Date | null;
  expectedReduction?: string | null;
  dependencies?: string | null;
  implementationStatus?: string;
  effectivenessReview?: string | null;
  justification?: string | null;
  expiryDate?: Date | null;
}

export interface UpdateRiskTreatmentData extends Partial<CreateRiskTreatmentData> {}

export interface ListRiskTreatmentsQuery {
  page?: string;
  limit?: string;
  riskId?: string;
  treatmentOption?: string;
  implementationStatus?: string;
  responsibleUserId?: string;
}

export class RiskTreatmentService {
  // RSK-021/RSK-023: Validate acceptance treatment requirements
  private validateAcceptance(data: CreateRiskTreatmentData | UpdateRiskTreatmentData): void {
    if (data.treatmentOption === 'accept') {
      if (!data.justification) {
        throw new AppError('Acceptance requires justification', 400);
      }
      if (!data.expiryDate) {
        throw new AppError('Acceptance requires expiry date (cannot be unlimited per RSK-023)', 400);
      }
    }
  }

  // RSK-022: Check if risk value exceeds escalation threshold
  private async checkEscalation(riskId: string): Promise<boolean> {
    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk) return false;

    // Get active risk method for thresholds
    const method = await prisma.riskMethod.findFirst({
      where: { isActive: true },
    });

    if (!method || !method.escalationThresholds) return false;

    try {
      const thresholds = typeof method.escalationThresholds === 'string'
        ? JSON.parse(method.escalationThresholds as unknown as string)
        : method.escalationThresholds;

      // Check if inherent risk score exceeds threshold
      const riskScore = risk.likelihood * risk.impact;
      const escalationThreshold = thresholds.inherentRisk ?? 16; // default: 4x4 matrix, threshold at 16

      return riskScore >= escalationThreshold;
    } catch {
      return false;
    }
  }

  async list(query: ListRiskTreatmentsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.RiskTreatmentWhereInput = {};

    if (query.riskId) {
      where.riskId = query.riskId;
    }

    if (query.treatmentOption) {
      where.treatmentOption = query.treatmentOption;
    }

    if (query.implementationStatus) {
      where.implementationStatus = query.implementationStatus;
    }

    if (query.responsibleUserId) {
      where.responsibleUserId = query.responsibleUserId;
    }

    const [treatments, total] = await Promise.all([
      prisma.riskTreatment.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { risk: true },
      }),
      prisma.riskTreatment.count({ where }),
    ]);

    return {
      data: treatments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const treatment = await prisma.riskTreatment.findUnique({
      where: { id },
      include: { risk: true },
    });

    if (!treatment) {
      throw new AppError('Risk treatment not found', 404);
    }

    return treatment;
  }

  async create(data: CreateRiskTreatmentData, _createdBy?: string) {
    // Validate acceptance requirements (RSK-021/RSK-023)
    this.validateAcceptance(data);

    // Check escalation threshold (RSK-022)
    const needsEscalation = await this.checkEscalation(data.riskId);

    const displayId = `RT-${Date.now()}`;

    const treatment = await prisma.riskTreatment.create({
      data: {
        ...data,
        displayId,
        completionApproval: needsEscalation ? 'escalation_required' : null,
      },
    });

    return treatment;
  }

  async update(id: string, data: UpdateRiskTreatmentData, _updatedBy?: string) {
    const existing = await prisma.riskTreatment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk treatment not found', 404);
    }

    // Validate acceptance requirements (RSK-021/RSK-023)
    if (data.treatmentOption === 'accept' || existing.treatmentOption === 'accept') {
      this.validateAcceptance({ ...existing, ...data } as CreateRiskTreatmentData);
    }

    const treatment = await prisma.riskTreatment.update({
      where: { id },
      data,
    });

    return treatment;
  }

  async delete(id: string) {
    const existing = await prisma.riskTreatment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk treatment not found', 404);
    }

    await prisma.riskTreatment.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  // RSK-021: Approve treatment plan
  async approve(id: string, approvedByUserId: string) {
    const treatment = await prisma.riskTreatment.findUnique({ where: { id } });
    if (!treatment) {
      throw new AppError('Risk treatment not found', 404);
    }

    // For acceptance treatments, verify requirements (RSK-021/RSK-023)
    if (treatment.treatmentOption === 'accept') {
      if (!treatment.justification) {
        throw new AppError('Cannot approve: missing justification', 400);
      }
      if (!treatment.expiryDate) {
        throw new AppError('Cannot approve: missing expiry date (RSK-023)', 400);
      }
    }

    const updated = await prisma.riskTreatment.update({
      where: { id },
      data: {
        approvedByUserId,
        completionApproval: 'approved',
        implementationStatus: 'approved',
      },
    });

    return updated;
  }
}

export const riskTreatmentService = new RiskTreatmentService();

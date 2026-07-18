import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { authorizationService } from './authorization.service';
import { displayIdService } from './displayId.service';

const db = prisma as any;

export interface CreateRiskTreatmentData {
  riskId: string;
  assessmentId?: string | null;
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
  approverId?: string | null;
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

export interface ApprovalData {
  decision?: 'approved' | 'rejected';
  comment?: string | null;
}

export interface EffectivenessReviewData {
  result: string;
  reviewDate: Date;
  reviewerId?: string;
  notes?: string | null;
}

export interface CompleteTreatmentData {
  residualAssessmentId?: string;
  targetAssessment?: {
    riskMethodVersionId?: string;
    likelihood: number;
    impact: number;
    inherentRisk?: string;
    residualRisk?: string;
    targetRisk?: string;
    score?: number;
    assessorId?: string;
    nextReviewDate: Date;
    justification: string;
  };
}

type ApprovalLevel = 'risk_owner' | 'management';

export class RiskTreatmentService {
  private normalizeTreatmentOption(option: string): string {
    if (option === 'mitigate') return 'reduce';
    return option;
  }

  private isMitigation(option: string): boolean {
    const normalized = this.normalizeTreatmentOption(option);
    return normalized === 'reduce' || normalized === 'mitigation';
  }

  private normalizeRiskClass(value?: string | null): string {
    if (!value) return 'low';
    return value === 'very_high' ? 'critical' : value;
  }

  private determineApprovalLevel(assessment: { score: number | null; residualRisk: string; targetRisk: string; inherentRisk: string; likelihood: number; impact: number }): ApprovalLevel {
    const riskClass = this.normalizeRiskClass(assessment.residualRisk || assessment.targetRisk || assessment.inherentRisk);
    const score = assessment.score ?? assessment.likelihood * assessment.impact;
    if (riskClass === 'high' || riskClass === 'critical' || score >= 9) return 'management';
    return 'risk_owner';
  }

  // RSK-021/RSK-023: Validate acceptance treatment requirements
  private validateAcceptance(data: CreateRiskTreatmentData | UpdateRiskTreatmentData): void {
    if (this.normalizeTreatmentOption(data.treatmentOption ?? '') === 'accept') {
      if (!data.justification || data.justification.trim().length === 0) {
        throw new AppError('Acceptance requires justification', 400);
      }
      if (!data.expiryDate) {
        throw new AppError('Acceptance requires expiry date (cannot be unlimited per RSK-023)', 400);
      }
      if (!data.assessmentId) {
        throw new AppError('Acceptance requires a concrete risk assessment version', 400);
      }
    }
  }

  // RSK-022: Check if risk value exceeds escalation threshold
  private async checkEscalation(riskId: string): Promise<boolean> {
    const risk = await db.risk.findUnique({ where: { id: riskId } });
    if (!risk) return false;

    // Get active risk method for thresholds
    const method = await db.riskMethod.findFirst({
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
      db.riskTreatment.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { risk: true },
      }),
      db.riskTreatment.count({ where }),
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
    const treatment = await db.riskTreatment.findUnique({
      where: { id },
      include: { risk: true, acceptance: true, approvals: true, effectivenessReviews: true },
    });

    if (!treatment) {
      throw new AppError('Risk treatment not found', 404);
    }

    return treatment;
  }

  async create(data: CreateRiskTreatmentData, createdBy?: string) {
    if (createdBy) {
      await authorizationService.requireEntityPermission(createdBy, 'risks', 'write', data.riskId);
    }

    const normalizedData = { ...data, treatmentOption: this.normalizeTreatmentOption(data.treatmentOption) };
    // Validate acceptance requirements (RSK-021/RSK-023)
    this.validateAcceptance(normalizedData);

    const risk = await db.risk.findUnique({ where: { id: normalizedData.riskId } });
    if (!risk) throw new AppError('Risk not found', 404);

    let currentAssessment: any = null;
    if (normalizedData.assessmentId) {
      currentAssessment = await db.riskAssessment.findUnique({ where: { id: normalizedData.assessmentId } });
      if (!currentAssessment || currentAssessment.riskId !== normalizedData.riskId) {
        throw new AppError('Risk assessment version not found for this risk', 404);
      }
    }

    if (normalizedData.treatmentOption === 'accept' && !normalizedData.approverId) {
      throw new AppError('Acceptance requires approver', 400);
    }

    // Check escalation threshold (RSK-022)
    const needsEscalation = await this.checkEscalation(normalizedData.riskId);
    const requiredLevel = currentAssessment ? this.determineApprovalLevel(currentAssessment) : (needsEscalation ? 'management' : 'risk_owner');

    const displayId = await displayIdService.nextDisplayIdStandalone(prisma, 'RiskTreatment');

    const treatment = await db.$transaction(async (tx: any) => {
      const created = await tx.riskTreatment.create({
        data: {
          riskId: normalizedData.riskId,
          assessmentId: normalizedData.assessmentId,
          treatmentOption: normalizedData.treatmentOption,
          plannedActions: normalizedData.plannedActions,
          responsibleUserId: normalizedData.responsibleUserId,
          budget: normalizedData.budget,
          targetDate: normalizedData.targetDate,
          expectedReduction: normalizedData.expectedReduction,
          dependencies: normalizedData.dependencies,
          implementationStatus: normalizedData.treatmentOption === 'accept' ? 'approval_pending' : (normalizedData.implementationStatus ?? 'planned'),
          effectivenessReview: normalizedData.effectivenessReview,
          justification: normalizedData.justification,
          expiryDate: normalizedData.expiryDate,
          approvedByUserId: normalizedData.treatmentOption === 'accept' ? normalizedData.approverId : undefined,
          displayId,
          completionApproval: normalizedData.treatmentOption === 'accept' ? requiredLevel : (needsEscalation ? 'escalation_required' : null),
        },
      });

      if (normalizedData.treatmentOption === 'accept') {
        await tx.riskAcceptance.create({
          data: {
            treatmentId: created.id,
            riskId: normalizedData.riskId,
            assessmentId: normalizedData.assessmentId!,
            justification: normalizedData.justification!,
            expiryDate: normalizedData.expiryDate!,
            requestedBy: createdBy ?? normalizedData.responsibleUserId ?? 'system',
            requiredLevel,
          },
        });
      }

      if (createdBy) {
        await auditService.logEvent(tx, {
          userId: createdBy,
          action: normalizedData.treatmentOption === 'accept' ? 'RISK_ACCEPTANCE_REQUEST' : 'RISK_TREATMENT_CREATE',
          entityType: 'RiskTreatment',
          entityId: created.id,
          details: `Created ${normalizedData.treatmentOption} treatment ${displayId} for risk ${risk.displayId}`,
        });
      }
      return created;
    });

    return treatment;
  }

  async update(id: string, data: UpdateRiskTreatmentData, updatedBy?: string) {
    const existing = await db.riskTreatment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk treatment not found', 404);
    }

    if (updatedBy) {
      await authorizationService.requireEntityPermission(updatedBy, 'risks', 'write', existing.riskId);
    }

    const normalizedData = data.treatmentOption ? { ...data, treatmentOption: this.normalizeTreatmentOption(data.treatmentOption) } : data;
    // Validate acceptance requirements (RSK-021/RSK-023)
    if (normalizedData.treatmentOption === 'accept' || existing.treatmentOption === 'accept') {
      this.validateAcceptance({ ...existing, ...normalizedData } as CreateRiskTreatmentData);
    }

    const treatment = await db.riskTreatment.update({
      where: { id },
      data: normalizedData,
    });

    if (updatedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'RISK_TREATMENT_UPDATE',
        entityType: 'RiskTreatment',
        entityId: id,
        details: `Updated risk treatment ${existing.displayId}`,
      });
    }

    return treatment;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await db.riskTreatment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk treatment not found', 404);
    }

    if (deletedBy) {
      await authorizationService.requireEntityPermission(deletedBy, 'risks', 'delete', existing.riskId);
    }

    await db.riskTreatment.update({
      where: { id },
      data: { isArchived: true },
    });

    if (deletedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: deletedBy,
        action: 'RISK_TREATMENT_DELETE',
        entityType: 'RiskTreatment',
        entityId: id,
        details: `Archived risk treatment ${existing.displayId}`,
      });
    }

    return { success: true };
  }

  // RSK-021: Approve treatment plan
  async approve(id: string, approvedByUserId: string, data: ApprovalData = {}) {
    const treatment = await db.riskTreatment.findUnique({
      where: { id },
      include: { risk: true, acceptance: true },
    });
    if (!treatment) {
      throw new AppError('Risk treatment not found', 404);
    }

    await authorizationService.requireEntityPermission(approvedByUserId, 'risks', 'write', treatment.riskId);

    const decision = data.decision ?? 'approved';
    if (!['approved', 'rejected'].includes(decision)) throw new AppError('Invalid approval decision', 400);

    // For acceptance treatments, verify requirements (RSK-021/RSK-023)
    if (treatment.treatmentOption === 'accept') {
      if (!treatment.justification) {
        throw new AppError('Cannot approve: missing justification', 400);
      }
      if (!treatment.expiryDate) {
        throw new AppError('Cannot approve: missing expiry date (RSK-023)', 400);
      }
      if (!treatment.acceptance) {
        throw new AppError('Cannot approve: missing formal acceptance workflow', 400);
      }
      if (treatment.approvedByUserId && treatment.approvedByUserId !== approvedByUserId) {
        throw new AppError('Only the designated approver may approve this acceptance', 403);
      }

      const assessment = await db.riskAssessment.findUnique({ where: { id: treatment.acceptance.assessmentId } });
      if (!assessment) throw new AppError('Cannot approve: referenced assessment not found', 404);

      const requiredLevel = treatment.acceptance.requiredLevel as ApprovalLevel;
      if (requiredLevel === 'risk_owner') {
        if (approvedByUserId !== treatment.risk.riskOwnerId) {
          throw new AppError('Low/medium risk acceptance requires risk owner approval', 403);
        }
      } else {
        if (approvedByUserId === assessment.assessorId) {
          throw new AppError('High/critical risk acceptance requires independent approver; approver must differ from assessor', 403);
        }
        await authorizationService.requireAdminAccess(approvedByUserId);
      }
    }

    const updated = await db.$transaction(async (tx: any) => {
      await tx.riskTreatmentApproval.create({
        data: {
          treatmentId: id,
          approverId: approvedByUserId,
          approvalLevel: treatment.acceptance?.requiredLevel ?? 'management',
          decision,
          comment: data.comment,
        },
      });

      if (treatment.treatmentOption === 'accept') {
        await tx.riskAcceptance.update({
          where: { treatmentId: id },
          data: {
            status: decision,
            approvedBy: decision === 'approved' ? approvedByUserId : null,
            approvedAt: decision === 'approved' ? new Date() : null,
            rejectionReason: decision === 'rejected' ? data.comment : null,
          },
        });
      }

      const next = await tx.riskTreatment.update({
        where: { id },
        data: {
          approvedByUserId: decision === 'approved' ? approvedByUserId : null,
          completionApproval: decision,
          implementationStatus: decision === 'approved' ? 'approved' : 'rejected',
        },
      });

      if (treatment.treatmentOption === 'accept' && decision === 'approved') {
        await tx.risk.update({
          where: { id: treatment.riskId },
          data: { status: 'accepted', updatedBy: approvedByUserId },
        });
      }

      await auditService.logEvent(tx, {
        userId: approvedByUserId,
        action: treatment.treatmentOption === 'accept' ? (decision === 'approved' ? 'RISK_ACCEPTANCE_APPROVE' : 'RISK_ACCEPTANCE_REJECT') : 'RISK_TREATMENT_APPROVE',
        entityType: 'RiskTreatment',
        entityId: id,
        details: `${decision} treatment ${treatment.displayId}`,
      });
      return next;
    });

    return updated;
  }

  async recordEffectivenessReview(id: string, data: EffectivenessReviewData, userId: string) {
    const treatment = await db.riskTreatment.findUnique({ where: { id } });
    if (!treatment) throw new AppError('Risk treatment not found', 404);
    await authorizationService.requireEntityPermission(userId, 'risks', 'write', treatment.riskId);

    if (!data.result || data.result.trim().length === 0) throw new AppError('Effectiveness review result is required', 400);
    if (!data.reviewDate) throw new AppError('Effectiveness review date is required', 400);
    const reviewerId = data.reviewerId ?? userId;

    const review = await db.$transaction(async (tx: any) => {
      const created = await tx.riskTreatmentEffectivenessReview.create({
        data: {
          treatmentId: id,
          result: data.result,
          reviewDate: data.reviewDate,
          reviewerId,
          notes: data.notes,
        },
      });
      await tx.riskTreatment.update({
        where: { id },
        data: { effectivenessReview: `${data.result} (${data.reviewDate.toISOString()})` },
      });
      await auditService.logEvent(tx, {
        userId,
        action: 'RISK_TREATMENT_EFFECTIVENESS_REVIEW',
        entityType: 'RiskTreatmentEffectivenessReview',
        entityId: created.id,
        details: `Recorded effectiveness review for treatment ${treatment.displayId}`,
      });
      return created;
    });
    return review;
  }

  async complete(id: string, data: CompleteTreatmentData, userId: string) {
    const treatment = await db.riskTreatment.findUnique({
      where: { id },
      include: { risk: true, effectivenessReviews: true },
    });
    if (!treatment) throw new AppError('Risk treatment not found', 404);
    await authorizationService.requireEntityPermission(userId, 'risks', 'write', treatment.riskId);

    if (this.isMitigation(treatment.treatmentOption) && treatment.effectivenessReviews.length === 0) {
      throw new AppError('Mitigation treatment cannot be completed without effectiveness review', 400);
    }

    if (!data.residualAssessmentId && !data.targetAssessment) {
      throw new AppError('Treatment completion requires residual/target assessment confirmation or creation', 400);
    }

    const result = await db.$transaction(async (tx: any) => {
      let assessmentId = data.residualAssessmentId;
      if (assessmentId) {
        const assessment = await tx.riskAssessment.findUnique({ where: { id: assessmentId } });
        if (!assessment || assessment.riskId !== treatment.riskId) {
          throw new AppError('Residual assessment not found for this risk', 404);
        }
      } else if (data.targetAssessment) {
        if (!data.targetAssessment.justification || data.targetAssessment.justification.trim().length === 0) {
          throw new AppError('Target assessment justification is mandatory', 400);
        }
        const methodVersionId = data.targetAssessment.riskMethodVersionId ?? treatment.risk.riskMethodVersionId;
        if (!methodVersionId) throw new AppError('Target assessment requires risk method version', 400);
        const maxAssessment = await tx.riskAssessment.findFirst({
          where: { riskId: treatment.riskId },
          orderBy: { assessmentNumber: 'desc' },
          select: { assessmentNumber: true },
        });
        await tx.riskAssessment.updateMany({
          where: { riskId: treatment.riskId, assessmentType: 'target', isCurrent: true },
          data: { isCurrent: false },
        });
        const created = await tx.riskAssessment.create({
          data: {
            riskId: treatment.riskId,
            riskMethodVersionId: methodVersionId,
            assessmentNumber: (maxAssessment?.assessmentNumber ?? 0) + 1,
            assessmentType: 'target',
            likelihood: data.targetAssessment.likelihood,
            impact: data.targetAssessment.impact,
            inherentRisk: data.targetAssessment.inherentRisk ?? treatment.risk.inherentRisk,
            residualRisk: data.targetAssessment.residualRisk ?? data.targetAssessment.targetRisk ?? treatment.risk.residualRisk,
            targetRisk: data.targetAssessment.targetRisk ?? data.targetAssessment.residualRisk ?? treatment.risk.targetRisk,
            score: data.targetAssessment.score ?? data.targetAssessment.likelihood * data.targetAssessment.impact,
            assessorId: data.targetAssessment.assessorId ?? userId,
            nextReviewDate: data.targetAssessment.nextReviewDate,
            justification: data.targetAssessment.justification,
            isCurrent: true,
          },
        });
        assessmentId = created.id;
      }

      const updated = await tx.riskTreatment.update({
        where: { id },
        data: {
          implementationStatus: 'completed',
          completedAt: new Date(),
          completedBy: userId,
          residualAssessmentId: assessmentId,
        },
      });
      await tx.risk.update({ where: { id: treatment.riskId }, data: { status: 'closed', updatedBy: userId } });
      await auditService.logEvent(tx, {
        userId,
        action: 'RISK_TREATMENT_COMPLETE',
        entityType: 'RiskTreatment',
        entityId: id,
        details: `Completed treatment ${treatment.displayId} with residual assessment ${assessmentId}`,
      });
      return updated;
    });

    return result;
  }
}

export const riskTreatmentService = new RiskTreatmentService();


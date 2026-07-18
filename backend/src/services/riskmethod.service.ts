import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

// ==========================================
// Safe Calculation Types
// ==========================================

export type CalculationType = 'product' | 'sum' | 'max' | 'matrix';

export interface RiskClassRange {
  min?: number;
  max?: number;
}

export interface RiskClassDefinition {
  [className: string]: RiskClassRange;
}

export interface ScaleLevel {
  value: number;
  label: string;
  description?: string;
}

export interface LikelihoodScale {
  levels: ScaleLevel[];
}

export interface ImpactScale {
  levels: ScaleLevel[];
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// ==========================================
// DTOs
// ==========================================

export interface CreateRiskMethodData {
  name: string;
  description?: string | null;
  version: string;
  likelihoodScale: Record<string, unknown>;
  impactScale: Record<string, unknown>;
  ratingDimensions: Record<string, unknown>;
  calculationType?: CalculationType;
  formulaExpression?: string | null;
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

export interface RecalculatePreviewInput {
  riskIds?: string[];
  likelihoodOverrides?: Record<string, number>;
  impactOverrides?: Record<string, number>;
}

export interface RecalculatePreviewResult {
  riskId: string;
  title: string;
  currentAssessmentNumber: number;
  currentInherentRisk: string;
  currentScore: number | null;
  newScore: number;
  newRiskClass: string;
}

export interface ConfirmRecalculationInput {
  riskMethodVersionId: string;
  assessorId: string;
  justification?: string;
  nextReviewDate?: Date;
}

// ==========================================
// Safe Calculation Engine
// ==========================================

class SafeCalculationEngine {
  /**
   * Calculate risk score using a safe, validated calculation type.
   * No eval(), Function(), or dynamic evaluation is used.
   */
  static calculate(calculationType: string, likelihood: number, impact: number): number {
    switch (calculationType) {
      case 'product':
        return likelihood * impact;
      case 'sum':
        return likelihood + impact;
      case 'max':
        return Math.max(likelihood, impact);
      case 'matrix':
        // Matrix calculation uses product as default for 2D matrix lookup
        return likelihood * impact;
      default:
        throw new AppError(`Unsupported calculation type: ${calculationType}. Allowed: product, sum, max, matrix`, 400);
    }
  }

  /**
   * Classify a risk score into a risk class based on method version thresholds.
   */
  static classifyRisk(score: number, classes: Record<string, unknown>): string {
    for (const [className, range] of Object.entries(classes)) {
      const r = range as RiskClassRange;
      if ((r.min === undefined || score >= r.min) && (r.max === undefined || score <= r.max)) {
        return className;
      }
    }
    return 'unknown';
  }

  /**
   * Validate that likelihood and impact values are within the allowed scale ranges.
   */
  static validateInputs(
    likelihood: number,
    impact: number,
    likelihoodScale: Record<string, unknown>,
    impactScale: Record<string, unknown>,
  ): void {
    const lLevels = this.extractScaleValues(likelihoodScale);
    const iLevels = this.extractScaleValues(impactScale);

    if (lLevels.length > 0) {
      const minL = Math.min(...lLevels);
      const maxL = Math.max(...lLevels);
      if (likelihood < minL || likelihood > maxL) {
        throw new AppError(`Likelihood ${likelihood} out of scale range [${minL}, ${maxL}]`, 400);
      }
    }

    if (iLevels.length > 0) {
      const minI = Math.min(...iLevels);
      const maxI = Math.max(...iLevels);
      if (impact < minI || impact > maxI) {
        throw new AppError(`Impact ${impact} out of scale range [${minI}, ${maxI}]`, 400);
      }
    }
  }

  private static extractScaleValues(scale: Record<string, unknown>): number[] {
    const levels = (scale as any).levels;
    if (Array.isArray(levels)) {
      return levels
        .map((l: any) => typeof l === 'number' ? l : l.value ?? l)
        .filter((v: any) => typeof v === 'number');
    }
    if (Array.isArray(scale)) {
      return scale.filter((v: any) => typeof v === 'number') as number[];
    }
    return [];
  }
}

// ==========================================
// RiskMethodService
// ==========================================

export class RiskMethodService {
  // ---- CRUD for RiskMethod (the editable definition) ----

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

    if (query.isActive !== undefined && query.isActive !== '') {
      where.isActive = query.isActive === 'true';
    }

    const [methods, total] = await Promise.all([
      prisma.riskMethod.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { versions: true } } },
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

  async create(data: CreateRiskMethodData, createdBy?: string) {
    const displayId = `RM-${Date.now()}`;
    const calculationType = data.calculationType || 'product';

    // Validate calculation type
    if (!['product', 'sum', 'max', 'matrix'].includes(calculationType)) {
      throw new AppError(`Invalid calculation type: ${calculationType}`, 400);
    }

    const method = await prisma.$transaction(async (tx) => {
      if (data.isActive) {
        await tx.riskMethod.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      return tx.riskMethod.create({
        data: {
          displayId,
          name: data.name,
          description: data.description ?? null,
          version: data.version,
          likelihoodScale: JSON.parse(JSON.stringify(data.likelihoodScale)),
          impactScale: JSON.parse(JSON.stringify(data.impactScale)),
          ratingDimensions: JSON.parse(JSON.stringify(data.ratingDimensions)),
          calculationType,
          formulaExpression: data.formulaExpression ?? null,
          riskClasses: JSON.parse(JSON.stringify(data.riskClasses)),
          acceptanceThresholds: data.acceptanceThresholds
            ? JSON.parse(JSON.stringify(data.acceptanceThresholds)) : null,
          escalationThresholds: data.escalationThresholds
            ? JSON.parse(JSON.stringify(data.escalationThresholds)) : null,
          approvalRules: data.approvalRules
            ? JSON.parse(JSON.stringify(data.approvalRules)) : null,
          reviewInterval: data.reviewInterval ?? null,
          isActive: data.isActive ?? false,
        },
      });
    });

    // Create initial snapshot version automatically from the just-created method.
    await this.createVersionFromMethod(method);

    // Audit log
    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'CONFIG_CHANGE',
        entityType: 'RiskMethod',
        entityId: method.id,
        details: `Created risk method "${method.name}" v${method.version}`,
      });
    }

    return method;
  }

  async update(id: string, data: UpdateRiskMethodData, updatedBy?: string) {
    const existing = await prisma.riskMethod.findUnique({ where: { id } });
    if (!existing) throw new AppError('Risk method not found', 404);

    // Validate calculation type if provided
    if (data.calculationType && !['product', 'sum', 'max', 'matrix'].includes(data.calculationType)) {
      throw new AppError(`Invalid calculation type: ${data.calculationType}`, 400);
    }

    // If activating, deactivate others
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

    // Creating a new snapshot version when substantive fields change
    const substantiveFields = ['likelihoodScale', 'impactScale', 'ratingDimensions', 'calculationType', 'riskClasses'];
    const hasSubstantiveChange = substantiveFields.some(field => data[field as keyof UpdateRiskMethodData] !== undefined);

    if (hasSubstantiveChange) {
      await this.createVersion(method.id);
    }

    // Audit log
    if (updatedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'CONFIG_CHANGE',
        entityType: 'RiskMethod',
        entityId: method.id,
        details: `Updated risk method "${method.name}"`,
        oldValue: { name: existing.name, version: existing.version },
        newValue: { name: method.name, version: method.version },
      });
    }

    return method;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await prisma.riskMethod.findUnique({ where: { id } });
    if (!existing) throw new AppError('Risk method not found', 404);

    // Check if any versions are immutable (referenced by assessments)
    const immutableVersions = await prisma.riskMethodVersion.count({
      where: { riskMethodId: id, isImmutable: true },
    });

    if (immutableVersions > 0) {
      throw new AppError('Cannot delete risk method with referenced versions. Archive instead.', 409);
    }

    await prisma.riskMethod.update({ where: { id }, data: { isArchived: true } });

    // Audit log
    if (deletedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: deletedBy,
        action: 'CONFIG_CHANGE',
        entityType: 'RiskMethod',
        entityId: id,
        details: `Archived risk method "${existing.name}"`,
      });
    }

    return { success: true };
  }

  // ---- Version Management ----

  /**
   * Create a new immutable snapshot version of the current RiskMethod.
   * This is called when the method definition changes and we need to preserve history.
   */
  async createVersion(riskMethodId: string): Promise<any> {
    const method = await this.findById(riskMethodId);
    return this.createVersionFromMethod(method);
  }

  private async createVersionFromMethod(method: Awaited<ReturnType<RiskMethodService['findById']>>): Promise<any> {
    // Count existing versions to generate sequential tag
    const versionCount = await prisma.riskMethodVersion.count({
      where: { riskMethodId: method.id },
    });

    const versionTag = `${method.version}-snapshot-${versionCount + 1}`;
    const calculationType = (method as any).calculationType || 'product';

    const version = await prisma.riskMethodVersion.create({
      data: {
        riskMethodId: method.id,
        versionTag,
        likelihoodScale: JSON.parse(JSON.stringify(method.likelihoodScale)),
        impactScale: JSON.parse(JSON.stringify(method.impactScale)),
        ratingDimensions: JSON.parse(JSON.stringify(method.ratingDimensions)),
        calculationType,
        formulaExpression: (method as any).formulaExpression ?? null,
        riskClasses: JSON.parse(JSON.stringify(method.riskClasses)),
      },
    });

    return version;
  }

  /**
   * Get a specific method version by ID.
   */
  async findVersion(versionId: string) {
    const version = await prisma.riskMethodVersion.findUnique({
      where: { id: versionId },
      include: { riskMethod: true },
    });
    if (!version) throw new AppError('Risk method version not found', 404);
    return version;
  }

  /**
   * List all versions for a given RiskMethod.
   */
  async listVersions(riskMethodId: string) {
    await this.findById(riskMethodId); // validate existence

    const versions = await prisma.riskMethodVersion.findMany({
      where: { riskMethodId },
      orderBy: { createdAt: 'asc' },
    });

    return versions;
  }

  /**
   * Attempt to update a version — fails if immutable.
   * This enforces the immutability contract.
   */
  async updateVersion(_versionId: string, _data: Record<string, unknown>): Promise<never> {
    throw new AppError('Risk method versions are immutable. Create a new version instead.', 409);
  }

  /**
   * Mark a version as immutable (called automatically when first assessment references it).
   */
  async markVersionImmutable(versionId: string): Promise<void> {
    await prisma.riskMethodVersion.update({
      where: { id: versionId },
      data: { isImmutable: true },
    });
  }

  // ---- Safe Risk Calculation ----

  /**
   * Calculate risk score using a safe calculation engine.
   * Uses the method version's calculation type and validates inputs against scales.
   */
  async calculateRiskScore(
    versionId: string,
    likelihood: number,
    impact: number,
  ): Promise<{ score: number; riskClass: string }> {
    const version = await this.findVersion(versionId);

    // Validate inputs against scale ranges
    SafeCalculationEngine.validateInputs(likelihood, impact, jsonRecord(version.likelihoodScale), jsonRecord(version.impactScale));

    const calculationType = version.calculationType || 'product';
    const score = SafeCalculationEngine.calculate(calculationType, likelihood, impact);
    const riskClass = SafeCalculationEngine.classifyRisk(score, jsonRecord(version.riskClasses));

    return { score, riskClass };
  }

  // ---- Recalculation Preview (RSK-004) ----

  /**
   * Preview recalculation with a new method version WITHOUT persisting any changes.
   * This is a read-only operation that shows what the results would be.
   */
  async recalculatePreview(
    targetVersionId: string,
    input?: RecalculatePreviewInput,
  ): Promise<RecalculatePreviewResult[]> {
    const targetVersion = await this.findVersion(targetVersionId);

    // Determine which risks to preview
    let where: Prisma.RiskWhereInput = { isArchived: false };
    if (input?.riskIds && input.riskIds.length > 0) {
      where.id = { in: input.riskIds };
    }

    const risks = await prisma.risk.findMany({
      where,
      select: {
        id: true,
        title: true,
        likelihood: true,
        impact: true,
        inherentRisk: true,
        riskMethodVersionId: true,
        RiskAssessment: {
          where: { isCurrent: true },
          select: { assessmentNumber: true, score: true },
          take: 1,
        },
      },
      take: 500,
    });

    const calculationType = targetVersion.calculationType || 'product';

    return risks.map((risk) => {
      const likelihood = input?.likelihoodOverrides?.[risk.id] ?? risk.likelihood;
      const impact = input?.impactOverrides?.[risk.id] ?? risk.impact;

      const currentAssessments = risk.RiskAssessment ?? (risk as any).assessments ?? [];
      const newScore = SafeCalculationEngine.calculate(calculationType, likelihood, impact);
      const newRiskClass = SafeCalculationEngine.classifyRisk(newScore, jsonRecord(targetVersion.riskClasses));

      return {
        riskId: risk.id,
        title: risk.title,
        currentAssessmentNumber: currentAssessments[0]?.assessmentNumber ?? 0,
        currentInherentRisk: risk.inherentRisk ?? 'unknown',
        currentScore: currentAssessments[0]?.score ?? null,
        newScore,
        newRiskClass,
      };
    });
  }

  // ---- Confirmed Recalculation (creates new Assessment version) ----

  /**
   * Confirm recalculation: creates a new RiskAssessment with the target method version.
   * Does NOT modify historical assessments — appends a new version.
   */
  async confirmRecalculation(
    riskId: string,
    input: ConfirmRecalculationInput,
    userId?: string,
  ): Promise<any> {
    // Validate risk exists
    const risk = await prisma.risk.findUnique({
      where: { id: riskId },
      include: {
        RiskAssessment: {
          where: { isCurrent: true },
          orderBy: { assessmentNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!risk) throw new AppError('Risk not found', 404);

    // Validate target version exists and get calculation details
    const targetVersion = await this.findVersion(input.riskMethodVersionId);

    // Calculate new score using safe engine
    const likelihood = risk.likelihood;
    const impact = risk.impact;
    const { score, riskClass } = await this.calculateRiskScore(
      input.riskMethodVersionId,
      likelihood,
      impact,
    );

    // Determine next assessment number
    const currentAssessments = risk.RiskAssessment ?? (risk as any).assessments ?? [];
    const currentAssessment = currentAssessments[0];
    const newAssessmentNumber = (currentAssessment?.assessmentNumber ?? 0) + 1;

    const nextReviewDate = input.nextReviewDate || this.calculateNextReviewDate(targetVersion);

    // Create new assessment in a transaction
    const newAssessment = await prisma.$transaction(async (tx) => {
      // Mark current assessment as no longer current
      if (currentAssessment) {
        await tx.riskAssessment.update({
          where: { id: currentAssessment.id },
          data: { isCurrent: false },
        });
      }

      // Create new assessment with new method version
      const assessment = await tx.riskAssessment.create({
        data: {
          riskId,
          riskMethodVersionId: input.riskMethodVersionId,
          assessmentNumber: newAssessmentNumber,
          likelihood,
          impact,
          inherentRisk: riskClass,
          residualRisk: risk.residualRisk,
          targetRisk: risk.targetRisk,
          score,
          assessorId: input.assessorId,
          nextReviewDate,
          justification: input.justification ?? 'Risk recalculated due to risk method version change.',
          isCurrent: true,
        },
      });

      // Update risk to point to new method version
      await tx.risk.update({
        where: { id: riskId },
        data: {
          riskMethodVersionId: input.riskMethodVersionId,
          inherentRisk: riskClass,
          nextReviewDate,
          evaluationJustification: input.justification ?? risk.evaluationJustification,
        },
      });

      // Mark version as immutable (now referenced by an assessment)
      const existingRefs = await tx.riskAssessment.count({
        where: { riskMethodVersionId: input.riskMethodVersionId },
      });
      if (existingRefs > 0) {
        await tx.riskMethodVersion.update({
          where: { id: input.riskMethodVersionId },
          data: { isImmutable: true },
        });
      }

      return assessment;
    });

    // Audit log
    if (userId) {
      await auditService.logEventStandalone(prisma, {
        userId,
        action: 'RISK_UPDATE',
        entityType: 'RiskAssessment',
        entityId: newAssessment.id,
        details: `Recalculated risk "${risk.title}" with method version ${targetVersion.versionTag} (assessment #${newAssessmentNumber})`,
        oldValue: {
          assessmentNumber: currentAssessment?.assessmentNumber,
          riskMethodVersionId: risk.riskMethodVersionId,
          inherentRisk: risk.inherentRisk,
        },
        newValue: {
          assessmentNumber: newAssessmentNumber,
          riskMethodVersionId: input.riskMethodVersionId,
          inherentRisk: riskClass,
          score,
        },
      });
    }

    return newAssessment;
  }

  /**
   * Bulk recalculation for multiple risks.
   */
  async bulkConfirmRecalculation(
    riskIds: string[],
    input: ConfirmRecalculationInput,
    userId?: string,
  ): Promise<{ success: number; failures: Array<{ riskId: string; error: string }> }> {
    const results = { success: 0, failures: [] as Array<{ riskId: string; error: string }> };

    for (const riskId of riskIds) {
      try {
        await this.confirmRecalculation(riskId, input, userId);
        results.success++;
      } catch (error: any) {
        results.failures.push({
          riskId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  // ---- Legacy compatibility methods ----

  /**
   * Legacy calculateRiskScore — uses method ID and finds latest version.
   * Deprecated in favor of version-based calculation.
   */
  async calculateRiskScoreLegacy(methodId: string, likelihood: number, impact: number): Promise<number> {
    const method = await this.findById(methodId);
    const calculationType = (method as any).calculationType || 'product';
    return SafeCalculationEngine.calculate(calculationType, likelihood, impact);
  }

  /**
   * Legacy recalculatePreview — uses method ID and finds latest version.
   */
  async recalculatePreviewLegacy(methodId: string): Promise<RecalculatePreviewResult[]> {
    const latestVersion = await prisma.riskMethodVersion.findFirst({
      where: { riskMethodId: methodId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestVersion) {
      throw new AppError('No versions found for this risk method. Create a version first.', 404);
    }

    return this.recalculatePreview(latestVersion.id);
  }

  private calculateNextReviewDate(_version: any): Date {
    // Default: 1 year if no interval specified
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }
}

export const riskMethodService = new RiskMethodService();

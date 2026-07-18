import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { displayIdService } from './displayId.service';

// ==========================================
// Interfaces
// ==========================================

export interface CreateRiskData {
  title: string;
  description: string;
  organizationUnitId?: string;
  // Relational building blocks
  scenarioId?: string;
  threatId?: string;
  vulnerabilityId?: string;
  causeIds?: string[];
  impactIds?: string[];
  // Asset/Process/Service junction relations
  assetIds?: string[];
  processIds?: string[];
  serviceIds?: string[];
  // Assessment data
  riskMethodVersionId?: string;
  likelihood: number;
  impact: number;
  assessorId: string;
  riskOwnerId: string;
  nextReviewDate: Date;
  justification: string;
}

export interface UpdateRiskData extends Partial<CreateRiskData> {
  status?: string;
  assessmentType?: 'inherent' | 'current' | 'target';
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

export interface CreateAssessmentData {
  riskId: string;
  riskMethodVersionId: string;
  assessmentType: 'inherent' | 'current' | 'target';
  likelihood: number;
  impact: number;
  inherentRisk: string;
  residualRisk: string;
  targetRisk: string;
  score?: number;
  assessorId: string;
  nextReviewDate: Date;
  justification: string;
}

export interface CreateReviewTaskData {
  riskId: string;
  scheduledDate: Date;
  dueDate: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  triggerType?: 'scheduled' | 'unplanned_event' | 'ad_hoc';
  triggerEventId?: string;
  triggerSource?: string;
  notes?: string;
}

type ReviewTaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

// ==========================================
// RiskService
// ==========================================

export class RiskService {
  /**
   * List risks with pagination and filters.
   */
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
          scenario: {
            include: {
              threat: true,
              vulnerability: true,
            },
          },
          threat: true,
          vulnerability: true,
          causes: { include: { cause: true } },
          impacts: { include: { impact: true } },
          riskAssets: { include: { asset: true } },
          processLinks: { include: { process: true } },
          serviceLinks: { include: { service: true } },
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

  /**
   * Get a single risk by ID with full relations.
   */
  async getById(id: string) {
    const risk = await prisma.risk.findUnique({
      where: { id },
      include: {
        organizationUnit: true,
        scenario: {
          include: {
            threat: true,
            vulnerability: true,
          },
        },
        threat: true,
        vulnerability: true,
        causes: { include: { cause: true } },
        impacts: { include: { impact: true } },
        riskAssets: { include: { asset: true } },
        processLinks: { include: { process: true } },
        serviceLinks: { include: { service: true } },
        evidenceLinks: { include: { evidence: true } },
        treatments: true,
        reviewTasks: true,
        RiskAssessment: {
          orderBy: { assessmentNumber: 'desc' },
        },
        riskMethodVersion: true,
      },
    });

    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    return risk;
  }

  /**
   * Create a new risk with relational building blocks and junction table links.
   * Creates an initial assessment snapshot automatically.
   */
  async create(data: CreateRiskData, createdBy?: string) {
    const displayId = await displayIdService.nextDisplayIdStandalone(prisma, 'Risk');
    const inherentRisk = this.calculateRiskLevel(data.likelihood, data.impact);

    // Validate scenario references if provided
    if (data.scenarioId) {
      const scenario = await prisma.riskScenario.findUnique({ where: { id: data.scenarioId } });
      if (!scenario) {
        throw new AppError('Scenario not found', 404);
      }
    }

    // Validate threat reference if provided
    if (data.threatId) {
      const threat = await prisma.threat.findUnique({ where: { id: data.threatId } });
      if (!threat) {
        throw new AppError('Threat not found', 404);
      }
    }

    // Validate vulnerability reference if provided
    if (data.vulnerabilityId) {
      const vuln = await prisma.vulnerability.findUnique({ where: { id: data.vulnerabilityId } });
      if (!vuln) {
        throw new AppError('Vulnerability not found', 404);
      }
    }

    // Validate cause IDs if provided
    if (data.causeIds && data.causeIds.length > 0) {
      const causes = await prisma.riskCause.findMany({
        where: { id: { in: data.causeIds } },
        select: { id: true },
      });
      if (causes.length !== data.causeIds.length) {
        throw new AppError('One or more cause IDs not found', 404);
      }
    }

    // Validate impact IDs if provided
    if (data.impactIds && data.impactIds.length > 0) {
      const impacts = await prisma.riskImpact.findMany({
        where: { id: { in: data.impactIds } },
        select: { id: true },
      });
      if (impacts.length !== data.impactIds.length) {
        throw new AppError('One or more impact IDs not found', 404);
      }
    }

    // Validate method version if provided
    if (data.riskMethodVersionId) {
      const version = await prisma.riskMethodVersion.findUnique({ where: { id: data.riskMethodVersionId } });
      if (!version) {
        throw new AppError('Risk method version not found', 404);
      }
    }

    // Use a transaction to create risk, junction links, and initial assessment atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create the Risk entity
      const risk = await tx.risk.create({
        data: {
          displayId,
          title: data.title,
          description: data.description,
          organizationUnitId: data.organizationUnitId,
          scenarioId: data.scenarioId,
          threatId: data.threatId,
          vulnerabilityId: data.vulnerabilityId,
          possibleImpact: data.description,
          likelihood: data.likelihood,
          impact: data.impact,
          inherentRisk,
          residualRisk: inherentRisk,
          targetRisk: inherentRisk,
          riskOwnerId: data.riskOwnerId,
          assessorId: data.assessorId,
          nextReviewDate: data.nextReviewDate,
          evaluationJustification: data.justification,
          riskMethodVersionId: data.riskMethodVersionId,
          status: 'identified',
          createdBy,
        },
      });

      // Create junction links for assets
      if (data.assetIds && data.assetIds.length > 0) {
        await tx.riskAsset.createMany({
          data: data.assetIds.map(assetId => ({ riskId: risk.id, assetId })),
          skipDuplicates: true,
        });
      }

      // Create junction links for processes
      if (data.processIds && data.processIds.length > 0) {
        await tx.riskProcess.createMany({
          data: data.processIds.map(processId => ({ riskId: risk.id, processId })),
          skipDuplicates: true,
        });
      }

      // Create junction links for services
      if (data.serviceIds && data.serviceIds.length > 0) {
        await tx.riskService.createMany({
          data: data.serviceIds.map(serviceId => ({ riskId: risk.id, serviceId })),
          skipDuplicates: true,
        });
      }

      // Create cause links
      if (data.causeIds && data.causeIds.length > 0) {
        await tx.riskCauseLink.createMany({
          data: data.causeIds.map(causeId => ({ riskId: risk.id, causeId })),
          skipDuplicates: true,
        });
      }

      // Create impact links
      if (data.impactIds && data.impactIds.length > 0) {
        await tx.riskImpactLink.createMany({
          data: data.impactIds.map(impactId => ({ riskId: risk.id, impactId })),
          skipDuplicates: true,
        });
      }

      // Create initial assessment snapshot (type = current)
      if (data.riskMethodVersionId) {
        await tx.riskAssessment.create({
          data: {
            riskId: risk.id,
            riskMethodVersionId: data.riskMethodVersionId,
            assessmentNumber: 1,
            assessmentType: 'current',
            likelihood: data.likelihood,
            impact: data.impact,
            inherentRisk,
            residualRisk: inherentRisk,
            targetRisk: inherentRisk,
            assessorId: data.assessorId,
            nextReviewDate: data.nextReviewDate,
            justification: data.justification,
            isCurrent: true,
          },
        });

        // Mark method version as immutable once referenced
        await tx.riskMethodVersion.update({
          where: { id: data.riskMethodVersionId },
          data: { isImmutable: true },
        });
      }

      return risk;
    });

    // Audit log for risk creation
    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'RISK_CREATE',
        entityType: 'Risk',
        entityId: result.id,
        details: `Created risk: ${data.title} (${displayId})`,
      });
    }

    return this.getById(result.id);
  }

  /**
   * Update an existing risk. Changes to assessment values create a new assessment snapshot.
   */
  async update(id: string, data: UpdateRiskData, updatedBy?: string) {
    const existing = await prisma.risk.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Risk not found', 404);
    }

    // Determine if assessment values changed
    const assessmentChanged =
      data.likelihood !== undefined ||
      data.impact !== undefined ||
      data.justification !== undefined;

    const result = await prisma.$transaction(async (tx) => {
      let newInherentRisk = existing.inherentRisk;
      if (data.likelihood !== undefined && data.impact !== undefined) {
        newInherentRisk = this.calculateRiskLevel(data.likelihood, data.impact);
      }

      // Build update payload
      const updateData: Prisma.RiskUpdateInput = {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.organizationUnitId !== undefined && { organizationUnitId: data.organizationUnitId }),
        ...(data.scenarioId !== undefined && { scenarioId: data.scenarioId }),
        ...(data.threatId !== undefined && { threatId: data.threatId }),
        ...(data.vulnerabilityId !== undefined && { vulnerabilityId: data.vulnerabilityId }),
        ...(data.likelihood !== undefined && { likelihood: data.likelihood }),
        ...(data.impact !== undefined && { impact: data.impact }),
        ...(data.likelihood !== undefined || data.impact !== undefined ? { inherentRisk: newInherentRisk } : {}),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.nextReviewDate !== undefined && { nextReviewDate: data.nextReviewDate }),
        ...(data.justification !== undefined && { evaluationJustification: data.justification }),
        updatedBy,
      };

      const risk = await tx.risk.update({
        where: { id },
        data: updateData,
      });

      // Handle junction table updates if asset/process/service IDs provided
      if (data.assetIds !== undefined) {
        await tx.riskAsset.deleteMany({ where: { riskId: id } });
        if (data.assetIds.length > 0) {
          await tx.riskAsset.createMany({
            data: data.assetIds.map(assetId => ({ riskId: id, assetId })),
            skipDuplicates: true,
          });
        }
      }

      if (data.processIds !== undefined) {
        await tx.riskProcess.deleteMany({ where: { riskId: id } });
        if (data.processIds.length > 0) {
          await tx.riskProcess.createMany({
            data: data.processIds.map(processId => ({ riskId: id, processId })),
            skipDuplicates: true,
          });
        }
      }

      if (data.serviceIds !== undefined) {
        await tx.riskService.deleteMany({ where: { riskId: id } });
        if (data.serviceIds.length > 0) {
          await tx.riskService.createMany({
            data: data.serviceIds.map(serviceId => ({ riskId: id, serviceId })),
            skipDuplicates: true,
          });
        }
      }

      // Handle cause links updates
      if (data.causeIds !== undefined) {
        await tx.riskCauseLink.deleteMany({ where: { riskId: id } });
        if (data.causeIds.length > 0) {
          await tx.riskCauseLink.createMany({
            data: data.causeIds.map(causeId => ({ riskId: id, causeId })),
            skipDuplicates: true,
          });
        }
      }

      // Handle impact links updates
      if (data.impactIds !== undefined) {
        await tx.riskImpactLink.deleteMany({ where: { riskId: id } });
        if (data.impactIds.length > 0) {
          await tx.riskImpactLink.createMany({
            data: data.impactIds.map(impactId => ({ riskId: id, impactId })),
            skipDuplicates: true,
          });
        }
      }

      // If assessment values changed, create a new assessment snapshot
      if (assessmentChanged && existing.riskMethodVersionId) {
        // Determine next assessment number
        const maxAssessment = await tx.riskAssessment.findFirst({
          where: { riskId: id },
          orderBy: { assessmentNumber: 'desc' },
          select: { assessmentNumber: true },
        });
        const nextNumber = (maxAssessment?.assessmentNumber ?? 0) + 1;

        // Mark current assessments as historical
        await tx.riskAssessment.updateMany({
          where: { riskId: id, isCurrent: true },
          data: { isCurrent: false },
        });

        const assessmentType = (data.assessmentType as 'inherent' | 'current' | 'target') ?? 'current';
        await tx.riskAssessment.create({
          data: {
            riskId: id,
            riskMethodVersionId: existing.riskMethodVersionId,
            assessmentNumber: nextNumber,
            assessmentType,
            likelihood: data.likelihood ?? existing.likelihood,
            impact: data.impact ?? existing.impact,
            inherentRisk: newInherentRisk,
            residualRisk: newInherentRisk,
            targetRisk: newInherentRisk,
            assessorId: updatedBy ?? existing.assessorId,
            nextReviewDate: data.nextReviewDate ?? existing.nextReviewDate,
            justification: data.justification ?? existing.evaluationJustification ?? '',
            isCurrent: true,
          },
        });
      }

      return risk;
    });

    // Audit log for risk update
    if (updatedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'RISK_UPDATE',
        entityType: 'Risk',
        entityId: id,
        details: `Updated risk: ${existing.title}`,
        oldValue: {
          status: existing.status,
          likelihood: existing.likelihood,
          impact: existing.impact,
          inherentRisk: existing.inherentRisk,
        },
        newValue: {
          status: data.status ?? existing.status,
          likelihood: data.likelihood ?? existing.likelihood,
          impact: data.impact ?? existing.impact,
        },
      });
    }

    return this.getById(result.id);
  }

  /**
   * Soft-delete (archive) a risk.
   */
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

  // ==========================================
  // Assessment Management
  // ==========================================

  /**
   * Create a new assessment snapshot for a risk.
   * This creates a versioned, immutable record and marks previous assessments as historical.
   * Justification is mandatory.
   */
  async createAssessment(data: CreateAssessmentData) {
    // Validate justification is provided (mandatory)
    if (!data.justification || data.justification.trim().length === 0) {
      throw new AppError('Justification is mandatory for every assessment', 400);
    }

    const risk = await prisma.risk.findUnique({ where: { id: data.riskId } });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    const methodVersion = await prisma.riskMethodVersion.findUnique({
      where: { id: data.riskMethodVersionId },
    });
    if (!methodVersion) {
      throw new AppError('Risk method version not found', 404);
    }

    // Determine next assessment number
    const maxAssessment = await prisma.riskAssessment.findFirst({
      where: { riskId: data.riskId },
      orderBy: { assessmentNumber: 'desc' },
      select: { assessmentNumber: true },
    });
    const nextNumber = (maxAssessment?.assessmentNumber ?? 0) + 1;

    // Use transaction to mark previous as historical and create new
    await prisma.$transaction(async (tx) => {
      // Mark current assessments as historical for this type
      await tx.riskAssessment.updateMany({
        where: { riskId: data.riskId, assessmentType: data.assessmentType, isCurrent: true },
        data: { isCurrent: false },
      });

      const score = data.likelihood * data.impact;

      await tx.riskAssessment.create({
        data: {
          riskId: data.riskId,
          riskMethodVersionId: data.riskMethodVersionId,
          assessmentNumber: nextNumber,
          assessmentType: data.assessmentType,
          likelihood: data.likelihood,
          impact: data.impact,
          inherentRisk: data.inherentRisk,
          residualRisk: data.residualRisk,
          targetRisk: data.targetRisk,
          score,
          assessorId: data.assessorId,
          nextReviewDate: data.nextReviewDate,
          justification: data.justification,
          isCurrent: true,
        },
      });

      // Mark method version as immutable once referenced
      if (!methodVersion.isImmutable) {
        await tx.riskMethodVersion.update({
          where: { id: data.riskMethodVersionId },
          data: { isImmutable: true },
        });
      }

      // Update risk with latest values if assessment type is 'current'
      if (data.assessmentType === 'current') {
        await tx.risk.update({
          where: { id: data.riskId },
          data: {
            likelihood: data.likelihood,
            impact: data.impact,
            inherentRisk: data.inherentRisk,
            residualRisk: data.residualRisk,
            targetRisk: data.targetRisk,
            nextReviewDate: data.nextReviewDate,
            evaluationJustification: data.justification,
          },
        });
      }
    });

    // Audit log
    await auditService.logEventStandalone(prisma, {
      userId: data.assessorId,
      action: 'RISK_ASSESSMENT_CREATE',
      entityType: 'RiskAssessment',
      entityId: data.riskId,
      details: `Created ${data.assessmentType} assessment #${nextNumber} for risk ${risk.displayId}`,
    });

    return this.getAssessments(data.riskId);
  }

  /**
   * Get all assessments for a risk (full history).
   */
  async getAssessments(riskId: string) {
    const assessments = await prisma.riskAssessment.findMany({
      where: { riskId },
      orderBy: { assessmentNumber: 'desc' },
      include: {
        riskMethodVersion: true,
      },
    });

    return assessments;
  }

  /**
   * Get the current assessment for a risk by type.
   */
  async getCurrentAssessment(riskId: string, assessmentType?: 'inherent' | 'current' | 'target') {
    const where: Prisma.RiskAssessmentWhereInput = { riskId, isCurrent: true };
    if (assessmentType) {
      where.assessmentType = assessmentType;
    }

    return prisma.riskAssessment.findFirst({
      where,
      include: {
        riskMethodVersion: true,
      },
    });
  }

  // ==========================================
  // ReviewTask Management
  // ==========================================

  /**
   * Create a review task for a risk.
   */
  async createReviewTask(data: CreateReviewTaskData) {
    const risk = await prisma.risk.findUnique({ where: { id: data.riskId } });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    const displayId = await displayIdService.nextDisplayIdStandalone(prisma, 'ReviewTask');

    const task = await prisma.reviewTask.create({
      data: {
        displayId,
        riskId: data.riskId,
        scheduledDate: data.scheduledDate,
        dueDate: data.dueDate,
        priority: data.priority ?? 'medium',
        assignedTo: data.assignedTo,
        triggerType: data.triggerType ?? 'scheduled',
        triggerEventId: data.triggerEventId,
        triggerSource: data.triggerSource,
        notes: data.notes,
      },
    });

    // Audit log
    await auditService.logEventStandalone(prisma, {
      userId: data.assignedTo ?? 'system',
      action: 'REVIEW_TASK_CREATE',
      entityType: 'ReviewTask',
      entityId: task.id,
      details: `Created review task ${displayId} for risk ${risk.displayId}`,
    });

    return task;
  }

  /**
   * Update a review task.
   */
  async updateReviewTask(id: string, data: Partial<CreateReviewTaskData> & { status?: ReviewTaskStatus }, updatedBy?: string) {
    const existing = await prisma.reviewTask.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Review task not found', 404);
    }

    const updateData: Prisma.ReviewTaskUpdateInput = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

    // If completing, set completion fields
    if (data.status === 'completed') {
      updateData.completedAt = new Date();
      updateData.completedBy = updatedBy ?? existing.assignedTo;
    }

    const task = await prisma.reviewTask.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    if (updatedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'REVIEW_TASK_UPDATE',
        entityType: 'ReviewTask',
        entityId: id,
        details: `Updated review task ${existing.displayId}, status: ${existing.status} -> ${data.status}`,
      });
    }

    return task;
  }

  /**
   * Get all review tasks for a risk.
   */
  async getReviewTasks(riskId: string) {
    return prisma.reviewTask.findMany({
      where: { riskId, isArchived: false },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * List all review tasks with optional filters.
   */
  async listReviewTasks(filters?: {
    status?: string;
    assignedTo?: string;
    priority?: string;
    overdue?: boolean;
  }) {
    const where: Prisma.ReviewTaskWhereInput = { isArchived: false };
    if (filters?.status) where.status = filters.status;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.overdue) {
      where.AND = [
        { dueDate: { lt: new Date() } },
        { status: { notIn: ['completed', 'cancelled'] } },
      ];
    }

    return prisma.reviewTask.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        risk: { select: { id: true, displayId: true, title: true } },
      },
    });
  }

  // ==========================================
  // Unplanned Review Trigger (RSK-024)
  // ==========================================

  /**
   * Check if an event triggers an unplanned risk review.
   * If so, creates a concrete ReviewTask for each affected risk.
   */
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

    // If review is required, find affected risks and create ReviewTasks
    let affectedRisks: any[] = [];
    const createdTasks: any[] = [];

    if (requiresReview) {
      const where: Prisma.RiskWhereInput = {
        status: { notIn: ['accepted', 'closed'] },
        isArchived: false,
      };

      // If specific risk ID provided, narrow search
      if (event.riskId) {
        where.id = event.riskId;
      } else if (event.assetId) {
        // Find risks linked to this asset via junction table
        const assetRisks = await prisma.riskAsset.findMany({
          where: { assetId: event.assetId },
          select: { riskId: true },
        });
        where.id = { in: assetRisks.map(r => r.riskId) };
      }

      affectedRisks = await prisma.risk.findMany({
        where,
        include: { organizationUnit: true },
      });

      // Create a ReviewTask for each affected risk
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // Default: review within 7 days

      for (const risk of affectedRisks) {
        const task = await this.createReviewTask({
          riskId: risk.id,
          scheduledDate: new Date(),
          dueDate,
          priority: event.severity === 'very_high' ? 'critical' : event.severity === 'high' ? 'high' : 'medium',
          assignedTo: risk.riskOwnerId,
          triggerType: 'unplanned_event',
          triggerEventId: event.riskId ?? event.assetId,
          triggerSource: `${event.type}: ${reason}`,
          notes: event.details,
        });
        createdTasks.push(task);
      }
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
      createdReviewTasks: createdTasks.map(t => ({
        id: t.id,
        displayId: t.displayId,
        riskId: t.riskId,
        dueDate: t.dueDate,
        status: t.status,
      })),
    };
  }

  // ==========================================
  // Treatment Plan (existing)
  // ==========================================

  async createTreatmentPlan(riskId: string, data: CreateTreatmentPlanData) {
    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk) {
      throw new AppError('Risk not found', 404);
    }

    const displayId = await displayIdService.nextDisplayIdStandalone(prisma, 'RiskTreatment');
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

  /**
   * Calculate risk level from likelihood and impact scores.
   */
  private calculateRiskLevel(likelihood: number, impact: number): string {
    const score = likelihood * impact;
    if (score >= 16) return 'very_high';
    if (score >= 9) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
}

export const riskService = new RiskService();

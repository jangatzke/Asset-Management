import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { authorizationService } from './authorization.service';
import type { ScopeConstraints } from './authorization.service';

const db = prisma as any;
const DEPRECATED_CONTROL_FIELDS = ['relatedRiskIds', 'riskIds', 'evidenceIds', 'risks'];

async function resolveImplementationTargetScope(data: { scopeId?: string | null; organizationUnitId?: string | null; siteId?: string | null }): Promise<ScopeConstraints> {
  const [organizationUnit, site] = await Promise.all([
    data.organizationUnitId ? db.organizationUnit.findUnique({ where: { id: data.organizationUnitId }, select: { id: true, legalEntityId: true } }) : null,
    data.siteId ? db.site.findUnique({ where: { id: data.siteId }, include: { organizationUnit: true } }) : null,
  ]);
  if (data.organizationUnitId && !organizationUnit) throw new AppError('Organization unit not found', 404);
  if (data.siteId && !site) throw new AppError('Site not found', 404);
  return {
    legalEntityId: organizationUnit?.legalEntityId ?? site?.organizationUnit?.legalEntityId ?? null,
    organizationUnitId: data.organizationUnitId ?? site?.organizationUnitId ?? null,
    siteId: data.siteId ?? null,
    scopeId: data.scopeId ?? null,
  };
}

export interface CreateControlData {
  catalogId: string;
  catalogVersion: string;
  title: string;
  description: string;
  controlGoal: string;
  responsibleId?: string;
  applicability?: string;
  applicabilityJustification?: string;
  implementationStatus?: string;
  maturityLevel?: number;
  implementationDescription?: string;
  affectedAssetIds?: string[];
  affectedProcessIds?: string[];
  affectedSiteIds?: string[];
  testMethod?: string;
  testFrequency?: string;
}

export interface CreateControlImplementationData {
  controlId: string;
  scopeId?: string;
  organizationUnitId?: string;
  siteId?: string;
  responsibleUserId: string;
  implementationStatus?: string;
  maturityLevel?: number;
  implementationDescription?: string;
  testMethod?: string;
  testFrequency?: string;
  lastTestDate?: Date;
  nextTestDate?: Date;
  requirementIds?: string[];
  findings?: Array<{ title: string; description?: string; severity?: string; dueDate?: Date }>;
  actions?: Array<{ title: string; description?: string; responsibleUserId?: string; dueDate?: Date; findingTitle?: string }>;
}

export interface CreateSoAItemData {
  requirementId?: string;
  controlId?: string;
  applicability?: string;
  justification: string;
  implementationStatus?: string;
  controlImplementationIds?: string[];
}

export interface CreateControlTestData {
  controlImplementationId: string;
  testType: string;
  testMethod?: string;
  testedBy: string;
  testedAt?: Date;
  result: string;
  effectivenessRating?: number;
  findings?: string;
  evidenceRequired?: boolean;
  nextTestDate?: Date;
  evidenceLinks?: Array<{ evidenceId: string; relationType?: string }>;
}

export interface CreateSoAData {
  frameworkId: string;
  frameworkVersion: string;
  scopeId: string;
  items?: CreateSoAItemData[];
}

export interface UpdateControlData extends Partial<CreateControlData> {
  status?: string;
}

export interface ListControlsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  implementationStatus?: string;
  catalogId?: string;
}

export class ControlService {
  private rejectDeprecatedPayload(data: Record<string, unknown>) {
    const forbidden = DEPRECATED_CONTROL_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(data, field));
    if (forbidden.length) {
      throw new AppError(`Deprecated direct control-risk/evidence fields are not accepted: ${forbidden.join(', ')}. Use RiskControl and EvidenceLink.`, 400);
    }
  }
  async list(query: ListControlsQuery, authzWhere: Prisma.ControlWhereInput = {}, implementationAuthzWhere: Prisma.ControlImplementationWhereInput | null = null) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.ControlWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.implementationStatus) {
      where.implementationStatus = query.implementationStatus;
    }

    if (query.catalogId) {
      where.catalogId = query.catalogId;
    }

    const effectiveWhere: Prisma.ControlWhereInput = Object.keys(authzWhere).length ? { AND: [where, authzWhere] } : where;

    const [controls, total] = await Promise.all([
      prisma.control.findMany({
        where: effectiveWhere,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requirementMappings: { include: { requirement: true } },
          implementations: implementationAuthzWhere ? { where: implementationAuthzWhere } : true,
        } as Prisma.ControlInclude,
      }),
      prisma.control.count({ where: effectiveWhere }),
    ]);

    return {
      data: controls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, userId?: string) {
    const implementationAuthzWhere = userId ? await authorizationService.buildControlImplementationReadFilter(userId) : undefined;
    const control = await prisma.control.findUnique({
      where: { id },
      include: {
        requirementMappings: { include: { requirement: true } },
        implementations: { where: implementationAuthzWhere, include: { findings: true, actions: true } },
      } as Prisma.ControlInclude,
    });

    if (!control) {
      throw new AppError('Control not found', 404);
    }

    return control;
  }

  async listImplementationRisks(implementationId: string, userId?: string) {
    const riskAuthzWhere = userId ? await authorizationService.buildRiskReadFilter(userId) : undefined;
    const implementation = await db.controlImplementation.findUnique({
      where: { id: implementationId },
      include: {
        control: true,
        riskControls: {
          orderBy: { createdAt: 'desc' },
          include: {
            risk: { select: { id: true, displayId: true, title: true, status: true, inherentRisk: true, residualRisk: true } },
            assessments: {
              orderBy: { assessedAt: 'desc' },
              take: 1,
              include: { riskAssessmentVersion: true, evidenceLinks: true },
            },
          },
        },
      },
    });
    if (!implementation) throw new AppError('Control implementation not found', 404);
    if (userId) await authorizationService.requireForEntity(userId, 'controls.read', 'controls', implementationId);
    const visibleRiskControls = riskAuthzWhere ? await db.riskControl.findMany({
      where: { controlImplementationId: implementationId, risk: riskAuthzWhere },
      orderBy: { createdAt: 'desc' },
      include: {
        risk: { select: { id: true, displayId: true, title: true, status: true, inherentRisk: true, residualRisk: true } },
        assessments: { orderBy: { assessedAt: 'desc' }, take: 1, include: { riskAssessmentVersion: true, evidenceLinks: true } },
      },
    }) : implementation.riskControls;
    return {
      implementationId,
      control: implementation.control,
      risks: visibleRiskControls.map((riskControl: any) => ({
        riskControlId: riskControl.id,
        riskId: riskControl.riskId,
        displayId: riskControl.risk?.displayId,
        title: riskControl.risk?.title,
        status: riskControl.risk?.status,
        inherentRisk: riskControl.risk?.inherentRisk,
        residualRisk: riskControl.risk?.residualRisk,
        role: riskControl.role,
        mitigationDimension: riskControl.mitigationDimension,
        isKeyControl: riskControl.isKeyControl,
        relationshipStatus: riskControl.status,
        latestAssessment: riskControl.assessments?.[0] ?? null,
      })),
    };
  }

  async create(data: CreateControlData, createdBy?: string) {
    this.rejectDeprecatedPayload(data as unknown as Record<string, unknown>);
    const { affectedAssetIds, affectedProcessIds, affectedSiteIds, ...controlData } = data;
    const control = await prisma.control.create({
      data: {
        ...controlData,
        createdBy,
        assetLinks: affectedAssetIds?.length ? { create: affectedAssetIds.map((assetId) => ({ assetId })) } : undefined,
        processLinks: affectedProcessIds?.length ? { create: affectedProcessIds.map((processId) => ({ processId })) } : undefined,
        siteLinks: affectedSiteIds?.length ? { create: affectedSiteIds.map((siteId) => ({ siteId })) } : undefined,
      },
    });

    // Audit log for control creation
    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'CONTROL_CREATE',
        entityType: 'Control',
        entityId: control.id,
        details: `Created control: ${data.title}`,
      });
    }

    return control;
  }

  async update(id: string, data: UpdateControlData, updatedBy?: string) {
    this.rejectDeprecatedPayload(data as unknown as Record<string, unknown>);
    const existing = await prisma.control.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Control not found', 404);
    }

    // Audit log for control update (if status or implementation changed)
    if (updatedBy && (data.status !== undefined || data.implementationStatus !== undefined)) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'CONTROL_UPDATE',
        entityType: 'Control',
        entityId: id,
        details: `Updated control: ${existing.title}`,
        oldValue: { status: existing.status, implementationStatus: existing.implementationStatus },
        newValue: { status: data.status ?? existing.status, implementationStatus: data.implementationStatus ?? existing.implementationStatus },
      });
    }

    const control = await prisma.control.update({
      where: { id },
      data: {
        ...Object.fromEntries(Object.entries(data).filter(([key]) => !['affectedAssetIds', 'affectedProcessIds', 'affectedSiteIds'].includes(key))),
        updatedBy,
      },
    });

    return control;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await prisma.control.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Control not found', 404);
    }

    // Audit log for control deletion (archiving)
    if (deletedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: deletedBy,
        action: 'CONTROL_DELETE',
        entityType: 'Control',
        entityId: id,
        details: `Archived control: ${existing.title}`,
      });
    }

    await prisma.control.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async getSOA(scopeId?: string) {
    const where: Prisma.StatementOfApplicabilityWhereInput = {};
    if (scopeId) {
      where.scopeId = scopeId;
    }

    return prisma.statementOfApplicability.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, approvals: true },
    });
  }

  async createSOA(data: CreateSoAData, createdBy?: string) {
    data.items?.forEach((item) => this.rejectDeprecatedPayload(item as unknown as Record<string, unknown>));
    const soa = await prisma.statementOfApplicability.create({
      data: {
        frameworkId: data.frameworkId,
        frameworkVersion: data.frameworkVersion,
        scopeId: data.scopeId,
        createdBy,
        items: data.items?.length ? {
          create: data.items.map((item) => ({
            requirementId: item.requirementId,
            controlId: item.controlId,
            applicability: item.applicability ?? 'under_review',
            justification: item.justification,
            implementationStatus: item.implementationStatus ?? 'planned',
            implementationLinks: item.controlImplementationIds?.length ? { create: item.controlImplementationIds.map((controlImplementationId) => ({ controlImplementationId })) } : undefined,
            createdBy,
          })),
        } : undefined,
      },
      include: { items: true },
    });

    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'SOA_CREATE',
        entityType: 'StatementOfApplicability',
        entityId: soa.id,
        details: `Created SoA version ${soa.version}`,
      });
    }

    return soa;
  }

  async updateSOAItem(itemId: string, data: Partial<CreateSoAItemData>, updatedBy?: string) {
    this.rejectDeprecatedPayload(data as Record<string, unknown>);
    const existing = await prisma.soAItem.findUnique({ where: { id: itemId }, include: { soa: true } });
    if (!existing) throw new AppError('SoA item not found', 404);
    if (existing.isImmutable || existing.soa.isImmutable || existing.soa.approvalStatus === 'approved') {
      throw new AppError('Approved SoA items are immutable', 409);
    }

    const updated = await prisma.soAItem.update({
      where: { id: itemId },
      data: {
        requirementId: data.requirementId,
        controlId: data.controlId,
        applicability: data.applicability,
        justification: data.justification,
        implementationStatus: data.implementationStatus,
        updatedBy,
      },
    });

    if (data.controlImplementationIds !== undefined) {
      await db.soAItemControlImplementation.deleteMany({ where: { soaItemId: itemId } });
      if (data.controlImplementationIds.length) {
        await db.soAItemControlImplementation.createMany({
          data: data.controlImplementationIds.map((controlImplementationId) => ({ soaItemId: itemId, controlImplementationId })),
          skipDuplicates: true,
        });
      }
    }

    if (updatedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'SOA_ITEM_UPDATE',
        entityType: 'SoAItem',
        entityId: itemId,
        details: 'Updated SoA item',
      });
    }

    return updated;
  }

  async submitSOA(soaId: string, userId: string) {
    const soa = await prisma.statementOfApplicability.findUnique({ where: { id: soaId }, include: { items: true } });
    if (!soa) throw new AppError('Statement of Applicability not found', 404);
    if (soa.isImmutable || soa.approvalStatus === 'approved') throw new AppError('Approved SoA versions are immutable', 409);
    if (soa.items.length === 0) throw new AppError('SoA requires at least one item before submission', 400);
    if (soa.items.some((item) => !item.justification?.trim())) throw new AppError('Every SoA item requires a justification', 400);

    const updated = await prisma.statementOfApplicability.update({
      where: { id: soaId },
      data: { approvalStatus: 'under_review', submittedAt: new Date(), submittedBy: userId, updatedBy: userId },
      include: { items: true },
    });

    await auditService.logEventStandalone(prisma, { userId, action: 'SOA_SUBMIT', entityType: 'StatementOfApplicability', entityId: soaId, details: 'Submitted SoA for approval' });
    return updated;
  }

  async approveSOA(soaId: string, approverId: string, decision: 'approved' | 'rejected' = 'approved', comment?: string) {
    const soa = await prisma.statementOfApplicability.findUnique({ where: { id: soaId }, include: { items: true } });
    if (!soa) throw new AppError('Statement of Applicability not found', 404);
    if (soa.isImmutable || soa.approvalStatus === 'approved') throw new AppError('Approved SoA versions are immutable', 409);
    if (soa.approvalStatus !== 'under_review') throw new AppError('SoA must be under review before approval decision', 400);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.soAApproval.create({ data: { soaId, approverId, decision, comment } });
      if (decision === 'rejected') {
        return tx.statementOfApplicability.update({ where: { id: soaId }, data: { approvalStatus: 'draft', rejectedAt: new Date(), rejectedBy: approverId, rejectionReason: comment, updatedBy: approverId }, include: { items: true, approvals: true } });
      }
      await tx.soAItem.updateMany({ where: { soaId }, data: { isImmutable: true } });
      return tx.statementOfApplicability.update({ where: { id: soaId }, data: { approvalStatus: 'approved', approvedAt: new Date(), approvedBy: approverId, isImmutable: true, updatedBy: approverId }, include: { items: true, approvals: true } });
    });

    await auditService.logEventStandalone(prisma, { userId: approverId, action: decision === 'approved' ? 'SOA_APPROVE' : 'SOA_REJECT', entityType: 'StatementOfApplicability', entityId: soaId, details: `SoA ${decision}` });
    return updated;
  }

  async createImplementation(data: CreateControlImplementationData, createdBy?: string) {
    const control = await prisma.control.findUnique({ where: { id: data.controlId } });
    if (!control) throw new AppError('Control not found', 404);
    if (!data.scopeId && !data.organizationUnitId && !data.siteId) {
      throw new AppError('Control implementation requires scope, organization unit, or site', 400);
    }
    if (createdBy) {
      await authorizationService.requireForScope(createdBy, 'controls.write', await resolveImplementationTargetScope(data));
    }

    if (data.requirementIds?.length) {
      const requirementCount = await prisma.requirement.count({ where: { id: { in: data.requirementIds } } });
      if (requirementCount !== data.requirementIds.length) throw new AppError('One or more requirements were not found', 400);
    }

    const implementation = await prisma.controlImplementation.create({
      data: {
        controlId: data.controlId,
        scopeId: data.scopeId,
        organizationUnitId: data.organizationUnitId,
        siteId: data.siteId,
        responsibleUserId: data.responsibleUserId,
        implementationStatus: data.implementationStatus ?? 'planned',
        maturityLevel: data.maturityLevel ?? 0,
        implementationDescription: data.implementationDescription,
        testMethod: data.testMethod,
        testFrequency: data.testFrequency,
        lastTestDate: data.lastTestDate,
        nextTestDate: data.nextTestDate,
        findingsSummary: data.findings?.map((finding) => finding.title).join('; '),
        actionsSummary: data.actions?.map((action) => action.title).join('; '),
        createdBy,
        requirements: data.requirementIds?.length ? { create: data.requirementIds.map((requirementId) => ({ requirementId })) } : undefined,
        findings: data.findings?.length ? { create: data.findings.map((finding) => ({ title: finding.title, description: finding.description, severity: finding.severity ?? 'medium', dueDate: finding.dueDate, createdBy })) } : undefined,
        actions: data.actions?.length ? { create: data.actions.map((action) => ({ title: action.title, description: action.description, responsibleUserId: action.responsibleUserId, dueDate: action.dueDate, createdBy })) } : undefined,
      },
      include: { requirements: true, findings: true, actions: true },
    });

    if (createdBy) {
      await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'CONTROL_IMPLEMENTATION_CREATE', entityType: 'ControlImplementation', entityId: implementation.id, details: `Created implementation for ${control.title}` });
    }

    return implementation;
  }

  async createControlTest(data: CreateControlTestData, createdBy?: string) {
    const implementation = await db.controlImplementation.findUnique({ where: { id: data.controlImplementationId } });
    if (!implementation) throw new AppError('Control implementation not found', 404);
    if (createdBy) await authorizationService.requireForEntity(createdBy, 'controls.test', 'controls', data.controlImplementationId);
    if (!data.result?.trim()) throw new AppError('Control test result is required', 400);

    return db.$transaction(async (tx: any) => {
      const test = await tx.controlTest.create({
        data: {
          controlImplementationId: data.controlImplementationId,
          testType: data.testType,
          testMethod: data.testMethod,
          testedBy: createdBy ?? data.testedBy,
          testedAt: data.testedAt,
          result: data.result,
          effectivenessRating: data.effectivenessRating,
          findings: data.findings,
          evidenceRequired: data.evidenceRequired ?? false,
          nextTestDate: data.nextTestDate,
          createdBy,
        },
      });
      if (data.evidenceLinks?.length) {
        await tx.evidenceLink.createMany({
          data: data.evidenceLinks.map((link) => ({
            evidenceId: link.evidenceId,
            entityType: 'ControlTest',
            entityId: test.id,
            relationType: link.relationType ?? 'supports',
            controlTestId: test.id,
            createdBy,
          })),
          skipDuplicates: true,
        });
      }
      return tx.controlTest.findUnique({ where: { id: test.id }, include: { evidenceLinks: true } });
    });
  }
}

export const controlService = new ControlService();

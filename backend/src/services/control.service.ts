import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

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
  relatedRiskIds?: string[];
  evidenceIds?: string[];
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
  riskIds?: string[];
  evidenceIds?: string[];
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
  async list(query: ListControlsQuery) {
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

    const [controls, total] = await Promise.all([
      prisma.control.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requirementMappings: { include: { requirement: true } },
          implementations: true,
        } as Prisma.ControlInclude,
      }),
      prisma.control.count({ where }),
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

  async getById(id: string) {
    const control = await prisma.control.findUnique({
      where: { id },
      include: {
        requirementMappings: { include: { requirement: true } },
        implementations: { include: { findings: true, actions: true } },
      } as Prisma.ControlInclude,
    });

    if (!control) {
      throw new AppError('Control not found', 404);
    }

    return control;
  }

  async create(data: CreateControlData, createdBy?: string) {
    const { affectedAssetIds, affectedProcessIds, affectedSiteIds, relatedRiskIds, evidenceIds, ...controlData } = data;
    const control = await prisma.control.create({
      data: {
        ...controlData,
        createdBy,
        assetLinks: affectedAssetIds?.length ? { create: affectedAssetIds.map((assetId) => ({ assetId })) } : undefined,
        processLinks: affectedProcessIds?.length ? { create: affectedProcessIds.map((processId) => ({ processId })) } : undefined,
        siteLinks: affectedSiteIds?.length ? { create: affectedSiteIds.map((siteId) => ({ siteId })) } : undefined,
        risks: relatedRiskIds?.length ? { connect: relatedRiskIds.map((id) => ({ id })) } : undefined,
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
        ...Object.fromEntries(Object.entries(data).filter(([key]) => !['affectedAssetIds', 'affectedProcessIds', 'affectedSiteIds', 'relatedRiskIds', 'evidenceIds'].includes(key))),
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
            controlImplementationIds: item.controlImplementationIds ?? [],
            riskIds: item.riskIds ?? [],
            evidenceIds: item.evidenceIds ?? [],
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
        controlImplementationIds: data.controlImplementationIds,
        riskIds: data.riskIds,
        evidenceIds: data.evidenceIds,
        updatedBy,
      },
    });

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
}

export const controlService = new ControlService();

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

export interface CreateIncidentData {
  title: string;
  description: string;
  detectionTime: Date;
  knowledgeTime: Date;
  reporterId?: string;
  reporterSource?: string;
  affectedAssetIds?: string[];
  affectedServiceIds?: string[];
  affectedProcessIds?: string[];
  confidentialityImpact?: string;
  integrityImpact?: string;
  availabilityImpact?: string;
  operationalImpact?: string;
  financialImpact?: number;
  legalImpact?: string;
  personalDataImpact?: boolean;
  affectedCustomers?: string[];
  affectedThirdParties?: string[];
  suspectedCause?: string;
  isIntentional?: boolean;
  hasCrossBorderImpact?: boolean;
  indicatorsOfCompromise?: string[];
  immediateActions?: string[];
  incidentManagerId: string;
  severity?: string;
}

export interface UpdateIncidentData extends Partial<CreateIncidentData> {
  status?: string;
  notificationStatus?: string;
}

export interface ListIncidentsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  severity?: string;
}

export interface AssessIncidentData {
  assessorId: string;
  isReportable: boolean;
  reportingJustification?: string;
  decisionNotToReport?: string;
}

export class IncidentService {
  async list(query: ListIncidentsQuery) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const where: Prisma.IncidentWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.incident.count({ where }),
    ]);

    return {
      data: incidents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const incident = await prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    return incident;
  }

  async create(data: CreateIncidentData, createdBy?: string) {
    const displayId = `INC-${Date.now()}`;

    const incident = await prisma.incident.create({
      data: {
        ...data,
        displayId,
        financialImpact: data.financialImpact
          ? new (require('@prisma/client/runtime/client').Decimal)(data.financialImpact)
          : undefined,
        createdBy,
      },
    });

    // Audit log for incident creation
    if (createdBy) {
      await auditService.logEventStandalone(prisma, {
        userId: createdBy,
        action: 'INCIDENT_CREATE',
        entityType: 'Incident',
        entityId: incident.id,
        details: `Created incident: ${data.title}`,
      });
    }

    return incident;
  }

  async update(id: string, data: UpdateIncidentData, updatedBy?: string) {
    const existing = await prisma.incident.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Incident not found', 404);
    }

    // Audit log for incident update (if status or severity changed)
    if (updatedBy && (data.status !== undefined || data.severity !== undefined)) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'INCIDENT_UPDATE',
        entityType: 'Incident',
        entityId: id,
        details: `Updated incident: ${existing.title}`,
        oldValue: { status: existing.status, severity: existing.severity },
        newValue: { status: data.status ?? existing.status, severity: data.severity ?? existing.severity },
      });
    }

    const incident = await prisma.incident.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
    });

    return incident;
  }

  async delete(id: string, deletedBy?: string) {
    const existing = await prisma.incident.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Incident not found', 404);
    }

    // Audit log for incident deletion (archiving)
    if (deletedBy) {
      await auditService.logEventStandalone(prisma, {
        userId: deletedBy,
        action: 'INCIDENT_DELETE',
        entityType: 'Incident',
        entityId: id,
        details: `Archived incident: ${existing.title}`,
      });
    }

    await prisma.incident.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async assessIncident(incidentId: string, data: AssessIncidentData) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    const assessment = await prisma.incidentAssessment.create({
      data: {
        incidentId,
        ...data,
      },
    });

    return assessment;
  }

  async createReport(incidentId: string, reportData: {
    title: string;
    content: string;
    authorId: string;
  }) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    return { success: true, incidentId, ...reportData };
  }
}

export const incidentService = new IncidentService();
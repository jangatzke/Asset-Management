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
  rootCause?: string;
  lessonsLearned?: string;
  measuresEvaluation?: string;
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
  decisionApprovedBy?: string;
}

export type IncidentReportType = 'early_warning_24h' | 'incident_notification_72h' | 'interim_report' | 'monthly_final_report';

const DEFAULT_SIGNIFICANCE_RULES = {
  version: '1.0',
  rules: [
    { key: 'critical_severity', field: 'severity', operator: 'in', value: ['critical', 'high'], reason: 'High or critical incident severity' },
    { key: 'cross_border', field: 'hasCrossBorderImpact', operator: 'equals', value: true, reason: 'Cross-border impact' },
    { key: 'personal_data', field: 'personalDataImpact', operator: 'equals', value: true, reason: 'Personal data impact' },
    { key: 'availability_high', field: 'availabilityImpact', operator: 'in', value: ['high'], reason: 'High availability impact' },
  ],
};

export class IncidentService {
  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private endOfNextMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0, 23, 59, 59, 999));
  }

  async ensureDefaultSignificanceRules(createdBy?: string) {
    return (prisma as any).nis2IncidentSignificanceRuleVersion.upsert({
      where: { version: DEFAULT_SIGNIFICANCE_RULES.version },
      update: { status: 'active' },
      create: { version: DEFAULT_SIGNIFICANCE_RULES.version, rules: DEFAULT_SIGNIFICANCE_RULES.rules, createdBy },
    });
  }

  evaluateSignificance(incident: Record<string, any>, ruleVersion: any) {
    const rules = Array.isArray(ruleVersion?.rules) ? ruleVersion.rules : DEFAULT_SIGNIFICANCE_RULES.rules;
    const matched = rules.filter((rule: any) => {
      const value = incident[rule.field];
      if (rule.operator === 'equals') return value === rule.value;
      if (rule.operator === 'in') return Array.isArray(rule.value) && rule.value.includes(value);
      if (rule.operator === 'truthy') return Boolean(value);
      return false;
    });
    return { isSignificant: matched.length > 0, reasons: matched.map((rule: any) => rule.reason ?? rule.key), evaluatedRules: matched.map((rule: any) => rule.key) };
  }

  async createSignificanceRuleVersion(data: { version: string; rules: unknown; effectiveFrom?: Date }, createdBy?: string) {
    const created = await (prisma as any).nis2IncidentSignificanceRuleVersion.create({ data: { ...data, createdBy } });
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'INCIDENT_SIGNIFICANCE_RULE_VERSION_CREATE', entityType: 'Nis2IncidentSignificanceRuleVersion', entityId: created.id, details: `Created incident significance rules ${data.version}` });
    return created;
  }

  async list(query: ListIncidentsQuery, authzWhere: Prisma.IncidentWhereInput = {}) {
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

    const effectiveWhere: Prisma.IncidentWhereInput = Object.keys(authzWhere).length ? { AND: [where, authzWhere] } : where;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where: effectiveWhere,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { reports: true, escalations: true } as Prisma.IncidentInclude,
      }),
      prisma.incident.count({ where: effectiveWhere }),
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
      include: { assessments: true, reports: true, communications: true, escalations: true, knowledgeTimeChanges: true, significanceRuleVersion: true } as Prisma.IncidentInclude,
    });

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    return incident;
  }

  async create(data: CreateIncidentData, createdBy?: string) {
    const displayId = `INC-${Date.now()}`;
    const { affectedAssetIds, affectedServiceIds, affectedProcessIds, ...incidentData } = data;
    const ruleVersion = await this.ensureDefaultSignificanceRules(createdBy);
    const significance = this.evaluateSignificance(data as any, ruleVersion);

    const incident = await prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          ...incidentData,
          displayId,
          significanceRuleVersionId: ruleVersion.id,
          isSignificant: significance.isSignificant,
          significanceReasons: significance.reasons,
          notificationStatus: significance.isSignificant ? 'pending_assessment' : 'not_required',
          financialImpact: data.financialImpact
            ? new (require('@prisma/client/runtime/client').Decimal)(data.financialImpact)
            : undefined,
          createdBy,
          incidentAssets: affectedAssetIds?.length ? { create: affectedAssetIds.map((assetId) => ({ assetId })) } : undefined,
          serviceLinks: affectedServiceIds?.length ? { create: affectedServiceIds.map((serviceId) => ({ serviceId })) } : undefined,
          processLinks: affectedProcessIds?.length ? { create: affectedProcessIds.map((processId) => ({ processId })) } : undefined,
        } as any,
      });
      if (significance.isSignificant) {
        await this.createDeadlinesForIncident(tx, created.id, data.knowledgeTime);
      }
      return created;
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

    if (data.knowledgeTime !== undefined && new Date(data.knowledgeTime).getTime() !== existing.knowledgeTime.getTime()) {
      throw new AppError('Knowledge time is protected and must be changed through the dedicated endpoint with reason', 400);
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
        ...Object.fromEntries(Object.entries(data).filter(([key]) => !['affectedAssetIds', 'affectedServiceIds', 'affectedProcessIds'].includes(key))),
        updatedBy,
      } as any,
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

    if (!data.isReportable && !data.decisionNotToReport?.trim()) throw new AppError('Decision not to report requires justification', 400);
    if (!data.isReportable && !data.decisionApprovedBy?.trim()) throw new AppError('Decision not to report requires approval', 400);

    const incidentAny = incident as any;
    const ruleVersion = incidentAny.significanceRuleVersionId
      ? await (prisma as any).nis2IncidentSignificanceRuleVersion.findUnique({ where: { id: incidentAny.significanceRuleVersionId } })
      : await this.ensureDefaultSignificanceRules(data.assessorId);
    const evaluated = this.evaluateSignificance(incident as any, ruleVersion);

    const assessment = await (prisma as any).incidentAssessment.upsert({
      where: { incidentId },
      update: {
        ...data,
        decisionApprovedAt: !data.isReportable ? new Date() : undefined,
        significanceRuleVersionId: ruleVersion.id,
        evaluatedRules: evaluated,
        updatedBy: data.assessorId,
      },
      create: {
        incidentId,
        ...data,
        decisionApprovedAt: !data.isReportable ? new Date() : undefined,
        significanceRuleVersionId: ruleVersion.id,
        evaluatedRules: evaluated,
      },
    });

    await prisma.incident.update({ where: { id: incidentId }, data: { notificationStatus: data.isReportable ? 'pending_assessment' : 'not_required', isSignificant: data.isReportable, significanceReasons: evaluated.reasons } as any });

    return assessment;
  }

  private async createDeadlinesForIncident(tx: any, incidentId: string, knowledgeTime: Date) {
    const deadlines = [
      { notificationType: 'early_warning_24h', deadlineDate: this.addHours(knowledgeTime, 24) },
      { notificationType: 'incident_notification_72h', deadlineDate: this.addHours(knowledgeTime, 72) },
      { notificationType: 'interim_report', deadlineDate: this.addDays(knowledgeTime, 7) },
      { notificationType: 'monthly_final_report', deadlineDate: this.endOfNextMonth(knowledgeTime) },
    ];
    await tx.notificationDeadline.createMany({ data: deadlines.map((deadline) => ({ incidentId, ...deadline, knowledgeTimeReference: knowledgeTime, status: 'pending' })), skipDuplicates: true });
  }

  async recalculateDeadlines(incidentId: string) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new AppError('Incident not found', 404);
    await prisma.$transaction(async (tx) => {
      await tx.notificationDeadline.deleteMany({ where: { incidentId, status: 'pending' } });
      await this.createDeadlinesForIncident(tx, incidentId, incident.knowledgeTime);
    });
    return (prisma as any).notificationDeadline.findMany({ where: { incidentId }, orderBy: { deadlineDate: 'asc' } });
  }

  async changeKnowledgeTime(incidentId: string, newKnowledgeTime: Date, reason: string, changedBy: string) {
    if (!reason?.trim()) throw new AppError('Changing knowledge time requires a reason', 400);
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new AppError('Incident not found', 404);
    const updated = await prisma.$transaction(async (tx) => {
      await (tx as any).incidentKnowledgeTimeChange.create({ data: { incidentId, oldKnowledgeTime: incident.knowledgeTime, newKnowledgeTime, reason, changedBy } });
      const result = await tx.incident.update({ where: { id: incidentId }, data: { knowledgeTime: newKnowledgeTime, updatedBy: changedBy } });
      await tx.notificationDeadline.deleteMany({ where: { incidentId, status: 'pending' } });
      await this.createDeadlinesForIncident(tx, incidentId, newKnowledgeTime);
      return result;
    });
    await auditService.logEventStandalone(prisma, { userId: changedBy, action: 'INCIDENT_KNOWLEDGE_TIME_CHANGE', entityType: 'Incident', entityId: incidentId, details: reason, oldValue: { knowledgeTime: incident.knowledgeTime.toISOString() }, newValue: { knowledgeTime: newKnowledgeTime.toISOString() } });
    return updated;
  }

  async createIncidentReport(incidentId: string, reportData: { reportType: IncidentReportType; title?: string; content: Record<string, unknown>; authorId: string; recipient?: string; submissionMethod?: string; submissionProof?: string }) {
    const incident = await this.getById(incidentId) as any;
    const deadline = await (prisma as any).notificationDeadline.findUnique({ where: { incidentId_notificationType: { incidentId, notificationType: reportData.reportType } } });
    const report = await (prisma as any).incidentReport.create({
      data: {
        incidentId,
        reportType: reportData.reportType,
        title: reportData.title ?? `${incident.displayId} ${reportData.reportType}`,
        content: reportData.content,
        dueAt: deadline?.deadlineDate,
        status: reportData.submissionProof ? 'submitted' : 'draft',
        submittedAt: reportData.submissionProof ? new Date() : undefined,
        submittedBy: reportData.submissionProof ? reportData.authorId : undefined,
        recipient: reportData.recipient,
        submissionMethod: reportData.submissionMethod,
        submissionProof: reportData.submissionProof,
        exportPayload: this.buildReportExportPayload(incident, reportData.reportType, reportData.content),
        createdBy: reportData.authorId,
      },
    });
    if (deadline && reportData.submissionProof) await (prisma as any).notificationDeadline.update({ where: { id: deadline.id }, data: { status: 'sent', sentAt: new Date(), sentBy: reportData.authorId, submissionProof: reportData.submissionProof } });
    await auditService.logEventStandalone(prisma, { userId: reportData.authorId, action: 'INCIDENT_REPORT_CREATE', entityType: 'IncidentReport', entityId: report.id, details: `Created ${reportData.reportType} report for ${incident.displayId}` });
    return report;
  }

  buildReportExportPayload(incident: any, reportType: string, content: Record<string, unknown>) {
    return { schemaVersion: 'phase5-nis2-report-1.0', reportType, exportedAt: new Date().toISOString(), incident: { id: incident.id, displayId: incident.displayId, title: incident.title, knowledgeTime: incident.knowledgeTime, severity: incident.severity, significanceReasons: incident.significanceReasons }, content };
  }

  async exportReportPackage(reportId: string, exportedBy: string) {
    const report = await (prisma as any).incidentReport.findUnique({ where: { id: reportId }, include: { incident: true } });
    if (!report) throw new AppError('Incident report not found', 404);
    const payload = report.exportPayload ?? this.buildReportExportPayload(report.incident, report.reportType, report.content);
    await auditService.logEventStandalone(prisma, { userId: exportedBy, action: 'INCIDENT_REPORT_EXPORT', entityType: 'IncidentReport', entityId: reportId, details: `Exported report package ${report.reportType}` });
    return payload;
  }

  async createCommunication(incidentId: string, data: { channel: string; direction: string; recipient: string; sender?: string; message: string; scheduledAt?: Date; sentAt?: Date }, createdBy?: string) {
    await this.getById(incidentId);
    const communication = await (prisma as any).incidentCommunication.create({ data: { incidentId, ...data, status: data.sentAt ? 'sent' : 'planned', createdBy } });
    if (createdBy) await auditService.logEventStandalone(prisma, { userId: createdBy, action: 'INCIDENT_COMMUNICATION_CREATE', entityType: 'IncidentCommunication', entityId: communication.id, details: `Recorded ${data.channel} communication` });
    return communication;
  }

  async escalateOverdueDeadlines(now = new Date()) {
    const overdue = await (prisma as any).notificationDeadline.findMany({ where: { status: 'pending', deadlineDate: { lt: now } } });
    for (const deadline of overdue) {
      await (prisma as any).notificationDeadline.update({ where: { id: deadline.id }, data: { status: 'overdue' } });
      await (prisma as any).incidentEscalation.create({ data: { incidentId: deadline.incidentId, escalationType: 'deadline_overdue', reason: `${deadline.notificationType} deadline overdue`, dueAt: deadline.deadlineDate, level: 1 } });
    }
    return { escalated: overdue.length };
  }

  async closeIncident(incidentId: string, data: { rootCause?: string; lessonsLearned?: string; measuresEvaluation?: string; closureSummary?: string }, closedBy: string) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId }, include: { reports: true } as Prisma.IncidentInclude }) as any;
    if (!incident) throw new AppError('Incident not found', 404);
    const rootCause = data.rootCause ?? incident.rootCause;
    const measuresEvaluation = data.measuresEvaluation ?? incident.measuresEvaluation;
    if (!rootCause?.trim()) throw new AppError('Incident cannot be closed without root cause', 400);
    if (!measuresEvaluation?.trim()) throw new AppError('Incident cannot be closed without measures evaluation', 400);
    if (incident.isSignificant) {
      const finalReport = incident.reports?.find((report: any) => report.reportType === 'monthly_final_report' && report.status === 'submitted');
      if (!finalReport) throw new AppError('Significant incident requires submitted monthly final report before closure', 400);
    }
    const updated = await prisma.incident.update({ where: { id: incidentId }, data: { rootCause, lessonsLearned: data.lessonsLearned ?? incident.lessonsLearned, measuresEvaluation, closureSummary: data.closureSummary, status: 'closed', closedAt: new Date(), closedBy, updatedBy: closedBy } as any });
    await auditService.logEventStandalone(prisma, { userId: closedBy, action: 'INCIDENT_CLOSE', entityType: 'Incident', entityId: incidentId, details: data.closureSummary ?? 'Closed incident with root cause and measures evaluation' });
    return updated;
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

    return this.createIncidentReport(incidentId, { reportType: 'interim_report', title: reportData.title, content: { text: reportData.content }, authorId: reportData.authorId });
  }
}

export const incidentService = new IncidentService();

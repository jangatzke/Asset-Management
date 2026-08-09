import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';

// ==========================================
// Incident History (AUDIT-001)
// ==========================================

export type IncidentHistoryAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSESSMENT' | 'KNOWLEDGE_TIME_CHANGE' | 'CLOSE' | 'REOPEN';

export interface IncidentHistoryEntry {
  id: string;
  incidentId: string;
  action: IncidentHistoryAction;
  fieldChanges?: Record<string, { old?: unknown; new?: unknown } | unknown>[];
  summary?: string;
  actorId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface GetHistoryQuery {
  action?: IncidentHistoryAction;
  limit?: number;
  offset?: number;
}

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
  private readonly relationUpdateFields = ['affectedAssetIds', 'affectedServiceIds', 'affectedProcessIds'];

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

  /**
   * Record a history entry for an incident change.
   * Append-only: each call creates a new record.
   */
  private async recordHistoryEntry(incidentId: string, action: IncidentHistoryAction, summary: string, fieldChanges: Record<string, { old?: unknown; new?: unknown } | unknown> = {}, actorId?: string, ipAddress?: string, userAgent?: string) {
    const historyEntry = (prisma as any).incidentHistoryEntry;
    if (!historyEntry) {
      console.warn('IncidentService.recordHistoryEntry: incidentHistoryEntry model not available on prisma client');
      return;
    }
    await historyEntry.create({
      data: {
        incidentId,
        action,
        summary,
        fieldChanges,
        actorId,
        ipAddress,
        userAgent,
      },
    });
  }

  private normalizeDecimalString(value: string): string {
    const trimmed = value.trim();
    const sign = trimmed.startsWith('-') ? '-' : '';
    const unsigned = trimmed.replace(/^[+-]/, '');
    const [integerPart, fractionalPart = ''] = unsigned.split('.');
    const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || '0';
    const normalizedFraction = fractionalPart.replace(/0+$/, '');
    const normalized = normalizedFraction ? `${normalizedInteger}.${normalizedFraction}` : normalizedInteger;
    return normalized === '0' ? '0' : `${sign}${normalized}`;
  }

  private normalizeFinancialImpactValue(value: unknown): unknown {
    if (value === undefined) return undefined;
    if (value === null || value === '') return '0';

    const comparableValue = typeof value === 'object' && value !== null && typeof (value as any).toString === 'function'
      ? (value as any).toString()
      : value;

    if (typeof comparableValue === 'number') {
      if (!Number.isFinite(comparableValue)) return comparableValue;
      return this.normalizeDecimalString(String(comparableValue));
    }

    if (typeof comparableValue === 'string') {
      const trimmed = comparableValue.trim();
      if (!trimmed) return '0';
      if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return this.normalizeDecimalString(trimmed);
    }

    return comparableValue;
  }

  private normalizeHistoryValue(field: string, value: unknown): unknown {
    if (value === undefined) return undefined;

    if (field === 'financialImpact') {
      return this.normalizeFinancialImpactValue(value);
    }

    if (value === null) {
      if (['isIntentional', 'hasCrossBorderImpact', 'personalDataImpact'].includes(field)) return false;
      if (['affectedCustomers', 'affectedThirdParties', 'indicatorsOfCompromise', 'immediateActions', 'significanceReasons'].includes(field)) return [];
      if (['confidentialityImpact', 'integrityImpact', 'availabilityImpact'].includes(field)) return 'none';
      return null;
    }

    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.normalizeHistoryValue(field, item));

    if (typeof value === 'object') {
      const objectValue = value as any;
      if (typeof objectValue.toJSON === 'function') {
        return objectValue.toJSON();
      }

      return Object.fromEntries(
        Object.entries(objectValue)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entryValue]) => [key, this.normalizeHistoryValue(key, entryValue)])
      );
    }

    return value;
  }

  private historyValuesEqual(field: string, oldValue: unknown, newValue: unknown) {
    if (newValue === undefined) return true;
    return JSON.stringify(this.normalizeHistoryValue(field, oldValue)) === JSON.stringify(this.normalizeHistoryValue(field, newValue));
  }

  /**
   * Get the change history for a specific incident.
   * Returns entries in chronological order (ascending by createdAt).
   */
  async getHistory(incidentId: string, query: GetHistoryQuery = {}) {
    const { action, limit = 100, offset = 0 } = query;

    const historyEntry = (prisma as any).incidentHistoryEntry;
    if (!historyEntry) {
      console.warn('IncidentService.getHistory: incidentHistoryEntry model not available on prisma client');
      return [];
    }

    const where: any = { incidentId };
    if (action) {
      where.action = action;
    }

    const entries = await historyEntry.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    return entries;
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
      include: {
        assessments: true,
        reports: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { createdAt: 'desc' } },
        escalations: true,
        knowledgeTimeChanges: { orderBy: { changedAt: 'desc' } },
        notificationDeadlines: { orderBy: { deadlineDate: 'asc' } },
        significanceRuleVersion: true,
        incidentAssets: { include: { asset: { select: { id: true, displayId: true, name: true } } } },
        serviceLinks: { include: { service: { select: { id: true, displayId: true, name: true } } } },
        processLinks: { include: { process: { select: { id: true, displayId: true, name: true } } } },
      } as Prisma.IncidentInclude,
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

    // Incident history entry (AUDIT-001)
    await this.recordHistoryEntry(incident.id, 'CREATE', `Created incident: ${data.title}`, {}, createdBy);

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

    // Compute field changes for history (AUDIT-001)
    const fieldChanges: Record<string, { old?: unknown; new?: unknown }> = {};
    const allFields = Object.keys(data).filter(k => !this.relationUpdateFields.includes(k) && (data as any)[k] !== undefined);
    for (const key of allFields) {
      const oldVal = (existing as any)[key];
      const newVal = (data as any)[key];
      if (!this.historyValuesEqual(key, oldVal, newVal)) {
        fieldChanges[key] = { old: oldVal, new: newVal };
      }
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
        ...Object.fromEntries(Object.entries(data).filter(([key]) => !this.relationUpdateFields.includes(key))),
        updatedBy,
      } as any,
    });

    // Incident history entry (AUDIT-001): one summarized entry per update request.
    const statusChanged = data.status !== undefined && !this.historyValuesEqual('status', (existing as any).status, data.status);
    if (statusChanged) {
      const { status: _statusChange, ...otherFieldChanges } = fieldChanges;
      const otherChangedFields = Object.keys(otherFieldChanges);
      // Only include otherFieldChanges in details; exclude oldStatus/newStatus from fieldChanges
      // because they are already expressed in the summary line and would render as "-" in the generic changes table.
      const details: Record<string, unknown> = { oldStatus: (existing as any).status, newStatus: data.status };
      if (otherChangedFields.length > 0) {
        for (const field of otherChangedFields) {
          details[field] = otherFieldChanges[field];
        }
      }
      const summarySuffix = otherChangedFields.length ? `; updated fields: ${otherChangedFields.join(', ')}` : '';
      await this.recordHistoryEntry(id, 'STATUS_CHANGE', `Status changed from ${(existing as any).status} to ${data.status}${summarySuffix}`, details, updatedBy);
    } else if (Object.keys(fieldChanges).length > 0) {
      const changedFields = Object.keys(fieldChanges).join(', ');
      await this.recordHistoryEntry(id, 'UPDATE', `Updated incident: ${existing.title} (${changedFields})`, fieldChanges, updatedBy);
    }

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

    // Incident history entry (AUDIT-001)
    await this.recordHistoryEntry(id, 'DELETE', `Archived incident: ${existing.title}`, {}, deletedBy);

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
    if (!data.isReportable) {
      const approver = await prisma.user.findFirst({
        where: { id: data.decisionApprovedBy, isActive: true, isArchived: false },
        select: { id: true },
      });
      if (!approver) throw new AppError('Decision approver must be an active user', 400);
    }

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

    // Incident history entry (AUDIT-001)
    await this.recordHistoryEntry(incidentId, 'ASSESSMENT', `Assessed incident: ${data.isReportable ? 'reportable' : 'not reportable'}`, { isReportable: data.isReportable, justification: data.reportingJustification }, data.assessorId);

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
    // Incident history entry (AUDIT-001)
    await this.recordHistoryEntry(incidentId, 'KNOWLEDGE_TIME_CHANGE', `Changed knowledge time: ${reason}`, { oldKnowledgeTime: incident.knowledgeTime.toISOString(), newKnowledgeTime: newKnowledgeTime.toISOString() }, changedBy);
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
    // Incident history entries (AUDIT-001)
    await this.recordHistoryEntry(incidentId, 'STATUS_CHANGE', `Status changed to closed`, { oldStatus: incident.status, newStatus: 'closed' }, closedBy);
    await this.recordHistoryEntry(incidentId, 'CLOSE', data.closureSummary ?? 'Closed incident with root cause and measures evaluation', { rootCause, measuresEvaluation, closureSummary: data.closureSummary }, closedBy);
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

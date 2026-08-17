import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { authorizationService } from './authorization.service';
import { validateTransition } from './statusTransition';

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

// Workflow state (status/notificationStatus) is intentionally excluded:
// state changes run exclusively through the dedicated status transition endpoint.
export type UpdateIncidentData = Partial<CreateIncidentData>;

export interface ListIncidentsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  severity?: string;
}

export interface AssessIncidentData {
  isReportable: boolean;
  reportingJustification?: string;
  decisionNotToReport?: string;
  decisionApprovedBy?: string;
}

export interface DecideIncidentNonReportableApprovalData {
  decision: 'approve' | 'reject';
  returnReason?: string;
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

  private async requireEligibleNonReportableApprover(approverId: string, assessorId: string, incidentId: string) {
    if (approverId === assessorId) throw new AppError('Decision approver must differ from assessor', 403);

    const approver = await prisma.user.findFirst({
      where: { id: approverId, isActive: true, isArchived: false },
      select: { id: true },
    });
    if (!approver) throw new AppError('Decision approver must be an active, non-archived user', 403);

    const [canApprove, canReadIncident] = await Promise.all([
      authorizationService.canForEntity(approverId, 'nis2.approve', 'incidents', incidentId),
      authorizationService.canForEntity(approverId, 'incidents.read', 'incidents', incidentId),
    ]);
    if (!canApprove) throw new AppError('Decision approver requires nis2.approve for the incident scope', 403);
    if (!canReadIncident) throw new AppError('Decision approver requires read access to the incident', 403);
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
   * Accepts the prisma client or a transaction handle so the entry can be
   * written atomically together with the business change and the audit entry.
   */
  private async recordHistoryEntry(db: any, incidentId: string, action: IncidentHistoryAction, summary: string, fieldChanges: Record<string, { old?: unknown; new?: unknown } | unknown> = {}, actorId?: string, ipAddress?: string, userAgent?: string) {
    const historyEntry = db.incidentHistoryEntry;
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
    await this.recordHistoryEntry(prisma, incident.id, 'CREATE', `Created incident: ${data.title}`, {}, createdBy);

    return incident;
  }

  async update(id: string, data: UpdateIncidentData, updatedBy?: string) {
    if ((data as Record<string, unknown>).status !== undefined || (data as Record<string, unknown>).notificationStatus !== undefined) {
      throw new AppError('Incident status is workflow state and can only be changed through the dedicated status transition endpoint', 400);
    }
    const existing = await prisma.incident.findUnique({ where: { id } });
    if (!existing) throw new AppError('Incident not found', 404);

    if (data.knowledgeTime !== undefined && existing.knowledgeTime !== null && new Date(data.knowledgeTime).getTime() !== existing.knowledgeTime.getTime()) {
      throw new AppError('Knowledge time is protected and must be changed through the dedicated endpoint with reason', 400);
    }

    const updateData = Object.fromEntries(Object.entries(data).filter(([key]) => !this.relationUpdateFields.includes(key)));
    const ruleVersion = (existing as any).significanceRuleVersionId
      ? await (prisma as any).nis2IncidentSignificanceRuleVersion.findUnique({ where: { id: (existing as any).significanceRuleVersionId } })
      : await this.ensureDefaultSignificanceRules(updatedBy);
    const mergedIncident = { ...(existing as any), ...updateData };
    const evaluatorFields = new Set(
      (Array.isArray(ruleVersion?.rules) ? ruleVersion.rules : DEFAULT_SIGNIFICANCE_RULES.rules)
        .map((rule: any) => rule.field)
    );
    const significanceInputsChanged = Object.keys(updateData).some((field) => evaluatorFields.has(field));
    const significance = significanceInputsChanged ? this.evaluateSignificance(mergedIncident, ruleVersion) : undefined;

    // Compute field changes for history (AUDIT-001)
    const fieldChanges: Record<string, { old?: unknown; new?: unknown } | unknown> = {};
    const allFields = Object.keys(data).filter(k => !this.relationUpdateFields.includes(k) && (data as any)[k] !== undefined);
    for (const key of allFields) {
      const oldVal = (existing as any)[key];
      const newVal = (data as any)[key];
      if (!this.historyValuesEqual(key, oldVal, newVal)) {
        fieldChanges[key] = { old: oldVal, new: newVal };
      }
    }

    // Audit log for incident update (if status or severity changed)
    if (updatedBy && data.severity !== undefined) {
      await auditService.logEventStandalone(prisma, {
        userId: updatedBy,
        action: 'INCIDENT_UPDATE',
        entityType: 'Incident',
        entityId: id,
        details: `Updated incident: ${existing.title}`,
        oldValue: { severity: existing.severity },
        newValue: { severity: data.severity ?? existing.severity },
      });
    }

    const incident = await prisma.$transaction(async (tx) => {
      const result = await tx.incident.update({
        where: { id },
        data: {
          ...updateData,
          ...(significance ? {
            isSignificant: significance.isSignificant,
            significanceReasons: significance.reasons,
            // Becoming significant begins the established assessment/deadline workflow.
            ...(significance.isSignificant && !existing.isSignificant ? { notificationStatus: 'pending_assessment' } : {}),
          } : {}),
          updatedBy,
        } as any,
      });
      if (significance?.isSignificant && !existing.isSignificant) {
        await this.createDeadlinesForIncident(tx, id, existing.knowledgeTime);
      }
      return result;
    });

    // Incident history entry (AUDIT-001)
    if (Object.keys(fieldChanges).length > 0) {
      const changedFields = Object.keys(fieldChanges).join(', ');
      await this.recordHistoryEntry(prisma, id, 'UPDATE', `Updated incident: ${existing.title} (${changedFields})`, fieldChanges, updatedBy);
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
    await this.recordHistoryEntry(prisma, id, 'DELETE', `Archived incident: ${existing.title}`, {}, deletedBy);

    await prisma.incident.update({
      where: { id },
      data: { isArchived: true },
    });

    return { success: true };
  }

  async assessIncident(incidentId: string, data: AssessIncidentData, actorId: string) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    if (!data.isReportable && !data.decisionNotToReport?.trim()) throw new AppError('Decision not to report requires justification', 400);
    if (!data.isReportable && !data.decisionApprovedBy?.trim()) throw new AppError('Decision not to report requires approval', 400);
    if (!data.isReportable) {
      await this.requireEligibleNonReportableApprover(data.decisionApprovedBy!, actorId, incidentId);
    }

    const incidentAny = incident as any;
    const ruleVersion = incidentAny.significanceRuleVersionId
      ? await (prisma as any).nis2IncidentSignificanceRuleVersion.findUnique({ where: { id: incidentAny.significanceRuleVersionId } })
      : await this.ensureDefaultSignificanceRules(actorId);
    const evaluated = this.evaluateSignificance(incident as any, ruleVersion);

    const assessment = await prisma.$transaction(async (tx) => {
      const savedAssessment = await (tx as any).incidentAssessment.upsert({
        where: { incidentId },
        update: {
          isReportable: data.isReportable,
          reportingJustification: data.reportingJustification,
          decisionNotToReport: data.decisionNotToReport,
          decisionApprovalAssigneeId: data.isReportable ? null : data.decisionApprovedBy,
          decisionApprovedBy: null,
          decisionApprovedAt: null,
          status: data.isReportable ? 'active' : 'pending_approval',
          significanceRuleVersionId: ruleVersion.id,
          evaluatedRules: evaluated,
          assessorId: actorId,
          updatedBy: actorId,
        },
        create: {
          incidentId,
          isReportable: data.isReportable,
          reportingJustification: data.reportingJustification,
          decisionNotToReport: data.decisionNotToReport,
          decisionApprovalAssigneeId: data.isReportable ? undefined : data.decisionApprovedBy,
          assessorId: actorId,
          status: data.isReportable ? 'active' : 'pending_approval',
          significanceRuleVersionId: ruleVersion.id,
          evaluatedRules: evaluated,
        },
      });
      await tx.incident.update({
        where: { id: incidentId },
        data: { notificationStatus: data.isReportable ? 'pending_assessment' : 'pending_non_reportable_approval', updatedBy: actorId },
      });
      return savedAssessment;
    });

    // Incident history entry (AUDIT-001)
    await this.recordHistoryEntry(prisma, incidentId, 'ASSESSMENT', `Assessed incident: ${data.isReportable ? 'reportable' : 'not reportable'}`, { isReportable: data.isReportable, justification: data.reportingJustification }, actorId);

    return assessment;
  }

  async decideNonReportableAssessment(incidentId: string, data: DecideIncidentNonReportableApprovalData, actorId: string) {
    const assessment = await (prisma as any).incidentAssessment.findUnique({ where: { incidentId } });
    if (!assessment) throw new AppError('Incident assessment not found', 404);
    if (assessment.isReportable || assessment.status !== 'pending_approval') throw new AppError('Non-reportable decision is not pending approval', 409);
    if (assessment.assessorId === actorId) throw new AppError('Assessor cannot approve their own decision', 403);
    if (assessment.decisionApprovalAssigneeId !== actorId) throw new AppError('Only the assigned approver can decide this assessment', 403);

    await this.requireEligibleNonReportableApprover(actorId, assessment.assessorId, incidentId);

    const approved = data.decision === 'approve';
    const updated = await prisma.$transaction(async (tx) => {
      const decisionAt = new Date();
      const decisionUpdate = await (tx as any).incidentAssessment.updateMany({
        where: { incidentId, isReportable: false, status: 'pending_approval', decisionApprovalAssigneeId: actorId },
        data: {
          status: approved ? 'approved' : 'returned',
          decisionApprovedBy: approved ? actorId : null,
          decisionApprovedAt: approved ? decisionAt : null,
          updatedBy: actorId,
          ...(approved ? {} : { decisionApprovalAssigneeId: null, reportingJustification: data.returnReason }),
        },
      });
      if (decisionUpdate.count !== 1) throw new AppError('Non-reportable decision was already decided', 409);
      await tx.incident.update({
        where: { id: incidentId },
        data: { notificationStatus: approved ? 'not_required' : 'pending_assessment', updatedBy: actorId },
      });
      return (tx as any).incidentAssessment.findUnique({ where: { incidentId } });
    });
    await this.recordHistoryEntry(prisma, incidentId, 'ASSESSMENT', approved ? 'Approved non-reportable decision' : `Returned non-reportable decision: ${data.returnReason}`, { decision: data.decision }, actorId);
    return updated;
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
    const oldKnowledgeTime = incident.knowledgeTime ? new Date(incident.knowledgeTime) : new Date();
    // Knowledge-time change, deadline recalculation, audit entry and history
    // entry run in ONE database transaction: if the audit or history write
    // fails, the knowledge-time change and the deadline recalculation roll
    // back as well — the client never observes a changed knowledge time
    // without a complete audit trail (and vice versa).
    //
    // The knowledge time is a NIS2-relevant moment: it drives every statutory
    // reporting deadline, so its audit trail must be atomic with the change.
    const updated = await prisma.$transaction(async (tx) => {
      await (tx as any).incidentKnowledgeTimeChange.create({ data: { incidentId, oldKnowledgeTime: oldKnowledgeTime, newKnowledgeTime, reason, changedBy } });
      const result = await tx.incident.update({ where: { id: incidentId }, data: { knowledgeTime: newKnowledgeTime, updatedBy: changedBy } });
      await tx.notificationDeadline.deleteMany({ where: { incidentId, status: 'pending' } });
      await this.createDeadlinesForIncident(tx, incidentId, newKnowledgeTime);
      await auditService.logEvent(tx, { userId: changedBy, action: 'INCIDENT_KNOWLEDGE_TIME_CHANGE', entityType: 'Incident', entityId: incidentId, details: reason, oldValue: { knowledgeTime: oldKnowledgeTime.toISOString() }, newValue: { knowledgeTime: newKnowledgeTime.toISOString() } });
      // Incident history entry (AUDIT-001)
      await this.recordHistoryEntry(tx, incidentId, 'KNOWLEDGE_TIME_CHANGE', `Changed knowledge time: ${reason}`, { oldKnowledgeTime: oldKnowledgeTime.toISOString(), newKnowledgeTime: newKnowledgeTime.toISOString() }, changedBy);
      return result;
    });
    return updated;
  }

  /**
   * Dedicated incident status transition. Workflow state changes run exclusively
   * through this method (never through the generic update path). 'closed' is
   * intentionally not reachable here: closing requires the gated closeIncident
   * flow (root cause, measures evaluation, final report).
   */
  async changeIncidentStatus(incidentId: string, data: { status: string; reason: string }, actorId: string) {
    if (!data?.reason?.trim()) throw new AppError('Changing incident status requires a reason', 400);
    const newStatus = data.status;
    if (newStatus === 'closed') throw new AppError('Closing an incident requires the dedicated close endpoint with root cause, measures evaluation and final report', 400);
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new AppError('Incident not found', 404);
    if (incident.status === newStatus) throw new AppError(`Incident is already in status '${newStatus}'`, 400);
    const validation = validateTransition('incidents', incident.status, newStatus);
    if (!validation.allowed) throw new AppError(validation.message ?? `Invalid incident status transition from '${incident.status}' to '${newStatus}'`, 400);
    const oldStatus = incident.status;
    // Compare-and-set: atomically apply the transition only if the status is
    // still the value we validated against. A concurrent status change in the
    // window between the read and the write loses the race and receives a clean
    // 409 Conflict (same error class as the non-reportable approval race).
    //
    // CAS update, audit entry and history entry run in ONE database
    // transaction: if the audit or history write fails, the status change
    // rolls back as well — the client never observes a changed status without
    // a complete audit trail (and vice versa).
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await (tx as any).incident.updateMany({
        where: { id: incidentId, status: oldStatus },
        data: { status: newStatus, updatedBy: actorId },
      } as any);
      if (updateResult?.count !== 1) throw new AppError('Incident status changed concurrently', 409);
      const current = await tx.incident.findUnique({ where: { id: incidentId } });
      await auditService.logEvent(tx, { userId: actorId, action: 'INCIDENT_STATUS_CHANGE', entityType: 'Incident', entityId: incidentId, details: data.reason, oldValue: { status: oldStatus }, newValue: { status: newStatus } });
      // Incident history entry (AUDIT-001)
      await this.recordHistoryEntry(tx, incidentId, 'STATUS_CHANGE', `Status changed from ${oldStatus} to ${newStatus}: ${data.reason}`, { oldStatus, newStatus }, actorId);
      return current;
    });
    return updated;
  }

  async createIncidentReport(incidentId: string, reportData: { reportType: IncidentReportType; title?: string; content: Record<string, unknown>; recipient?: string; submissionMethod?: string; submissionProof?: string }, actorId: string) {
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
        submittedBy: reportData.submissionProof ? actorId : undefined,
        recipient: reportData.recipient,
        submissionMethod: reportData.submissionMethod,
        submissionProof: reportData.submissionProof,
        exportPayload: this.buildReportExportPayload(incident, reportData.reportType, reportData.content),
        createdBy: actorId,
      },
    });
    if (deadline && reportData.submissionProof) await (prisma as any).notificationDeadline.update({ where: { id: deadline.id }, data: { status: 'sent', sentAt: new Date(), sentBy: actorId, submissionProof: reportData.submissionProof } });
    await auditService.logEventStandalone(prisma, { userId: actorId, action: 'INCIDENT_REPORT_CREATE', entityType: 'IncidentReport', entityId: report.id, details: `Created ${reportData.reportType} report for ${incident.displayId}` });
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
    // Fast-fail before any write: closing an already closed incident is a
    // client error, not a concurrent-change race.
    if (incident.status === 'closed') throw new AppError('Incident is already closed', 409);
    const rootCause = data.rootCause ?? incident.rootCause;
    const measuresEvaluation = data.measuresEvaluation ?? incident.measuresEvaluation;
    if (!rootCause?.trim()) throw new AppError('Incident cannot be closed without root cause', 400);
    if (!measuresEvaluation?.trim()) throw new AppError('Incident cannot be closed without measures evaluation', 400);
    if (incident.isSignificant) {
      const finalReport = incident.reports?.find((report: any) => report.reportType === 'monthly_final_report' && report.status === 'submitted');
      if (!finalReport) throw new AppError('Significant incident requires submitted monthly final report before closure', 400);
    }
    const oldStatus = incident.status;
    // Compare-and-set guard + audit entry + both history entries run in ONE
    // database transaction:
    //
    // 1. Atomicity — if the audit or history write fails, the close itself
    //    rolls back. The client never observes a closed incident without a
    //    complete audit trail (same guarantee as changeIncidentStatus).
    //
    // 2. Concurrency — the updateMany is only applied while the incident is
    //    still in an open state (status != 'closed'). A second parallel
    //    /close request loses the race, sees count !== 1, and receives a
    //    clean 409 Conflict instead of rewriting closedAt/closedBy and
    //    duplicating the CLOSE/STATUS_CHANGE history entries.
    const updated = await prisma.$transaction(async (tx) => {
      const updateResult = await (tx as any).incident.updateMany({
        where: { id: incidentId, status: { not: 'closed' } },
        data: { rootCause, lessonsLearned: data.lessonsLearned ?? incident.lessonsLearned, measuresEvaluation, closureSummary: data.closureSummary, status: 'closed', closedAt: new Date(), closedBy, updatedBy: closedBy },
      } as any);
      if (updateResult?.count !== 1) throw new AppError('Incident is already closed', 409);
      const current = await tx.incident.findUnique({ where: { id: incidentId } });
      await auditService.logEvent(tx, { userId: closedBy, action: 'INCIDENT_CLOSE', entityType: 'Incident', entityId: incidentId, details: data.closureSummary ?? 'Closed incident with root cause and measures evaluation' });
      // Incident history entries (AUDIT-001)
      await this.recordHistoryEntry(tx, incidentId, 'STATUS_CHANGE', `Status changed to closed`, { oldStatus, newStatus: 'closed' }, closedBy);
      await this.recordHistoryEntry(tx, incidentId, 'CLOSE', data.closureSummary ?? 'Closed incident with root cause and measures evaluation', { rootCause, measuresEvaluation, closureSummary: data.closureSummary }, closedBy);
      return current;
    });
    return updated;
  }

  async createReport(incidentId: string, reportData: {
    title: string;
    content: string;
  }, actorId: string) {
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    return this.createIncidentReport(incidentId, { reportType: 'interim_report', title: reportData.title, content: { text: reportData.content } }, actorId);
  }
}

export const incidentService = new IncidentService();

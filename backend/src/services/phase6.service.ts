import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService, AuditAction } from './audit.service';
import { reminderService } from './reminder.service';
import { PHASE6_MODEL_MAP } from './phase6.resources';

type AnyObject = Record<string, any>;

const CREATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const UPDATE_ACTION: AuditAction = 'CONFIG_CHANGE';
const DELETE_ACTION: AuditAction = 'CONFIG_CHANGE';

export class Phase6Service {
  private getConfig(resource: string) {
    const config = PHASE6_MODEL_MAP[resource];
    if (!config) throw new AppError(`Unsupported Phase 6 resource: ${resource}`, 404);
    return config;
  }

  private getDelegate(resource: string): any {
    const config = this.getConfig(resource);
    return (prisma as any)[config.delegate];
  }

  private displayId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  private csvEscape(value: unknown) {
    const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  async list(resource: string, query: AnyObject = {}) {
    const config = this.getConfig(resource);
    const page = Number(query.page ?? 1);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const skip = (page - 1) * limit;
    const where: AnyObject = {};

    if (query.status) where.status = String(query.status);
    if (query.ownerId) where.OR = [{ ownerId: String(query.ownerId) }, { ownerId: String(query.ownerId) }];
    if (query.search) {
      where.OR = config.searchable.map((field) => ({ [field]: { contains: String(query.search), mode: 'insensitive' } }));
    }
    if (query.dueBefore && config.dueField) {
      where[config.dueField] = { lte: new Date(String(query.dueBefore)) };
    }
    if (query.overdue === 'true' && config.dueField) {
      where[config.dueField] = { lte: new Date() };
      where.status = { notIn: ['completed', 'closed', 'cancelled', 'approved'] };
    }

    const delegate = this.getDelegate(resource);
    const defaultOrder = config.defaultOrderBy ?? { createdAt: 'desc' as const };
    const [data, total] = await Promise.all([
      delegate.findMany({ where, skip, take: limit, orderBy: defaultOrder }),
      delegate.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(resource: string, id: string) {
    const record = await this.getDelegate(resource).findUnique({ where: { id } });
    if (!record) throw new AppError(`${this.getConfig(resource).entityType} not found`, 404);
    return record;
  }

  async create(resource: string, data: AnyObject, userId = 'system') {
    const config = this.getConfig(resource);
    const createData: AnyObject = { ...data, createdBy: userId };
    if (resource === 'metricValues') {
      Object.assign(createData, await this.evaluateMetricBreach(data.metricId, data.value));
    }
    if (['suppliers', 'bias', 'bcps', 'auditPrograms', 'auditPlans', 'auditFindings', 'correctiveActions', 'trainingCourses', 'managementReviews', 'securityObjectives', 'metricDefinitions', 'workflowDefinitions', 'reportDefinitions'].includes(resource)) {
      createData.displayId = createData.displayId ?? this.displayId(config.prefix);
    }
    const created = await this.getDelegate(resource).create({ data: createData });
    await auditService.logEventStandalone(prisma, { userId, action: CREATE_ACTION, entityType: config.entityType, entityId: created.id, details: `Created ${config.entityType}`, newValue: created as any });
    return created;
  }

  async update(resource: string, id: string, data: AnyObject, userId = 'system') {
    const config = this.getConfig(resource);
    const existing = await this.get(resource, id);
    const updateData = { ...data, updatedBy: userId };
    if (resource === 'metricValues' && data.value !== undefined) Object.assign(updateData, await this.evaluateMetricBreach(data.metricId ?? existing.metricId, data.value));
    const updated = await this.getDelegate(resource).update({ where: { id }, data: updateData });
    await auditService.logEventStandalone(prisma, { userId, action: UPDATE_ACTION, entityType: config.entityType, entityId: id, details: `Updated ${config.entityType}`, oldValue: existing as any, newValue: updated as any });
    return updated;
  }

  async remove(resource: string, id: string, userId = 'system') {
    const config = this.getConfig(resource);
    const existing = await this.get(resource, id);
    const delegate = this.getDelegate(resource);
    const deleted = 'isArchived' in existing ? await delegate.update({ where: { id }, data: { isArchived: true, updatedBy: userId } }) : await delegate.delete({ where: { id } });
    await auditService.logEventStandalone(prisma, { userId, action: DELETE_ACTION, entityType: config.entityType, entityId: id, details: `Deleted/archived ${config.entityType}`, oldValue: existing as any });
    return deleted;
  }

  async export(resource: string, query: AnyObject, userId = 'system') {
    const format = String(query.format ?? 'json').toLowerCase();
    if (!['json', 'csv'].includes(format)) throw new AppError('Only JSON and CSV exports are supported', 400);
    const result = await this.list(resource, { ...query, page: 1, limit: 10000 });
    const rows = result.data as AnyObject[];
    let payload: string;
    let mimeType: string;
    if (format === 'csv') {
      const columns = Array.from(rows.reduce<Set<string>>((set, row) => { Object.keys(row).forEach((key) => set.add(key)); return set; }, new Set<string>()));
      payload = [columns.join(','), ...rows.map((row) => columns.map((column) => this.csvEscape(row[column])).join(','))].join('\n');
      mimeType = 'text/csv';
    } else {
      payload = JSON.stringify(rows, null, 2);
      mimeType = 'application/json';
    }
    const job = await (prisma as any).exportJob.create({ data: { entityType: resource, format, filters: query, status: 'completed', payload, fileName: `${resource}.${format}`, mimeType, rowCount: rows.length, requestedBy: userId, completedAt: new Date() } });
    await auditService.logEventStandalone(prisma, { userId, action: 'EVIDENCE_AUDIT_PACKAGE_EXPORT', entityType: 'ExportJob', entityId: job.id, details: `Exported ${resource} as ${format}` });
    return job;
  }

  async createCorrectiveActionFromSource(sourceType: string, sourceId: string, data: AnyObject, userId = 'system') {
    const allowed = ['audit', 'incident', 'risk', 'control', 'supplier', 'bcp'];
    if (!allowed.includes(sourceType)) throw new AppError('Unsupported corrective action source', 400);
    return this.create('correctiveActions', { ...data, sourceType, sourceId }, userId);
  }

  async completeTrainingAssignment(id: string, data: AnyObject, userId = 'system') {
    const assignment = await this.get('trainingAssignments', id);
    const completion = await (prisma as any).trainingCompletion.create({ data: { assignmentId: id, courseId: assignment.courseId, userId: assignment.userId, score: data.score, result: data.result ?? 'passed', certificateUrl: data.certificateUrl, evidenceId: data.evidenceId, expiresAt: data.expiresAt, createdBy: userId } });
    await (prisma as any).trainingAssignment.update({ where: { id }, data: { status: 'completed', completedAt: completion.completedAt, completionId: completion.id } });
    await auditService.logEventStandalone(prisma, { userId, action: 'DOCUMENT_ACKNOWLEDGE', entityType: 'TrainingCompletion', entityId: completion.id, details: 'Completed training assignment' });
    return completion;
  }

  async runReminders(resource: string, userId = 'system') {
    this.getConfig(resource);
    return reminderService.runForResource(resource, userId, { sendEmail: false });
  }

  async createReportRun(data: AnyObject, userId = 'system') {
    const resource = data.module;
    const result = await this.list(resource, data.filters ?? {});
    const run = await (prisma as any).reportRun.create({ data: { definitionId: data.definitionId, module: resource, filters: data.filters ?? {}, format: data.format ?? 'json', status: 'completed', result: result.data, rowCount: result.data.length, createdBy: userId, completedAt: new Date() } });
    await auditService.logEventStandalone(prisma, { userId, action: 'EVIDENCE_AUDIT_PACKAGE_EXPORT', entityType: 'ReportRun', entityId: run.id, details: `Ran report for ${resource}` });
    return run;
  }

  async startWorkflow(definitionId: string, data: AnyObject, userId = 'system') {
    const definition = await (prisma as any).workflowDefinition.findUnique({ where: { id: definitionId } });
    if (!definition) throw new AppError('Workflow definition not found', 404);
    const states = Array.isArray(definition.states) ? definition.states : [];
    const initialState = data.initialState ?? states[0]?.key ?? states[0]?.name ?? 'start';
    const dueDate = this.calculateWorkflowDueDate(definition.dueDateRules, data.context ?? {});
    const instance = await (prisma as any).workflowInstance.create({ data: { definitionId, entityType: data.entityType ?? definition.entityType, entityId: data.entityId, currentState: initialState, context: data.context ?? {}, dueDate, createdBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'DOCUMENT_WORKFLOW_TRANSITION', entityType: 'WorkflowInstance', entityId: instance.id, details: `Started workflow ${definition.name}` });
    return instance;
  }

  async transitionWorkflow(instanceId: string, transitionKey: string, data: AnyObject, userId = 'system') {
    const instance = await (prisma as any).workflowInstance.findUnique({ where: { id: instanceId } });
    if (!instance) throw new AppError('Workflow instance not found', 404);
    const definition = await (prisma as any).workflowDefinition.findUnique({ where: { id: instance.definitionId } });
    const transitions = Array.isArray(definition?.transitions) ? definition.transitions : [];
    const transition = transitions.find((item: AnyObject) => item.key === transitionKey || item.name === transitionKey);
    if (!transition) throw new AppError('Workflow transition not allowed', 400);
    if (transition.from && transition.from !== instance.currentState) throw new AppError('Workflow transition has invalid source state', 400);
    const updated = await (prisma as any).workflowInstance.update({ where: { id: instanceId }, data: { currentState: transition.to, status: transition.to === 'completed' || transition.complete ? 'completed' : 'running', completedAt: transition.to === 'completed' || transition.complete ? new Date() : undefined } });
    await (prisma as any).workflowTransitionLog.create({ data: { instanceId, fromState: instance.currentState, toState: transition.to, transition: transitionKey, performedBy: userId, comment: data.comment } });
    if (transition.task) await (prisma as any).workflowTask.create({ data: { instanceId, title: transition.task.title ?? `Task for ${transition.to}`, assigneeId: transition.task.assigneeId ?? data.assigneeId, taskType: transition.task.type ?? 'approval', dueDate: transition.task.dueDate ? new Date(transition.task.dueDate) : undefined } });
    await auditService.logEventStandalone(prisma, { userId, action: 'DOCUMENT_WORKFLOW_TRANSITION', entityType: 'WorkflowInstance', entityId: instanceId, details: `Transitioned workflow via ${transitionKey}` });
    return updated;
  }

  private calculateWorkflowDueDate(rules: AnyObject | null, context: AnyObject) {
    const days = Number(rules?.days ?? context?.dueInDays ?? 0);
    return days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined;
  }

  private async evaluateMetricBreach(metricId: string, rawValue: Prisma.Decimal | number | string) {
    const metric = await (prisma as any).metricDefinition.findUnique({ where: { id: metricId } });
    const value = Number(rawValue);
    const thresholds = (metric?.thresholds ?? {}) as AnyObject;
    let breachStatus = 'none';
    const breaches: string[] = [];
    if (thresholds.warningMax !== undefined && value > Number(thresholds.warningMax)) { breachStatus = 'warning'; breaches.push('warningMax'); }
    if (thresholds.criticalMax !== undefined && value > Number(thresholds.criticalMax)) { breachStatus = 'critical'; breaches.push('criticalMax'); }
    if (thresholds.warningMin !== undefined && value < Number(thresholds.warningMin)) { breachStatus = breachStatus === 'critical' ? 'critical' : 'warning'; breaches.push('warningMin'); }
    if (thresholds.criticalMin !== undefined && value < Number(thresholds.criticalMin)) { breachStatus = 'critical'; breaches.push('criticalMin'); }
    const previous = await (prisma as any).metricValue.findFirst({ where: { metricId }, orderBy: { measuredAt: 'desc' } });
    const prev = previous ? Number(previous.value) : undefined;
    const trend = prev === undefined ? 'none' : value > prev ? 'up' : value < prev ? 'down' : 'stable';
    return { breachStatus, breachDetails: { breaches, thresholds, value }, trend };
  }
}

export const phase6Service = new Phase6Service();
export { PHASE6_MODEL_MAP };

import { prisma } from '../config/database';
import { authorizationService } from './authorization.service';

export const ACTION_CENTER_SOURCE_TYPES = [
  'workflowTask', 'notificationDeadline', 'correctiveAction', 'riskReviewTask',
  'trainingAssignment', 'auditFinding', 'managementReviewAction', 'documentReview',
  'supplier', 'supplierAssessment', 'businessImpactAnalysis', 'businessContinuityPlan',
  'bcpExercise', 'auditPlan', 'managementReview',
  'incidentNonReportableApproval',
] as const;
export type ActionCenterSourceType = typeof ACTION_CENTER_SOURCE_TYPES[number];
export type ActionCenterScope = 'mine' | 'authorized' | 'all';
export type ActionCenterUrgency = 'overdue' | 'critical' | 'upcoming' | 'planned';

export interface ActionCenterQuery {
  scope?: ActionCenterScope;
  sourceType?: ActionCenterSourceType;
  urgency?: ActionCenterUrgency;
  status?: string;
  dueBefore?: string;
  page?: number;
  limit?: number;
}

export interface ActionCenterItem {
  id: string;
  sourceType: ActionCenterSourceType;
  title: string;
  status: string;
  dueDate: string;
  urgency: ActionCenterUrgency;
  assignment: 'mine' | 'authorized';
  href?: string;
}

export interface ActionCenterResponse {
  data: ActionCenterItem[];
  summary: Record<ActionCenterUrgency, number>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const OPEN_STATUSES = ['open', 'pending', 'assigned', 'in_progress', 'planned', 'running', 'active', 'draft'];
const closed = (status: string) => ['completed', 'closed', 'cancelled', 'resolved', 'sent', 'withdrawn', 'archived'].includes(status.toLowerCase());
const urgencyFor = (dueDate: Date, now: Date): ActionCenterUrgency => {
  const hours = (dueDate.getTime() - now.getTime()) / 3_600_000;
  if (hours < 0) return 'overdue';
  if (hours <= 72) return 'critical';
  if (hours <= 168) return 'upcoming';
  return 'planned';
};
const NIS2_APPROVAL_SLA_MS = 24 * 3_600_000;
/** Pending NIS2 decisions do not have a persisted deadline, so derive their temporary SLA from creation. */
const nis2ApprovalDueDate = (createdAt: Date): Date => new Date(createdAt.getTime() + NIS2_APPROVAL_SLA_MS);
const item = (sourceType: ActionCenterSourceType, record: any, title: string, dueDate: Date, assignment: 'mine' | 'authorized', href?: string, now = new Date()): ActionCenterItem => ({
  id: record.id, sourceType, title, status: record.status, dueDate: dueDate.toISOString(), urgency: urgencyFor(dueDate, now), assignment, href,
});

/** Server-side read model. A source is queried only after its permission has been verified. */
export class ActionCenterService {
  async list(userId: string, query: ActionCenterQuery = {}, now = new Date()): Promise<ActionCenterResponse> {
    const scope = query.scope ?? 'all';
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const db = prisma as any;
    const items: ActionCenterItem[] = [];
    const addMine = scope !== 'authorized';
    const addAuthorized = scope !== 'mine';
    // Phase 6 records have no consistent scope relation. Do not expose them through a
    // scoped role until per-record scope filtering exists; an unscoped granting role is safe.
    const can = async (permission: any) => addAuthorized && (await authorizationService.getActiveRoles(userId)).some((role) =>
      role.permissions.has(permission) && !role.legalEntityId && !role.organizationUnitId && !role.scopeId && !role.siteId,
    );
    const openWhere = { status: { in: OPEN_STATUSES } };

    if (addMine) {
      const [workflowTasks, training, reviews, corrective, riskReviews, managementActions] = await Promise.all([
        db.workflowTask.findMany({ where: { ...openWhere, assigneeId: userId, dueDate: { not: null } } }),
        db.trainingAssignment.findMany({ where: { ...openWhere, userId, dueDate: { not: null } } }),
        db.documentReview.findMany({ where: { ...openWhere, reviewerId: userId }, include: { document: { select: { title: true } } } }),
        db.correctiveAction.findMany({ where: { ...openWhere, ownerId: userId } }),
        db.reviewTask.findMany({ where: { ...openWhere, assignedTo: userId } }),
        db.managementReviewAction.findMany({ where: { ...openWhere, ownerId: userId } }),
      ]);
      workflowTasks.forEach((r: any) => r.dueDate && items.push(item('workflowTask', r, r.title, r.dueDate, 'mine', '/isms-operations', now)));
      training.forEach((r: any) => items.push(item('trainingAssignment', r, 'Training assignment', r.dueDate, 'mine', '/isms-operations', now)));
      reviews.forEach((r: any) => items.push(item('documentReview', r, r.document?.title ?? 'Document review', r.dueDate, 'mine', undefined, now)));
      corrective.forEach((r: any) => items.push(item('correctiveAction', r, r.title, r.dueDate, 'mine', '/isms-operations', now)));
      riskReviews.forEach((r: any) => items.push(item('riskReviewTask', r, 'Risk review', r.dueDate, 'mine', '/risks', now)));
      managementActions.forEach((r: any) => items.push(item('managementReviewAction', r, r.title, r.dueDate, 'mine', '/isms-operations', now)));
      const managedDeadlines = await db.notificationDeadline.findMany({
        where: { ...openWhere, incident: { incidentManagerId: userId } },
        include: { incident: { select: { title: true } } },
      });
      managedDeadlines.forEach((r: any) => items.push(item('notificationDeadline', r, `Notification: ${r.incident.title}`, r.deadlineDate, 'mine', '/incidents', now)));
      const pendingApprovals = await db.incidentAssessment.findMany({
        where: { decisionApprovalAssigneeId: userId, status: 'pending_approval', isArchived: false },
        include: { incident: { select: { title: true } } },
      });
      pendingApprovals.forEach((r: any) => items.push(item('incidentNonReportableApproval', r, `Approve non-reportable decision: ${r.incident.title}`, nis2ApprovalDueDate(r.createdAt), 'mine', `/incidents/${r.incidentId}`, now)));
    }

    if (await can('incidents.read')) {
      const deadlines = await db.notificationDeadline.findMany({ where: { ...openWhere, incident: await authorizationService.buildReadFilter(userId, 'incidents') }, include: { incident: { select: { title: true } } } });
      deadlines.forEach((r: any) => items.push(item('notificationDeadline', r, `Notification: ${r.incident.title}`, r.deadlineDate, 'authorized', '/incidents', now)));
    }
    const authorizedSources: Array<[any, any, ActionCenterSourceType, string, string]> = [
      ['correctiveAction', 'correctiveActions.read', 'correctiveAction', 'title', '/isms-operations'],
      ['reviewTask', 'risks.read', 'riskReviewTask', 'title', '/risks'],
      ['auditFinding', 'audits.read', 'auditFinding', 'title', '/isms-operations'],
      ['managementReviewAction', 'audits.read', 'managementReviewAction', 'title', '/isms-operations'],
      ['documentReview', 'documents.read', 'documentReview', 'documentId', ''],
    ];
    for (const [delegate, permission, sourceType, titleField, href] of authorizedSources) {
      if (!(await can(permission))) continue;
      const rows = await db[delegate].findMany({ where: openWhere });
      rows.forEach((r: any) => {
        const dueDate = r.dueDate;
        if (dueDate && !closed(r.status)) items.push(item(sourceType, r, r[titleField] ?? (sourceType === 'documentReview' ? 'Document review' : sourceType), dueDate, 'authorized', href || undefined, now));
      });
    }
    const phase6Sources: Array<[any, any, ActionCenterSourceType, string, string]> = [
      ['supplier', 'suppliers.read', 'supplier', 'nextReviewDate', 'legalName'],
      ['supplierAssessment', 'suppliers.read', 'supplierAssessment', 'nextAssessmentDate', 'assessmentType'],
      ['businessImpactAnalysis', 'bcm.read', 'businessImpactAnalysis', 'nextReviewDate', 'title'],
      ['businessContinuityPlan', 'bcm.read', 'businessContinuityPlan', 'nextTestDate', 'title'],
      ['bCPExercise', 'bcm.read', 'bcpExercise', 'plannedAt', 'exerciseType'],
      ['auditPlan', 'audits.read', 'auditPlan', 'plannedStart', 'title'],
      ['managementReview', 'audits.read', 'managementReview', 'nextReviewDate', 'title'],
    ];
    for (const [delegate, permission, sourceType, dueField, titleField] of phase6Sources) {
      if (!(await can(permission))) continue;
      const rows = await db[delegate].findMany({ where: { ...openWhere, [dueField]: { not: null } } });
      rows.forEach((r: any) => r[dueField] && items.push(item(sourceType, r, r[titleField] ?? sourceType, r[dueField], 'authorized', '/isms-operations', now)));
    }

    const unique = [...new Map(items.map((entry) => [`${entry.sourceType}:${entry.id}`, entry])).values()];
    const filtered = unique.filter((r) => (!query.sourceType || r.sourceType === query.sourceType) && (!query.urgency || r.urgency === query.urgency) && (!query.status || r.status === query.status) && (!query.dueBefore || r.dueDate <= query.dueBefore!));
    filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sourceType.localeCompare(b.sourceType) || a.id.localeCompare(b.id));
    const summary = { overdue: 0, critical: 0, upcoming: 0, planned: 0 } as Record<ActionCenterUrgency, number>;
    filtered.forEach((r) => { summary[r.urgency]++; });
    return { data: filtered.slice((page - 1) * limit, page * limit), summary, pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) } };
  }
}

export const actionCenterService = new ActionCenterService();

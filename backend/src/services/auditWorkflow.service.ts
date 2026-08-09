import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './audit.service';
import { correctiveActionService } from './correctiveaction.service';

export interface AuditProgramWrite {
  title: string;
  year: number;
  scope: string;
  objectives?: string[];
  criteria?: string[];
  ownerId: string;
  status?: 'draft' | 'active' | 'completed' | 'archived';
}

export interface AuditPlanWrite {
  programId: string;
  auditType: 'internal' | 'external' | 'combined' | 'surveillance' | 'certification';
  title: string;
  scope: string;
  criteria?: string[];
  auditorIds?: string[];
  auditeeIds?: string[];
  plannedStart: Date;
  plannedEnd: Date;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
}

export interface AuditFindingWrite {
  findingType: 'nonconformity' | 'observation' | 'opportunity_for_improvement';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  requirementIds?: string[];
  controlIds?: string[];
  assetIds?: string[];
  riskIds?: string[];
  ownerId?: string;
  dueDate?: Date;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
}

export interface AuditEvidenceRelationWrite {
  evidenceId: string;
  relationType?: 'supports' | 'demonstrates' | 'contradicts';
}

export interface CapaFromFindingWrite {
  title: string;
  description: string;
  ownerId: string;
  dueDate: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  rootCause?: string;
  containmentActions?: string[];
  correctiveActions?: string[];
  effectivenessCriteria?: string;
}

const DISPLAY_PREFIX: Record<'program' | 'audit' | 'finding', string> = {
  program: 'AP', audit: 'AUD', finding: 'AF',
};

export class AuditWorkflowService {
  private displayId(kind: keyof typeof DISPLAY_PREFIX): string {
    return `${DISPLAY_PREFIX[kind]}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  async listPrograms() {
    return prisma.auditProgram.findMany({ orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] });
  }

  async createProgram(data: AuditProgramWrite, userId: string) {
    const created = await prisma.auditProgram.create({ data: { ...data, displayId: this.displayId('program'), createdBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditProgram', entityId: created.id, details: 'Created audit program', newValue: created as any });
    return created;
  }

  async updateProgram(id: string, data: Partial<AuditProgramWrite>, userId: string) {
    const previous = await this.requireProgram(id);
    const updated = await prisma.auditProgram.update({ where: { id }, data: { ...data, updatedBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditProgram', entityId: id, details: 'Updated audit program', oldValue: previous as any, newValue: updated as any });
    return updated;
  }

  async getProgramDetail(id: string) {
    const program = await this.requireProgram(id);
    const audits = await prisma.auditPlan.findMany({ where: { programId: id }, orderBy: { plannedStart: 'asc' } });
    return { program, audits };
  }

  async createAudit(data: AuditPlanWrite, userId: string) {
    await this.requireProgram(data.programId);
    if (data.plannedEnd < data.plannedStart) throw new AppError('The audit end date must be on or after its start date', 400);
    const created = await prisma.auditPlan.create({ data: { ...data, displayId: this.displayId('audit'), createdBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditPlan', entityId: created.id, details: 'Created audit within audit program', newValue: created as any });
    return created;
  }

  async updateAudit(id: string, data: Partial<AuditPlanWrite>, userId: string) {
    const previous = await this.requireAudit(id);
    const start = data.plannedStart ?? previous.plannedStart;
    const end = data.plannedEnd ?? previous.plannedEnd;
    if (end < start) throw new AppError('The audit end date must be on or after its start date', 400);
    if (data.programId) await this.requireProgram(data.programId);
    const updated = await prisma.auditPlan.update({ where: { id }, data: { ...data, updatedBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditPlan', entityId: id, details: 'Updated audit', oldValue: previous as any, newValue: updated as any });
    return updated;
  }

  async getAuditDetail(id: string) {
    const audit = await this.requireAudit(id);
    const [program, findings] = await Promise.all([
      audit.programId ? prisma.auditProgram.findUnique({ where: { id: audit.programId } }) : null,
      prisma.auditFinding.findMany({ where: { auditPlanId: id, isArchived: false }, orderBy: { createdAt: 'asc' } }),
    ]);
    return { audit, program, findings };
  }

  async createFinding(auditId: string, data: AuditFindingWrite, userId: string) {
    await this.requireAudit(auditId);
    const created = await prisma.auditFinding.create({ data: { ...data, auditPlanId: auditId, displayId: this.displayId('finding'), createdBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditFinding', entityId: created.id, details: 'Created audit finding', newValue: created as any });
    return created;
  }

  async updateFinding(id: string, data: Partial<AuditFindingWrite>, userId: string) {
    const previous = await this.requireFinding(id);
    const updated = await prisma.auditFinding.update({ where: { id }, data: { ...data, updatedBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditFinding', entityId: id, details: 'Updated audit finding', oldValue: previous as any, newValue: updated as any });
    return updated;
  }

  async getFindingDetail(id: string) {
    const finding = await this.requireFinding(id);
    const [audit, relations, correctiveAction] = await Promise.all([
      this.requireAudit(finding.auditPlanId),
      prisma.auditEvidenceRelation.findMany({ where: { auditFindingId: id }, orderBy: { createdAt: 'desc' } }),
      finding.correctiveActionId ? correctiveActionService.get(finding.correctiveActionId) : null,
    ]);
    const evidenceIds = relations.map(({ evidenceId }) => evidenceId);
    const evidence = evidenceIds.length ? await prisma.evidence.findMany({ where: { id: { in: evidenceIds }, isArchived: false } }) : [];
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    return { finding, audit, evidenceRelations: relations.map((relation) => ({ ...relation, evidence: evidenceById.get(relation.evidenceId) ?? null })), correctiveAction };
  }

  async addEvidenceRelation(findingId: string, data: AuditEvidenceRelationWrite, userId: string) {
    await this.requireFinding(findingId);
    const evidence = await prisma.evidence.findFirst({ where: { id: data.evidenceId, isArchived: false } });
    if (!evidence) throw new AppError('Evidence not found or is archived', 404);
    const relation = await prisma.auditEvidenceRelation.create({ data: { auditFindingId: findingId, evidenceId: data.evidenceId, relationType: data.relationType ?? 'supports', createdBy: userId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditEvidenceRelation', entityId: relation.id, details: 'Linked evidence to audit finding', newValue: relation as any });
    return relation;
  }

  async removeEvidenceRelation(findingId: string, relationId: string, userId: string) {
    const relation = await prisma.auditEvidenceRelation.findFirst({ where: { id: relationId, auditFindingId: findingId } });
    if (!relation) throw new AppError('Audit evidence relation not found', 404);
    await prisma.auditEvidenceRelation.delete({ where: { id: relationId } });
    await auditService.logEventStandalone(prisma, { userId, action: 'CONFIG_CHANGE', entityType: 'AuditEvidenceRelation', entityId: relationId, details: 'Unlinked evidence from audit finding', oldValue: relation as any });
  }

  async createCapaFromFinding(findingId: string, data: CapaFromFindingWrite, userId: string) {
    const finding = await this.requireFinding(findingId);
    if (finding.correctiveActionId) throw new AppError('This audit finding already has a corrective action', 409);
    const correctiveAction = await correctiveActionService.createFromSource('audit', findingId, data, userId);
    await prisma.auditFinding.update({ where: { id: findingId }, data: { correctiveActionId: correctiveAction.id, updatedBy: userId } });
    return correctiveAction;
  }

  private async requireProgram(id: string) {
    const record = await prisma.auditProgram.findUnique({ where: { id } });
    if (!record) throw new AppError('Audit program not found', 404);
    return record;
  }

  private async requireAudit(id: string) {
    const record = await prisma.auditPlan.findUnique({ where: { id } });
    if (!record) throw new AppError('Audit not found', 404);
    return record;
  }

  private async requireFinding(id: string) {
    const record = await prisma.auditFinding.findFirst({ where: { id, isArchived: false } });
    if (!record) throw new AppError('Audit finding not found', 404);
    return record;
  }
}

export const auditWorkflowService = new AuditWorkflowService();

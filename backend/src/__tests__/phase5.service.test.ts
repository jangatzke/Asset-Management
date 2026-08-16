const mockPrismaClient: any = {
  incident: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  user: { findFirst: jest.fn() },
  notificationDeadline: { createMany: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  incidentAssessment: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  incidentKnowledgeTimeChange: { create: jest.fn() },
  incidentReport: { create: jest.fn(), findUnique: jest.fn() },
  incidentCommunication: { create: jest.fn() },
  incidentEscalation: { create: jest.fn() },
  nis2IncidentSignificanceRuleVersion: { upsert: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  nis2QuestionnaireVersion: { upsert: jest.fn(), create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  nis2Assessment: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  nis2Registration: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  nis2RegistrationChange: { create: jest.fn() },
  framework: { upsert: jest.fn() },
  frameworkVersion: { create: jest.fn(), findFirst: jest.fn() },
  control: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  controlRequirementMapping: { createMany: jest.fn() },
  auditLog: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) }, // Phase 9: hash-chain lookup
  $transaction: jest.fn(async (cb: any) => cb(mockPrismaClient)),
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

const mockAuthorizationService = { canForEntity: jest.fn() };
jest.mock('../services/authorization.service', () => ({ authorizationService: mockAuthorizationService }));

import { incidentService } from '../services/incident.service';
import { nis2Service, NIS2_TOPICS } from '../services/nis2.service';
import { UpdateIncidentSchema } from 'shared';

describe('Phase 5 NIS-2 and incident workflow services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.auditLog.create.mockResolvedValue({});
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.upsert.mockResolvedValue({ id: 'rules-1', version: '1.0', rules: [
      { key: 'critical_severity', field: 'severity', operator: 'in', value: ['critical', 'high'], reason: 'High or critical incident severity' },
    ] });
    mockAuthorizationService.canForEntity.mockResolvedValue(true);
  });

  it('creates reportable incident deadlines from protected knowledge time', async () => {
    const knowledgeTime = new Date('2026-07-18T10:00:00Z');
    mockPrismaClient.incident.create.mockResolvedValue({ id: 'inc-1', displayId: 'INC-1', title: 'Outage', knowledgeTime, severity: 'critical' });

    await incidentService.create({ title: 'Outage', description: 'Major service outage', detectionTime: knowledgeTime, knowledgeTime, severity: 'critical', incidentManagerId: 'manager-1' }, 'user-1');

    expect(mockPrismaClient.notificationDeadline.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ notificationType: 'early_warning_24h', deadlineDate: new Date('2026-07-19T10:00:00Z') }),
        expect.objectContaining({ notificationType: 'incident_notification_72h', deadlineDate: new Date('2026-07-21T10:00:00Z') }),
      ]),
    }));
  });

  it('requires reason and audits protected knowledge time changes', async () => {
    const oldKnowledgeTime = new Date('2026-07-18T10:00:00Z');
    const newKnowledgeTime = new Date('2026-07-18T12:00:00Z');
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', title: 'Outage', knowledgeTime: oldKnowledgeTime });
    mockPrismaClient.incident.update.mockResolvedValue({ id: 'inc-1', knowledgeTime: newKnowledgeTime });

    await expect(incidentService.changeKnowledgeTime('inc-1', newKnowledgeTime, '', 'user-1')).rejects.toThrow('reason');
    await incidentService.changeKnowledgeTime('inc-1', newKnowledgeTime, 'Forensic timestamp correction', 'user-1');

    expect(mockPrismaClient.incidentKnowledgeTimeChange.create).toHaveBeenCalledWith({ data: expect.objectContaining({ reason: 'Forensic timestamp correction' }) });
    expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'INCIDENT_KNOWLEDGE_TIME_CHANGE' }) });
  });

  it('requires justification and approval for non-reporting decision', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'low' });
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValue({ id: 'rules-1', rules: [] });
    await expect(incidentService.assessIncident('inc-1', { isReportable: false }, 'assessor-1')).rejects.toThrow('justification');
    await expect(incidentService.assessIncident('inc-1', { isReportable: false, decisionNotToReport: 'Below threshold' }, 'assessor-1')).rejects.toThrow('approval');
  });

  it('atomically submits a non-reportable assessment for approval without changing rule-derived significance', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'low', isSignificant: true, significanceReasons: ['High impact'] });
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValue({ id: 'rules-1', rules: [] });
    mockPrismaClient.user.findFirst.mockResolvedValue({ id: '5d234b9e-5a99-41e5-b273-41d814574c4d' });
    mockPrismaClient.incidentAssessment.upsert.mockResolvedValue({ id: 'assessment-1' });

    await incidentService.assessIncident('inc-1', { isReportable: false, decisionNotToReport: 'Below threshold', decisionApprovedBy: '5d234b9e-5a99-41e5-b273-41d814574c4d' }, 'assessor-1');

    expect(mockPrismaClient.user.findFirst).toHaveBeenCalledWith({ where: { id: '5d234b9e-5a99-41e5-b273-41d814574c4d', isActive: true, isArchived: false }, select: { id: true } });
    expect(mockPrismaClient.incidentAssessment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ decisionApprovalAssigneeId: '5d234b9e-5a99-41e5-b273-41d814574c4d', decisionApprovedBy: null, decisionApprovedAt: null, status: 'pending_approval' }),
      create: expect.objectContaining({ decisionApprovalAssigneeId: '5d234b9e-5a99-41e5-b273-41d814574c4d', status: 'pending_approval' }),
    }));
    expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: 'pending_non_reportable_approval' }) }));
    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ isSignificant: expect.anything(), significanceReasons: expect.anything() }) }));
    expect(mockAuthorizationService.canForEntity).toHaveBeenCalledWith('5d234b9e-5a99-41e5-b273-41d814574c4d', 'nis2.approve', 'incidents', 'inc-1');
    expect(mockAuthorizationService.canForEntity).toHaveBeenCalledWith('5d234b9e-5a99-41e5-b273-41d814574c4d', 'incidents.read', 'incidents', 'inc-1');
  });

  it('keeps the reportable assessment transition in the same transaction', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'high', isSignificant: true });
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValue({ id: 'rules-1', rules: [] });
    mockPrismaClient.incidentAssessment.upsert.mockResolvedValue({ id: 'assessment-1', status: 'active' });

    await incidentService.assessIncident('inc-1', { isReportable: true, reportingJustification: 'Report required' }, 'assessor-1');

    expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrismaClient.incidentAssessment.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'active' }) }));
    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: 'pending_assessment' }) }));
  });

  it('propagates a related incident transition failure from the assessment transaction', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'low' });
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValue({ id: 'rules-1', rules: [] });
    mockPrismaClient.user.findFirst.mockResolvedValue({ id: 'approver-1' });
    mockPrismaClient.incidentAssessment.upsert.mockResolvedValue({ id: 'assessment-1' });
    mockPrismaClient.incident.update.mockRejectedValueOnce(new Error('incident transition failed'));

    await expect(incidentService.assessIncident('inc-1', { isReportable: false, decisionNotToReport: 'Below threshold', decisionApprovedBy: 'approver-1' }, 'assessor-1')).rejects.toThrow('incident transition failed');
    expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects self-assignment for non-reportable approval', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'low' });
    await expect(incidentService.assessIncident('inc-1', { isReportable: false, decisionNotToReport: 'Below threshold', decisionApprovedBy: 'assessor-1' }, 'assessor-1')).rejects.toThrow('differ from assessor');
    expect(mockPrismaClient.user.findFirst).not.toHaveBeenCalled();
  });

  it('atomically approves only an assigned eligible approver and transitions the incident to not required', async () => {
    mockPrismaClient.incidentAssessment.findUnique.mockResolvedValue({ incidentId: 'inc-1', isReportable: false, status: 'pending_approval', assessorId: 'assessor-1', decisionApprovalAssigneeId: 'approver-1' });
    await expect(incidentService.decideNonReportableAssessment('inc-1', { decision: 'approve' }, 'spoofed-user')).rejects.toThrow('Only the assigned approver');
    await expect(incidentService.decideNonReportableAssessment('inc-1', { decision: 'approve' }, 'assessor-1')).rejects.toThrow('cannot approve their own');
    mockPrismaClient.user.findFirst.mockResolvedValue({ id: 'approver-1' });
    mockPrismaClient.incidentAssessment.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.incidentAssessment.findUnique.mockResolvedValueOnce({ incidentId: 'inc-1', isReportable: false, status: 'pending_approval', assessorId: 'assessor-1', decisionApprovalAssigneeId: 'approver-1' }).mockResolvedValueOnce({ id: 'assessment-1', decisionApprovedBy: 'approver-1' });
    await incidentService.decideNonReportableAssessment('inc-1', { decision: 'approve' }, 'approver-1');
    expect(mockPrismaClient.incidentAssessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'pending_approval', decisionApprovalAssigneeId: 'approver-1' }), data: expect.objectContaining({ decisionApprovedBy: 'approver-1', decisionApprovedAt: expect.any(Date), status: 'approved' }) }));
    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: 'not_required' }) }));
  });

  it('returns a pending decision without setting approval attribution', async () => {
    mockPrismaClient.incidentAssessment.findUnique.mockResolvedValue({ incidentId: 'inc-1', isReportable: false, status: 'pending_approval', assessorId: 'assessor-1', decisionApprovalAssigneeId: 'approver-1' });
    mockPrismaClient.user.findFirst.mockResolvedValue({ id: 'approver-1' });
    mockPrismaClient.incidentAssessment.updateMany.mockResolvedValue({ count: 1 });
    mockPrismaClient.incidentAssessment.findUnique.mockResolvedValueOnce({ incidentId: 'inc-1', isReportable: false, status: 'pending_approval', assessorId: 'assessor-1', decisionApprovalAssigneeId: 'approver-1' }).mockResolvedValueOnce({ id: 'assessment-1', status: 'returned' });
    await incidentService.decideNonReportableAssessment('inc-1', { decision: 'reject', returnReason: 'Please add evidence' }, 'approver-1');
    expect(mockPrismaClient.incidentAssessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'returned', decisionApprovedBy: null, decisionApprovedAt: null, decisionApprovalAssigneeId: null }) }));
    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificationStatus: 'pending_assessment' }) }));
  });

  it('rejects a non-reporting decision that names an unavailable user', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'low' });
    mockPrismaClient.user.findFirst.mockResolvedValue(null);

    await expect(incidentService.assessIncident('inc-1', { isReportable: false, decisionNotToReport: 'Below threshold', decisionApprovedBy: '5d234b9e-5a99-41e5-b273-41d814574c4d' }, 'assessor-1')).rejects.toThrow('active, non-archived');
  });

  it('rejects assignment and decision when the approver lacks scoped approval or incident read access', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', significanceRuleVersionId: 'rules-1', severity: 'low' });
    mockPrismaClient.user.findFirst.mockResolvedValue({ id: 'approver-1' });
    mockAuthorizationService.canForEntity.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(incidentService.assessIncident('inc-1', { isReportable: false, decisionNotToReport: 'Below threshold', decisionApprovedBy: 'approver-1' }, 'assessor-1')).rejects.toThrow('nis2.approve');

    mockPrismaClient.incidentAssessment.findUnique.mockResolvedValue({ incidentId: 'inc-1', isReportable: false, status: 'pending_approval', assessorId: 'assessor-1', decisionApprovalAssigneeId: 'approver-1' });
    mockAuthorizationService.canForEntity.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(incidentService.decideNonReportableAssessment('inc-1', { decision: 'approve' }, 'approver-1')).rejects.toThrow('read access');
    expect(mockPrismaClient.incidentAssessment.updateMany).not.toHaveBeenCalled();
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('recomputes significance from the merged incident and creates deadlines on a false-to-true generic update', async () => {
    const knowledgeTime = new Date('2026-07-18T10:00:00Z');
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', title: 'Outage', knowledgeTime, severity: 'low', personalDataImpact: false, isSignificant: false, significanceRuleVersionId: 'rules-1' });
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.findUnique.mockResolvedValue({ id: 'rules-1', rules: [{ key: 'personal_data', field: 'personalDataImpact', operator: 'equals', value: true, reason: 'Personal data impact' }] });
    mockPrismaClient.incident.update.mockResolvedValue({ id: 'inc-1', isSignificant: true });

    await incidentService.update('inc-1', { personalDataImpact: true }, 'user-1');

    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ personalDataImpact: true, isSignificant: true, significanceReasons: ['Personal data impact'], notificationStatus: 'pending_assessment' }) }));
    expect(mockPrismaClient.notificationDeadline.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ incidentId: 'inc-1', notificationType: 'early_warning_24h' })]) }));
  });

  it('rejects status fields from the generic incident DTO and in the service update path', async () => {
    expect(UpdateIncidentSchema.safeParse({ status: 'closed' }).success).toBe(false);
    expect(UpdateIncidentSchema.safeParse({ notificationStatus: 'not_required' }).success).toBe(false);

    await expect(incidentService.update('inc-1', { status: 'closed' } as any, 'user-1')).rejects.toThrow('dedicated status transition endpoint');
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
    expect(mockPrismaClient.auditLog.create).not.toHaveBeenCalled();
  });

  it('applies a valid incident status transition with reason, audit, and history', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', title: 'Outage', status: 'new', isSignificant: false, knowledgeTime: null });
    mockPrismaClient.incident.update.mockResolvedValue({ id: 'inc-1', status: 'under_investigation' });

    const updated = await incidentService.changeIncidentStatus('inc-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1');

    expect(updated.status).toBe('under_investigation');
    expect(mockPrismaClient.incident.update).toHaveBeenCalledWith({ where: { id: 'inc-1' }, data: { status: 'under_investigation', updatedBy: 'user-1' } });
    expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', action: 'INCIDENT_STATUS_CHANGE' }) }));
  });

  it('rejects closed as a status transition target (requires the dedicated close endpoint)', async () => {
    await expect(incidentService.changeIncidentStatus('inc-1', { status: 'closed', reason: 'Done' }, 'user-1')).rejects.toThrow('dedicated close endpoint');
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('rejects an incident status transition without a reason', async () => {
    await expect(incidentService.changeIncidentStatus('inc-1', { status: 'under_investigation', reason: '   ' }, 'user-1')).rejects.toThrow('reason');
    expect(mockPrismaClient.incident.findUnique).not.toHaveBeenCalled();
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the incident does not exist for a status transition', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue(null);

    await expect(incidentService.changeIncidentStatus('inc-1', { status: 'under_investigation', reason: 'Starting investigation' }, 'user-1')).rejects.toThrow('not found');
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('rejects a transition from the terminal resolved incident status', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', title: 'Outage', status: 'resolved' });

    await expect(incidentService.changeIncidentStatus('inc-1', { status: 'new', reason: 'Reopen' }, 'user-1')).rejects.toThrow('not valid');
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('rejects an incident status transition to the current status', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', title: 'Outage', status: 'new' });

    await expect(incidentService.changeIncidentStatus('inc-1', { status: 'new', reason: 'No change' }, 'user-1')).rejects.toThrow('already in status');
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('rejects a compare-and-set decision that lost the race without changing the incident', async () => {
    mockPrismaClient.incidentAssessment.findUnique.mockResolvedValue({ incidentId: 'inc-1', isReportable: false, status: 'pending_approval', assessorId: 'assessor-1', decisionApprovalAssigneeId: 'approver-1' });
    mockPrismaClient.user.findFirst.mockResolvedValue({ id: 'approver-1' });
    mockPrismaClient.incidentAssessment.updateMany.mockResolvedValue({ count: 0 });

    await expect(incidentService.decideNonReportableAssessment('inc-1', { decision: 'approve' }, 'approver-1')).rejects.toThrow('already decided');
    expect(mockPrismaClient.incident.update).not.toHaveBeenCalled();
  });

  it('blocks incident closure without root cause, measures evaluation and final report', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', isSignificant: true, rootCause: null, measuresEvaluation: null, reports: [] });
    await expect(incidentService.closeIncident('inc-1', { measuresEvaluation: 'Controls improved' }, 'closer-1')).rejects.toThrow('root cause');
    await expect(incidentService.closeIncident('inc-1', { rootCause: 'Patch gap' }, 'closer-1')).rejects.toThrow('measures evaluation');
    await expect(incidentService.closeIncident('inc-1', { rootCause: 'Patch gap', measuresEvaluation: 'Controls improved' }, 'closer-1')).rejects.toThrow('monthly final report');
  });

  it('exports persisted incident report package', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', displayId: 'INC-1', title: 'Outage', knowledgeTime: new Date(), severity: 'high', significanceReasons: ['High severity'] });
    mockPrismaClient.notificationDeadline.findUnique.mockResolvedValue({ id: 'deadline-1', deadlineDate: new Date() });
    mockPrismaClient.incidentReport.create.mockResolvedValue({ id: 'report-1', reportType: 'early_warning_24h', exportPayload: { reportType: 'early_warning_24h' } });
    const report = await incidentService.createIncidentReport('inc-1', { reportType: 'early_warning_24h', content: { summary: 'Outage' }, submissionProof: 'portal-123' }, 'user-1');
    expect(report.exportPayload.reportType).toBe('early_warning_24h');
  });

  it('derives report author, submission, deadline, and audit actors from the required actor argument', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', displayId: 'INC-1', title: 'Outage', knowledgeTime: new Date(), severity: 'high', significanceReasons: [] });
    mockPrismaClient.notificationDeadline.findUnique.mockResolvedValue({ id: 'deadline-1', deadlineDate: new Date() });
    mockPrismaClient.incidentReport.create.mockResolvedValue({ id: 'report-1' });

    await incidentService.createIncidentReport('inc-1', { reportType: 'early_warning_24h', content: { summary: 'Outage' }, submissionProof: 'portal-123' }, 'authenticated-user');

    expect(mockPrismaClient.incidentReport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdBy: 'authenticated-user', submittedBy: 'authenticated-user' }) }));
    expect(mockPrismaClient.notificationDeadline.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sentBy: 'authenticated-user' }) }));
    expect(mockPrismaClient.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'authenticated-user', action: 'INCIDENT_REPORT_CREATE' }) }));
  });

  it('returns deadline and affected-entity relationships in the incident detail contract', async () => {
    mockPrismaClient.incident.findUnique.mockResolvedValue({ id: 'inc-1', notificationDeadlines: [], incidentAssets: [], serviceLinks: [], processLinks: [] });

    await incidentService.getById('inc-1');

    expect(mockPrismaClient.incident.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        notificationDeadlines: expect.objectContaining({ orderBy: { deadlineDate: 'asc' } }),
        incidentAssets: expect.any(Object),
        serviceLinks: expect.any(Object),
        processLinks: expect.any(Object),
      }),
    }));
  });

  it('versions NIS-2 applicability assessment and requires approval before registration', async () => {
    mockPrismaClient.nis2QuestionnaireVersion.findUnique.mockResolvedValue({ id: 'q-1', version: '1.0' });
    mockPrismaClient.nis2Assessment.create.mockResolvedValue({ id: 'assess-1', questionnaireVersion: '1.0', preliminaryResult: 'important_entity', status: 'draft' });
    const assessment = await nis2Service.createApplicabilityAssessment({ answers: { employeeCount: 80, annualRevenueMillionEur: 20, criticalService: false } }, 'user-1');
    expect(assessment.questionnaireVersion).toBe('1.0');

    mockPrismaClient.nis2Assessment.findUnique.mockResolvedValue({ id: 'assess-1', status: 'draft' });
    await expect(nis2Service.createRegistration({ assessmentId: 'assess-1', entityType: 'important_entity', deadline: new Date() }, 'user-1')).rejects.toThrow('approved');
  });

  it('ensures ten NIS-2 topics as requirements and controls', async () => {
    mockPrismaClient.framework.upsert.mockResolvedValue({ id: 'fw-1' });
    mockPrismaClient.frameworkVersion.findFirst.mockResolvedValue(null);
    mockPrismaClient.frameworkVersion.create.mockResolvedValue({ id: 'fv-1', requirements: NIS2_TOPICS.map((topic, index) => ({ id: `req-${index}`, title: topic.title, requirementText: topic.title })) });
    mockPrismaClient.control.findFirst.mockResolvedValue(null);
    mockPrismaClient.control.create.mockImplementation(async ({ data }: any) => ({ id: `ctrl-${data.title}`, ...data }));
    const catalogue = await nis2Service.ensureMeasuresCatalogue('user-1');
    expect(catalogue.topics).toHaveLength(10);
    expect(mockPrismaClient.control.create).toHaveBeenCalledTimes(10);
  });

  it('returns minimal list contracts and complete protected details for the NIS-2 workflow', async () => {
    mockPrismaClient.nis2QuestionnaireVersion.findMany.mockResolvedValue([{ id: 'q-1', version: '1.0' }]);
    mockPrismaClient.nis2Assessment.findMany.mockResolvedValue([{ id: 'a-1', status: 'draft' }]);
    mockPrismaClient.nis2Registration.findMany.mockResolvedValue([{ id: 'r-1', status: 'pending' }]);
    mockPrismaClient.nis2Assessment.findFirst.mockResolvedValue({ id: 'a-1', answers: { sector: 'energy' } });
    mockPrismaClient.nis2Registration.findFirst.mockResolvedValue({ id: 'r-1', changes: [] });

    await expect(nis2Service.listActiveQuestionnaires()).resolves.toHaveLength(1);
    await expect(nis2Service.listAssessments()).resolves.toHaveLength(1);
    await expect(nis2Service.listRegistrations()).resolves.toHaveLength(1);
    await expect(nis2Service.getAssessment('a-1')).resolves.toMatchObject({ id: 'a-1' });
    await expect(nis2Service.getRegistration('r-1')).resolves.toMatchObject({ id: 'r-1' });
    expect(mockPrismaClient.nis2Assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.any(Object) }));
    expect(mockPrismaClient.nis2Registration.findFirst).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ changes: expect.any(Object) }) }));
  });
});

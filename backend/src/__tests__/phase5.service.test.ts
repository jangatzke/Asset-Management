const mockPrismaClient: any = {
  incident: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  notificationDeadline: { createMany: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  incidentAssessment: { upsert: jest.fn() },
  incidentKnowledgeTimeChange: { create: jest.fn() },
  incidentReport: { create: jest.fn(), findUnique: jest.fn() },
  incidentCommunication: { create: jest.fn() },
  incidentEscalation: { create: jest.fn() },
  nis2IncidentSignificanceRuleVersion: { upsert: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  nis2QuestionnaireVersion: { upsert: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  nis2Assessment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  nis2Registration: { create: jest.fn(), findUnique: jest.fn() },
  nis2RegistrationChange: { create: jest.fn() },
  framework: { upsert: jest.fn() },
  frameworkVersion: { create: jest.fn(), findFirst: jest.fn() },
  control: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  controlRequirementMapping: { createMany: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(async (cb: any) => cb(mockPrismaClient)),
};

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));

import { incidentService } from '../services/incident.service';
import { nis2Service, NIS2_TOPICS } from '../services/nis2.service';

describe('Phase 5 NIS-2 and incident workflow services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.auditLog.create.mockResolvedValue({});
    mockPrismaClient.nis2IncidentSignificanceRuleVersion.upsert.mockResolvedValue({ id: 'rules-1', version: '1.0', rules: [
      { key: 'critical_severity', field: 'severity', operator: 'in', value: ['critical', 'high'], reason: 'High or critical incident severity' },
    ] });
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
    await expect(incidentService.assessIncident('inc-1', { assessorId: 'assessor-1', isReportable: false })).rejects.toThrow('justification');
    await expect(incidentService.assessIncident('inc-1', { assessorId: 'assessor-1', isReportable: false, decisionNotToReport: 'Below threshold' })).rejects.toThrow('approval');
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
    const report = await incidentService.createIncidentReport('inc-1', { reportType: 'early_warning_24h', content: { summary: 'Outage' }, authorId: 'user-1', submissionProof: 'portal-123' });
    expect(report.exportPayload.reportType).toBe('early_warning_24h');
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
});

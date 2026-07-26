import { createMockPrismaClient } from '../test/prisma-mock';

const mockPrismaClient = createMockPrismaClient();

jest.mock('../config/database', () => ({ prisma: mockPrismaClient }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn(), logEvent: jest.fn() } }));
jest.mock('../services/displayId.service', () => ({
  displayIdService: { nextDisplayIdStandalone: jest.fn().mockResolvedValue('ID-0001') },
  nextDisplayId: jest.fn().mockResolvedValue('AST-0001'),
}));
jest.mock('../services/authorization.service', () => ({
  authorizationService: { requireEntityPermission: jest.fn(), requireAdminAccess: jest.fn() },
}));

import { riskService } from '../services/risk.service';
import { controlService } from '../services/control.service';
import { evidenceService } from '../services/evidence.service';
import { assetService } from '../services/asset.service';
import { riskTreatmentService } from '../services/risktreatment.service';

describe('normalized risk-control and asset inventory overhaul', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaClient));
  });

  it('rejects deprecated Risk.existingControls payloads', async () => {
    await expect(riskService.create({ existingControls: ['legacy'] } as any)).rejects.toThrow('Deprecated direct risk-control fields');
  });

  it('rejects deprecated Control.relatedRiskIds payloads', async () => {
    await expect(controlService.create({ relatedRiskIds: ['risk-1'] } as any)).rejects.toThrow('Deprecated direct control-risk/evidence fields');
  });

  it('rejects deprecated SoA risk and evidence mirror arrays', async () => {
    await expect(controlService.createSOA({ frameworkId: 'fw', frameworkVersion: '1', scopeId: 'scope', items: [{ justification: 'x', riskIds: ['r'] } as any] })).rejects.toThrow('Deprecated direct control-risk/evidence fields');
  });

  it('creates canonical RiskControl with allowed role and mitigation dimension', async () => {
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-1' });
    mockPrismaClient.controlImplementation.findUnique.mockResolvedValue({ id: 'ci-1' });
    mockPrismaClient.riskControl.create.mockResolvedValue({ id: 'rc-1', riskId: 'risk-1', controlImplementationId: 'ci-1' });

    await riskService.linkRiskControl({ riskId: 'risk-1', controlImplementationId: 'ci-1', role: 'preventive', mitigationDimension: 'likelihood' }, 'user-1');

    expect(mockPrismaClient.riskControl.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'preventive', mitigationDimension: 'likelihood' }) }));
  });

  it('rejects invalid RiskControl role', async () => {
    await expect(riskService.linkRiskControl({ riskId: 'risk-1', controlImplementationId: 'ci-1', role: 'advisory' as any, mitigationDimension: 'both' })).rejects.toThrow('Invalid risk-control role');
  });

  it('creates versioned RiskControlAssessment with generic evidence links', async () => {
    mockPrismaClient.riskControl.findUnique.mockResolvedValue({ id: 'rc-1', riskId: 'risk-1' });
    mockPrismaClient.riskAssessmentVersion.findUnique.mockResolvedValue({ id: 'rav-1', riskId: 'risk-1', status: 'draft', isClosed: false });
    mockPrismaClient.riskControlAssessment.create.mockResolvedValue({ id: 'rca-1' });
    mockPrismaClient.riskControlAssessment.findUnique.mockResolvedValue({ id: 'rca-1', evidenceLinks: [] });

    await riskService.assessRiskControl({ riskControlId: 'rc-1', riskAssessmentVersionId: 'rav-1', effectivenessStatus: 'effective', justification: 'tested', assessedBy: 'u1', evidenceLinks: [{ evidenceId: 'ev-1' }] }, 'u1');

    expect(mockPrismaClient.evidenceLink.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ entityType: 'RiskControlAssessment', entityId: 'rca-1' })] }));
  });

  it('does not overwrite closed assessment versions', async () => {
    mockPrismaClient.riskControl.findUnique.mockResolvedValue({ id: 'rc-1', riskId: 'risk-1' });
    mockPrismaClient.riskAssessmentVersion.findUnique.mockResolvedValue({ id: 'rav-1', riskId: 'risk-1', status: 'closed', isClosed: true });
    await expect(riskService.assessRiskControl({ riskControlId: 'rc-1', riskAssessmentVersionId: 'rav-1', effectivenessStatus: 'effective', justification: 'x', assessedBy: 'u1' })).rejects.toThrow('immutable');
  });

  it('creates RiskAssessmentVersion using assessor-entered residual and target values', async () => {
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-1' });
    mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue({ id: 'rmv-1', isImmutable: false });
    mockPrismaClient.riskAssessment.findFirst.mockResolvedValue({ assessmentNumber: 1 });
    mockPrismaClient.riskAssessmentVersion.findFirst.mockResolvedValue({ versionNumber: 1 });
    mockPrismaClient.riskAssessment.create.mockResolvedValue({ id: 'ra-2' });
    mockPrismaClient.riskAssessmentVersion.create.mockResolvedValue({ id: 'rav-2' });
    mockPrismaClient.riskAssessment.findMany.mockResolvedValue([]);
    mockPrismaClient.riskAssessmentVersion.findMany.mockResolvedValue([]);

    await riskService.createAssessment({ riskId: 'risk-1', riskMethodVersionId: 'rmv-1', assessmentType: 'current', likelihood: 2, impact: 3, inherentRisk: 'high', residualRisk: 'medium', targetRisk: 'low', assessorId: 'u1', nextReviewDate: new Date(), justification: 'Effective key controls justify residual risk' });

    expect(mockPrismaClient.riskAssessmentVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ residualRisk: 'medium', targetRisk: 'low' }) }));
  });

  it('does not reduce residual risk when only planned controls exist', async () => {
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-1' });
    await expect(riskService.create({ title: 'r', description: 'd', likelihood: 4, impact: 4, assessorId: 'u1', riskOwnerId: 'u1', nextReviewDate: new Date(), justification: 'planned controls only', controls: ['c1'] } as any)).rejects.toThrow('Deprecated direct risk-control fields');
  });

  it('creates TreatmentAction rows for treatment chain actions', async () => {
    mockPrismaClient.risk.findUnique.mockResolvedValue({ id: 'risk-1', displayId: 'RSK-1' });
    mockPrismaClient.riskMethod.findFirst.mockResolvedValue(null);
    mockPrismaClient.riskTreatment.create.mockResolvedValue({ id: 't-1', displayId: 'TR-1' });
    await riskTreatmentService.create({ riskId: 'risk-1', treatmentOption: 'reduce', actions: [{ actionType: 'improve', title: 'Improve MFA', controlImplementationId: 'ci-1' }] }, 'u1');
    expect(mockPrismaClient.treatmentAction.createMany).toHaveBeenCalled();
  });

  it('completing treatment creates reassessment review task instead of mutating closed residual risk', async () => {
    mockPrismaClient.riskTreatment.findUnique.mockResolvedValue({ id: 't-1', riskId: 'risk-1', treatmentOption: 'reduce', displayId: 'TR-1', risk: { id: 'risk-1', riskOwnerId: 'owner-1', riskMethodVersionId: 'rmv-1', inherentRisk: 'high', residualRisk: 'high', targetRisk: 'medium' }, effectivenessReviews: [{ id: 'er-1' }] });
    mockPrismaClient.riskAssessment.findUnique.mockResolvedValue({ id: 'ra-1', riskId: 'risk-1' });
    mockPrismaClient.riskTreatment.update.mockResolvedValue({ id: 't-1' });
    await riskTreatmentService.complete('t-1', { residualAssessmentId: 'ra-1' }, 'u1');
    expect(mockPrismaClient.reviewTask.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ triggerSource: 'risk_treatment_completed' }) }));
  });

  it('creates ControlTest with generic evidence links', async () => {
    mockPrismaClient.controlImplementation.findUnique.mockResolvedValue({ id: 'ci-1' });
    mockPrismaClient.controlTest.create.mockResolvedValue({ id: 'ct-1' });
    mockPrismaClient.controlTest.findUnique.mockResolvedValue({ id: 'ct-1', evidenceLinks: [] });
    await controlService.createControlTest({ controlImplementationId: 'ci-1', testType: 'sample', testedBy: 'u1', result: 'effective', evidenceLinks: [{ evidenceId: 'ev-1' }] }, 'u1');
    expect(mockPrismaClient.evidenceLink.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ entityType: 'ControlTest' })] }));
  });

  it('uses only generic EvidenceLink associations', async () => {
    mockPrismaClient.evidence.create.mockResolvedValue({ id: 'ev-1', title: 'E', fileHash: 'a'.repeat(64), classification: 'internal', links: [] });
    await evidenceService.create({ title: 'E', evidenceType: 'file', classification: 'internal', responsibleId: 'u1', fileHash: 'a'.repeat(64), retentionPeriod: '1y', expiresAt: new Date(), links: [{ entityType: 'Risk', entityId: 'risk-1' }] }, 'u1');
    expect(mockPrismaClient.evidence.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ relatedRiskIds: expect.anything() }) }));
  });

  it('generates next free inventory number transactionally from subtype pattern', async () => {
    mockPrismaClient.assetType.findUnique.mockResolvedValue({ id: 'type-1', inventoryEnabled: true, inventoryPattern: 'AST####', inventoryNextSequence: 1 });
    mockPrismaClient.assetSubtype.findUnique.mockResolvedValue({ id: 'sub-1', assetTypeId: 'type-1', inventoryEnabled: true, inventoryPattern: 'NB####', inventoryNextSequence: 7 });
    mockPrismaClient.asset.findUnique.mockResolvedValue(null);
    const preview = await assetService.generateInventoryPreview('type-1', 'sub-1');
    expect(preview.nextInventoryNumber).toBe('NB0007');
  });

  it('rejects subtype that does not belong to type', async () => {
    mockPrismaClient.assetType.findUnique.mockResolvedValue({ id: 'type-1', inventoryEnabled: true, inventoryPattern: 'AST####', inventoryNextSequence: 1 });
    mockPrismaClient.assetSubtype.findUnique.mockResolvedValue({ id: 'sub-1', assetTypeId: 'other-type' });
    await expect(assetService.generateInventoryPreview('type-1', 'sub-1')).rejects.toThrow('does not belong');
  });

  it('rejects duplicate manual inventory number globally', async () => {
    mockPrismaClient.asset.findUnique.mockResolvedValue({ id: 'existing' });
    mockPrismaClient.assetType.findUnique.mockResolvedValue({ id: 'type-1', inventoryEnabled: true, inventoryPattern: 'AST####', inventoryNextSequence: 1 });
    await expect(assetService.create({ name: 'A', assetTypeId: 'type-1', inventoryNumber: 'NB0001' } as any)).rejects.toThrow('globally unique');
  });
});

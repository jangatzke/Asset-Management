/**
 * Tests for RiskTreatmentService
 *
 * Tests CRUD operations, acceptance validation (RSK-021/RSK-023), and escalation check (RSK-022).
 */

const mockPrismaClient: any = {
  riskTreatment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  riskAcceptance: {
    create: jest.fn(),
    update: jest.fn(),
  },
  riskTreatmentApproval: {
    create: jest.fn(),
  },
  riskTreatmentEffectivenessReview: {
    create: jest.fn(),
  },
  riskAssessment: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  risk: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  riskMethod: {
    findFirst: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  userRole: {
    findMany: jest.fn(),
  },
  userGroup: {
    findMany: jest.fn(),
  },
  displayIdCounter: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(async (cb: any) => cb(mockPrismaClient)),
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { riskTreatmentService } from '../services/risktreatment.service';

describe('RiskTreatmentService', () => {
  const mockTreatment = {
    id: 'rt-1',
    displayId: 'RT-001',
    riskId: 'risk-1',
    treatmentOption: 'reduce',
    plannedActions: 'Implement firewall rules',
    responsibleUserId: 'user-1',
    targetDate: new Date('2025-06-30'),
    implementationStatus: 'planned',
    justification: null,
    expiryDate: null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.userRole.findMany.mockResolvedValue([{ roleName: 'risk_writer', validUntil: null, scopeId: null, organizationUnitId: null, role: { canAccessAdmin: false, entityPermissions: { risks: 'readwrite' } } }]);
    mockPrismaClient.userGroup.findMany.mockResolvedValue([]);
    mockPrismaClient.risk.findUnique.mockResolvedValue({
      id: 'risk-1',
      displayId: 'RSK-001',
      title: 'Risk',
      riskOwnerId: 'owner-1',
      assessorId: 'assessor-1',
      likelihood: 2,
      impact: 2,
      inherentRisk: 'medium',
      residualRisk: 'medium',
      targetRisk: 'medium',
      riskMethodVersionId: 'method-version-1',
      nextReviewDate: new Date('2026-12-31'),
    });
    mockPrismaClient.riskMethod.findFirst.mockResolvedValue(null);
    mockPrismaClient.riskAssessment.findUnique.mockResolvedValue({
      id: 'assessment-1',
      riskId: 'risk-1',
      riskMethodVersionId: 'method-version-1',
      likelihood: 2,
      impact: 2,
      inherentRisk: 'medium',
      residualRisk: 'medium',
      targetRisk: 'medium',
      score: 4,
      assessorId: 'assessor-1',
      nextReviewDate: new Date('2026-12-31'),
    });
    mockPrismaClient.displayIdCounter.upsert.mockResolvedValue({ sequence: 1 });
    mockPrismaClient.auditLog.create.mockResolvedValue({});
  });

  describe('list', () => {
    it('should return paginated treatments', async () => {
      mockPrismaClient.riskTreatment.findMany.mockResolvedValue([mockTreatment]);
      mockPrismaClient.riskTreatment.count.mockResolvedValue(1);

      const result = await riskTreatmentService.list({});

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by treatment option', async () => {
      mockPrismaClient.riskTreatment.findMany.mockResolvedValue([]);
      mockPrismaClient.riskTreatment.count.mockResolvedValue(0);

      await riskTreatmentService.list({ treatmentOption: 'accept' });

      expect(mockPrismaClient.riskTreatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { treatmentOption: 'accept' } }),
      );
    });

    it('should filter by implementation status', async () => {
      mockPrismaClient.riskTreatment.findMany.mockResolvedValue([]);
      mockPrismaClient.riskTreatment.count.mockResolvedValue(0);

      await riskTreatmentService.list({ implementationStatus: 'completed' });

      expect(mockPrismaClient.riskTreatment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { implementationStatus: 'completed' } }),
      );
    });
  });

  describe('findById', () => {
    it('should return treatment by id', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(mockTreatment);

      const result = await riskTreatmentService.findById('rt-1');

      expect(result.id).toBe('rt-1');
    });

    it('should throw 404 for non-existent treatment', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(null);

      await expect(riskTreatmentService.findById('nonexistent')).rejects.toThrow('Risk treatment not found');
    });
  });

  describe('create - RSK-021/RSK-023 validation', () => {
    it('should create a reduce treatment without justification', async () => {
      mockPrismaClient.riskTreatment.create.mockResolvedValue(mockTreatment);

      await riskTreatmentService.create({
        riskId: 'risk-1',
        treatmentOption: 'reduce',
        plannedActions: 'Install patches',
      });

      expect(mockPrismaClient.riskTreatment.create).toHaveBeenCalled();
    });

    it('should reject acceptance without justification (RSK-021)', async () => {
      await expect(
        riskTreatmentService.create({
          riskId: 'risk-1',
          treatmentOption: 'accept',
        }),
      ).rejects.toThrow('Acceptance requires justification');
    });

    it('should reject acceptance without expiry date (RSK-023)', async () => {
      await expect(
        riskTreatmentService.create({
          riskId: 'risk-1',
          treatmentOption: 'accept',
          justification: 'Accepted by management',
        }),
      ).rejects.toThrow('Acceptance requires expiry date');
    });

    it('should reject acceptance without assessment version', async () => {
      await expect(
        riskTreatmentService.create({
          riskId: 'risk-1',
          treatmentOption: 'accept',
          justification: 'Accepted by management',
          expiryDate: new Date('2026-01-01'),
          approverId: 'owner-1',
        }),
      ).rejects.toThrow('Acceptance requires a concrete risk assessment version');
    });

    it('should reject acceptance without approver', async () => {
      await expect(
        riskTreatmentService.create({
          riskId: 'risk-1',
          assessmentId: 'assessment-1',
          treatmentOption: 'accept',
          justification: 'Accepted by management',
          expiryDate: new Date('2026-01-01'),
        }),
      ).rejects.toThrow('Acceptance requires approver');
    });

    it('should accept treatment with both justification and expiry (RSK-021/RSK-023)', async () => {
      mockPrismaClient.riskTreatment.create.mockResolvedValue({
        ...mockTreatment,
        treatmentOption: 'accept',
        justification: 'Board approved',
        expiryDate: new Date('2026-01-01'),
      });

      await riskTreatmentService.create({
        riskId: 'risk-1',
        assessmentId: 'assessment-1',
        treatmentOption: 'accept',
        justification: 'Board approved',
        expiryDate: new Date('2026-01-01'),
        approverId: 'owner-1',
      });

      expect(mockPrismaClient.riskTreatment.create).toHaveBeenCalled();
      expect(mockPrismaClient.riskAcceptance.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ assessmentId: 'assessment-1', requiredLevel: 'risk_owner' }),
      }));
    });
  });

  describe('update - RSK-021/RSK-023 validation', () => {
    it('should allow updating non-acceptance treatments', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(mockTreatment);
      const updated = { ...mockTreatment, plannedActions: 'Updated actions' };
      mockPrismaClient.riskTreatment.update.mockResolvedValue(updated);

      await riskTreatmentService.update('rt-1', { plannedActions: 'Updated actions' });

      expect(mockPrismaClient.riskTreatment.update).toHaveBeenCalled();
    });

    it('should reject changing to acceptance without justification', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(mockTreatment);

      await expect(
        riskTreatmentService.update('rt-1', { treatmentOption: 'accept' }),
      ).rejects.toThrow('Acceptance requires justification');
    });
  });

  describe('delete', () => {
    it('should soft delete a treatment', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(mockTreatment);
      mockPrismaClient.riskTreatment.update.mockResolvedValue({ ...mockTreatment, isArchived: true });

      const result = await riskTreatmentService.delete('rt-1');

      expect(result.success).toBe(true);
    });

    it('should throw 404 for non-existent treatment', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(null);

      await expect(riskTreatmentService.delete('nonexistent')).rejects.toThrow('Risk treatment not found');
    });
  });

  describe('list by riskId filter', () => {
    it('should return treatments for a given risk via list filter', async () => {
      mockPrismaClient.riskTreatment.findMany.mockResolvedValue([mockTreatment]);
      mockPrismaClient.riskTreatment.count.mockResolvedValue(1);

      const result = await riskTreatmentService.list({ riskId: 'risk-1' });

      expect(result.data).toHaveLength(1);
    });

    it('should return empty results when no treatments exist for risk', async () => {
      mockPrismaClient.riskTreatment.findMany.mockResolvedValue([]);
      mockPrismaClient.riskTreatment.count.mockResolvedValue(0);

      const result = await riskTreatmentService.list({ riskId: 'risk-empty' });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('approve - RSK-021', () => {
    it('should approve a treatment with valid acceptance data', async () => {
      const acceptTreatment = {
        ...mockTreatment,
        treatmentOption: 'accept',
        approvedByUserId: 'owner-1',
        justification: 'Board approved',
        expiryDate: new Date('2026-01-01'),
        risk: { id: 'risk-1', riskOwnerId: 'owner-1' },
        acceptance: { treatmentId: 'rt-1', assessmentId: 'assessment-1', requiredLevel: 'risk_owner' },
      };
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue(acceptTreatment);
      const approved = { ...acceptTreatment, completionApproval: 'approved', implementationStatus: 'approved' };
      mockPrismaClient.riskTreatment.update.mockResolvedValue(approved);

      const result = await riskTreatmentService.approve('rt-1', 'owner-1');

      expect(result.completionApproval).toBe('approved');
    });

    it('should reject approval of acceptance without justification', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue({
        ...mockTreatment,
        treatmentOption: 'accept',
        justification: null,
        expiryDate: new Date('2026-01-01'),
        risk: { id: 'risk-1', riskOwnerId: 'owner-1' },
        acceptance: { treatmentId: 'rt-1', assessmentId: 'assessment-1', requiredLevel: 'risk_owner' },
      });

      await expect(riskTreatmentService.approve('rt-1', 'admin-1')).rejects.toThrow('missing justification');
    });

    it('should reject approval of acceptance without expiry date (RSK-023)', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue({
        ...mockTreatment,
        treatmentOption: 'accept',
        justification: 'Approved',
        expiryDate: null,
        risk: { id: 'risk-1', riskOwnerId: 'owner-1' },
        acceptance: { treatmentId: 'rt-1', assessmentId: 'assessment-1', requiredLevel: 'risk_owner' },
      });

      await expect(riskTreatmentService.approve('rt-1', 'admin-1')).rejects.toThrow('missing expiry date');
    });

    it('should reject high risk acceptance approval by original assessor', async () => {
      mockPrismaClient.riskAssessment.findUnique.mockResolvedValue({
        id: 'assessment-1',
        riskId: 'risk-1',
        assessorId: 'assessor-1',
        likelihood: 5,
        impact: 4,
        residualRisk: 'high',
        targetRisk: 'high',
        inherentRisk: 'high',
        score: 20,
      });
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue({
        ...mockTreatment,
        treatmentOption: 'accept',
        approvedByUserId: 'assessor-1',
        justification: 'Approved',
        expiryDate: new Date('2026-01-01'),
        risk: { id: 'risk-1', riskOwnerId: 'owner-1' },
        acceptance: { treatmentId: 'rt-1', assessmentId: 'assessment-1', requiredLevel: 'management' },
      });

      await expect(riskTreatmentService.approve('rt-1', 'assessor-1')).rejects.toThrow('independent approver');
    });
  });

  describe('effectiveness review and completion', () => {
    it('should reject mitigation completion without effectiveness review', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue({
        ...mockTreatment,
        treatmentOption: 'reduce',
        risk: { id: 'risk-1', riskMethodVersionId: 'method-version-1', inherentRisk: 'high', residualRisk: 'high', targetRisk: 'medium' },
        effectivenessReviews: [],
      });

      await expect(riskTreatmentService.complete('rt-1', { residualAssessmentId: 'assessment-1' }, 'user-1')).rejects.toThrow('without effectiveness review');
    });

    it('should complete mitigation with effectiveness review and create target assessment', async () => {
      mockPrismaClient.riskTreatment.findUnique.mockResolvedValue({
        ...mockTreatment,
        treatmentOption: 'reduce',
        risk: { id: 'risk-1', riskMethodVersionId: 'method-version-1', inherentRisk: 'high', residualRisk: 'high', targetRisk: 'medium' },
        effectivenessReviews: [{ id: 'review-1' }],
      });
      mockPrismaClient.riskAssessment.findFirst.mockResolvedValue({ assessmentNumber: 2 });
      mockPrismaClient.riskAssessment.create.mockResolvedValue({ id: 'assessment-target-1' });
      mockPrismaClient.riskTreatment.update.mockResolvedValue({ ...mockTreatment, implementationStatus: 'completed', residualAssessmentId: 'assessment-target-1' });

      const result = await riskTreatmentService.complete('rt-1', {
        targetAssessment: {
          likelihood: 2,
          impact: 2,
          nextReviewDate: new Date('2027-01-01'),
          justification: 'Residual risk confirmed after mitigation',
        },
      }, 'user-1');

      expect(result.implementationStatus).toBe('completed');
      expect(mockPrismaClient.riskAssessment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ assessmentType: 'target', assessmentNumber: 3 }),
      }));
    });
  });
});

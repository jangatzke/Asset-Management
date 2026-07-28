/**
 * Tests for RiskMethodService — Paket 3.1: Versionierte Risikomethoden
 *
 * Covers:
 * - CRUD operations with calculationType
 * - Version creation and immutability
 * - Safe calculation engine (no eval/Function)
 * - Recalculation preview (read-only, no persistence)
 * - Confirmed recalculation (new assessment version)
 * - Bulk recalculation
 * - Input validation against scale ranges
 */

// ---- Mock Setup ----

const mockTransactionFn = jest.fn((cb) => cb({
  riskMethod: {
    updateMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  riskMethodVersion: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  riskAssessmentVersion: {
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  risk: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
}));

const mockPrismaClient: any = {
  riskMethod: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  riskMethodVersion: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  riskAssessmentVersion: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  risk: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: mockTransactionFn,
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

jest.mock('../services/audit.service', () => ({
  auditService: {
    logEventStandalone: jest.fn(),
  },
}));

import { riskMethodService } from '../services/riskmethod.service';

describe('RiskMethodService — Paket 3.1', () => {
  const mockMethod = {
    id: 'rm-1',
    displayId: 'RM-001',
    name: 'ISO 27005 Standard',
    description: 'Standard risk assessment method',
    version: '2.0.0',
    likelihoodScale: { levels: [{ value: 1, label: 'Very Low' }, { value: 2, label: 'Low' }, { value: 3, label: 'Medium' }, { value: 4, label: 'High' }, { value: 5, label: 'Very High' }] },
    impactScale: { levels: [{ value: 1, label: 'Very Low' }, { value: 2, label: 'Low' }, { value: 3, label: 'Medium' }, { value: 4, label: 'High' }, { value: 5, label: 'Very High' }] },
    ratingDimensions: { confidentiality: true, integrity: true, availability: true },
    calculationType: 'product',
    formulaExpression: null,
    riskClasses: {
      low: { min: 1, max: 4 },
      medium: { min: 5, max: 9 },
      high: { min: 10, max: 16 },
      critical: { min: 17, max: 25 },
    },
    isActive: true,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVersion = {
    id: 'rmv-1',
    riskMethodId: 'rm-1',
    versionTag: '2.0.0-snapshot-1',
    likelihoodScale: mockMethod.likelihoodScale,
    impactScale: mockMethod.impactScale,
    ratingDimensions: mockMethod.ratingDimensions,
    calculationType: 'product',
    formulaExpression: null,
    riskClasses: mockMethod.riskClasses,
    isImmutable: false,
    createdAt: new Date(),
  };

  const mockAssessment = {
    id: 'ra-1',
    riskId: 'risk-1',
    riskMethodVersionId: 'rmv-1',
    versionNumber: 1,
    likelihood: 3,
    impact: 4,
    inherentRisk: 'medium',
    residualRisk: 'low',
    targetRisk: 'low',
    score: 12,
    assessorId: 'user-1',
    assessedAt: new Date(),
    nextReviewDate: new Date('2027-01-01'),
    justification: null,
    isCurrent: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // CRUD Tests
  // ==========================================

  describe('list', () => {
    it('should return paginated methods with version count', async () => {
      mockPrismaClient.riskMethod.findMany.mockResolvedValue([mockMethod]);
      mockPrismaClient.riskMethod.count.mockResolvedValue(1);

      const result = await riskMethodService.list({});

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by isActive', async () => {
      mockPrismaClient.riskMethod.findMany.mockResolvedValue([]);
      mockPrismaClient.riskMethod.count.mockResolvedValue(0);

      await riskMethodService.list({ isActive: 'false' });

      expect(mockPrismaClient.riskMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });
  });

  describe('findById', () => {
    it('should return method by id', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);

      const result = await riskMethodService.findById('rm-1');

      expect(result.id).toBe('rm-1');
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.findById('nonexistent')).rejects.toThrow('Risk method not found');
    });
  });

  describe('create', () => {
    it('should create a new method with calculationType', async () => {
      const txCreate = jest.fn().mockResolvedValue(mockMethod);
      mockTransactionFn.mockImplementation(async (cb) => cb({
        riskMethod: { updateMany: jest.fn(), create: txCreate },
      }));
      mockPrismaClient.riskMethodVersion.count.mockResolvedValue(0);
      mockPrismaClient.riskMethodVersion.create.mockResolvedValue(mockVersion);

      await riskMethodService.create({
        name: 'New Method',
        version: '1.0.0',
        likelihoodScale: { levels: [{ value: 1, label: 'Low' }, { value: 2, label: 'High' }] },
        impactScale: { levels: [{ value: 1, label: 'Low' }, { value: 2, label: 'High' }] },
        ratingDimensions: {},
        calculationType: 'product',
        riskClasses: { low: { min: 1, max: 2 }, high: { min: 3, max: 4 } },
      });

      expect(txCreate).toHaveBeenCalled();
    });

    it('should reject invalid calculation type', async () => {
      await expect(riskMethodService.create({
        name: 'Bad Method',
        version: '1.0.0',
        likelihoodScale: {},
        impactScale: {},
        ratingDimensions: {},
        calculationType: 'eval' as any,
        riskClasses: {},
      })).rejects.toThrow('Invalid calculation type');
    });

    it('should deactivate other active methods when creating active method', async () => {
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreate = jest.fn().mockResolvedValue(mockMethod);
      mockTransactionFn.mockImplementation(async (cb) => cb({
        riskMethod: { updateMany: txUpdateMany, create: txCreate },
      }));
      mockPrismaClient.riskMethodVersion.count.mockResolvedValue(0);
      mockPrismaClient.riskMethodVersion.create.mockResolvedValue(mockVersion);

      await riskMethodService.create({
        name: 'New Active Method',
        version: '1.0.0',
        likelihoodScale: {},
        impactScale: {},
        ratingDimensions: {},
        calculationType: 'product',
        riskClasses: {},
        isActive: true,
      });

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { isActive: true },
        data: { isActive: false },
      });
    });
  });

  describe('update', () => {
    it('should update an existing method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      const updated = { ...mockMethod, name: 'Updated Method' };
      mockPrismaClient.riskMethod.update.mockResolvedValue(updated);

      const result = await riskMethodService.update('rm-1', { name: 'Updated Method' });

      expect(result.name).toBe('Updated Method');
    });

    it('should reject invalid calculation type on update', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);

      await expect(riskMethodService.update('rm-1', { calculationType: 'eval' as any }))
        .rejects.toThrow('Invalid calculation type');
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.update('nonexistent', { name: 'X' })).rejects.toThrow('Risk method not found');
    });
  });

  describe('delete', () => {
    it('should soft delete a method without immutable versions', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.riskMethodVersion.count.mockResolvedValue(0);
      mockPrismaClient.riskMethod.update.mockResolvedValue({ ...mockMethod, isArchived: true });

      const result = await riskMethodService.delete('rm-1');

      expect(result.success).toBe(true);
    });

    it('should prevent deletion when immutable versions exist', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.riskMethodVersion.count.mockResolvedValue(2);

      await expect(riskMethodService.delete('rm-1')).rejects.toThrow('Cannot delete risk method with referenced versions');
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.delete('nonexistent')).rejects.toThrow('Risk method not found');
    });
  });

  // ==========================================
  // Version Management Tests
  // ==========================================

  describe('createVersion', () => {
    it('should create a new snapshot version', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.riskMethodVersion.count.mockResolvedValue(1);
      const newVersion = { ...mockVersion, id: 'rmv-2', versionTag: '2.0.0-snapshot-2' };
      mockPrismaClient.riskMethodVersion.create.mockResolvedValue(newVersion);

      const result = await riskMethodService.createVersion('rm-1');

      expect(result.versionTag).toBe('2.0.0-snapshot-2');
      expect(mockPrismaClient.riskMethodVersion.create).toHaveBeenCalled();
    });
  });

  describe('findVersion', () => {
    it('should return version with parent method', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue({
        ...mockVersion,
        riskMethod: mockMethod,
      });

      const result = await riskMethodService.findVersion('rmv-1');

      expect(result.id).toBe('rmv-1');
      expect(result.riskMethod.name).toBe('ISO 27005 Standard');
    });

    it('should throw 404 for non-existent version', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.findVersion('nonexistent')).rejects.toThrow('Risk method version not found');
    });
  });

  describe('listVersions', () => {
    it('should return all versions for a method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.riskMethodVersion.findMany.mockResolvedValue([mockVersion]);

      const result = await riskMethodService.listVersions('rm-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateVersion (immutability enforcement)', () => {
    it('must always throw — versions are immutable', async () => {
      await expect(riskMethodService.updateVersion('rmv-1', { riskClasses: {} }))
        .rejects.toThrow('Risk method versions are immutable');
    });
  });

  describe('markVersionImmutable', () => {
    it('should mark a version as immutable', async () => {
      mockPrismaClient.riskMethodVersion.update.mockResolvedValue({ ...mockVersion, isImmutable: true });

      await riskMethodService.markVersionImmutable('rmv-1');

      expect(mockPrismaClient.riskMethodVersion.update).toHaveBeenCalledWith({
        where: { id: 'rmv-1' },
        data: { isImmutable: true },
      });
    });
  });

  // ==========================================
  // Safe Calculation Engine Tests
  // ==========================================

  describe('calculateRiskScore', () => {
    it('should calculate product correctly', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(mockVersion);

      const result = await riskMethodService.calculateRiskScore('rmv-1', 3, 4);

      expect(result.score).toBe(12);
      expect(result.riskClass).toBe('high'); // 10-16 = high
    });

    it('should calculate sum correctly', async () => {
      const sumVersion = { ...mockVersion, calculationType: 'sum' };
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(sumVersion);

      const result = await riskMethodService.calculateRiskScore('rmv-1', 3, 4);

      expect(result.score).toBe(7);
    });

    it('should calculate max correctly', async () => {
      const maxVersion = { ...mockVersion, calculationType: 'max' };
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(maxVersion);

      const result = await riskMethodService.calculateRiskScore('rmv-1', 3, 4);

      expect(result.score).toBe(4);
    });

    it('should validate inputs against scale ranges', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(mockVersion);

      // Value 6 is outside the scale range [1,5]
      await expect(riskMethodService.calculateRiskScore('rmv-1', 6, 4))
        .rejects.toThrow('out of scale range');
    });

    it('should throw for unsupported calculation type', async () => {
      const badVersion = { ...mockVersion, calculationType: 'eval' };
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(badVersion);

      await expect(riskMethodService.calculateRiskScore('rmv-1', 3, 4))
        .rejects.toThrow('Unsupported calculation type');
    });
  });

  // ==========================================
  // Recalculation Preview Tests (RSK-004)
  // ==========================================

  describe('recalculatePreview', () => {
    it('should return preview without persisting changes', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(mockVersion);
      mockPrismaClient.risk.findMany.mockResolvedValue([
        {
          id: 'risk-1',
          title: 'Test Risk',
          likelihood: 3,
          impact: 4,
          inherentRisk: 'medium',
          riskMethodVersionId: null,
          assessments: [],
        },
      ]);

      const result = await riskMethodService.recalculatePreview('rmv-1');

      expect(result).toHaveLength(1);
      expect(result[0].newScore).toBe(12); // 3 * 4
      expect(result[0].newRiskClass).toBe('high');
      // Verify no write operations were called
      expect(mockPrismaClient.risk.update).not.toHaveBeenCalled();
      expect(mockPrismaClient.riskAssessmentVersion.create).not.toHaveBeenCalled();
    });

    it('should filter by specific risk IDs', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(mockVersion);
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      await riskMethodService.recalculatePreview('rmv-1', { riskIds: ['risk-1'] });

      expect(mockPrismaClient.risk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['risk-1'] } }),
        }),
      );
    });

    it('should allow likelihood/impact overrides', async () => {
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(mockVersion);
      mockPrismaClient.risk.findMany.mockResolvedValue([
        {
          id: 'risk-1',
          title: 'Test Risk',
          likelihood: 3,
          impact: 4,
          inherentRisk: 'medium',
          riskMethodVersionId: null,
          assessments: [],
        },
      ]);

      const result = await riskMethodService.recalculatePreview('rmv-1', {
        likelihoodOverrides: { 'risk-1': 5 },
        impactOverrides: { 'risk-1': 5 },
      });

      expect(result[0].newScore).toBe(25); // 5 * 5 override
    });
  });

  // ==========================================
  // Confirmed Recalculation Tests
  // ==========================================

  describe('confirmRecalculation', () => {
    it('should create a new assessment version without modifying history', async () => {
      const mockRisk = {
        id: 'risk-1',
        title: 'Test Risk',
        likelihood: 3,
        impact: 4,
        inherentRisk: 'medium',
        residualRisk: 'low',
        targetRisk: 'low',
        riskMethodVersionId: null,
        evaluationJustification: null,
        assessments: [mockAssessment],
      };

      mockPrismaClient.risk.findUnique.mockResolvedValue(mockRisk);
      mockPrismaClient.riskMethodVersion.findUnique.mockResolvedValue(mockVersion);

      const newAssessment = { ...mockAssessment, id: 'ra-2', versionNumber: 2 };
      const txUpdateAssessment = jest.fn().mockResolvedValue({});
      const txCreateAssessment = jest.fn().mockResolvedValue(newAssessment);
      const txUpdateRisk = jest.fn().mockResolvedValue({});
      const txCountRefs = jest.fn().mockResolvedValue(1);
      const txUpdateVersion = jest.fn().mockResolvedValue({ ...mockVersion, isImmutable: true });

      mockTransactionFn.mockImplementation(async (cb) => cb({
        riskAssessmentVersion: { update: txUpdateAssessment, create: txCreateAssessment, count: txCountRefs },
        risk: { update: txUpdateRisk },
        riskMethodVersion: { update: txUpdateVersion },
      }));

      const result = await riskMethodService.confirmRecalculation('risk-1', {
        riskMethodVersionId: 'rmv-1',
        assessorId: 'user-2',
        justification: 'Method updated to v3.0',
      });

      expect(result.versionNumber).toBe(2);
      // Old assessment marked as not current
      expect(txUpdateAssessment).toHaveBeenCalledWith({
        where: { id: mockAssessment.id },
        data: expect.objectContaining({ isCurrent: false, isClosed: true }),
      });
      // New assessment created
      expect(txCreateAssessment).toHaveBeenCalled();
      // Version marked immutable
      expect(txUpdateVersion).toHaveBeenCalled();
    });

    it('should throw 404 for non-existent risk', async () => {
      mockPrismaClient.risk.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.confirmRecalculation('nonexistent', {
        riskMethodVersionId: 'rmv-1',
        assessorId: 'user-1',
      })).rejects.toThrow('Risk not found');
    });
  });

  describe('bulkConfirmRecalculation', () => {
    it('should return success/failure counts', async () => {
      mockPrismaClient.risk.findUnique.mockResolvedValue(null);

      const result = await riskMethodService.bulkConfirmRecalculation(
        ['risk-1', 'risk-2'],
        { riskMethodVersionId: 'rmv-1', assessorId: 'user-1' },
      );

      expect(result.success).toBe(0);
      expect(result.failures).toHaveLength(2);
    });
  });

  // ==========================================
  // Legacy Compatibility Tests
  // ==========================================

  describe('calculateRiskScoreLegacy', () => {
    it('should calculate using method calculationType', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);

      const result = await riskMethodService.calculateRiskScoreLegacy('rm-1', 3, 4);

      expect(result).toBe(12);
    });
  });

  describe('recalculatePreviewLegacy', () => {
    it('should delegate to version-based preview', async () => {
      mockPrismaClient.riskMethodVersion.findFirst.mockResolvedValue(mockVersion);
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      const result = await riskMethodService.recalculatePreviewLegacy('rm-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

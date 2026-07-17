/**
 * Tests for RiskMethodService
 *
 * Tests CRUD operations, versioning, risk calculation, and recalculate preview.
 */

const mockTransactionFn = jest.fn((cb) => cb({
  riskMethod: {
    updateMany: jest.fn(),
    create: jest.fn(),
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
  $transaction: mockTransactionFn,
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { riskMethodService } from '../services/riskmethod.service';

describe('RiskMethodService', () => {
  const mockMethod = {
    id: 'rm-1',
    displayId: 'RM-001',
    name: 'ISO 27005 Standard',
    description: 'Standard risk assessment method',
    version: '2.0.0',
    likelihoodScale: JSON.stringify({ levels: [1, 2, 3, 4, 5] }),
    impactScale: JSON.stringify({ levels: [1, 2, 3, 4, 5] }),
    ratingDimensions: JSON.stringify({ confidentiality: true, integrity: true, availability: true }),
    formula: 'likelihood * impact',
    riskClasses: JSON.stringify({ low: '<=4', medium: '5-9', high: '10-16' }),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated methods', async () => {
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

    it('should return empty results for no matches', async () => {
      mockPrismaClient.riskMethod.findMany.mockResolvedValue([]);
      mockPrismaClient.riskMethod.count.mockResolvedValue(0);

      const result = await riskMethodService.list({ search: 'nonexistent' });

      expect(result.data).toHaveLength(0);
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
    it('should create a new method with displayId', async () => {
      const txCreate = jest.fn().mockResolvedValue(mockMethod);
      mockTransactionFn.mockImplementation(async (cb) => cb({
        riskMethod: { updateMany: jest.fn(), create: txCreate },
      }));

      await riskMethodService.create({
        name: 'New Method',
        version: '1.0.0',
        likelihoodScale: { levels: [1, 2, 3] },
        impactScale: { levels: [1, 2, 3] },
        ratingDimensions: {},
        formula: 'l * i',
        riskClasses: {},
      });

      expect(txCreate).toHaveBeenCalled();
    });

    it('should deactivate other active methods when creating active method', async () => {
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreate = jest.fn().mockResolvedValue(mockMethod);
      mockTransactionFn.mockImplementation(async (cb) => cb({
        riskMethod: { updateMany: txUpdateMany, create: txCreate },
      }));

      await riskMethodService.create({
        name: 'New Active Method',
        version: '1.0.0',
        likelihoodScale: {},
        impactScale: {},
        ratingDimensions: {},
        formula: 'l * i',
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

    it('should deactivate other methods when activating this one', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.riskMethod.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaClient.riskMethod.update.mockResolvedValue(mockMethod);

      await riskMethodService.update('rm-1', { isActive: true });

      expect(mockPrismaClient.riskMethod.updateMany).toHaveBeenCalledWith({
        where: { isActive: true, id: { not: 'rm-1' } },
        data: { isActive: false },
      });
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.update('nonexistent', { name: 'X' })).rejects.toThrow('Risk method not found');
    });
  });

  describe('delete', () => {
    it('should soft delete a method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.riskMethod.update.mockResolvedValue({ ...mockMethod, isArchived: true });

      const result = await riskMethodService.delete('rm-1');

      expect(result.success).toBe(true);
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(riskMethodService.delete('nonexistent')).rejects.toThrow('Risk method not found');
    });
  });

  describe('recalculatePreview', () => {
    it('should return recalculated risk values for all risks', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);
      mockPrismaClient.risk = { findMany: jest.fn() };
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      const result = await riskMethodService.recalculatePreview('rm-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(
        riskMethodService.recalculatePreview('nonexistent'),
      ).rejects.toThrow('Risk method not found');
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate multiplication formula', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(mockMethod);

      const result = await riskMethodService.calculateRiskScore('rm-1', 3, 4);

      expect(result).toBe(12);
    });

    it('should throw 404 for non-existent method', async () => {
      mockPrismaClient.riskMethod.findUnique.mockResolvedValue(null);

      await expect(
        riskMethodService.calculateRiskScore('nonexistent', 3, 4),
      ).rejects.toThrow('Risk method not found');
    });
  });
});

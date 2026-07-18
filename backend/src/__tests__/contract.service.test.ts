/**
 * Tests for ContractService
 *
 * Tests CRUD operations, filtering, and soft delete functionality.
 */

// Using any type for mocks to avoid strict TypeScript 'never' inference issues
const mockPrismaClient: any = {
  contract: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { contractService } from '../services/contract.service';

describe('ContractService', () => {
  const mockContract = {
    id: 'ctr-1',
    displayId: 'CTR-001',
    title: 'Test Contract',
    description: 'A test contract',
    contractType: 'sla',
    supplierId: 'sup-1',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    status: 'active',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated contracts', async () => {
      mockPrismaClient.contract.findMany.mockResolvedValue([mockContract]);
      mockPrismaClient.contract.count.mockResolvedValue(1);

      const result = await contractService.list({});

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrismaClient.contract.findMany.mockResolvedValue([]);
      mockPrismaClient.contract.count.mockResolvedValue(0);

      await contractService.list({ status: 'expired' });

      expect(mockPrismaClient.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'expired' } }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaClient.contract.findMany.mockResolvedValue([]);
      mockPrismaClient.contract.count.mockResolvedValue(0);

      await contractService.list({ startDateFrom: '2024-01-01', startDateTo: '2024-12-31' });

      expect(mockPrismaClient.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { startDate: expect.any(Object) } }),
      );
    });

    it('should return empty results for no matches', async () => {
      mockPrismaClient.contract.findMany.mockResolvedValue([]);
      mockPrismaClient.contract.count.mockResolvedValue(0);

      const result = await contractService.list({ search: 'nonexistent' });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('should return contract by id with assets', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue({ ...mockContract, assetLinks: [] });

      const result = await contractService.findById('ctr-1');

      expect(result.id).toBe('ctr-1');
      expect(mockPrismaClient.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'ctr-1' },
        include: { assetLinks: { include: { asset: { include: { assetType: true } } } } },
      });
    });

    it('should throw 404 for non-existent contract', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue(null);

      await expect(contractService.findById('nonexistent')).rejects.toThrow('Contract not found');
    });
  });

  describe('create', () => {
    it('should create a new contract with displayId', async () => {
      mockPrismaClient.contract.create.mockResolvedValue(mockContract);

      const result = await contractService.create({
        title: 'New Contract',
        contractType: 'nda',
      }, 'user-1');

      expect(result).toBe(mockContract);
      expect(mockPrismaClient.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayId: expect.stringMatching(/^CTR-/), createdBy: 'user-1' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing contract', async () => {
      const updated = { ...mockContract, title: 'Updated Contract' };
      mockPrismaClient.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaClient.contract.update.mockResolvedValue(updated);

      const result = await contractService.update('ctr-1', { title: 'Updated Contract' });

      expect(result.title).toBe('Updated Contract');
    });

    it('should throw 404 for non-existent contract', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue(null);

      await expect(contractService.update('nonexistent', { title: 'X' })).rejects.toThrow('Contract not found');
    });
  });

  describe('delete', () => {
    it('should soft delete a contract', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaClient.contract.update.mockResolvedValue({ ...mockContract, isArchived: true });

      const result = await contractService.delete('ctr-1');

      expect(result.success).toBe(true);
      expect(mockPrismaClient.contract.update).toHaveBeenCalledWith({
        where: { id: 'ctr-1' },
        data: { isArchived: true },
      });
    });

    it('should throw 404 for non-existent contract', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue(null);

      await expect(contractService.delete('nonexistent')).rejects.toThrow('Contract not found');
    });
  });

  describe('getAssets', () => {
    it('should return assets linked to contract', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaClient.asset.findMany.mockResolvedValue([]);

      await contractService.getAssets('ctr-1');

      expect(mockPrismaClient.asset.findMany).toHaveBeenCalledWith({
        where: { contractLinks: { some: { contractId: 'ctr-1' } } },
        include: { assetType: true },
      });
    });

    it('should throw 404 for non-existent contract', async () => {
      mockPrismaClient.contract.findUnique.mockResolvedValue(null);

      await expect(contractService.getAssets('nonexistent')).rejects.toThrow('Contract not found');
    });
  });
});

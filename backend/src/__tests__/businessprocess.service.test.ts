/**
 * Tests for BusinessProcessService
 *
 * Tests CRUD operations, filtering, risk linking, and soft delete.
 */

const mockPrismaClient: any = {
  businessProcess: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  risk: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { businessProcessService } from '../services/businessprocess.service';

describe('BusinessProcessService', () => {
  const mockProcess = {
    id: 'bp-1',
    displayId: 'BP-001',
    name: 'Order Processing',
    description: 'Core order processing workflow',
    processOwner: 'user-1',
    category: 'core',
    siacControlled: false,
    criticality: 'high',
    status: 'active',
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated processes', async () => {
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([mockProcess]);
      mockPrismaClient.businessProcess.count.mockResolvedValue(1);

      const result = await businessProcessService.list({});

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([]);
      mockPrismaClient.businessProcess.count.mockResolvedValue(0);

      await businessProcessService.list({ status: 'inactive' });

      expect(mockPrismaClient.businessProcess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'inactive' } }),
      );
    });

    it('should filter by category', async () => {
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([]);
      mockPrismaClient.businessProcess.count.mockResolvedValue(0);

      await businessProcessService.list({ category: 'management' });

      expect(mockPrismaClient.businessProcess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: 'management' } }),
      );
    });

    it('should filter by criticality', async () => {
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([]);
      mockPrismaClient.businessProcess.count.mockResolvedValue(0);

      await businessProcessService.list({ criticality: 'critical' });

      expect(mockPrismaClient.businessProcess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { criticality: 'critical' } }),
      );
    });

    it('should filter by processOwner', async () => {
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([]);
      mockPrismaClient.businessProcess.count.mockResolvedValue(0);

      await businessProcessService.list({ processOwner: 'user-2' });

      expect(mockPrismaClient.businessProcess.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { processOwner: 'user-2' } }),
      );
    });

    it('should return empty results for no matches', async () => {
      mockPrismaClient.businessProcess.findMany.mockResolvedValue([]);
      mockPrismaClient.businessProcess.count.mockResolvedValue(0);

      const result = await businessProcessService.list({ search: 'nonexistent' });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return process by id with risks', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue({ ...mockProcess, risks: [] });

      const result = await businessProcessService.findById('bp-1');

      expect(result.id).toBe('bp-1');
    });

    it('should throw 404 for non-existent process', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(null);

      await expect(businessProcessService.findById('nonexistent')).rejects.toThrow('Business process not found');
    });
  });

  describe('create', () => {
    it('should create a new process with displayId', async () => {
      mockPrismaClient.businessProcess.create.mockResolvedValue(mockProcess);

      const result = await businessProcessService.create({
        name: 'New Process',
        processOwner: 'user-1',
      }, 'admin-1');

      expect(result).toBe(mockProcess);
      expect(mockPrismaClient.businessProcess.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayId: expect.stringMatching(/^BP-/), createdBy: 'admin-1' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing process', async () => {
      const updated = { ...mockProcess, name: 'Updated Process' };
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(mockProcess);
      mockPrismaClient.businessProcess.update.mockResolvedValue(updated);

      const result = await businessProcessService.update('bp-1', { name: 'Updated Process' });

      expect(result.name).toBe('Updated Process');
    });

    it('should throw 404 for non-existent process', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(null);

      await expect(businessProcessService.update('nonexistent', { name: 'X' })).rejects.toThrow('Business process not found');
    });
  });

  describe('delete', () => {
    it('should soft delete a process', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(mockProcess);
      mockPrismaClient.businessProcess.update.mockResolvedValue({ ...mockProcess, isArchived: true });

      const result = await businessProcessService.delete('bp-1');

      expect(result.success).toBe(true);
    });

    it('should throw 404 for non-existent process', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(null);

      await expect(businessProcessService.delete('nonexistent')).rejects.toThrow('Business process not found');
    });
  });

  describe('getRisks', () => {
    it('should return risks linked to process', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(mockProcess);
      mockPrismaClient.risk.findMany.mockResolvedValue([]);

      await businessProcessService.getRisks('bp-1');

      expect(mockPrismaClient.risk.findMany).toHaveBeenCalledWith({
        where: { businessProcessId: 'bp-1', isArchived: false },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw 404 for non-existent process', async () => {
      mockPrismaClient.businessProcess.findUnique.mockResolvedValue(null);

      await expect(businessProcessService.getRisks('nonexistent')).rejects.toThrow('Business process not found');
    });
  });
});

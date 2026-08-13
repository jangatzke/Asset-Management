/**
 * Tests for LicenseService
 *
 * Tests CRUD operations, expiry date filtering, and soft delete.
 */

const mockPrismaClient: any = {
  license: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
  },
};

jest.mock('../config/database', () => ({
  prisma: mockPrismaClient,
}));

import { licenseService } from '../services/license.service';

describe('LicenseService', () => {
  const mockLicense = {
    id: 'lic-1',
    displayId: 'LIC-001',
    title: 'Office 365 License',
    description: 'E3 subscription',
    licenseType: 'subscription',
    vendor: 'Microsoft',
    productId: 'O365-E3',
    seats: 100,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    cost: 5000,
    currency: 'USD',
    status: 'active',
    licensingBasis: 'user' as const,
    assignmentModel: 'named' as const,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return paginated licenses', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([mockLicense]);
      mockPrismaClient.license.count.mockResolvedValue(1);

      const result = await licenseService.list({});

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should exclude soft-deleted licenses from normal listing', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([]);
      mockPrismaClient.license.count.mockResolvedValue(0);

      await licenseService.list({});

      expect(mockPrismaClient.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isArchived: { not: true } }),
        }),
      );
    });

    it('should filter by expiry date', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([]);
      mockPrismaClient.license.count.mockResolvedValue(0);

      await licenseService.list({ expiringBefore: '2025-06-30' });

      expect(mockPrismaClient.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ endDate: { lte: expect.any(Date) } }) }),
      );
    });

    it('should filter by vendor', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([]);
      mockPrismaClient.license.count.mockResolvedValue(0);

      await licenseService.list({ vendor: 'Microsoft' });

      expect(mockPrismaClient.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ vendor: expect.any(Object) }) }),
      );
    });

    it('should filter by licensingBasis', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([]);
      mockPrismaClient.license.count.mockResolvedValue(0);

      await licenseService.list({ licensingBasis: 'device' });

      expect(mockPrismaClient.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ licensingBasis: 'device' }) }),
      );
    });

    it('should filter by assignmentModel', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([]);
      mockPrismaClient.license.count.mockResolvedValue(0);

      await licenseService.list({ assignmentModel: 'concurrent' });

      expect(mockPrismaClient.license.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ assignmentModel: 'concurrent' }) }),
      );
    });

    it('should return empty results for no matches', async () => {
      mockPrismaClient.license.findMany.mockResolvedValue([]);
      mockPrismaClient.license.count.mockResolvedValue(0);

      const result = await licenseService.list({ search: 'nonexistent' });

      expect(result.data).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return license by id with assets', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue({ ...mockLicense, assetLinks: [] });

      const result = await licenseService.findById('lic-1');

      expect(result.id).toBe('lic-1');
    });

    it('should throw 404 for non-existent license', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue(null);

      await expect(licenseService.findById('nonexistent')).rejects.toThrow('License not found');
    });
  });

  describe('create', () => {
    it('should create a new license with displayId', async () => {
      mockPrismaClient.license.create.mockResolvedValue(mockLicense);

      const result = await licenseService.create({
        title: 'New License',
        licenseType: 'perpetual',
      }, 'user-1');

      expect(result).toBe(mockLicense);
      expect(mockPrismaClient.license.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayId: expect.stringMatching(/^LIC-/),
            createdBy: 'user-1',
            licensingBasis: 'user',
            assignmentModel: 'named',
          }),
        }),
      );
    });

    it('should accept explicit licensingBasis and assignmentModel', async () => {
      mockPrismaClient.license.create.mockResolvedValue({ ...mockLicense, licensingBasis: 'device', assignmentModel: 'concurrent' });

      const result = await licenseService.create({
        title: 'Device License',
        licenseType: 'subscription',
        licensingBasis: 'device',
        assignmentModel: 'concurrent',
      }, 'user-2');

      expect(result).toBeDefined();
      expect(mockPrismaClient.license.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            licensingBasis: 'device',
            assignmentModel: 'concurrent',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing license', async () => {
      const updated = { ...mockLicense, title: 'Updated License' };
      mockPrismaClient.license.findUnique.mockResolvedValue(mockLicense);
      mockPrismaClient.license.update.mockResolvedValue(updated);

      const result = await licenseService.update('lic-1', { title: 'Updated License' });

      expect(result.title).toBe('Updated License');
    });

    it('should throw 404 for non-existent license', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue(null);

      await expect(licenseService.update('nonexistent', { title: 'X' })).rejects.toThrow('License not found');
    });
  });

  describe('delete', () => {
    it('should soft delete a license', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue(mockLicense);
      mockPrismaClient.license.update.mockResolvedValue({ ...mockLicense, isArchived: true });

      const result = await licenseService.delete('lic-1');

      expect(result.success).toBe(true);
    });

    it('should throw 404 for non-existent license', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue(null);

      await expect(licenseService.delete('nonexistent')).rejects.toThrow('License not found');
    });
  });

  describe('getAssets', () => {
    it('should return assets linked to license', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue(mockLicense);
      mockPrismaClient.asset.findMany.mockResolvedValue([]);

      await licenseService.getAssets('lic-1');

      expect(mockPrismaClient.asset.findMany).toHaveBeenCalledWith({
        where: { licenseLinks: { some: { licenseId: 'lic-1' } } },
        include: { assetType: true },
      });
    });

    it('should throw 404 for non-existent license', async () => {
      mockPrismaClient.license.findUnique.mockResolvedValue(null);

      await expect(licenseService.getAssets('nonexistent')).rejects.toThrow('License not found');
    });
  });
});

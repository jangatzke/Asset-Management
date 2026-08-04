import type { CreateAssetData } from '../services/asset.service';

// ==========================================
// Mock Setup — must be defined BEFORE jest.mock calls due to hoisting
// ==========================================

var mockPrisma = {
  asset: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  networkAddress: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  assetType: {
    findUnique: jest.fn(),
  },
  assetSubtype: {
    findUnique: jest.fn(),
  },
  assetProcess: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  assetService: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  assetContract: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  assetLicense: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  assetLifecycleLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  assetRelation: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  displayIdCounter: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

jest.mock('../config/database', () => ({
  prisma: mockPrisma,
}));

var mockAuditService = {
  logEventStandalone: jest.fn(),
};

jest.mock('../services/audit.service', () => ({
  auditService: mockAuditService,
}));

// Mock displayId service
jest.mock('../services/displayId.service', () => ({
  nextDisplayId: jest.fn().mockResolvedValue('ASSET-0001'),
  displayIdService: {
    nextDisplayId: jest.fn().mockResolvedValue('ASSET-0001'),
  },
}));

const { AssetService } = require('../services/asset.service');

// ==========================================
// Test Helpers
// ==========================================

const validAssetTypeId = '550e8400-e29b-41d4-a716-446655440000';

const createAssetData: CreateAssetData = {
  name: 'Test Server',
  description: 'A test server asset',
  assetTypeId: validAssetTypeId,
  criticality: 'high',
  lifecycleStatus: 'planned',
};

const createdAsset = {
  id: 'asset-123',
  displayId: 'ASSET-0001',
  name: 'Test Server',
  description: 'A test server asset',
  assetTypeId: validAssetTypeId,
  criticality: 'high',
  lifecycleStatus: 'planned',
  isArchived: false,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const archivedAsset = {
  ...createdAsset,
  isArchived: true,
  archivedAt: new Date('2026-01-01'),
  lifecycleStatus: 'decommissioned',
};

// ==========================================
// Tests
// ==========================================

describe('AssetService - CRUD Operations', () => {
  let assetService: InstanceType<typeof AssetService>;

  beforeEach(() => {
    jest.clearAllMocks();
    assetService = new AssetService();
  });

  // ==========================================
  // Create
  // ==========================================

  describe('create', () => {
    beforeEach(() => {
      mockPrisma.assetType.findUnique.mockResolvedValue({
        id: validAssetTypeId,
        inventoryEnabled: false,
        inventoryPattern: null,
      });
      mockPrisma.assetSubtype.findUnique.mockResolvedValue(null);
      mockPrisma.asset.findUnique.mockResolvedValue(createdAsset);
    });

    it('should create an asset with sequential display ID (ASSET-0001)', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);

      const result = await assetService.create(createAssetData, 'user-123');

      expect(mockPrisma.asset.create).toHaveBeenCalled();
      expect(result.name).toBe('Test Server');
    });

    it('should create network addresses when provided', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);
      mockPrisma.networkAddress.createMany.mockResolvedValue({ count: 2 } as any);

      const dataWithAddresses: CreateAssetData = {
        ...createAssetData,
        networkAddresses: [
          { address: '192.168.1.1', type: 'ipv4', primary: true },
          { address: 'fe80::1', type: 'ipv6', primary: false },
        ],
      };

      await assetService.create(dataWithAddresses, 'user-123');

      expect(mockPrisma.networkAddress.createMany).toHaveBeenCalledWith({
        data: [
          { assetId: createdAsset.id, address: '192.168.1.1', type: 'ipv4', primary: true },
          { assetId: createdAsset.id, address: 'fe80::1', type: 'ipv6', primary: false },
        ],
      });
    });

    it('should create junction table entries for processIds', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);
      mockPrisma.assetProcess.createMany.mockResolvedValue({ count: 1 } as any);

      const dataWithProcesses: CreateAssetData = {
        ...createAssetData,
        processIds: ['process-001'],
      };

      await assetService.create(dataWithProcesses, 'user-123');

      expect(mockPrisma.assetProcess.createMany).toHaveBeenCalledWith({
        data: [{ assetId: createdAsset.id, processId: 'process-001' }],
      });
    });

    it('should create junction table entries for serviceIds', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);
      mockPrisma.assetService.createMany.mockResolvedValue({ count: 1 } as any);

      const dataWithServices: CreateAssetData = {
        ...createAssetData,
        serviceIds: ['service-001'],
      };

      await assetService.create(dataWithServices, 'user-123');

      expect(mockPrisma.assetService.createMany).toHaveBeenCalledWith({
        data: [{ assetId: createdAsset.id, serviceId: 'service-001' }],
      });
    });

    it('should create junction table entries for contractIds', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);
      mockPrisma.assetContract.createMany.mockResolvedValue({ count: 1 } as any);

      const dataWithContracts: CreateAssetData = {
        ...createAssetData,
        contractIds: ['contract-001'],
      };

      await assetService.create(dataWithContracts, 'user-123');

      expect(mockPrisma.assetContract.createMany).toHaveBeenCalledWith({
        data: [{ assetId: createdAsset.id, contractId: 'contract-001' }],
      });
    });

    it('should create junction table entries for licenseIds', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);
      mockPrisma.assetLicense.createMany.mockResolvedValue({ count: 1 } as any);

      const dataWithLicenses: CreateAssetData = {
        ...createAssetData,
        licenseIds: ['license-001'],
      };

      await assetService.create(dataWithLicenses, 'user-123');

      expect(mockPrisma.assetLicense.createMany).toHaveBeenCalledWith({
        data: [{ assetId: createdAsset.id, licenseId: 'license-001' }],
      });
    });

    it('should log initial lifecycle status in transaction', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);

      await assetService.create(createAssetData, 'user-123');

      expect(mockPrisma.assetLifecycleLog.create).toHaveBeenCalledWith({
        data: {
          assetId: createdAsset.id,
          newStatus: 'planned',
          changedByUserId: 'user-123',
          reason: 'Asset created',
        },
      });
    });

    it('should create audit log entry for asset creation', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);

      await assetService.create(createAssetData, 'user-123');

      expect(mockAuditService.logEventStandalone).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-123',
          action: 'ASSET_CREATE',
          entityType: 'Asset',
          entityId: createdAsset.id,
        }),
      );
    });

    it('should set isArchived to false for new assets', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);

      await assetService.create(createAssetData, 'user-123');

      const createCall = mockPrisma.asset.create as jest.Mock;
      expect(createCall.mock.calls[0][0].data.isArchived).toBe(false);
      expect(createCall.mock.calls[0][0].data.archivedAt).toBeNull();
    });

    it('should handle complianceRelevance field', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);

      const dataWithCompliance: CreateAssetData = {
        ...createAssetData,
        complianceRelevance: true,
      };

      await assetService.create(dataWithCompliance, 'user-123');

      const createCall = mockPrisma.asset.create as jest.Mock;
      expect(createCall.mock.calls[0][0].data.complianceRelevance).toBe(true);
    });
  });

  // ==========================================
  // Update
  // ==========================================

  describe('update', () => {
    beforeEach(() => {
      mockPrisma.assetType.findUnique.mockResolvedValue({
        id: validAssetTypeId,
        inventoryEnabled: false,
        inventoryPattern: null,
      });
      mockPrisma.asset.findUnique.mockResolvedValue(createdAsset);
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, criticality: 'critical' });
    });

    it('should update an asset successfully', async () => {
      await assetService.update('asset-123', { criticality: 'critical' }, 'user-123');
      expect(mockPrisma.asset.update).toHaveBeenCalled();
    });

    it('should throw 404 when updating non-existent asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(
        assetService.update('nonexistent', { name: 'Updated' }, 'user-123')
      ).rejects.toThrow('Asset not found');
    });

    it('should throw 409 when updating archived asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(archivedAsset);

      await expect(
        assetService.update('asset-123', { name: 'Updated' }, 'user-123')
      ).rejects.toThrow('Cannot modify archived asset');
    });

    it('should sync network addresses on update', async () => {
      mockPrisma.networkAddress.deleteMany.mockResolvedValue({ count: 0 } as any);
      mockPrisma.networkAddress.createMany.mockResolvedValue({ count: 1 } as any);

      await assetService.update('asset-123', {
        networkAddresses: [{ address: '10.0.0.1', type: 'ipv4', primary: true }],
      }, 'user-123');

      expect(mockPrisma.networkAddress.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'asset-123' } });
      expect(mockPrisma.networkAddress.createMany).toHaveBeenCalled();
    });

    it('should sync junction tables on update', async () => {
      mockPrisma.assetProcess.deleteMany.mockResolvedValue({ count: 0 } as any);
      mockPrisma.assetProcess.createMany.mockResolvedValue({ count: 1 } as any);

      await assetService.update('asset-123', { processIds: ['process-new'] }, 'user-123');

      expect(mockPrisma.assetProcess.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.assetProcess.createMany).toHaveBeenCalled();
    });

    it('should sync asset dependency relations on update', async () => {
      mockPrisma.assetRelation.deleteMany.mockResolvedValue({ count: 0 } as any);
      mockPrisma.assetRelation.createMany.mockResolvedValue({ count: 1 } as any);

      await assetService.update('asset-123', {
        assetRelations: [{ targetAssetId: 'asset-456', relationshipType: 'depends_on' }],
      }, 'user-123');

      expect(mockPrisma.assetRelation.deleteMany).toHaveBeenCalledWith({ where: { sourceAssetId: 'asset-123' } });
      expect(mockPrisma.assetRelation.createMany).toHaveBeenCalledWith({
        data: [{
          sourceAssetId: 'asset-123',
          targetAssetId: 'asset-456',
          relationshipType: 'depends_on',
          description: undefined,
        }],
      });
    });

    it('should log lifecycle status change in transaction', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'planned' });
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'active' });

      await assetService.update('asset-123', { lifecycleStatus: 'active' }, 'user-123');

      expect(mockPrisma.assetLifecycleLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousStatus: 'planned',
          newStatus: 'active',
        }),
      });
    });

    it('should create audit log for critical field changes', async () => {
      await assetService.update('asset-123', { criticality: 'critical' }, 'user-123');

      expect(mockAuditService.logEventStandalone).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'ASSET_UPDATE',
        }),
      );
    });

    it('should update an asset while preserving its own inventory number', async () => {
      const assetWithInventoryNumber = { ...createdAsset, inventoryNumber: 'INV-001' };
      mockPrisma.asset.findUnique.mockResolvedValue(assetWithInventoryNumber);
      mockPrisma.asset.update.mockResolvedValue({ ...assetWithInventoryNumber, name: 'Updated Server' });

      await assetService.update('asset-123', { name: 'Updated Server', inventoryNumber: 'INV-001' }, 'user-123');

      expect(mockPrisma.asset.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'asset-123' },
        data: expect.objectContaining({
          name: 'Updated Server',
          inventoryNumber: 'INV-001',
        }),
      }));
    });

    it('should reject updating an asset to another asset inventory number', async () => {
      const currentAsset = { ...createdAsset, inventoryNumber: 'INV-001' };
      const otherAsset = { ...createdAsset, id: 'asset-456', inventoryNumber: 'INV-002' };
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce(currentAsset)
        .mockResolvedValueOnce(otherAsset);

      await expect(
        assetService.update('asset-123', { inventoryNumber: 'INV-002' }, 'user-123'),
      ).rejects.toThrow('Inventory number must be globally unique');

      expect(mockPrisma.asset.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Archive / Restore (Soft Delete)
  // ==========================================

  describe('archive', () => {
    beforeEach(() => {
      mockPrisma.asset.findUnique.mockResolvedValue(createdAsset);
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, isArchived: true, lifecycleStatus: 'decommissioned' });
    });

    it('should archive an asset (soft-delete)', async () => {
      const result = await assetService.archive('asset-123', 'admin-user');

      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: expect.objectContaining({
          isArchived: true,
          archivedAt: expect.any(Date),
          lifecycleStatus: 'decommissioned',
        }),
      });
      expect(result.success).toBe(true);
    });

    it('should throw 409 when archiving already archived asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(archivedAsset);

      await expect(assetService.archive('asset-123', 'admin-user')).rejects.toThrow('already archived');
    });

    it('should throw 404 when archiving non-existent asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(assetService.archive('nonexistent', 'admin-user')).rejects.toThrow('Asset not found');
    });

    it('should log lifecycle change on archive', async () => {
      await assetService.archive('asset-123', 'admin-user', 'End of life reached');

      expect(mockPrisma.assetLifecycleLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousStatus: 'planned',
          newStatus: 'decommissioned',
          reason: expect.stringContaining('Archived'),
        }),
      });
    });

    it('should create audit log for archive action', async () => {
      await assetService.archive('asset-123', 'admin-user');

      expect(mockAuditService.logEventStandalone).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'ASSET_ARCHIVE',
        }),
      );
    });
  });

  describe('restore', () => {
    beforeEach(() => {
      mockPrisma.asset.findUnique.mockResolvedValue(archivedAsset);
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, isArchived: false, lifecycleStatus: 'planned' });
    });

    it('should restore an archived asset', async () => {
      const result = await assetService.restore('asset-123', 'admin-user');

      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: expect.objectContaining({
          isArchived: false,
          archivedAt: null,
          lifecycleStatus: 'planned',
        }),
      });
      expect(result.success).toBe(true);
    });

    it('should throw 409 when restoring non-archived asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(createdAsset);

      await expect(assetService.restore('asset-123', 'admin-user')).rejects.toThrow('not archived');
    });

    it('should log lifecycle change on restore', async () => {
      await assetService.restore('asset-123', 'admin-user', 'Re-evaluated for use');

      expect(mockPrisma.assetLifecycleLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          newStatus: 'planned',
          reason: expect.stringContaining('Restored'),
        }),
      });
    });

    it('should create audit log for restore action', async () => {
      await assetService.restore('asset-123', 'admin-user');

      expect(mockAuditService.logEventStandalone).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'ASSET_RESTORE',
        }),
      );
    });
  });

  // ==========================================
  // Lifecycle Transition (AST-030)
  // ==========================================

  describe('transitionLifecycle', () => {
    beforeEach(() => {
      mockPrisma.asset.findUnique.mockResolvedValue(createdAsset);
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'active' });
    });

    it('should allow valid transition from planned to ordered', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce({ ...createdAsset, lifecycleStatus: 'planned' })
        .mockResolvedValueOnce({ ...createdAsset, lifecycleStatus: 'ordered' });
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'ordered' });

      const result = await assetService.transitionLifecycle('asset-123', 'ordered', 'user-123');
      expect(result.lifecycleStatus).toBe('ordered');
    });

    it('should throw 409 for invalid transition (planned -> active)', async () => {
      // planned -> active is NOT allowed (must go through ordered/in_stock)
      await expect(
        assetService.transitionLifecycle('asset-123', 'active', 'user-123')
      ).rejects.toThrow('Invalid lifecycle transition');
    });

    it('should throw 409 for terminal state transitions (disposed -> anything)', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'disposed' });

      await expect(
        assetService.transitionLifecycle('asset-123', 'active', 'user-123')
      ).rejects.toThrow('Invalid lifecycle transition');
    });

    it('should log lifecycle change in transaction', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'planned' });
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'ordered' });

      await assetService.transitionLifecycle('asset-123', 'ordered', 'user-123', 'Approved for ordering');

      expect(mockPrisma.assetLifecycleLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          previousStatus: 'planned',
          newStatus: 'ordered',
          reason: 'Approved for ordering',
        }),
      });
    });

    it('should create audit log for lifecycle transition', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'planned' });
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'ordered' });

      await assetService.transitionLifecycle('asset-123', 'ordered', 'user-123');

      expect(mockAuditService.logEventStandalone).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'ASSET_LIFECYCLE_TRANSITION',
        }),
      );
    });

    it('should set disposal fields when transitioning to disposed/destroyed', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'decommissioned' });
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'disposed' });

      await assetService.transitionLifecycle(
        'asset-123',
        'disposed',
        'user-123',
        'Secure erasure via degaussing',
      );

      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: expect.objectContaining({
          lifecycleStatus: 'disposed',
          disposalDate: expect.any(Date),
          disposalMethod: 'Secure erasure via degaussing',
          disposalResponsible: 'user-123',
        }),
      });
    });

    it('should allow transition from decommissioned to disposed', async () => {
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce({ ...createdAsset, lifecycleStatus: 'decommissioned' })
        .mockResolvedValueOnce({ ...createdAsset, lifecycleStatus: 'disposed' });
      mockPrisma.asset.update.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'disposed' });

      const result = await assetService.transitionLifecycle('asset-123', 'disposed', 'user-123');
      expect(result.lifecycleStatus).toBe('disposed');
    });
  });

  // ==========================================
  // Disposal Proof (AST-031)
  // ==========================================

  describe('setDisposalProof', () => {
    beforeEach(() => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'decommissioned' });
      mockPrisma.asset.update.mockResolvedValue({
        ...createdAsset,
        disposalDate: new Date(),
        disposalMethod: 'Degaussing',
        disposalResponsible: 'John Doe',
      });
    });

    it('should set disposal proof for decommissioned asset', async () => {
      await assetService.setDisposalProof(
        'asset-123',
        new Date(),
        'Degaussing',
        'John Doe',
        'user-123',
      );

      expect(mockPrisma.asset.update).toHaveBeenCalledWith({
        where: { id: 'asset-123' },
        data: expect.objectContaining({
          disposalDate: expect.any(Date),
          disposalMethod: 'Degaussing',
          disposalResponsible: 'John Doe',
        }),
      });
    });

    it('should throw 409 for non-decommissioned asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ ...createdAsset, lifecycleStatus: 'active' });

      await expect(
        assetService.setDisposalProof('asset-123', new Date(), 'Degaussing', 'John Doe', 'user-123')
      ).rejects.toThrow('Cannot set disposal proof');
    });

    it('should log disposal evidence in lifecycle log', async () => {
      await assetService.setDisposalProof(
        'asset-123',
        new Date(),
        'Degaussing',
        'John Doe',
        'user-123',
      );

      expect(mockPrisma.assetLifecycleLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          disposalEvidence: expect.any(String),
        }),
      });
    });

    it('should create audit log for disposal proof', async () => {
      await assetService.setDisposalProof(
        'asset-123',
        new Date(),
        'Degaussing',
        'John Doe',
        'user-123',
      );

      expect(mockAuditService.logEventStandalone).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'ASSET_DISPOSAL_PROOF',
        }),
      );
    });
  });

  // ==========================================
  // List / Query
  // ==========================================

  describe('list', () => {
    it('should exclude archived assets by default', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await assetService.list({});

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isArchived: false }),
        }),
      );
    });

    it('should include archived assets when archived=true', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await assetService.list({ archived: 'true' });

      const call = (mockPrisma.asset.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.isArchived).toBeUndefined();
    });

    it('should include networkAddresses and junction tables in response', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await assetService.list({});

      const call = (mockPrisma.asset.findMany as jest.Mock).mock.calls[0][0];
      expect(call.include.networkAddresses).toBe(true);
      expect(call.include.processLinks).toBeDefined();
      expect(call.include.serviceLinks).toBeDefined();
      expect(call.include.contractLinks).toBeDefined();
      expect(call.include.licenseLinks).toBeDefined();
    });

    it('should filter by search term across name, description, serialNumber, displayId', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await assetService.list({ search: 'server' });

      const call = (mockPrisma.asset.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
    });
  });

  // ==========================================
  // Lifecycle Logs
  // ==========================================

  describe('getLifecycleLogs', () => {
    it('should return lifecycle logs for an asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(createdAsset);
      mockPrisma.assetLifecycleLog.findMany.mockResolvedValue([
        { id: 'log-1', assetId: 'asset-123', newStatus: 'planned' },
      ]);

      const logs = await assetService.getLifecycleLogs('asset-123');

      expect(logs).toHaveLength(1);
      expect(mockPrisma.assetLifecycleLog.findMany).toHaveBeenCalledWith({
        where: { assetId: 'asset-123' },
        orderBy: { changedAt: 'desc' },
      });
    });
  });

  // ==========================================
  // Display ID Integration
  // ==========================================

  describe('displayId integration', () => {
    it('should use sequential display ID (ASSET-0001) instead of timestamp-based', async () => {
      mockPrisma.asset.create.mockResolvedValue(createdAsset);

      await assetService.create(createAssetData, 'user-123');

      const createCall = (mockPrisma.asset.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.displayId).toBe('ASSET-0001');
    });
  });
});

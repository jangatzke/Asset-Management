var mockPrisma: any = {
  integrationSource: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  importRun: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  importRecord: { create: jest.fn() },
  importConflict: { create: jest.fn(), update: jest.fn() },
  asset: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  networkAddress: { findFirst: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  fieldLock: { findMany: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  fieldProvenance: { findUnique: jest.fn(), upsert: jest.fn() },
  sourcePriority: { findMany: jest.fn(), upsert: jest.fn() },
  auditLog: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) }, // Phase 9: hash-chain lookup
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

jest.mock('../config/database', () => ({ prisma: mockPrisma }));

var mockAuditService = { logEvent: jest.fn(), logEventStandalone: jest.fn() };
jest.mock('../services/audit.service', () => ({ auditService: mockAuditService }));

jest.mock('../services/displayId.service', () => ({ nextDisplayId: jest.fn().mockResolvedValue('ASSET-0001') }));

const { importService } = require('../services/import.service');

describe('ImportService', () => {
  const source = { id: 'source-1', name: 'CMDB', type: 'cmdb', isActive: true };
  const run = { id: 'run-1', integrationSourceId: source.id, status: 'running' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.integrationSource.findUnique.mockResolvedValue(source);
    mockPrisma.importRun.create.mockResolvedValue(run);
    mockPrisma.importRun.update.mockImplementation(({ data }: any) => Promise.resolve({ ...run, ...data }));
    mockPrisma.importRecord.create.mockResolvedValue({ id: 'record-1' });
    mockPrisma.asset.findFirst.mockResolvedValue(null);
    mockPrisma.asset.create.mockResolvedValue({ id: 'asset-1' });
    mockPrisma.asset.update.mockResolvedValue({ id: 'asset-1' });
    mockPrisma.asset.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.fieldLock.findMany.mockResolvedValue([]);
    mockPrisma.fieldProvenance.findUnique.mockResolvedValue(null);
    mockPrisma.sourcePriority.findMany.mockResolvedValue([]);
    mockPrisma.networkAddress.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.networkAddress.createMany.mockResolvedValue({ count: 1 });
  });

  it('creates records in dry run without mutating assets', async () => {
    const result = await importService.execute({
      integrationSourceId: source.id,
      dryRun: true,
      records: [{ sourceRecordId: 'srv-1', data: { name: 'Server 1', assetTypeId: 'type-1', serialNumber: 'SN-1' } }],
    }, 'user-1');

    expect(result.statistics.created).toBe(1);
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
    expect(mockPrisma.importRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'created', action: 'create' }) }));
  });

  it('is idempotent when imported data matches the existing asset', async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', name: 'Server 1', serialNumber: 'SN-1', assetTypeId: 'type-1', isArchived: false });

    const result = await importService.execute({
      integrationSourceId: source.id,
      records: [{ sourceRecordId: 'srv-1', data: { name: 'Server 1', assetTypeId: 'type-1', serialNumber: 'SN-1' } }],
    }, 'user-1');

    expect(result.statistics.unchanged).toBe(1);
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });

  it('detects conflicts when no source priority can decide a field collision', async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', name: 'Old Name', serialNumber: 'SN-1', assetTypeId: 'type-1' });

    const result = await importService.execute({
      integrationSourceId: source.id,
      records: [{ sourceRecordId: 'srv-1', data: { name: 'New Name', assetTypeId: 'type-1', serialNumber: 'SN-1' } }],
    }, 'user-1');

    expect(result.statistics.conflicts).toBe(1);
    expect(mockPrisma.importConflict.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fieldName: 'name' }) }));
  });

  it('respects field locks and does not overwrite locked values', async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({ id: 'asset-1', name: 'Locked Name', serialNumber: 'SN-1', assetTypeId: 'type-1' });
    mockPrisma.fieldLock.findMany.mockResolvedValue([{ assetId: 'asset-1', fieldName: 'name', isActive: true }]);

    const result = await importService.execute({
      integrationSourceId: source.id,
      records: [{ sourceRecordId: 'srv-1', data: { name: 'Incoming Name', assetTypeId: 'type-1', serialNumber: 'SN-1' } }],
    }, 'user-1');

    expect(result.statistics.unchanged).toBe(1);
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });

  it('marks stale assets without archiving them', async () => {
    mockPrisma.asset.updateMany.mockResolvedValue({ count: 3 });

    const result = await importService.execute({
      integrationSourceId: source.id,
      staleStrategy: 'mark',
      records: [{ sourceRecordId: 'srv-1', data: { name: 'Server 1', assetTypeId: 'type-1', serialNumber: 'SN-1' } }],
    }, 'user-1');

    expect(result.statistics.stale).toBe(3);
    expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'stale' }) }));
  });
});

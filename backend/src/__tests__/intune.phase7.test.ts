import { IntuneHttpClient } from '../services/intune.client';
import { IntuneSyncService } from '../services/intune.service';

jest.mock('../config/database', () => ({ prisma: require('../test/prisma-mock').createMockPrismaClient() }));
jest.mock('../services/intune.auth', () => ({ getAuthService: () => ({ getAccessToken: jest.fn().mockResolvedValue('token'), refreshAccessToken: jest.fn().mockResolvedValue('token') }) }));
jest.mock('../services/displayId.service', () => ({ nextDisplayId: jest.fn().mockResolvedValue('AST-0001') }));
jest.mock('../services/audit.service', () => ({ auditService: { logEventStandalone: jest.fn(), logEvent: jest.fn() } }));

const { prisma } = jest.requireMock('../config/database');

describe('Phase 7 Intune Graph client', () => {
  it('processes paginated managedDevices responses', async () => {
    const get = jest.fn()
      .mockResolvedValueOnce({ data: { value: [{ id: 'd1' }], '@odata.nextLink': 'next' } })
      .mockResolvedValueOnce({ data: { value: [{ id: 'd2' }] } });
    const client = new IntuneHttpClient(1, 1, { get } as any, jest.fn().mockResolvedValue(undefined));

    await expect(client.getAllDevices()).resolves.toEqual([{ id: 'd1' }, { id: 'd2' }]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('respects HTTP 429 Retry-After', async () => {
    const error: any = new Error('Too many requests');
    error.isAxiosError = true;
    error.response = { status: 429, headers: { 'retry-after': '2' }, data: {} };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({ data: { value: [] } });
    const client = new IntuneHttpClient(1, 1, { get } as any, sleep);

    await client.getAllDevices();
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('reports missing permission understandably', async () => {
    const error: any = new Error('Forbidden');
    error.isAxiosError = true;
    error.response = { status: 403, headers: {}, data: { error: { message: 'Insufficient privileges' } } };
    const client = new IntuneHttpClient(0, 1, { get: jest.fn().mockRejectedValue(error) } as any, jest.fn());

    const health = await client.checkHealth();
    expect(health.healthy).toBe(false);
    expect(health.permissions.message).toContain('DeviceManagementManagedDevices.Read.All');
  });
});

describe('Phase 7 Intune sync service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.integrationSource.upsert.mockResolvedValue({ id: 'src-1', name: 'intune', isActive: true });
    prisma.intuneSyncStatus.findFirst.mockResolvedValue({ id: 'status-1', totalSyncs: 0, totalDevicesSynced: 0, totalDevicesErrors: 0, status: 'idle' });
    prisma.intuneSyncStatus.update.mockResolvedValue({});
    prisma.intuneSyncConfig.findFirst.mockResolvedValue({ enabled: true, gracePeriodHours: 1 });
    prisma.importRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.importRun.update.mockResolvedValue({ id: 'run-1' });
    prisma.importRecord.create.mockResolvedValue({ id: 'rec-1' });
    prisma.assetType.findFirst.mockResolvedValue({ id: 'type-1', name: 'Endpoint' });
    prisma.networkAddress.deleteMany.mockResolvedValue({ count: 0 });
    prisma.networkAddress.createMany.mockResolvedValue({ count: 0 });
    prisma.fieldProvenance.upsert.mockResolvedValue({});
    prisma.fieldLock.findMany.mockResolvedValue([]);
    prisma.intuneDetectedApp.upsert.mockResolvedValue({});
    prisma.intuneDeviceSync.upsert.mockResolvedValue({});
    prisma.intuneDeviceSync.findMany.mockResolvedValue([]);
    prisma.asset.updateMany.mockResolvedValue({ count: 0 });
  });

  function serviceWith(clientOverrides: Partial<IntuneHttpClient>) {
    return new IntuneSyncService(clientOverrides as IntuneHttpClient);
  }

  it('creates exactly one asset for a new device and repeated sync creates no duplicate', async () => {
    const device = { id: 'dev-1', deviceName: 'PC-1', serialNumber: 'SN-1', lastSyncDateTime: '2026-07-18T00:00:00Z' };
    const client = { getAllDevices: jest.fn().mockResolvedValue([device]), getDetectedApps: jest.fn().mockResolvedValue([]) };
    prisma.intuneDeviceSync.findUnique.mockResolvedValue(null);
    prisma.asset.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue({ id: 'asset-1', name: 'PC-1', serialNumber: 'SN-1' });
    prisma.asset.create.mockResolvedValue({ id: 'asset-1' });
    prisma.asset.update.mockResolvedValue({ id: 'asset-1' });

    const service = serviceWith(client);
    await service.runFullSync('admin');
    await service.runFullSync('admin');

    expect(prisma.asset.create).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite locked fields', async () => {
    const device = { id: 'dev-1', deviceName: 'Graph Name', serialNumber: 'SN-1' };
    const client = { getAllDevices: jest.fn().mockResolvedValue([device]), getDetectedApps: jest.fn().mockResolvedValue([]) };
    prisma.intuneDeviceSync.findUnique.mockResolvedValue({ intuneId: 'dev-1', assetId: 'asset-1', syncAttempts: 1 });
    prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', name: 'Locked Name', serialNumber: 'SN-1' });
    prisma.fieldLock.findMany.mockResolvedValue([{ fieldName: 'name', isActive: true }]);
    prisma.asset.update.mockResolvedValue({ id: 'asset-1' });

    await serviceWith(client).runFullSync('admin');
    expect(prisma.asset.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Graph Name' }) }));
  });

  it('marks removed devices as stale without archiving assets', async () => {
    const client = { getAllDevices: jest.fn().mockResolvedValue([]), getDetectedApps: jest.fn().mockResolvedValue([]) };
    prisma.intuneDeviceSync.findMany.mockResolvedValue([{ intuneId: 'old-1', assetId: 'asset-1', lastSeenDateTime: new Date(0) }]);
    prisma.intuneDeviceSync.update.mockResolvedValue({});

    await serviceWith(client).runFullSync('admin');
    expect(prisma.asset.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'stale' }) }));
    expect(prisma.asset.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isArchived: true }) }));
  });

  it('resync fetches the device from Graph', async () => {
    const client = { getDeviceDetails: jest.fn().mockResolvedValue({ id: 'dev-1', deviceName: 'PC-1' }), getDetectedApps: jest.fn().mockResolvedValue([]) };
    prisma.intuneDeviceSync.findUnique.mockResolvedValue(null);
    prisma.asset.findFirst.mockResolvedValue(null);
    prisma.asset.create.mockResolvedValue({ id: 'asset-1' });

    await serviceWith(client).resyncDevice('dev-1', 'admin');
    expect(client.getDeviceDetails).toHaveBeenCalledWith('dev-1');
  });
});


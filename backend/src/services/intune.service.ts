import { prisma } from '../config/database';
import { getHttpClient, IntuneHttpClient, ManagedDevice } from './intune.client';
import { IntuneConfigManager } from './intune.config';
import { AppError } from '../middleware/errorHandler';
import { nextDisplayId } from './displayId.service';
import { auditService } from './audit.service';

const db = prisma as any;
const INTUNE_SOURCE_NAME = 'intune';
const SYSTEM_USER = 'intune-sync';

const DEVICE_STATE_MAP: Record<string, string> = {
  managed: 'active',
  retirePending: 'planned',
  retireFailed: 'planned',
  wipePending: 'planned',
  wipeFailed: 'planned',
  unhealthy: 'active',
  deletePending: 'planned',
  retired: 'retired',
};

export interface SyncProgress {
  status: 'idle' | 'running' | 'success' | 'partial_success' | 'error';
  syncType: 'full' | 'incremental' | 'resync';
  deviceCount: number;
  deviceSynced: number;
  deviceErrors: number;
  appCount: number;
  appSynced: number;
  appErrors: number;
  staleCount: number;
  lastSyncStartedAt: Date | null;
  lastSyncCompletedAt: Date | null;
  lastSyncDurationMs: number | null;
  lastError: string | null;
  totalSyncs: number;
  totalDevicesSynced: number;
  totalDevicesErrors: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface DeviceSyncResult {
  assetId?: string;
  created: boolean;
  updated: boolean;
}

type AssetUpdate = Record<string, string | Date | null | boolean | undefined>;

export class IntuneSyncService {
  private readonly configManager: IntuneConfigManager;
  private httpClient: IntuneHttpClient | null;

  constructor(httpClient?: IntuneHttpClient) {
    this.configManager = new IntuneConfigManager();
    this.httpClient = httpClient ?? null;
  }

  async initialize(): Promise<SyncProgress> {
    this.configManager.initialize();
    if (!this.httpClient) this.httpClient = getHttpClient();
    let status = await this.getSyncStatus();
    if (!status) status = await this.initializeSyncStatus();
    await this.ensureIntuneSource();
    return status;
  }

  private async ensureIntuneSource() {
    return db.integrationSource.upsert({
      where: { name: INTUNE_SOURCE_NAME },
      update: { type: 'intune', isActive: true, updatedBy: SYSTEM_USER },
      create: { name: INTUNE_SOURCE_NAME, type: 'intune', config: { graph: 'deviceManagement/managedDevices' }, isActive: true, createdBy: SYSTEM_USER, updatedBy: SYSTEM_USER },
    });
  }

  private async getSyncStatus(): Promise<SyncProgress | null> {
    const status = await db.intuneSyncStatus.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!status) return null;
    return { staleCount: 0, ...status } as SyncProgress;
  }

  private async initializeSyncStatus(): Promise<SyncProgress> {
    const status = await db.intuneSyncStatus.create({
      data: { syncType: 'full', status: 'idle', healthStatus: 'healthy' },
    });
    await db.intuneSyncConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', enabled: false, fullSyncIntervalHours: 24, incrementalSyncIntervalMinutes: 120, gracePeriodHours: 168, maxRetryAttempts: 3, retryDelayMs: 5000, batchSize: 100 },
    }).catch(async () => {
      if (!(await db.intuneSyncConfig.findFirst())) {
        await db.intuneSyncConfig.create({ data: { enabled: false, fullSyncIntervalHours: 24, incrementalSyncIntervalMinutes: 120, gracePeriodHours: 168, maxRetryAttempts: 3, retryDelayMs: 5000, batchSize: 100 } });
      }
    });
    return { staleCount: 0, ...status } as SyncProgress;
  }

  private async updateSyncStatus(updates: Partial<SyncProgress>): Promise<void> {
    const existing = await db.intuneSyncStatus.findFirst({ orderBy: { createdAt: 'desc' } });
    if (existing) await db.intuneSyncStatus.update({ where: { id: existing.id }, data: updates });
  }

  async getStatus(): Promise<SyncProgress> {
    const status = await this.getSyncStatus();
    return status ?? {
      status: 'idle', syncType: 'full', deviceCount: 0, deviceSynced: 0, deviceErrors: 0, appCount: 0, appSynced: 0, appErrors: 0, staleCount: 0,
      lastSyncStartedAt: null, lastSyncCompletedAt: null, lastSyncDurationMs: null, lastError: null, totalSyncs: 0, totalDevicesSynced: 0, totalDevicesErrors: 0, healthStatus: 'healthy',
    };
  }

  async runFullSync(userId = SYSTEM_USER): Promise<SyncProgress> {
    return this.runDeviceSync('full', userId);
  }

  async runIncrementalSync(userId = SYSTEM_USER): Promise<SyncProgress> {
    return this.runDeviceSync('incremental', userId);
  }

  private async runDeviceSync(syncType: 'full' | 'incremental', userId: string): Promise<SyncProgress> {
    const startTime = Date.now();
    const config = await this.getEffectiveConfig();
    if (!config.enabled) throw new AppError('Intune sync is disabled.', 400);

    const source = await this.ensureIntuneSource();
    const importRun = await db.importRun.create({ data: { integrationSourceId: source.id, status: 'running', dryRun: false, statistics: {}, createdBy: userId } });
    await this.audit(userId, 'INTUNE_SYNC_RUN', 'IntuneSync', importRun.id, { syncType, phase: 'start' });
    await this.audit(userId, 'IMPORT_RUN_START', 'ImportRun', importRun.id, { syncType });
    await this.updateSyncStatus({ status: 'running', syncType, deviceCount: 0, deviceSynced: 0, deviceErrors: 0, appCount: 0, appSynced: 0, appErrors: 0, lastSyncStartedAt: new Date(), lastSyncCompletedAt: null, lastError: null });

    try {
      const devices = syncType === 'incremental' ? await this.getIncrementalDevices() : await this.getClient().getAllDevices();
      const seenIntuneIds = new Set(devices.map((device) => device.id));
      let deviceSynced = 0;
      let deviceErrors = 0;
      let appCount = 0;
      let appSynced = 0;
      let appErrors = 0;

      for (const device of devices) {
        try {
          await this.syncDevice(device, source.id, importRun.id, userId);
          deviceSynced += 1;
        } catch (error) {
          deviceErrors += 1;
          await this.recordDeviceError(device.id, error as Error);
        }

        try {
          appCount += await this.syncDeviceApps(device.id);
          appSynced += 1;
        } catch {
          appErrors += 1;
        }

        await this.updateSyncStatus({ deviceCount: devices.length, deviceSynced, deviceErrors, appCount, appSynced, appErrors });
      }

      const staleCount = syncType === 'full' ? await this.markStaleDevices(seenIntuneIds, config.gracePeriodHours, userId) : 0;
      const finalStatus: SyncProgress['status'] = deviceErrors > 0 || appErrors > 0 ? 'partial_success' : 'success';
      const previous = await this.getStatus();
      const statistics = { total: devices.length, created: 0, updated: deviceSynced, unchanged: 0, conflicts: 0, skipped: 0, stale: staleCount, errors: deviceErrors + appErrors };

      await db.importRun.update({ where: { id: importRun.id }, data: { status: finalStatus === 'partial_success' ? 'completed_with_errors' : 'completed', endedAt: new Date(), statistics } });
      await this.audit(userId, 'INTUNE_SYNC_RUN', 'IntuneSync', importRun.id, { syncType, phase: 'complete', status: finalStatus, statistics });
      await this.audit(userId, 'IMPORT_RUN_COMPLETE', 'ImportRun', importRun.id, { syncType, status: finalStatus, statistics });
      await this.updateSyncStatus({
        status: finalStatus, deviceCount: devices.length, deviceSynced, deviceErrors, appCount, appSynced, appErrors, staleCount, lastSyncCompletedAt: new Date(), lastSyncDurationMs: Date.now() - startTime,
        lastError: finalStatus === 'partial_success' ? 'One or more Intune records failed to sync.' : null,
        totalSyncs: previous.totalSyncs + 1, totalDevicesSynced: previous.totalDevicesSynced + deviceSynced, totalDevicesErrors: previous.totalDevicesErrors + deviceErrors,
      });
      await this.updateConfigLastSync(syncType === 'full' ? 'lastFullSyncAt' : 'lastIncrementalSyncAt', new Date());
      return this.getStatus();
    } catch (error) {
      await db.importRun.update({ where: { id: importRun.id }, data: { status: 'failed', endedAt: new Date(), errorMessage: (error as Error).message } });
      await this.updateSyncStatus({ status: 'error', lastSyncCompletedAt: new Date(), lastSyncDurationMs: Date.now() - startTime, lastError: (error as Error).message });
      throw new AppError(`Intune ${syncType} sync failed: ${(error as Error).message}`, 500);
    }
  }

  private async getIncrementalDevices() {
    const config = await db.intuneSyncConfig.findFirst();
    const lastSyncTime = config?.lastIncrementalSyncAt ?? new Date(0);
    return (await this.getClient().getAllDevices()).filter((device) => device.lastSyncDateTime && new Date(device.lastSyncDateTime) > lastSyncTime);
  }

  private async syncDevice(device: ManagedDevice, integrationSourceId: string, importRunId: string, userId: string): Promise<DeviceSyncResult> {
    if (!device.id) throw new Error('Intune managedDevice id is missing');
    const normalized = this.normalizeDevice(device);
    const existingSync = await db.intuneDeviceSync.findUnique({ where: { intuneId: device.id } });
    const matchedAsset = existingSync?.assetId ? await db.asset.findUnique({ where: { id: existingSync.assetId } }) : await this.findMatchingAsset(normalized);

    const result = matchedAsset
      ? await this.updateAssetFromDevice(matchedAsset, normalized, integrationSourceId, importRunId, userId)
      : await this.createAssetFromDevice(normalized, integrationSourceId, importRunId, userId);

    await db.intuneDeviceSync.upsert({
      where: { intuneId: device.id },
      update: { ...normalized.syncData, assetId: result.assetId, syncStatus: 'synced', syncErrorMessage: null, syncAttempts: (existingSync?.syncAttempts ?? 0) + 1, lastSyncAt: new Date(), isArchived: false },
      create: { ...normalized.syncData, assetId: result.assetId, syncStatus: 'synced', syncAttempts: 1, lastSyncAt: new Date(), isArchived: false },
    });

    await db.importRecord.create({ data: { importRunId, sourceRecordId: device.id, sourceHash: device.lastSyncDateTime ?? new Date().toISOString(), sourceData: device as any, targetAssetId: result.assetId, status: result.created ? 'created' : result.updated ? 'updated' : 'unchanged', action: result.created ? 'create' : result.updated ? 'update' : 'none' } });
    return result;
  }

  private normalizeDevice(device: ManagedDevice) {
    const lastSyncDateTime = device.lastSyncDateTime ? new Date(device.lastSyncDateTime) : null;
    const enrolledDateTime = device.enrolledDateTime ? new Date(device.enrolledDateTime) : null;
    const networkAddresses = [device.wiFiMacAddress, device.ethernetMacAddress].filter(Boolean).map((address, index) => ({ address: address as string, type: 'mac', primary: index === 0 }));
    const assetData = {
      name: device.deviceName || device.serialNumber || `Intune ${device.id}`,
      serialNumber: device.serialNumber || null,
      manufacturer: device.manufacturer || null,
      model: device.model || null,
      externalId: device.azureADDeviceId || device.id,
      lifecycleStatus: DEVICE_STATE_MAP[device.managementState ?? ''] || 'active',
      status: device.complianceState === 'noncompliant' ? 'warning' : 'active',
      dataSource: INTUNE_SOURCE_NAME,
      lastDetectedAt: lastSyncDateTime ?? new Date(),
      networkAddresses,
    };
    const syncData = {
      intuneId: device.id,
      name: assetData.name,
      serialNumber: assetData.serialNumber,
      manufacturer: assetData.manufacturer,
      model: assetData.model,
      osName: device.operatingSystem || null,
      osVersion: device.osVersion || null,
      deviceEnrollmentType: device.deviceEnrollmentType || null,
      managementType: device.managementAgent || null,
      complianceStatus: device.complianceState || null,
      deviceState: device.managementState || null,
      enrollmentDateTime: enrolledDateTime,
      lastSyncDateTime,
      primaryUserEmail: device.emailAddress || device.userPrincipalName || null,
      primaryUserDisplayName: device.userDisplayName || null,
      lastSeenDateTime: lastSyncDateTime ?? new Date(),
      sourceIntuneId: device.id,
      sourceUpdatedAt: lastSyncDateTime ?? new Date(),
    };
    return { assetData, syncData };
  }

  private async findMatchingAsset(normalized: ReturnType<IntuneSyncService['normalizeDevice']>) {
    const { assetData } = normalized;
    if (assetData.serialNumber) {
      const bySerial = await db.asset.findFirst({ where: { serialNumber: assetData.serialNumber, isArchived: false } });
      if (bySerial) return bySerial;
    }
    if (assetData.externalId) {
      const byExternal = await db.asset.findFirst({ where: { externalId: assetData.externalId, isArchived: false } });
      if (byExternal) return byExternal;
    }
    const mac = assetData.networkAddresses[0]?.address;
    if (mac) return (await db.networkAddress.findFirst({ where: { address: mac }, include: { asset: true } }))?.asset ?? null;
    return null;
  }

  private async createAssetFromDevice(normalized: ReturnType<IntuneSyncService['normalizeDevice']>, integrationSourceId: string, importRunId: string, userId: string): Promise<DeviceSyncResult> {
    const assetTypeId = await this.getDefaultAssetTypeId();
    const displayId = await nextDisplayId(db, 'Asset');
    const asset = await db.asset.create({ data: { ...this.assetFields(normalized.assetData), assetTypeId, displayId, createdBy: userId, updatedBy: userId, isArchived: false, archivedAt: null } });
    await this.syncNetworkAddresses(asset.id, normalized.assetData.networkAddresses);
    await this.writeProvenance(asset.id, integrationSourceId, importRunId, normalized.syncData.intuneId, this.assetFields(normalized.assetData), userId);
    return { assetId: asset.id, created: true, updated: false };
  }

  private async updateAssetFromDevice(asset: any, normalized: ReturnType<IntuneSyncService['normalizeDevice']>, integrationSourceId: string, importRunId: string, userId: string): Promise<DeviceSyncResult> {
    const locks = new Set((await db.fieldLock.findMany({ where: { assetId: asset.id, isActive: true } })).map((lock: any) => lock.fieldName));
    const updates: AssetUpdate = {};
    for (const [fieldName, value] of Object.entries(this.assetFields(normalized.assetData))) {
      if (locks.has(fieldName)) continue;
      if (JSON.stringify(asset[fieldName] ?? null) !== JSON.stringify(value ?? null)) updates[fieldName] = value as any;
    }
    if (Object.keys(updates).length > 0) {
      await db.asset.update({ where: { id: asset.id }, data: { ...updates, updatedBy: userId } });
      await this.writeProvenance(asset.id, integrationSourceId, importRunId, normalized.syncData.intuneId, updates, userId);
    }
    await this.syncNetworkAddresses(asset.id, normalized.assetData.networkAddresses);
    return { assetId: asset.id, created: false, updated: Object.keys(updates).length > 0 };
  }

  private assetFields(assetData: any) {
    const { networkAddresses: _networkAddresses, ...fields } = assetData;
    return fields;
  }

  private async writeProvenance(assetId: string, integrationSourceId: string, importRunId: string, sourceRecordId: string, updates: AssetUpdate, setBy: string) {
    for (const [fieldName, value] of Object.entries(updates)) {
      await db.fieldProvenance.upsert({ where: { assetId_fieldName: { assetId, fieldName } }, update: { integrationSourceId, importRunId, sourceRecordId, value: value as any, setAt: new Date(), setBy }, create: { assetId, fieldName, integrationSourceId, importRunId, sourceRecordId, value: value as any, setBy } });
    }
  }

  private async syncNetworkAddresses(assetId: string, addresses: Array<{ address: string; type: string; primary: boolean }>) {
    await db.networkAddress.deleteMany({ where: { assetId, type: 'mac' } });
    if (addresses.length > 0) await db.networkAddress.createMany({ data: addresses.map((entry) => ({ ...entry, assetId })) });
  }

  private async getDefaultAssetTypeId(): Promise<string> {
    const existing = await db.assetType.findFirst({ where: { name: 'Endpoint' } });
    if (existing) return existing.id;
    return (await db.assetType.create({ data: { name: 'Endpoint', category: 'hardware', description: 'Managed endpoint device' } })).id;
  }

  private async syncDeviceApps(deviceId: string): Promise<number> {
    const apps = await this.getClient().getDetectedApps(deviceId);
    for (const app of apps) {
      const appId = app.id || app.appIdentity || app.displayName;
      if (!appId) continue;
      await db.intuneDetectedApp.upsert({
        where: { intuneAppId_deviceId: { intuneAppId: appId, deviceId } },
        update: { name: app.displayName || app.name || null, version: app.version || null, publisher: app.publisher || null, syncStatus: 'synced', syncErrorMessage: null, syncAttempts: 1, lastSyncAt: new Date(), sourceUpdatedAt: new Date() },
        create: { intuneAppId: appId, deviceId, name: app.displayName || app.name || null, version: app.version || null, publisher: app.publisher || null, syncStatus: 'synced', syncAttempts: 1, lastSyncAt: new Date(), sourceUpdatedAt: new Date() },
      });
    }
    return apps.length;
  }

  private async markStaleDevices(currentIds: Set<string>, gracePeriodHours: number, userId: string): Promise<number> {
    const knownDevices = await db.intuneDeviceSync.findMany({ where: { isArchived: false } });
    let stale = 0;
    const now = Date.now();
    for (const device of knownDevices) {
      if (currentIds.has(device.intuneId)) continue;
      const staleSince = device.lastSeenDateTime ?? device.lastSyncDateTime ?? new Date(0);
      const graceExpired = now > new Date(staleSince).getTime() + gracePeriodHours * 3600_000;
      await db.intuneDeviceSync.update({ where: { intuneId: device.intuneId }, data: { syncStatus: graceExpired ? 'stale' : 'missing', lastSyncAt: new Date(), syncErrorMessage: 'Device no longer returned by Microsoft Graph managedDevices.' } });
      if (device.assetId) await db.asset.updateMany({ where: { id: device.assetId, isArchived: false }, data: { status: 'stale', updatedBy: userId } });
      stale += 1;
    }
    return stale;
  }

  private async recordDeviceError(intuneId: string, error: Error) {
    await db.intuneDeviceSync.upsert({ where: { intuneId }, update: { syncStatus: 'error', syncErrorMessage: error.message, syncAttempts: { increment: 1 }, lastSyncAt: new Date() }, create: { intuneId, syncStatus: 'error', syncErrorMessage: error.message, syncAttempts: 1, lastSyncAt: new Date() } });
  }

  private async updateConfigLastSync(field: string, date: Date): Promise<void> {
    await db.intuneSyncConfig.updateMany({ where: {}, data: { [field]: date } });
  }

  async getSyncedDevices(page = 1, limit = 20, search?: string) {
    const where: any = { isArchived: false };
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { serialNumber: { contains: search, mode: 'insensitive' } }, { primaryUserEmail: { contains: search, mode: 'insensitive' } }];
    const [devices, total] = await Promise.all([db.intuneDeviceSync.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { lastSyncDateTime: 'desc' } }), db.intuneDeviceSync.count({ where })]);
    return { data: devices, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getSyncedDevice(intuneId: string) {
    const device = await db.intuneDeviceSync.findUnique({ where: { intuneId } });
    if (!device) throw new AppError('Device not found in sync records', 404);
    return device;
  }

  async resyncDevice(intuneId: string, userId = SYSTEM_USER): Promise<boolean> {
    const details = await this.getClient().getDeviceDetails(intuneId);
    if (!details) throw new AppError('Device no longer exists in Microsoft Graph managedDevices', 404);
    const source = await this.ensureIntuneSource();
    const importRun = await db.importRun.create({ data: { integrationSourceId: source.id, status: 'running', dryRun: false, statistics: { total: 1 }, createdBy: userId } });
    await this.syncDevice(details, source.id, importRun.id, userId);
    await this.syncDeviceApps(intuneId);
    await db.importRun.update({ where: { id: importRun.id }, data: { status: 'completed', endedAt: new Date(), statistics: { total: 1, updated: 1, errors: 0 } } });
    await this.audit(userId, 'INTUNE_RESYNC', 'IntuneDeviceSync', intuneId, { graphFetched: true });
    await this.audit(userId, 'IMPORT_RUN_COMPLETE', 'ImportRun', importRun.id, { syncType: 'resync', intuneId });
    return true;
  }

  async archiveDevice(intuneId: string): Promise<boolean> {
    await db.intuneDeviceSync.update({ where: { intuneId }, data: { isArchived: true } });
    return true;
  }

  async updateConfig(updates: Partial<{ enabled: boolean; fullSyncIntervalHours: number; incrementalSyncIntervalMinutes: number; gracePeriodHours: number; maxRetryAttempts: number; retryDelayMs: number; batchSize: number }>, userId = SYSTEM_USER) {
    const existing = await db.intuneSyncConfig.findFirst();
    const config = existing ? await db.intuneSyncConfig.update({ where: { id: existing.id }, data: updates }) : await db.intuneSyncConfig.create({ data: { enabled: updates.enabled ?? false, fullSyncIntervalHours: updates.fullSyncIntervalHours ?? 24, incrementalSyncIntervalMinutes: updates.incrementalSyncIntervalMinutes ?? 120, gracePeriodHours: updates.gracePeriodHours ?? 168, maxRetryAttempts: updates.maxRetryAttempts ?? 3, retryDelayMs: updates.retryDelayMs ?? 5000, batchSize: updates.batchSize ?? 100 } });
    await this.audit(userId, 'CONFIG_CHANGE', 'IntuneSyncConfig', config.id, updates);
    return config;
  }

  async getConfig() {
    return db.intuneSyncConfig.findFirst();
  }

  async checkHealth(userId = SYSTEM_USER) {
    const health = await this.getClient().checkHealth();
    await this.audit(userId, 'INTUNE_HEALTH_CHECK', 'IntuneHealth', 'health-check', { healthy: health.healthy, permissions: health.permissions });
    await this.audit(userId, 'READ_SENSITIVE', 'IntuneHealth', 'health-check', { healthy: health.healthy, permissions: health.permissions });
    return health;
  }

  private async getEffectiveConfig() {
    const dbConfig = await db.intuneSyncConfig.findFirst();
    this.configManager.initialize();
    const env = this.configManager.getConfigForAuth();
    return { enabled: dbConfig?.enabled ?? env?.enabled ?? false, gracePeriodHours: dbConfig?.gracePeriodHours ?? env?.gracePeriodHours ?? 168 };
  }

  private getClient(): IntuneHttpClient {
    const client = this.httpClient ?? getHttpClient();
    if (!client) throw new AppError('Intune HTTP client not initialized', 500);
    return client;
  }

  private async audit(userId: string, action: any, entityType: string, entityId: string, newValue: any) {
    await auditService.logEventStandalone(prisma as any, { userId, action, entityType, entityId, newValue });
  }
}

let syncService: IntuneSyncService | null = null;

export function getSyncService(): IntuneSyncService | null {
  return syncService;
}

export function initializeSyncService(httpClient?: IntuneHttpClient): IntuneSyncService {
  syncService = new IntuneSyncService(httpClient);
  return syncService;
}


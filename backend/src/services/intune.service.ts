/**
 * Intune Sync Service
 * 
 * Orchestrates full and incremental sync of Intune managed devices
 * and detected apps into the local Asset Management database.
 */

import { prisma } from '../config/database';
import { IntuneHttpClient, getHttpClient } from './intune.client';
import { IntuneConfigManager } from './intune.config';
import { AppError } from '../middleware/errorHandler';

// Device state to lifecycle status mapping
const DEVICE_STATE_MAP: Record<string, string> = {
  active: 'active',
  enrolled: 'active',
  retired: 'archived',
  disabled: 'planned',
  cleanupPending: 'planned',
  registrationRequired: 'planned',
};

// Compliance status to asset status mapping (used for reference)
// Individual mappings are done inline in syncDevice

export interface SyncProgress {
  status: 'idle' | 'running' | 'success' | 'error';
  syncType: 'full' | 'incremental';
  deviceCount: number;
  deviceSynced: number;
  deviceErrors: number;
  appCount: number;
  appSynced: number;
  appErrors: number;
  lastSyncStartedAt: Date | null;
  lastSyncCompletedAt: Date | null;
  lastSyncDurationMs: number | null;
  lastError: string | null;
  totalSyncs: number;
  totalDevicesSynced: number;
  totalDevicesErrors: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

export class IntuneSyncService {
  private configManager: IntuneConfigManager;
  private httpClient: IntuneHttpClient | null;

  constructor() {
    this.configManager = new IntuneConfigManager();
    this.httpClient = null;
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<SyncProgress> {
    // Load config from environment
    this.configManager.initialize();
    
    // Initialize HTTP client with retry settings from config
    const config = this.configManager.getConfigForAuth();
    if (config) {
      this.httpClient = getHttpClient();
      if (!this.httpClient) {
        // Create a new client with config-based settings
        this.httpClient = new IntuneHttpClient(
          config.maxRetryAttempts ?? 3,
          config.retryDelayMs ?? 5000
        );
      }
    }

    // Get or create initial sync status
    let status = await this.getSyncStatus();
    if (!status) {
      status = await this.initializeSyncStatus();
    }

    return status;
  }

  /**
   * Get or create sync status record
   */
  private async getSyncStatus(): Promise<SyncProgress | null> {
    const status = await prisma.intuneSyncStatus.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    return status as unknown as SyncProgress | null;
  }

  /**
   * Initialize default sync status
   */
  private async initializeSyncStatus(): Promise<SyncProgress> {
    const status = await prisma.intuneSyncStatus.create({
      data: {
        syncType: 'full',
        status: 'idle',
        deviceCount: 0,
        deviceSynced: 0,
        deviceErrors: 0,
        appCount: 0,
        appSynced: 0,
        appErrors: 0,
        healthStatus: 'healthy',
      },
    });

    // Create default sync config
    await prisma.intuneSyncConfig.create({
      data: {
        enabled: false,
        fullSyncIntervalHours: 24,
        incrementalSyncIntervalMinutes: 120,
        gracePeriodHours: 168,
        maxRetryAttempts: 3,
        retryDelayMs: 5000,
        batchSize: 100,
      },
    });

    return status as unknown as SyncProgress;
  }

  /**
   * Update sync status in database
   */
  private async updateSyncStatus(updates: Partial<SyncProgress>): Promise<void> {
    const existing = await prisma.intuneSyncStatus.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.intuneSyncStatus.update({
        where: { id: existing.id },
        data: updates,
      });
    }
  }

  /**
   * Get current sync status (formatted for API response)
   */
  async getStatus(): Promise<SyncProgress> {
    const status = await this.getSyncStatus();
    if (!status) {
      return {
        status: 'idle',
        syncType: 'full',
        deviceCount: 0,
        deviceSynced: 0,
        deviceErrors: 0,
        appCount: 0,
        appSynced: 0,
        appErrors: 0,
        lastSyncStartedAt: null,
        lastSyncCompletedAt: null,
        lastSyncDurationMs: null,
        lastError: null,
        totalSyncs: 0,
        totalDevicesSynced: 0,
        totalDevicesErrors: 0,
        healthStatus: 'healthy',
      };
    }

    // Determine health status based on recent sync errors
    const healthStatus = this.calculateHealthStatus(status);

    return {
      ...status,
      healthStatus,
    } as unknown as SyncProgress;
  }

  /**
   * Calculate health status based on recent sync results
   */
  private calculateHealthStatus(status: SyncProgress): 'healthy' | 'degraded' | 'unhealthy' {
    const lastError = status.lastError;
    if (lastError && lastError.toLowerCase().includes('auth')) {
      return 'unhealthy';
    }
    if (status.deviceErrors > 10 || status.appErrors > 50) {
      return 'degraded';
    }
    return 'healthy';
  }

  /**
   * Run a full sync of all Intune devices
   */
  async runFullSync(): Promise<SyncProgress> {
    const startTime = Date.now();
    const config = this.configManager.getConfigForAuth();
    
    if (!config?.enabled) {
      throw new AppError('Intune sync is not enabled. Set INTUNE_ENABLED=true in environment variables.', 400);
    }

    // Update status to running
    await this.updateSyncStatus({
      status: 'running',
      syncType: 'full' as const,
      deviceCount: 0,
      deviceSynced: 0,
      deviceErrors: 0,
      appCount: 0,
      appSynced: 0,
      appErrors: 0,
      lastSyncStartedAt: new Date(),
      lastSyncCompletedAt: null,
      lastSyncDurationMs: null,
      lastError: null,
    });

    try {
      // Get all devices from Intune
      const devices = await this.getAllDevices();
      
      await this.updateSyncStatus({
        deviceCount: devices.length,
      });

      let totalApps = 0;
      let totalAppSynced = 0;
      let totalAppErrors = 0;

      // Process each device
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        try {
          await this.syncDevice(device);
          totalApps += await this.syncDeviceApps(device.id);
          totalAppSynced++;
        } catch (error) {
          totalAppErrors++;
          console.error(`[IntuneSync] Error syncing device ${device.deviceName || device.id}:`, error);
        }

        // Update progress
        await this.updateSyncStatus({
          deviceSynced: i + 1,
          appCount: totalApps,
          appSynced: totalAppSynced,
          appErrors: totalAppErrors,
        });
      }

      // Mark deleted devices
      await this.markDeletedDevices();

      const duration = Date.now() - startTime;
      const totalSyncs = (await this.getSyncStatus())?.totalSyncs ?? 0;
      const totalDevicesSynced = (await this.getSyncStatus())?.totalDevicesSynced ?? 0;
      const totalDevicesErrors = (await this.getSyncStatus())?.totalDevicesErrors ?? 0;

      await this.updateSyncStatus({
        status: 'success',
        deviceSynced: devices.length,
        deviceErrors: 0,
        appCount: totalApps,
        appSynced: totalAppSynced,
        appErrors: totalAppErrors,
        lastSyncCompletedAt: new Date(),
        lastSyncDurationMs: duration,
        lastError: null,
        totalSyncs: totalSyncs + 1,
        totalDevicesSynced: totalDevicesSynced + devices.length,
        totalDevicesErrors: totalDevicesErrors + totalAppErrors,
      });

      // Update config with last sync time
      await this.updateConfigLastSync('lastFullSyncAt', new Date());

      return this.getStatus();
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateSyncStatus({
        status: 'error',
        deviceSynced: 0,
        deviceErrors: 0,
        appCount: 0,
        appSynced: 0,
        appErrors: 0,
        lastSyncCompletedAt: new Date(),
        lastSyncDurationMs: duration,
        lastError: (error as Error).message,
      });

      throw new AppError(`Full sync failed: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Run an incremental sync of changed Intune devices
   */
  async runIncrementalSync(): Promise<SyncProgress> {
    const startTime = Date.now();
    const config = this.configManager.getConfigForAuth();

    if (!config?.enabled) {
      throw new AppError('Intune sync is not enabled. Set INTUNE_ENABLED=true in environment variables.', 400);
    }

    await this.updateSyncStatus({
      status: 'running',
      syncType: 'incremental' as const,
      lastSyncStartedAt: new Date(),
      lastSyncCompletedAt: null,
      lastSyncDurationMs: null,
      lastError: null,
    });

    try {
      // Get last incremental sync time
      const configData = await prisma.intuneSyncConfig.findFirst();
      const lastSyncTime = configData?.lastIncrementalSyncAt ?? new Date(0);

      // Get all devices from Intune
      const devices = await this.getAllDevices();

      // Filter to only changed devices
      const changedDevices = devices.filter(
        (d: any) => d.lastSyncDateTime && new Date(d.lastSyncDateTime) > lastSyncTime
      );

      let deviceErrors = 0;

      for (const device of changedDevices) {
        try {
          await this.syncDevice(device);
        } catch (error) {
          deviceErrors++;
          console.error(`[IntuneSync] Error in incremental sync for device ${device.deviceName || device.id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      const totalSyncs = (await this.getSyncStatus())?.totalSyncs ?? 0;
      const totalDevicesSynced = (await this.getSyncStatus())?.totalDevicesSynced ?? 0;
      const totalDevicesErrors = (await this.getSyncStatus())?.totalDevicesErrors ?? 0;

      await this.updateSyncStatus({
        status: 'success',
        deviceCount: changedDevices.length,
        deviceSynced: changedDevices.length - deviceErrors,
        deviceErrors,
        lastSyncCompletedAt: new Date(),
        lastSyncDurationMs: duration,
        lastError: null,
        totalSyncs: totalSyncs + 1,
        totalDevicesSynced,
        totalDevicesErrors: totalDevicesErrors + deviceErrors,
      });

      // Update config with last sync time
      await this.updateConfigLastSync('lastIncrementalSyncAt', new Date());

      return this.getStatus();
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateSyncStatus({
        status: 'error',
        deviceCount: 0,
        deviceSynced: 0,
        deviceErrors: 0,
        lastSyncCompletedAt: new Date(),
        lastSyncDurationMs: duration,
        lastError: (error as Error).message,
      });

      throw new AppError(`Incremental sync failed: ${(error as Error).message}`, 500);
    }
  }

  /**
   * Get all devices from Intune API
   */
  private async getAllDevices(): Promise<any[]> {
    const httpClient = getHttpClient();
    if (!httpClient) {
      throw new AppError('Intune HTTP client not initialized', 500);
    }
    return httpClient.getAllDevices();
  }

  /**
   * Sync a single device to the database
   */
  private async syncDevice(device: any): Promise<void> {
    const intuneId = device.id;
    if (!intuneId) return;

    const deviceData = {
      intuneId,
      name: device.deviceName || device.deviceName || null,
      serialNumber: device.serialNumber || null,
      manufacturer: device.manufacturer || null,
      model: device.model || null,
      osName: device.osName || null,
      osVersion: device.osVersion || null,
      deviceEnrollmentType: device.deviceEnrollmentType || null,
      managementType: device.managementType || null,
      complianceStatus: device.complianceStatus || null,
      deviceState: device.deviceState || null,
      enrollmentDateTime: device.enrollmentDateTime ? new Date(device.enrollmentDateTime) : null,
      lastSyncDateTime: device.lastSyncDateTime ? new Date(device.lastSyncDateTime) : null,
      primaryUserEmail: device.primaryUserEmailaddress || null,
      primaryUserDisplayName: device.primaryUserDisplayName || null,
      compliancePolicyName: device.compliancePolicyName || null,
      configurationPolicyName: device.configurationPolicyName || null,
      autopilotStatus: null,
      autopilotProfileName: null,
      lastSeenDateTime: device.lastSyncDateTime ? new Date(device.lastSyncDateTime) : null,
      intuneLicenseState: device.intuneLicenseState || null,
      deviceWpdsStatus: device.deviceWpdsStatus || null,
      syncStatus: 'synced',
      syncErrorMessage: null,
      syncAttempts: 1,
      lastSyncAt: new Date(),
      sourceUpdatedAt: new Date(),
    };

    // Upsert by intuneId
    await prisma.intuneDeviceSync.upsert({
      where: { intuneId },
      update: deviceData,
      create: deviceData,
    });

    // Update linked asset if exists
    const existingSync = await prisma.intuneDeviceSync.findUnique({
      where: { intuneId },
    });

    if (existingSync?.assetId) {
      // Update the asset with new data
      const assetStatus = deviceData.complianceStatus === 'compliant'
        ? 'active' 
        : deviceData.complianceStatus === 'nonCompliant' 
          ? 'warning' 
          : 'active';

      await prisma.asset.updateMany({
        where: { id: existingSync.assetId },
        data: {
          manufacturer: deviceData.manufacturer || undefined,
          model: deviceData.model || undefined,
          serialNumber: deviceData.serialNumber || undefined,
          lifecycleStatus: DEVICE_STATE_MAP[deviceData.deviceState || ''] || 'active',
          status: assetStatus,
          lastDetectedAt: deviceData.lastSyncDateTime || undefined,
          dataSource: 'intune',
          updatedBy: 'intune-sync',
        },
      });
    }
  }

  /**
   * Sync detected apps for a device
   */
  private async syncDeviceApps(deviceId: string): Promise<number> {
    const httpClient = getHttpClient();
    if (!httpClient) return 0;

    try {
      const apps = await httpClient.getDetectedApps(deviceId);
      let count = 0;

      for (const app of apps) {
        // Use app.id as the unique identifier for the app
        const appIdentity = app.appIdentity || app.id || app.appName || app.packageName;
        if (!appIdentity) continue;

        // Use composite unique key [intuneAppId, deviceId] for upsert
        await prisma.intuneDetectedApp.upsert({
          where: { intuneAppId_deviceId: { intuneAppId: appIdentity, deviceId } },
          update: {
            name: app.name || undefined,
            version: app.version || undefined,
            publisher: app.publisher || undefined,
            platform: app.platform || undefined,
            appCategory: (app.appCategory || app.appType || null) as string | undefined,
            isManaged: app.isManaged ?? false,
            syncStatus: 'synced',
            syncErrorMessage: null,
            syncAttempts: 1,
            lastSyncAt: new Date(),
            sourceUpdatedAt: new Date(),
          },
          create: {
            intuneAppId: appIdentity,
            deviceId,
            name: app.name || null,
            version: app.version || null,
            publisher: app.publisher || null,
            platform: app.platform || null,
            appCategory: (app.appCategory || app.appType || null) as string | null,
            isManaged: app.isManaged ?? false,
            syncStatus: 'synced',
            syncErrorMessage: null,
            syncAttempts: 1,
            lastSyncAt: new Date(),
            sourceUpdatedAt: new Date(),
          },
        });

        count++;
      }

      return count;
    } catch (error) {
      console.error(`[IntuneSync] Error fetching apps for device ${deviceId}:`, error);
      return 0;
    }
  }

  /**
   * Mark devices as deleted if they no longer exist in Intune
   */
  private async markDeletedDevices(): Promise<void> {
    const syncedDevices = await prisma.intuneDeviceSync.findMany({
      where: {
        isArchived: false,
        syncStatus: { not: 'deleted' },
      },
    });

    // Get current device IDs from Intune
    const currentDevices = await this.getAllDevices();
    const currentIds = new Set(currentDevices.map((d: any) => d.id));

    // Find devices that are no longer in Intune
    const deletedDevices = syncedDevices.filter(
      (d) => !currentIds.has(d.intuneId)
    );

    const gracePeriodHours = 168; // 7 days default

    for (const device of deletedDevices) {
      const lastSeen = device.lastSyncDateTime ? new Date(device.lastSyncDateTime) : new Date(0);
      const graceExpiry = new Date(lastSeen.getTime() + gracePeriodHours * 60 * 60 * 1000);

      if (new Date() > graceExpiry) {
        // Grace period expired, archive the device
        await prisma.intuneDeviceSync.update({
          where: { intuneId: device.intuneId },
          data: {
            syncStatus: 'deleted',
            isArchived: true,
            lastSyncAt: new Date(),
          },
        });

        // Also archive linked asset
        if (device.assetId) {
          await prisma.asset.updateMany({
            where: { id: device.assetId },
            data: { isArchived: true, updatedBy: 'intune-sync' },
          });
        }
      } else {
        // Still within grace period, mark as deleted but not archived
        await prisma.intuneDeviceSync.update({
          where: { intuneId: device.intuneId },
          data: {
            syncStatus: 'deleted',
            lastSyncAt: new Date(),
          },
        });
      }
    }
  }

  /**
   * Update config last sync time
   */
  private async updateConfigLastSync(field: string, date: Date): Promise<void> {
    await prisma.intuneSyncConfig.updateMany({
      where: {},
      data: { [field]: date } as any,
    });
  }

  /**
   * Get synced devices list (with pagination)
   */
  async getSyncedDevices(page: number = 1, limit: number = 20, search?: string): Promise<{
    data: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: any = { isArchived: false };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { primaryUserEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [devices, total] = await Promise.all([
      prisma.intuneDeviceSync.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastSyncDateTime: 'desc' },
      }),
      prisma.intuneDeviceSync.count({ where }),
    ]);

    return {
      data: devices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Resync a specific device
   */
  async resyncDevice(intuneId: string): Promise<boolean> {
    const device = await prisma.intuneDeviceSync.findUnique({
      where: { intuneId },
    });

    if (!device) {
      throw new AppError('Device not found in sync records', 404);
    }

    await this.syncDevice(device);
    await this.syncDeviceApps(device.intuneId);

    await this.updateSyncStatus({
      deviceSynced: (await this.getSyncStatus())?.deviceSynced ?? 0,
    });

    return true;
  }

  /**
   * Archive a synced device
   */
  async archiveDevice(intuneId: string): Promise<boolean> {
    await prisma.intuneDeviceSync.update({
      where: { intuneId },
      data: { isArchived: true },
    });

    return true;
  }

  /**
   * Update sync configuration
   */
  async updateConfig(updates: Partial<{
    enabled: boolean;
    fullSyncIntervalHours: number;
    incrementalSyncIntervalMinutes: number;
    gracePeriodHours: number;
    maxRetryAttempts: number;
    retryDelayMs: number;
    batchSize: number;
  }>): Promise<any> {
    const config = await prisma.intuneSyncConfig.findFirst();
    
    if (!config) {
      return prisma.intuneSyncConfig.create({
        data: {
          enabled: updates.enabled ?? false,
          fullSyncIntervalHours: updates.fullSyncIntervalHours ?? 24,
          incrementalSyncIntervalMinutes: updates.incrementalSyncIntervalMinutes ?? 120,
          gracePeriodHours: updates.gracePeriodHours ?? 168,
          maxRetryAttempts: updates.maxRetryAttempts ?? 3,
          retryDelayMs: updates.retryDelayMs ?? 5000,
          batchSize: updates.batchSize ?? 100,
        },
      });
    }

    return prisma.intuneSyncConfig.update({
      where: { id: config.id },
      data: updates,
    });
  }

  /**
   * Get sync configuration
   */
  async getConfig(): Promise<any> {
    const config = await prisma.intuneSyncConfig.findFirst();
    return config;
  }

  /**
   * Check Intune API health
   */
  async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
    const httpClient = getHttpClient();
    if (!httpClient) {
      return { healthy: false, error: 'Intune HTTP client not initialized' };
    }
    return httpClient.checkHealth();
  }
}

// Singleton instance
let syncService: IntuneSyncService | null = null;

export function getSyncService(): IntuneSyncService | null {
  return syncService;
}

export function initializeSyncService(): IntuneSyncService {
  syncService = new IntuneSyncService();
  return syncService;
}

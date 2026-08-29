/**
 * Intune Background Sync Scheduler
 * 
 * Manages full and incremental sync scheduling using setInterval.
 * Runs without requiring a logged-in user.
 */

import { IntuneConfigManager } from './intune.config';
import { initializeSyncService, getSyncService } from './intune.service';
import { initializeAuthService, getAuthService } from './intune.auth';
import { initializeHttpClient } from './intune.client';
import { prisma } from '../config/database';
import { executeTrackedJob } from './jobRunner.service';

export class IntuneSyncScheduler {
  private fullSyncTimer: NodeJS.Timeout | null = null;
  private incrementalSyncTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start the sync scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[IntuneScheduler] Scheduler is already running');
      return;
    }

    const configManager = new IntuneConfigManager();
    configManager.initialize();

    if (!configManager.isEnabled()) {
      console.log('[IntuneScheduler] Intune sync is disabled. Skipping scheduler start.');
      return;
    }

    const config = configManager.getConfigForAuth();
    if (!config) {
      console.error('[IntuneScheduler] No Intune configuration available. Scheduler not started.');
      return;
    }

    const intervals = configManager.getSyncIntervals();

    // Validate configuration
    const validation = configManager.validate();
    if (!validation.valid) {
      console.error('[IntuneScheduler] Invalid Intune configuration:', validation.errors);
      return;
    }

    console.log('[IntuneScheduler] Initializing Intune sync services...');

    // Initialize auth service
    const authService = initializeAuthService({
      tenantId: config.tenantId,
      appId: config.appId,
      certificatePrivateKeySecretRef: config.certificatePrivateKeySecretRef,
      certificateX5cSecretRef: config.certificateX5cSecretRef,
      certificateThumbprint: config.certificateThumbprint,
    });

    await authService.initialize();

    // Initialize HTTP client
    initializeHttpClient(
      config.maxRetryAttempts ?? 3,
      config.retryDelayMs ?? 5000
    );

    // Initialize sync service
    const syncService = initializeSyncService();
    await syncService.initialize();

    // Update config in DB
    let existingConfig = await prisma.intuneSyncConfig.findFirst();
    const configData = {
      enabled: true,
      fullSyncIntervalHours: config.fullSyncIntervalHours,
      incrementalSyncIntervalMinutes: config.incrementalSyncIntervalMinutes,
      gracePeriodHours: config.gracePeriodHours,
      maxRetryAttempts: config.maxRetryAttempts,
      retryDelayMs: config.retryDelayMs,
      batchSize: config.batchSize,
    };
    if (existingConfig) {
      await prisma.intuneSyncConfig.update({
        where: { id: existingConfig.id },
        data: configData,
      });
    } else {
      await prisma.intuneSyncConfig.create({
        data: configData,
      });
    }

    this.isRunning = true;

    // Run initial full sync (tracked, cluster-safe)
    console.log('[IntuneScheduler] Running initial full sync...');
    void this.runTrackedSync(syncService, 'full').catch((error: unknown) => {
      console.error('[IntuneScheduler] Initial full sync failed:', error);
    });

    // Set up incremental sync timer (tracked, cluster-safe)
    this.incrementalSyncTimer = setInterval(() => {
      console.log('[IntuneScheduler] Running incremental sync...');
      void this.runTrackedSync(syncService, 'incremental').catch((error: unknown) => {
        console.error('[IntuneScheduler] Incremental sync failed:', error);
      });
    }, intervals.incrementalSyncMs);

    // Set up full sync timer (tracked, cluster-safe)
    this.fullSyncTimer = setInterval(() => {
      console.log('[IntuneScheduler] Running full sync...');
      void this.runTrackedSync(syncService, 'full').catch((error: unknown) => {
        console.error('[IntuneScheduler] Full sync failed:', error);
      });
    }, intervals.fullSyncMs);

    // Set up health check timer (every 30 minutes)
    this.healthCheckTimer = setInterval(() => {
      // checkHealth is async; attach a catch so a failure inside the timer
      // callback does not become an unhandled promise rejection.
      void this.checkHealth().catch((error: unknown) => {
        console.error('[IntuneScheduler] Health check failed:', error);
      });
    }, 30 * 60 * 1000);

    console.log('[IntuneScheduler] Scheduler started successfully');
    console.log(`[IntuneScheduler] Incremental sync interval: ${intervals.incrementalSyncMs / 60000} minutes`);
    console.log(`[IntuneScheduler] Full sync interval: ${intervals.fullSyncMs / 3600000} hours`);
  }

  /**
   * Stop the sync scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.fullSyncTimer) {
      clearInterval(this.fullSyncTimer);
      this.fullSyncTimer = null;
    }

    if (this.incrementalSyncTimer) {
      clearInterval(this.incrementalSyncTimer);
      this.incrementalSyncTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.isRunning = false;

    // Clean up auth service
    const authService = getAuthService();
    if (authService) {
      authService.destroy();
    }

    console.log('[IntuneScheduler] Scheduler stopped');
  }

  /**
   * Run a sync job with tracked execution and advisory lock.
   */
  private runTrackedSync(
    syncService: ReturnType<typeof getSyncService> | null,
    syncType: 'full' | 'incremental',
  ): Promise<void> {
    const jobId = syncType === 'full' ? 'intune-full-sync' : 'intune-incremental-sync';

    if (!syncService) {
      return Promise.resolve();
    }

    return executeTrackedJob({
      jobId,
      jobType: 'sync',
      handler: async () => {
        const status = syncType === 'full'
          ? await syncService.runFullSync()
          : await syncService.runIncrementalSync();
        // Argument-style logging (no template interpolation) to avoid format-string injection.
        console.log('[IntuneScheduler] completed:', jobId, status.status);
      },
    }).then(() => undefined).catch((error: unknown) => {
      // executeTrackedJob rethrows; log but do not crash the timer.
      // Argument-style logging (no template interpolation) to avoid format-string injection.
      console.error('[IntuneScheduler] tracked job failed:', jobId, error);
    });
  }

  /**
   * Check health of the Intune integration
   */
  private async checkHealth(): Promise<void> {
    const syncService = getSyncService();
    if (!syncService) {
      console.warn('[IntuneScheduler] Sync service not available for health check');
      return;
    }

    const health = await syncService.checkHealth();
    const status = await syncService.getStatus();

    if (!health.healthy) {
      console.error('[IntuneScheduler] Health check failed:', health.error);
    }

    // Update health status in DB
    if (status) {
      let existingStatus = await prisma.intuneSyncStatus.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      if (existingStatus) {
        await prisma.intuneSyncStatus.update({
          where: { id: existingStatus.id },
          data: { healthStatus: status.healthStatus },
        });
      } else {
        await prisma.intuneSyncStatus.create({
          data: {
            syncType: 'full',
            status: 'idle',
            healthStatus: status.healthStatus,
          },
        });
      }
    }
  }
}

// Singleton instance
let scheduler: IntuneSyncScheduler | null = null;

export function getScheduler(): IntuneSyncScheduler | null {
  return scheduler;
}

export function initializeScheduler(): IntuneSyncScheduler {
  scheduler = new IntuneSyncScheduler();
  return scheduler;
}

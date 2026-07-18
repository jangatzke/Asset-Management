/**
 * Intune Configuration Management
 * 
 * Loads and validates Intune-related configuration from environment variables.
 */

export interface IntuneConfig {
  enabled: boolean;
  tenantId: string;
  appId: string;
  certificatePrivateKeySecretRef: string;
  certificateX5cSecretRef?: string;
  certificateThumbprint: string;
  appName: string;
  fullSyncIntervalHours: number;
  incrementalSyncIntervalMinutes: number;
  gracePeriodHours: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  batchSize: number;
}

export interface SyncIntervals {
  fullSyncMs: number;
  incrementalSyncMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DEFAULTS = {
  fullSyncIntervalHours: 24,
  incrementalSyncIntervalMinutes: 120,
  gracePeriodHours: 168,
  maxRetryAttempts: 3,
  retryDelayMs: 5000,
  batchSize: 100,
  appName: 'Asset-Management',
};

export class IntuneConfigManager {
  private config: IntuneConfig | null = null;

  constructor(config?: IntuneConfig) {
    if (config) {
      this.config = config;
    }
  }

  /**
   * Load configuration from environment variables
   * Sets this.config directly on the instance
   */
  loadFromEnv(): void {
    const enabled = process.env.INTUNE_ENABLED === 'true' || process.env.INTUNE_ENABLED === '1';

    const intuneConfig: IntuneConfig = {
      enabled,
      tenantId: process.env.INTUNE_TENANT_ID || '',
      appId: process.env.INTUNE_APP_ID || '',
      certificatePrivateKeySecretRef: process.env.INTUNE_CERT_PRIVATE_KEY_SECRET_REF || process.env.INTUNE_CERT_PATH || '',
      certificateX5cSecretRef: process.env.INTUNE_CERT_X5C_SECRET_REF || undefined,
      certificateThumbprint: process.env.INTUNE_CERT_THUMBPRINT || process.env.INTUNE_CERT_THUMPRINT || '',
      appName: process.env.INTUNE_APP_NAME || DEFAULTS.appName,
      fullSyncIntervalHours: parseInt(process.env.INTUNE_FULL_SYNC_INTERVAL || '') || DEFAULTS.fullSyncIntervalHours,
      incrementalSyncIntervalMinutes: parseInt(process.env.INTUNE_INCREMENTAL_SYNC_INTERVAL || '') || DEFAULTS.incrementalSyncIntervalMinutes,
      gracePeriodHours: parseInt(process.env.INTUNE_GRACE_PERIOD_HOURS || '') || DEFAULTS.gracePeriodHours,
      maxRetryAttempts: parseInt(process.env.INTUNE_MAX_RETRY_ATTEMPTS || '') || DEFAULTS.maxRetryAttempts,
      retryDelayMs: parseInt(process.env.INTUNE_RETRY_DELAY_MS || '') || DEFAULTS.retryDelayMs,
      batchSize: parseInt(process.env.INTUNE_BATCH_SIZE || '') || DEFAULTS.batchSize,
    };

    this.config = intuneConfig;
  }

  /**
   * Initialize the configuration from environment variables
   * Returns validation result
   */
  initialize(): ValidationResult {
    this.loadFromEnv();
    return this.validate();
  }

  /**
   * Get current configuration
   */
  getConfig(): IntuneConfig | null {
    return this.config;
  }

  /**
   * Validate configuration
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.config) {
      return { valid: false, errors: ['Configuration not loaded'] };
    }

    if (!this.config.enabled) {
      return { valid: true, errors: [] };
    }

    if (!this.config.tenantId) {
      errors.push('INTUNE_TENANT_ID is required when INTUNE_ENABLED=true');
    }

    if (!this.config.appId) {
      errors.push('INTUNE_APP_ID is required when INTUNE_ENABLED=true');
    }

    if (!this.config.certificatePrivateKeySecretRef) {
      errors.push('INTUNE_CERT_PRIVATE_KEY_SECRET_REF is required when INTUNE_ENABLED=true');
    }

    if (!this.config.certificateThumbprint) {
      errors.push('INTUNE_CERT_THUMBPRINT is required when INTUNE_ENABLED=true');
    }

    if (this.config.fullSyncIntervalHours < 1 || this.config.fullSyncIntervalHours > 168) {
      errors.push('INTUNE_FULL_SYNC_INTERVAL must be between 1 and 168 hours');
    }

    if (this.config.incrementalSyncIntervalMinutes < 10 || this.config.incrementalSyncIntervalMinutes > 1440) {
      errors.push('INTUNE_INCREMENTAL_SYNC_INTERVAL must be between 10 and 1440 minutes');
    }

    if (this.config.maxRetryAttempts < 1 || this.config.maxRetryAttempts > 10) {
      errors.push('INTUNE_MAX_RETRY_ATTEMPTS must be between 1 and 10');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if Intune sync is enabled
   */
  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  /**
   * Get sync interval settings in milliseconds
   */
  getSyncIntervals(): SyncIntervals {
    return {
      fullSyncMs: (this.config?.fullSyncIntervalHours ?? DEFAULTS.fullSyncIntervalHours) * 60 * 60 * 1000,
      incrementalSyncMs: (this.config?.incrementalSyncIntervalMinutes ?? DEFAULTS.incrementalSyncIntervalMinutes) * 60 * 1000,
    };
  }

  /**
   * Get authentication config for the auth service
   */
  getAuthConfig() {
    if (!this.config) return null;
    return {
      tenantId: this.config.tenantId,
      appId: this.config.appId,
      certificatePrivateKeySecretRef: this.config.certificatePrivateKeySecretRef,
      certificateX5cSecretRef: this.config.certificateX5cSecretRef,
      certificateThumbprint: this.config.certificateThumbprint,
    };
  }

  /**
   * Get the underlying config (for auth service)
   */
  getConfigForAuth() {
    return this.config;
  }
}

// Singleton instance
let configManager: IntuneConfigManager | null = null;

export function getConfigManager(): IntuneConfigManager | null {
  return configManager;
}

export function initializeConfigManager(): IntuneConfigManager {
  configManager = new IntuneConfigManager();
  configManager.initialize();
  return configManager;
}

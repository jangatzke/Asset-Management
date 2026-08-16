import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';

// ==================== Health Check State ====================

/** Detailed status for a single health check component. */
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'skipped' | 'pending';
  duration?: number;
  details?: string;
}

interface HealthStateInternal {
  startupTime: number;
  isReady: boolean;
  checks: Record<string, boolean>;
  criticalInitializations: Record<string, boolean>;
  // Runtime check functions registered dynamically
  runtimeChecks: Map<string, () => Promise<HealthCheckResult>>;
}

const healthState: HealthStateInternal = {
  startupTime: Date.now(),
  isReady: false,
  checks: {} as Record<string, boolean>,
  criticalInitializations: {} as Record<string, boolean>,
  runtimeChecks: new Map(),
};

interface PrismaMigrationRow {
  migration_name: string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
  applied_steps_count: number | null;
  checksum: string | null;
  logs: string | null;
}

// ==================== Registration API ====================

/**
 * Register a named health check that will be evaluated on every /health/ready call.
 */
export function registerHealthCheck(name: string, check: () => Promise<boolean>): void {
  healthState.checks[name] = false;
  // Run initial check asynchronously
  check()
    .then((result) => {
      healthState.checks[name] = result;
    })
    .catch(() => {
      healthState.checks[name] = false;
    });
}

/**
 * Register a runtime health check that returns a structured HealthCheckResult.
 */
export function registerRuntimeHealthCheck(
  name: string,
  check: () => Promise<HealthCheckResult>
): void {
  healthState.runtimeChecks.set(name, check);
}

/**
 * Set the overall readiness state (called after server startup completes).
 */
export function setReady(isReady: boolean): void {
  healthState.isReady = isReady;
}

/** Record completion state for a startup step required before readiness may become healthy. */
export function setCriticalInitialization(name: string, isHealthy: boolean): void {
  healthState.criticalInitializations[name] = isHealthy;
}

/** Reset health state for isolated tests. */
export function resetHealthState(): void {
  healthState.isReady = false;
  healthState.checks = {};
  healthState.criticalInitializations = {};
  healthState.runtimeChecks.clear();
}

/**
 * Get current health state (for testing).
 */
export function getHealthState() {
  return {
    ...healthState,
    checks: { ...healthState.checks },
    criticalInitializations: { ...healthState.criticalInitializations },
    runtimeChecks: new Map(healthState.runtimeChecks),
  };
}

// ==================== Helper Functions ====================

/** Check that required secrets are configured. */
function checkRequiredSecrets(): HealthCheckResult {
  const checked: string[] = [];
  const missing: string[] = [];

  const requiredVars = ['JWT_SECRET', 'DATABASE_URL'];
  for (const varName of requiredVars) {
    checked.push(varName);
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Also check SMTP config if INTUNE_ENABLED or other integrations are configured
  const intuneEnabled = process.env.INTUNE_ENABLED;
  if (intuneEnabled === 'true' || intuneEnabled === '1') {
    checked.push('INTUNE_TENANT_ID');
    if (!process.env.INTUNE_TENANT_ID) {
      missing.push('INTUNE_TENANT_ID');
    }
  }

  if (missing.length > 0) {
    return { status: 'unhealthy', details: `Missing required secrets: ${missing.join(', ')}` };
  }

  return { status: 'healthy', details: `Checked: ${checked.join(', ')}` };
}

function getLocalMigrationNames(): string[] | null {
  const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');

  try {
    return fs.readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (_error) {
    return null;
  }
}

function isCriticalReadinessMode(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.READINESS_MODE === 'critical';
}

function describeMigrationFailure(row: PrismaMigrationRow): string | null {
  if (!row.migration_name || !row.started_at) {
    return 'Migration row has missing migration_name or started_at';
  }

  if (!row.checksum) {
    return `Migration ${row.migration_name} has no checksum`;
  }

  if (row.rolled_back_at) {
    return null;
  }

  if (!row.finished_at) {
    return `Migration ${row.migration_name} is incomplete or failed${row.logs ? `: ${row.logs}` : ''}`;
  }

  return null;
}

/** Check schema/migration status safely using real Prisma migration columns. */
async function checkSchemaStatus(): Promise<HealthCheckResult> {
  try {
    const rows = await prisma.$queryRaw<PrismaMigrationRow[]>`
      SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count, checksum, logs
      FROM "_prisma_migrations"
      ORDER BY started_at ASC
    `;

    if (rows.length === 0) {
      const localMigrationNames = getLocalMigrationNames();
      if (localMigrationNames === null) {
        return {
          status: isCriticalReadinessMode() ? 'unhealthy' : 'skipped',
          details: 'No migration rows found and local migration directory could not be inspected; pending status unknown',
        };
      }

      if (localMigrationNames.length > 0) {
        return {
          status: 'unhealthy',
          details: `Database has no applied Prisma migrations; pending local migrations: ${localMigrationNames.join(', ')}`,
        };
      }

      return { status: 'healthy', details: 'No local Prisma migrations and no database migration rows found' };
    }

    const failed = rows.map(describeMigrationFailure).find((failure): failure is string => failure !== null);
    if (failed) {
      return {
        status: 'unhealthy',
        details: failed,
      };
    }

    const localMigrationNames = getLocalMigrationNames();
    if (localMigrationNames === null) {
      return {
        status: isCriticalReadinessMode() ? 'unhealthy' : 'skipped',
        details: 'Prisma migration table is readable, but local migration directory could not be inspected; pending status unknown',
      };
    }

    const appliedMigrationNames = new Set(
      rows
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => row.migration_name)
    );
    const pendingLocalMigrations = localMigrationNames.filter((name) => !appliedMigrationNames.has(name));

    if (pendingLocalMigrations.length > 0) {
      return {
        status: 'unhealthy',
        details: `Pending local Prisma migrations not recorded as applied in database: ${pendingLocalMigrations.join(', ')}`,
      };
    }

    const latestMigration = rows.filter((row) => row.finished_at && !row.rolled_back_at).at(-1)?.migration_name ?? 'none';
    return { status: 'healthy', details: `Latest applied migration: ${latestMigration}; local migrations match database` };
  } catch (error: unknown) {
    return {
      status: isCriticalReadinessMode() ? 'unhealthy' : 'skipped',
      details: error instanceof Error ? error.message : 'Unknown error checking schema',
    };
  }
}

/** Check optional integration health. */
async function checkOptionalIntegration(
  name: string,
  enabledVar: string,
  checkFn: () => Promise<boolean>
): Promise<HealthCheckResult> {
  const enabled = process.env[enabledVar];
  if (enabled !== 'true' && enabled !== '1') {
    return { status: 'skipped', details: `${name} integration not configured` };
  }

  return runIntegrationCheck(name, checkFn);
}

/**
 * Check an integration that is "configured" when its secret/env var is set
 * (as opposed to a boolean *_ENABLED flag). Used for encryption keys, which
 * are arbitrary strings and therefore cannot be tested against 'true'/'1'.
 */
async function checkKeyBasedIntegration(
  name: string,
  keyVar: string,
  checkFn: () => Promise<boolean>
): Promise<HealthCheckResult> {
  const key = process.env[keyVar];
  if (!key) {
    return { status: 'skipped', details: `${name} integration not configured (${keyVar} not set)` };
  }

  return runIntegrationCheck(name, checkFn);
}

async function runIntegrationCheck(
  name: string,
  checkFn: () => Promise<boolean>
): Promise<HealthCheckResult> {

  try {
    const healthy = await checkFn();
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      details: healthy ? `${name} integration is operational` : `${name} integration check failed`,
    };
  } catch (error: unknown) {
    return {
      status: 'unhealthy',
      details: error instanceof Error ? error.message : `Unknown ${name} error`,
    };
  }
}

// ==================== Health Check Endpoints ====================

/**
 * Liveness Probe
 * Simple check to verify the server is running.
 * GET /health/live
 */
export const healthLive = async (_req: Request, res: Response): Promise<void> => {
  const uptimeSeconds = Math.floor((Date.now() - healthState.startupTime) / 1000);

  res.json({
    status: 'ok',
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness Probe
 * Checks if the server is ready to serve requests (database connected, etc.).
 * GET /health/ready
 */
export const healthReady = async (_req: Request, res: Response): Promise<void> => {
  const checks: Record<string, HealthCheckResult> = {};
  let allHealthy = true;

  // 1. Database connectivity check (required)
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStart;
    checks['database'] = { status: 'healthy', duration: dbDuration };
  } catch (_error) {
    checks['database'] = { status: 'unhealthy', details: 'Database connection failed' };
    allHealthy = false;
  }

  // 2. Schema/migration status check (informational, may be skipped)
  const schemaResult = await checkSchemaStatus();
  checks['schema'] = schemaResult;
  if (schemaResult.status === 'unhealthy' || (schemaResult.status === 'skipped' && isCriticalReadinessMode())) {
    allHealthy = false;
  }

  // 3. Required secrets check
  const secretsResult = checkRequiredSecrets();
  checks['secrets'] = secretsResult;
  if (secretsResult.status === 'unhealthy') {
    allHealthy = false;
  }

  // 4. Optional integration health checks
  // Intune
  checks['intune'] = await checkOptionalIntegration(
    'Intune',
    'INTUNE_ENABLED',
    async () => true // Lightweight: just check config is present (full check would require API call)
  );

  // SMTP
  checks['smtp'] = await checkOptionalIntegration(
    'SMTP',
    'SMTP_HOST',
    async () => !!process.env.SMTP_HOST && !!process.env.SMTP_USER
  );

  // VMware vCenter — configured when the encryption key is set (key-based gating)
  checks['vmware'] = await checkKeyBasedIntegration(
    'VMware',
    'VMWARE_ENCRYPTION_KEY',
    async () => !!process.env.VMWARE_ENCRYPTION_KEY && process.env.VMWARE_ENCRYPTION_KEY.length === 32
  );

  // Proxmox — configured when the encryption key is set (key-based gating).
  // Previously gated on PROXMOX_ENABLED with a stub check that always passed,
  // which was inconsistent with the VMware check and gave a false "healthy".
  checks['proxmox'] = await checkKeyBasedIntegration(
    'Proxmox',
    'PROXMOX_ENCRYPTION_KEY',
    async () => !!process.env.PROXMOX_ENCRYPTION_KEY && process.env.PROXMOX_ENCRYPTION_KEY.length === 32
  );

  // 5. Registered runtime health checks
  for (const [name, isHealthy] of Object.entries(healthState.criticalInitializations)) {
    checks[`startup:${name}`] = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: isHealthy ? 'Critical initialization completed' : 'Critical initialization failed or has not completed',
    };
    if (!isHealthy) {
      allHealthy = false;
    }
  }

  // 6. Registered runtime health checks
  for (const [name, checkFn] of healthState.runtimeChecks) {
    try {
      const result = await checkFn();
      checks[name] = result;
      if (result.status === 'unhealthy') {
        allHealthy = false;
      }
    } catch (_error) {
      checks[name] = { status: 'unhealthy', details: 'Runtime health check threw an error' };
      allHealthy = false;
    }
  }

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'not_ready';
  if (!healthState.isReady) {
    status = 'not_ready';
  } else if (!allHealthy) {
    // Check if any required component is unhealthy (DB, schema, secrets, or startup initialization)
    const dbStatus = checks['database']?.status;
    const schemaStatus = checks['schema']?.status;
    const secretsStatus = checks['secrets']?.status;
    const hasFailedStartupInitialization = Object.entries(checks).some(
      ([name, check]) => name.startsWith('startup:') && check.status === 'unhealthy'
    );

    if (dbStatus === 'unhealthy' || schemaStatus === 'unhealthy' || secretsStatus === 'unhealthy' || hasFailedStartupInitialization) {
      status = 'not_ready';
    } else {
      // Optional integrations unhealthy -> degraded
      status = 'degraded';
    }
  } else {
    status = 'healthy';
  }

  const response = {
    status,
    ready: healthState.isReady && status === 'healthy',
    uptime: Math.floor((Date.now() - healthState.startupTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  if (status === 'healthy') {
    res.status(200).json(response);
  } else if (status === 'degraded') {
    res.status(200).json(response); // Degraded is still serving traffic
  } else {
    res.status(503).json(response); // not_ready
  }
};

/**
 * Basic Health Endpoint (legacy compatibility)
 * GET /health
 */
export const healthBasic = async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - healthState.startupTime) / 1000),
    });
  } catch (_error) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
};

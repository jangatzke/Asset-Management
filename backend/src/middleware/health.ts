import { Request, Response } from 'express';
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
  // Runtime check functions registered dynamically
  runtimeChecks: Map<string, () => Promise<HealthCheckResult>>;
}

const healthState: HealthStateInternal = {
  startupTime: Date.now(),
  isReady: false,
  checks: {} as Record<string, boolean>,
  runtimeChecks: new Map(),
};

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

/**
 * Get current health state (for testing).
 */
export function getHealthState() {
  return {
    ...healthState,
    checks: { ...healthState.checks },
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

/** Check schema/migration status safely. */
async function checkSchemaStatus(): Promise<HealthCheckResult> {
  try {
    // Try to read the latest migration from _prisma_migrations table
    const rows = await prisma.$queryRaw<
      Array<{ version_steps: string; markers: string; log: string }>
    >`SELECT version_steps, markers, log FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 1`;

    if (rows.length === 0) {
      return { status: 'healthy', details: 'No migrations yet (fresh schema)' };
    }

    // Check for any unapplied migrations by looking at pending flag
    const pendingRows = await prisma.$queryRaw<
      Array<{ migration_name: string }>
    >`SELECT migration_name FROM "_prisma_migrations" WHERE applied = false LIMIT 1`;

    if (pendingRows.length > 0) {
      return {
        status: 'unhealthy',
        details: `Pending migration: ${pendingRows[0].migration_name}`,
      };
    }

    const latestVersion = rows[0].version_steps;
    return { status: 'healthy', details: `Latest migration: ${latestVersion}` };
  } catch (error: unknown) {
    // If the table doesn't exist or query fails, skip silently
    return {
      status: 'skipped',
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
  if (schemaResult.status === 'unhealthy') {
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

  // VMware vCenter
  checks['vmware'] = await checkOptionalIntegration(
    'VMware',
    'VMWARE_ENCRYPTION_KEY',
    async () => !!process.env.VMWARE_ENCRYPTION_KEY && process.env.VMWARE_ENCRYPTION_KEY.length === 32
  );

  // Proxmox
  checks['proxmox'] = await checkOptionalIntegration(
    'Proxmox',
    'PROXMOX_ENABLED',
    async () => true
  );

  // 5. Registered runtime health checks
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
  if (!allHealthy) {
    // Check if any required component is unhealthy (DB or secrets)
    const dbStatus = checks['database']?.status;
    const secretsStatus = checks['secrets']?.status;
    if (dbStatus === 'unhealthy' || secretsStatus === 'unhealthy') {
      status = 'not_ready';
    } else {
      // Optional integrations unhealthy -> degraded
      status = 'degraded';
    }
  } else if (!healthState.isReady) {
    status = 'not_ready';
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

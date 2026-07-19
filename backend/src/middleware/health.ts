import { Request, Response } from 'express';
import prisma from '../config/database';

// Health check state
const healthState = {
  startupTime: Date.now(),
  isReady: false,
  checks: {} as Record<string, boolean>,
};

/**
 * Register a health check.
 */
export function registerHealthCheck(name: string, check: () => Promise<boolean>): void {
  healthState.checks[name] = false;
  
  // Run initial check
  check().then(result => {
    healthState.checks[name] = result;
  }).catch(() => {
    healthState.checks[name] = false;
  });
}

/**
 * Set the overall readiness state.
 */
export function setReady(isReady: boolean): void {
  healthState.isReady = isReady;
}

/**
 * Get current health state (for testing).
 */
export function getHealthState() {
  return { ...healthState, checks: { ...healthState.checks } };
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
  const checks: Record<string, { status: string; duration?: number }> = {};
  let allHealthy = true;

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbDuration = Date.now() - dbStart;
    
    checks['database'] = { status: 'healthy', duration: dbDuration };
  } catch (error) {
    checks['database'] = { status: 'unhealthy' };
    allHealthy = false;
  }

  // Check configured health checks
  for (const [name, check] of Object.entries(healthState.checks)) {
    if (!check) {
      checks[name] = { status: 'unhealthy' };
      allHealthy = false;
    } else {
      checks[name] = { status: 'healthy' };
    }
  }

  const response = {
    status: allHealthy && healthState.isReady ? 'ready' : 'not_ready',
    ready: healthState.isReady,
    uptime: Math.floor((Date.now() - healthState.startupTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  if (allHealthy && healthState.isReady) {
    res.status(200).json(response);
  } else {
    res.status(503).json(response);
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
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
};

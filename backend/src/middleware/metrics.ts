import { Request, Response, NextFunction } from 'express';
import { Registry, Histogram, Counter, Gauge } from 'prom-client';

// ==================== Prometheus Registry ====================

const register = new Registry();

// Default registry already contains basic metrics (nodejs_*)
register.setDefaultLabels({
  service: 'asset-management-backend',
});

// ==================== Metric Definitions ====================

/** HTTP request count total. */
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests.',
  labelNames: ['method', 'status', 'endpoint'],
  registers: [register],
});

/** HTTP request duration histogram (seconds). */
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'status', 'endpoint'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/** HTTP error count (4xx and 5xx). */
const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses (4xx and 5xx).',
  labelNames: ['status_class'],
  registers: [register],
});

/** Database errors counter. */
const dbErrorsTotal = new Counter({
  name: 'db_errors_total',
  help: 'Total number of database errors.',
  registers: [register],
});

/** Background job duration histogram (seconds). */
export const jobDurationSeconds = new Histogram({
  name: 'job_run_duration_seconds',
  help: 'Background job run duration in seconds.',
  labelNames: ['jobId', 'status'],
  buckets: [0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [register],
});

/** Background job failures counter. */
export const jobFailuresTotal = new Counter({
  name: 'job_runs_failed_total',
  help: 'Total number of failed background jobs.',
  labelNames: ['jobId'],
  registers: [register],
});

/** Integration sync status gauge (1 = ok, 0 = error, -1 = unknown). */
export const integrationSyncStatus = new Gauge({
  name: 'integration_sync_status',
  help: 'Integration sync status (1=ok, 0=error, -1=unknown).',
  labelNames: ['integration'],
  registers: [register],
});

// ==================== In-Memory Metrics Fallback (for testing) ====================

interface MetricCounts {
  totalRequests: number;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  requestsByStatusCode: Record<string, number>;
  errors: number;
  totalResponseTimeMs: number;
}

const metrics: MetricCounts = {
  totalRequests: 0,
  requestsByMethod: {},
  requestsByEndpoint: {},
  requestsByStatusCode: {},
  errors: 0,
  totalResponseTimeMs: 0,
};

interface DbErrorEmitter {
  $on(event: 'error', callback: () => void): void;
}

/**
 * Reset in-memory metrics (for testing).
 */
export function resetMetrics(): void {
  Object.assign(metrics, {
    totalRequests: 0,
    requestsByMethod: {},
    requestsByEndpoint: {},
    requestsByStatusCode: {},
    errors: 0,
    totalResponseTimeMs: 0,
  });
}

/**
 * Get current in-memory metrics (for testing).
 */
export function getMetrics(): MetricCounts {
  return { ...metrics };
}

// ==================== Metrics Middleware ====================

/**
 * Normalize URL path by replacing dynamic segments with placeholders.
 */
function normalizePath(url: string): string {
  const parts = url.split('/');
  const normalized: string[] = [];

  for (const part of parts) {
    // Replace UUIDs and numeric IDs with :id placeholder
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
      normalized.push(':id');
    } else if (/^\d+$/.test(part) && normalized.length > 0 && normalized[normalized.length - 1] === ':id') {
      // Skip consecutive numeric segments after :id
      continue;
    } else {
      normalized.push(part);
    }
  }

  return normalized.join('/');
}

/**
 * Metrics Middleware
 * Collects request counts, response times, and error rates.
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Normalize endpoint pattern for grouping
  const normalizedPath = normalizePath(req.originalUrl || req.url);
  const method = req.method;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = String(res.statusCode);
    const durationSeconds = duration / 1000;

    // Update in-memory counters (for backward compatibility and testing)
    metrics.totalRequests++;
    metrics.requestsByMethod[method] = (metrics.requestsByMethod[method] || 0) + 1;
    metrics.requestsByEndpoint[normalizedPath] = (metrics.requestsByEndpoint[normalizedPath] || 0) + 1;
    metrics.requestsByStatusCode[statusCode] = (metrics.requestsByStatusCode[statusCode] || 0) + 1;

    if (parseInt(statusCode) >= 400) {
      metrics.errors++;
    }

    metrics.totalResponseTimeMs += duration;

    // Update Prometheus counters/histograms
    httpRequestsTotal.inc({ method, status: statusCode, endpoint: normalizedPath });
    httpRequestDuration.observe(
      { method, status: statusCode, endpoint: normalizedPath },
      durationSeconds
    );

    if (parseInt(statusCode) >= 400) {
      const statusClass = parseInt(statusCode) < 500 ? '4xx' : '5xx';
      httpErrorsTotal.inc({ status_class: statusClass });
    }
  });

  next();
};

// ==================== Metrics Token Auth Middleware ====================

/**
 * Create a metrics token authentication middleware.
 * In production, METRICS_TOKEN is required and absence fails closed.
 * If METRICS_TOKEN is set, requires ?token=<value> or Authorization: Bearer <token>.
 */
export function createMetricsAuthMiddleware() {
  const metricsToken = process.env.METRICS_TOKEN;

  if (!metricsToken) {
    if (process.env.NODE_ENV === 'production') {
      return (_req: Request, res: Response, _next: NextFunction): void => {
        res.status(503).json({
          error: 'metrics_unavailable',
          message: 'Metrics endpoint is disabled until METRICS_TOKEN is configured.',
        });
      };
    }

    return (_req: Request, _res: Response, next: NextFunction): void => {
      next();
    };
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check query parameter token
    const queryToken = req.query.token as string | undefined;
    if (queryToken && queryToken === metricsToken) {
      next();
      return;
    }

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token === metricsToken) {
        next();
        return;
      }
    }

    res.status(401).json({
      error: 'unauthorized',
      message: 'Missing or invalid METRICS_TOKEN. Provide ?token=<value> or Authorization: Bearer <token>.',
    });
  };
}

// ==================== Metrics Endpoint ====================

/**
 * Prometheus-compatible metrics endpoint.
 * GET /metrics
 */
export const metricsEndpoint = async (_req: Request, res: Response): Promise<void> => {
  try {
    const promMetrics = await register.metrics();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(promMetrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
};

// ==================== Database Error Hook ====================

/**
 * Attach a Prisma $on('error') hook to track DB errors globally.
 * Call this once during app startup.
 */
export function attachDbErrorHook(prismaClient: DbErrorEmitter): void {
  prismaClient.$on('error', () => {
    dbErrorsTotal.inc();
  });
}

// ==================== Export All Metrics for External Use ====================

export { register, httpRequestsTotal, httpRequestDuration, httpErrorsTotal, dbErrorsTotal };

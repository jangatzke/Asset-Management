import { Request, Response, NextFunction } from 'express';

// ==================== Metrics Collection ====================

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

/**
 * Reset metrics (for testing).
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
 * Get current metrics (for testing/export).
 */
export function getMetrics(): MetricCounts {
  return { ...metrics };
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

    metrics.totalRequests++;
    
    // Count by method
    metrics.requestsByMethod[method] = (metrics.requestsByMethod[method] || 0) + 1;
    
    // Count by endpoint
    metrics.requestsByEndpoint[normalizedPath] = (metrics.requestsByEndpoint[normalizedPath] || 0) + 1;
    
    // Count by status code
    metrics.requestsByStatusCode[statusCode] = (metrics.requestsByStatusCode[statusCode] || 0) + 1;
    
    // Track errors
    if (parseInt(statusCode) >= 400) {
      metrics.errors++;
    }
    
    // Track response time
    metrics.totalResponseTimeMs += duration;
  });

  next();
};

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
 * Metrics Endpoint (Prometheus-compatible text format)
 * GET /metrics
 */
export const metricsEndpoint = (_req: Request, res: Response): void => {
  const avgResponseTime = metrics.totalRequests > 0 
    ? Math.round(metrics.totalResponseTimeMs / metrics.totalRequests) 
    : 0;

  const lines: string[] = [
    '# HELP http_requests_total Total number of HTTP requests',
    '# TYPE http_requests_total counter',
    `http_requests_total{method="all"} ${metrics.totalRequests}`,
    '',
    '# HELP http_requests_by_method Number of requests by HTTP method',
    '# TYPE http_requests_by_method counter',
  ];

  for (const [method, count] of Object.entries(metrics.requestsByMethod)) {
    lines.push(`http_requests_by_method{method="${method}"} ${count}`);
  }

  lines.push('');
  lines.push('# HELP http_requests_by_status_code Number of requests by status code');
  lines.push('# TYPE http_requests_by_status_code counter');

  for (const [code, count] of Object.entries(metrics.requestsByStatusCode)) {
    lines.push(`http_requests_by_status_code{status="${code}"} ${count}`);
  }

  lines.push('');
  lines.push('# HELP http_errors_total Total number of error responses (4xx and 5xx)');
  lines.push('# TYPE http_errors_total counter');
  lines.push(`http_errors_total ${metrics.errors}`);

  lines.push('');
  lines.push('# HELP http_request_duration_ms_avg Average response time in milliseconds');
  lines.push('# TYPE http_request_duration_ms_avg gauge');
  lines.push(`http_request_duration_ms_avg ${avgResponseTime}`);

  lines.push('');
  lines.push('# HELP http_requests_by_endpoint Total requests per endpoint');
  lines.push('# TYPE http_requests_by_endpoint counter');

  for (const [endpoint, count] of Object.entries(metrics.requestsByEndpoint)) {
    lines.push(`http_requests_by_endpoint{endpoint="${endpoint}"} ${count}`);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(lines.join('\n'));
};

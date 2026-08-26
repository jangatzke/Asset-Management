import type { NextFunction } from 'express';
import { Request, Response } from 'express';
import { getCorrelationId } from './correlationId';

// Fields that should be redacted from logs to prevent secret/token leakage
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-correlation-id',
  'set-cookie',
  'proxy-authorization',
];

const SENSITIVE_BODY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey|api_key|api-key/i,
  /credential/i,
  /authorization/i,
  /access_token/i,
  /refresh_token/i,
];

/**
 * Redact sensitive information from an object for logging.
 */
export function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[Max depth exceeded]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check if the string looks like a secret/token
    // This is handled at key level, not value level to avoid false positives
    // Truncate long strings
    return obj.length > 200 ? obj.substring(0, 200) + '...' : obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      let redactedValue = value;
      
      // Check if key matches sensitive patterns
      const isSensitiveKey = SENSITIVE_HEADERS.some(h => h.toLowerCase() === key.toLowerCase()) ||
        SENSITIVE_BODY_PATTERNS.some(pattern => pattern.test(key));
      
      if (isSensitiveKey) {
        redactedValue = '[REDACTED]';
      } else {
        redactedValue = redactSensitiveData(value, depth + 1);
      }
      
      result[key] = redactedValue;
    }
    return result;
  }
  
  return obj;
}

/**
 * Structured JSON Logger Middleware
 * Logs all requests as structured JSON objects suitable for log aggregation systems.
 */
export const jsonLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Log exactly once when the response has been fully sent.
  // 'finish' fires for both normal responses and HEAD responses;
  // 'close' covers early-disconnected requests so we never leak unlogged requests.
  let logged = false;
  const logOnce = () => {
    if (logged) return;
    logged = true;
    logRequest(req, res, start, res.statusCode);
  };

  res.on('finish', logOnce);
  res.on('close', logOnce);

  next();
};

function logRequest(req: Request, res: Response, start: number, statusCode: number): void {
  const duration = Date.now() - start;
  const correlationId = getCorrelationId(req);
  
  const logEntry = {
    level: 'info',
    timestamp: new Date().toISOString(),
    correlationId,
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode,
    durationMs: duration,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.socket.remoteAddress,
    requestSize: parseHeaderNumber(req.headers['content-length']),
    responseSize: parseHeaderNumber(res.getHeader('content-length')),
  };

  // Log error level for server errors
  if (statusCode >= 500) {
    logEntry.level = 'error';
  } else if (statusCode >= 400) {
    logEntry.level = 'warn';
  }
    // Use console.log with JSON for structured logging
    // In production, this would be piped to a logging service
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Safely parse a header value that may be a string, a string[] (combined headers)
   * or undefined into a non-negative integer.
   */
  function parseHeaderNumber(value: string | number | string[] | undefined): number {
    if (value === undefined || value === null) return 0;
    const str = Array.isArray(value) ? value[0] : typeof value === 'number' ? String(value) : value;
    const parsed = parseInt(str, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

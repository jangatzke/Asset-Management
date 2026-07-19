import { Request, Response, NextFunction } from 'express';
import {
  IdempotencyResult,
  storeIdempotencyResponse,
  getIdempotencyResponse,
  startIdempotencyCleanup,
} from '../services/idempotency.service';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

interface IdempotencyOptions {
  ttlMs?: number;
  keyHeader?: string;
}

/**
 * Idempotency Middleware Factory
 * Ensures that requests with the same idempotency key are processed only once.
 */
export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000; // Default 24 hours
  const keyHeader = (options.keyHeader || IDEMPOTENCY_KEY_HEADER).toLowerCase();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers[keyHeader] as string | undefined;

    // If no idempotency key is provided, proceed normally
    if (!idempotencyKey) {
      return next();
    }

    // Validate idempotency key format (UUID or alphanumeric with hyphens)
    if (!/^[a-zA-Z0-9\-_]+$/.test(idempotencyKey)) {
      res.status(400).json({
        error: 'Invalid Idempotency-Key Format',
        message: 'Idempotency key must be a non-empty string containing only alphanumeric characters, hyphens, and underscores.',
      });
      return;
    }

    // Check if response is already stored for this key
    const existingResponse = getIdempotencyResponse<unknown>(idempotencyKey);

    if (existingResponse !== undefined) {
      // Return cached response
      res.set('X-Idempotency-Cache', 'hit');
      
      const result: IdempotencyResult<unknown> = {
        isDuplicate: true,
        response: existingResponse as { status: number; headers: Record<string, string>; body: unknown },
      };

      res.status(result.response.status).json(result.response.body);
      return;
    }

    // Store original methods to capture response
    const originalJson = res.json.bind(res);
    
    let capturedStatus = 200;
    
    // Intercept status calls using a wrapper approach
    const originalStatus = res.status;
    (res as any).status = function(statusCode: number) {
      capturedStatus = statusCode;
      return originalStatus.call(this, statusCode);
    };

    // Capture the response body when json is called
    const captureJson = async function(this: Response, body: unknown) {
      // Store in idempotency store asynchronously (fire and forget)
      const responseBody = {
        status: capturedStatus,
        headers: {},
        body,
      };

      storeIdempotencyResponse({
        key: idempotencyKey,
        httpMethod: req.method,
        routePattern: req.route?.path || req.originalUrl.split('?')[0],
        requestBodyHash: JSON.stringify(body),
        ttlMs,
      }, responseBody);

      return originalJson(body);
    };

    // Override json to capture response
    (res as any).json = captureJson;

    next();
  };
}

/**
 * Start idempotency cleanup on server start.
 */
export function initializeIdempotency(): void {
  startIdempotencyCleanup(60000); // Clean up every minute
}

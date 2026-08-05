import { Request, Response, NextFunction } from 'express';
import {
  IdempotencyResult,
  storeIdempotencyResponse,
  getIdempotencyResponse,
  getIdempotencyEntry,
  generateIdempotencyKey,
  generateRequestBodyHash,
  shouldCacheResponse,
  requestBodyMatches,
  startIdempotencyCleanup,
} from '../services/idempotency.service';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

interface IdempotencyOptions {
  ttlMs?: number;
  keyHeader?: string;
}

/**
 * Extract principal from request.
 * Tries service account context first, then user context.
 */
function extractPrincipal(req: Request): string | undefined {
  // Check for service account ID in request metadata
  const serviceAccountId = (req as any).serviceAccount?.id || (req as any).headers['x-service-account-id'];
  if (serviceAccountId) return String(serviceAccountId);

  // Check for user ID in request metadata
  const userId = (req as any).user?.id || (req as any).headers['x-user-id'];
  if (userId) return String(userId);

  return undefined;
}

/**
 * Idempotency Middleware Factory
 * Ensures that requests with the same idempotency key are processed only once.
 *
 * Key features:
 * - Key generation: principal + HTTP method + route + idempotency-key
 * - Request body hash comparison on reuse
 * - Only caches 2xx/3xx responses (not 4xx/5xx)
 * - Async middleware with try/catch and next(error)
 * - Atomic reservation semantics (first write wins)
 */
export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000; // Default 24 hours
  const keyHeader = (options.keyHeader || IDEMPOTENCY_KEY_HEADER).toLowerCase();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
          success: false,
          error: {
            message: 'Invalid Idempotency-Key Format',
            code: 'INVALID_IDEMPOTENCY_KEY',
          },
        });
        return;
      }

      const principal = extractPrincipal(req);
      const routePattern = req.route?.path || req.originalUrl.split('?')[0];

      // Generate composite key from principal + method + route + idempotency-key
      const compositeKey = generateIdempotencyKey(principal, req.method, routePattern, idempotencyKey);

      // Check if response is already stored for this key
      const existingResponse = getIdempotencyResponse<{ status: number; headers: Record<string, string>; body: unknown }>(compositeKey);

      if (existingResponse !== undefined) {
        // Get the full entry to access keyOptions.requestBodyHash
        const storedEntry = getIdempotencyEntry<{ response: unknown; keyOptions: { requestBodyHash?: string }; createdAt: number }>(compositeKey);
        
        // Check if request body hash matches (for methods that have a body)
        if (storedEntry?.keyOptions?.requestBodyHash && req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
          const newBodyHash = generateRequestBodyHash(req.body);
          if (!requestBodyMatches(newBodyHash, storedEntry.keyOptions.requestBodyHash)) {
            // Body mismatch - return error
            res.status(409).json({
              success: false,
              error: {
                message: 'Idempotency key reused with different request body',
                code: 'IDEMPOTENCY_BODY_MISMATCH',
              },
            });
            return;
          }
        }

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
      const originalStatus = res.status;

      let capturedStatus = 200;

      // Intercept status calls using a wrapper approach
      (res as any).status = function(statusCode: number) {
        capturedStatus = statusCode;
        return originalStatus.call(this, statusCode);
      };

      // Capture the response body when json is called
      const captureJson = async function(this: Response, body: unknown) {
        try {
          // Only cache successful responses (2xx and 3xx)
          if (shouldCacheResponse(capturedStatus)) {
            // Generate request body hash for comparison on reuse
            let requestBodyHash: string | undefined;
            if (req.body && Object.keys(req.body).length > 0) {
              requestBodyHash = generateRequestBodyHash(req.body);
            }

            const responseBody = {
              status: capturedStatus,
              headers: res.getHeaders() as Record<string, string>,
              body,
            };

            // Store with atomic reservation (first write wins)
            storeIdempotencyResponse({
              key: compositeKey,
              principal,
              httpMethod: req.method,
              routePattern,
              requestBodyHash,
              ttlMs,
            }, responseBody);
          }
        } catch (error) {
          // Log error but don't fail the request
          console.error('Idempotency store error:', error);
        }

        return originalJson(body);
      };

      // Override json to capture response
      (res as any).json = captureJson;

      next();
    } catch (error) {
      // Catch any unexpected errors and pass to error handler
      next(error);
    }
  };
}

/**
 * Start idempotency cleanup on server start.
 */
export function initializeIdempotency(): void {
  startIdempotencyCleanup(60000); // Clean up every minute
}

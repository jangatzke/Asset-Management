import { Request, Response, NextFunction } from 'express';
import {
  storeIdempotencyResponse,
  generateIdempotencyKey,
  generateRequestBodyHash,
  shouldCacheResponse,
  requestBodyMatches,
  startIdempotencyCleanup,
} from '../services/idempotency.service';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Default TTL for idempotency entries: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyState = 'pending' | 'completed' | 'failed';

export interface IdempotencyReservation {
  state: IdempotencyState;
  principal: string | undefined;
  httpMethod: string;
  routePattern: string;
  requestBodyHash: string | undefined;
  createdAt: number;
  completedAt?: number;
  response?: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  resultPromise?: Promise<{ status: number; headers: Record<string, string>; body: unknown }>;
}

interface IdempotencyOptions {
  ttlMs?: number;
  keyHeader?: string;
  /**
   * When true (default), requires a trusted principal from auth middleware.
   * Returns 401 if no trusted principal is set.
   * When false, allows anonymous idempotency (e.g., for webhook endpoints).
   */
  requireTrustedPrincipal?: boolean;
}

/**
 * Extract trusted principal from request.
 * ONLY reads from context properties set by preceding authentication middleware.
 * Does NOT fall back to raw headers — this prevents header-based impersonation.
 *
 * The principal is derived from:
 * 1. Service account: req.serviceAccount.id (set by service account auth middleware)
 * 2. User: req.userId (set by JWT authentication middleware)
 */
function extractTrustedPrincipal(req: Request): string | undefined {
  // Check for service account ID in request context (set by auth middleware)
  const serviceAccountId = (req as any).serviceAccount?.id;
  if (serviceAccountId) return String(serviceAccountId);

  // Check for user ID in request context (set by JWT auth middleware)
  const userId = (req as any).userId;
  if (userId) return String(userId);

  return undefined;
}

/**
 * In-memory store for in-flight idempotency reservations.
 * Tracks the state machine: missing → processing → completed/failed
 * Key: compositeKey, Value: IdempotencyReservation
 */
const inFlightReservations = new Map<string, IdempotencyReservation>();

/**
 * Idempotency Middleware Factory
 * Ensures that requests with the same idempotency key are processed only once.
 *
 * State machine: missing → processing → completed/failed
 * - First request with a key atomically reserves it (state: pending)
 * - Subsequent requests with the same key:
 *   - If body matches and still pending: wait for the in-flight result
 *   - If body matches and completed: return cached response immediately
 *   - If body differs: return 409 Conflict
 * - Completed/failed entries are cleaned up after TTL
 *
 * Key features:
 * - Atomic reservation via synchronous Map.set() (safe in Node.js single-threaded event loop)
 * - For multi-instance deployments: the Redis store's SET NX provides distributed atomicity
 * - Trusted principal extraction ONLY from auth middleware context (not raw headers)
 * - Recursive canonical body hash for collision-resistant request comparison
 * - Only caches 2xx/3xx responses (not 4xx/5xx)
 */
export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000; // Default 24 hours
  const keyHeader = (options.keyHeader || IDEMPOTENCY_KEY_HEADER).toLowerCase();
  const requireTrustedPrincipal = options.requireTrustedPrincipal !== false; // Default true

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

      // Extract trusted principal ONLY from auth middleware context
      const principal = extractTrustedPrincipal(req);

      // Enforce trusted principal requirement if configured
      if (requireTrustedPrincipal && !principal) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Trusted principal required for idempotency',
            code: 'MISSING_PRINCIPAL',
            hint: 'Ensure authentication middleware runs before idempotency middleware',
          },
        });
        return;
      }

      const routePattern = req.route?.path || req.originalUrl.split('?')[0];

      // Generate composite key from principal + method + route + idempotency-key
      const compositeKey = generateIdempotencyKey(principal, req.method, routePattern, idempotencyKey);

      // Generate request body hash for comparison
      let requestBodyHash: string | undefined;
      if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        requestBodyHash = generateRequestBodyHash(req.body);
      }

      // ===== STATE MACHINE: missing → pending → completed/failed =====

      // Check for existing reservation
      const existingReservation = inFlightReservations.get(compositeKey);

      if (existingReservation) {
        // ===== ALREADY RESERVED (pending, completed, or failed) =====

        // Handle failed reservations: remove and let the request retry
        if (existingReservation.state === 'failed') {
          inFlightReservations.delete(compositeKey);
          // Fall through to create a new reservation below
        } else if (existingReservation.state === 'pending') {
          // Check body hash match for pending reservations
          if (requestBodyHash) {
            if (!existingReservation.requestBodyHash) {
              existingReservation.requestBodyHash = requestBodyHash;
            } else if (!requestBodyMatches(requestBodyHash, existingReservation.requestBodyHash)) {
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

          // If pending and has a result promise, wait for it
          if (existingReservation.resultPromise) {
            try {
              const result = await existingReservation.resultPromise;
              res.set('X-Idempotency-Cache', 'waiting');
              res.status(result.status).json(result.body);
              return;
            } catch (error) {
              next(error);
              return;
            }
          }

          // Pending without promise - return 425
          res.status(425).json({
            success: false,
            error: {
              message: 'Idempotency key reservation is still being processed',
              code: 'IDEMPOTENCY_RESERVATION_IN_PROGRESS',
            },
          });
          return;
        } else if (existingReservation.state === 'completed') {
          // Check body hash match for completed reservations
          if (requestBodyHash && existingReservation.requestBodyHash) {
            if (!requestBodyMatches(requestBodyHash, existingReservation.requestBodyHash)) {
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

          // Return cached response immediately
          res.set('X-Idempotency-Cache', 'hit');
          if (!existingReservation.response) {
            res.status(500).json({
              success: false,
              error: {
                message: 'Internal error: cached response is incomplete',
                code: 'IDEMPOTENCY_CACHE_INCOMPLETE',
              },
            });
            return;
          }
          res.status(existingReservation.response.status).json(existingReservation.response.body);
          return;
        }
      }

      // ===== CREATE RESERVATION (missing → pending) =====
      // In Node.js single-threaded event loop, Map.set() is atomic for synchronous code.
      // For multi-instance deployments with Redis, the store's SET NX provides distributed atomicity.

      // Create a promise that will resolve when the handler completes
      let resolvePromise: (value: { status: number; headers: Record<string, string>; body: unknown }) => void;
      let rejectPromise: (error: unknown) => void;
      const resultPromise = new Promise<{ status: number; headers: Record<string, string>; body: unknown }>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });

      const reservation: IdempotencyReservation = {
        state: 'pending',
        principal,
        httpMethod: req.method,
        routePattern,
        requestBodyHash,
        createdAt: Date.now(),
        resultPromise,
      };

      // Atomically reserve the key
      inFlightReservations.set(compositeKey, reservation);

      // Store original methods to capture response
      const originalJson = res.json.bind(res);
      const originalStatus = res.status;

      let capturedStatus = 200;

      // Intercept status calls
      (res as any).status = function (statusCode: number) {
        capturedStatus = statusCode;
        return originalStatus.call(this, statusCode);
      };

      // Capture the response body when json is called
      const captureJson = async function (this: Response, body: unknown) {
        try {
          const responseBody = {
            status: capturedStatus,
            headers: res.getHeaders() as Record<string, string>,
            body,
          };

          // Resolve the result promise so waiting requests can proceed
          if (resolvePromise) {
            resolvePromise(responseBody);
          }

          // Only cache successful responses (2xx and 3xx)
          if (shouldCacheResponse(capturedStatus)) {
            // Store with atomic reservation (first write wins at store level)
            const stored = storeIdempotencyResponse({
              key: compositeKey,
              principal,
              httpMethod: req.method,
              routePattern,
              requestBodyHash,
              ttlMs,
            }, responseBody);

            if (stored) {
              // Successfully stored - update reservation state to completed
              reservation.state = 'completed';
              reservation.completedAt = Date.now();
              reservation.response = responseBody;
            }
            // If not stored (another instance won the race at Redis SET NX level),
            // the result promise still resolves so waiting requests get the response.
          } else {
            // Failed/unsuccessful response - mark as failed
            reservation.state = 'failed';
            reservation.completedAt = Date.now();
          }
        } catch (error) {
          reservation.state = 'failed';
          reservation.completedAt = Date.now();
          console.error('Idempotency store error:', error);
        }

        return originalJson(body);
      };

      // Handle request errors - reject the promise so waiting requests know
      req.on('close', () => {
        if (reservation.state === 'pending' && !reservation.response) {
          // Request was aborted without sending response
          if (rejectPromise) {
            rejectPromise(new Error('Request closed without response'));
          }
          reservation.state = 'failed';
          reservation.completedAt = Date.now();
        }
      });

      // Override json to capture response
      (res as any).json = captureJson;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Clean up expired in-flight reservations.
 * Removes reservations that have been pending for longer than the TTL.
 * Returns the number of removed entries.
 */
export function cleanupExpiredReservations(ttlMs: number = DEFAULT_TTL_MS): number {
  const now = Date.now();
  let removed = 0;

  for (const [key, reservation] of inFlightReservations.entries()) {
    const age = now - reservation.createdAt;
    if (age > ttlMs) {
      inFlightReservations.delete(key);
      removed++;
    }
  }

  return removed;
}

/**
 * Start idempotency cleanup on server start.
 * Cleans up both the idempotency store AND in-flight reservations.
 */
export function initializeIdempotency(): void {
  startIdempotencyCleanup(60000); // Clean up store every minute
  
  // Also clean up in-flight reservations every minute
  const reservationCleanupInterval = setInterval(() => {
    const removed = cleanupExpiredReservations();
    if (removed > 0) {
      console.debug(`Idempotency: cleaned up ${removed} expired in-flight reservations`);
    }
  }, 60000);
  
  // Don't prevent process exit from this interval
  if (reservationCleanupInterval.unref) {
    reservationCleanupInterval.unref();
  }
}

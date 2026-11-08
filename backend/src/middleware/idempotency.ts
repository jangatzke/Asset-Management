import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import {
  generateIdempotencyKey,
  generateRequestBodyHash,
  startIdempotencyCleanup,
  IdempotencyEntry,
} from '../services/idempotency.service';
import {
  createRedisIdempotencyClient,
  isRedisConfigured,
  RedisIdempotencyClient,
  IdempotencyReservation as RedisReservation,
  IdempotencyAlreadyExists,
  IdempotencyNotReserved,
} from '../services/idempotency-redis-client';

export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** Default TTL for idempotency entries: 24 hours */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
/** Poll interval for waiting on winner (ms) */
const POLL_INTERVAL_MS = 100;
/** Max wait time before giving up (ms) */
const MAX_WAIT_MS = 30000;

export type IdempotencyState = 'pending' | 'completed' | 'failed';

/**
 * Unified reservation result type that covers all possible outcomes:
 * - We won the reservation (RedisReservation)
 * - Response already exists (IdempotencyAlreadyExists)
 * - Someone else has the reservation (IdempotencyNotReserved)
 */
type ReservationResult = RedisReservation | IdempotencyAlreadyExists | IdempotencyNotReserved;

/**
 * In-memory reservation tracking for same-process deduplication.
 * Key: compositeKey, Value: InMemoryReservation
 */
interface InMemoryReservation {
  state: IdempotencyState;
  requestId: string;
  principal: string;
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
}

type CachedHttpResponse = NonNullable<InMemoryReservation['response']>;
type WinnerWaitResult = CachedHttpResponse | 'body-mismatch' | null;

function hasBodyMismatch(storedHash: string | undefined, requestHash: string | undefined): boolean {
  return Boolean(storedHash && requestHash && storedHash !== requestHash);
}

/**
 * Build the idempotency scope fingerprint for the current request.
 *
 * By default this is the route template (e.g. `/:id/type`) or the path without
 * query parameters when the request was not matched by a router. That behavior
 * is unchanged for all existing idempotent routes.
 *
 * With `includeRouteParams: true` concrete path parameters are substituted so
 * that two writes to different entities with the same Idempotency-Key never
 * replay each other's responses.
 */
function buildRoutePattern(req: Request, includeRouteParams: boolean): string {
  const routeTemplate = req.route?.path || req.originalUrl.split('?')[0];

  if (!includeRouteParams || typeof routeTemplate !== 'string') {
    return routeTemplate;
  }

  const params = (req as any).params || {};
  return routeTemplate.replace(/:([A-Za-z0-9_]+)/g, (placeholder: string, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/**
 * Replay a cached response. Non-JSON responses (e.g. 204 No Content) are stored
 * with an undefined body and must be replayed with `res.end()` so Express
 * terminates the response instead of sending JSON `null`.
 */
function replayCachedResponse(
  res: Response,
  cachedResponse: CachedHttpResponse,
  cacheState?: 'hit' | 'waiting',
): void {
  if (cacheState) {
    res.set('X-Idempotency-Cache', cacheState);
  }
  res.status(cachedResponse.status);
  if (cachedResponse.body === undefined) {
    res.end();
    return;
  }
  res.json(cachedResponse.body);
}

interface IdempotencyOptions {
  ttlMs?: number;
  keyHeader?: string;
  /**
   * Include concrete route parameters in the idempotency scope.
   * Default: false (route template only) — preserves existing semantics.
   */
  includeRouteParams?: boolean;
}

/**
 * Extract trusted principal from request.
 * ONLY reads from context properties set by preceding authentication middleware.
 * Does NOT fall back to raw headers — this prevents header-based impersonation.
 *
 * The principal is derived from:
 * 1. Service account: req.serviceAccount.id (set by service account auth middleware)
 * 2. User: req.userId (set by JWT authentication middleware)
 * 3. Webhook principal: req.webhookPrincipal (set by webhook auth middleware)
 */
function extractTrustedPrincipal(req: Request): string | undefined {
  // Check for webhook principal in request context (set by webhook auth middleware)
  const webhookPrincipal = (req as any).webhookPrincipal;
  if (webhookPrincipal) return String(webhookPrincipal);

  // Check for service account ID in request context (set by service account auth middleware)
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
 * Key: compositeKey, Value: InMemoryReservation
 */
const inFlightReservations = new Map<string, InMemoryReservation>();

/**
 * Global Redis client for distributed idempotency.
 * Used for cross-process distributed atomicity (first-write-wins).
 * Falls back to in-memory store if Redis is unavailable.
 */
let redisClient: RedisIdempotencyClient | null = null;

/**
 * Idempotency Middleware Factory
 *
 * CRITICAL FIX: Redis SET NX now happens BEFORE next() is called,
 * ensuring distributed atomic reservation before the business operation executes.
 *
 * State machine: missing → pending → completed/failed
 * - First request with a key atomically reserves it in Redis (state: pending)
 * - Subsequent requests with the same key:
 *   - If reserved by someone else: poll until winner completes
 *   - If response already exists: return cached response immediately
 *   - If body differs: return 409 Conflict
 * - Completed/failed entries are cleaned up after TTL
 *
 * Key features:
 * - Atomic reservation via Redis SET NX BEFORE next() (distributed atomicity)
 * - Losers poll and wait for winner to complete
 * - Trusted principal extraction ONLY from auth middleware context
 * - Recursive canonical body hash for collision-resistant request comparison
 * - Only caches 2xx/3xx responses (not 4xx/5xx)
 */
export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  const ttlSeconds = Math.ceil(ttlMs / 1000);
  const keyHeader = (options.keyHeader || IDEMPOTENCY_KEY_HEADER).toLowerCase();
  const includeRouteParams = options.includeRouteParams === true;

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

      // SECURITY FIX (Problem 10): Store validation errors in the idempotency store
      // so that duplicate requests with the same key receive consistent responses.
      // This gives a false sense of protection for validation errors - now we track them.
      
      // Extract trusted principal ONLY from auth middleware context
      const principal = extractTrustedPrincipal(req);

      // Require trusted principal - never allow anonymous idempotency
      if (!principal) {
        const routePattern = buildRoutePattern(req, includeRouteParams);
        const compositeKey = generateIdempotencyKey(principal || 'unknown', req.method, routePattern, idempotencyKey);
        
        // Store the error response in the idempotency store for consistency
        if (compositeKey) {
          await storeIdempotencyError(compositeKey, {
            status: 401,
            body: {
              success: false,
              error: {
                message: 'Trusted principal required for idempotency',
                code: 'MISSING_PRINCIPAL',
                hint: 'Ensure authentication middleware runs before idempotency middleware',
              },
            },
          }, ttlMs);
        }
        
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

      // Validate idempotency key format (UUID or alphanumeric with hyphens)
      if (!/^[a-zA-Z0-9\-_]+$/.test(idempotencyKey)) {
        const routePattern = buildRoutePattern(req, includeRouteParams);
        const compositeKey = generateIdempotencyKey(principal, req.method, routePattern, idempotencyKey);
        
        // Store the error response in the idempotency store for consistency
        if (compositeKey) {
          await storeIdempotencyError(compositeKey, {
            status: 400,
            body: {
              success: false,
              error: {
                message: 'Invalid Idempotency-Key Format',
                code: 'INVALID_IDEMPOTENCY_KEY',
              },
            },
          }, ttlMs);
        }
        
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid Idempotency-Key Format',
            code: 'INVALID_IDEMPOTENCY_KEY',
          },
        });
        return;
      }

      const routePattern = buildRoutePattern(req, includeRouteParams);

      // Generate composite key from principal + method + route + idempotency-key
      // NOTE: generateIdempotencyKey now returns undefined if principal is undefined,
      // but we already check for principal above and return 401, so this should never be undefined here.
      const compositeKey = generateIdempotencyKey(principal, req.method, routePattern, idempotencyKey);
      
      // Safety check: if compositeKey is somehow undefined, reject the request
      if (!compositeKey) {
        res.status(500).json({
          success: false,
          error: {
            message: 'Internal error: could not generate idempotency key',
            code: 'IDEMPOTENCY_KEY_GENERATION_FAILED',
          },
        });
        return;
      }

      // Generate request body hash for comparison
      const requestBodyHash = generateRequestBodyHash(req.body ?? null);

      const requestId = crypto.randomUUID();

      // ===== STEP 1: ATOMIC REDIS RESERVATION (BEFORE next()) =====
      // This is the CRITICAL FIX: Redis SET NX happens BEFORE the operation
      
      let reservationResult: ReservationResult;
      
      if (redisClient && redisClient.isConnected()) {
        try {
          reservationResult = await redisClient.reserve(
            compositeKey,
            principal,
            req.method,
            routePattern,
            requestId,
            ttlSeconds,
            requestBodyHash
          );
        } catch (error) {
          console.error('[Idempotency] Redis reservation failed, falling back to in-memory:', error);
          // Fall through to in-memory only mode
          reservationResult = await reserveInMemory(compositeKey, principal, req.method, routePattern, requestId, ttlMs, requestBodyHash);
        }
      } else {
        // No Redis - use in-memory only
        reservationResult = await reserveInMemory(compositeKey, principal, req.method, routePattern, requestId, ttlMs, requestBodyHash);
      }

      // Handle reservation result
      if (!reservationResult.reserved) {
        // We didn't win the reservation
        if ('exists' in reservationResult && reservationResult.exists) {
          const cachedBodyHash = reservationResult.entry.data.keyOptions.requestBodyHash;
          if (cachedBodyHash !== requestBodyHash) {
            res.status(409).json({
              success: false,
              error: {
                message: 'Request body mismatch for idempotency key',
                code: 'IDEMPOTENCY_BODY_MISMATCH',
                hint: 'The original request with this Idempotency-Key had a different body',
              },
            });
            return;
          }

          // Response already exists - return it immediately
          replayCachedResponse(res, reservationResult.entry.data.response, 'hit');
          return;
        }
        
        // Someone else has the reservation - wait for them to complete
        // Type narrowing: only IdempotencyNotReserved has 'existingReservation'
        if ('existingReservation' in reservationResult) {
          // Check for body mismatch before waiting
          if (hasBodyMismatch(reservationResult.existingReservation.requestBodyHash, requestBodyHash)) {
            res.status(409).json({
              success: false,
              error: {
                message: 'Request body mismatch for idempotency key',
                code: 'IDEMPOTENCY_BODY_MISMATCH',
                hint: 'The original request with this Idempotency-Key had a different body',
              },
            });
            return;
          }
          
          res.set('X-Idempotency-Cache', 'waiting');
          const result = await waitForWinner(
            compositeKey,
            reservationResult.existingReservation,
            requestBodyHash,
          );
          
          if (result === 'body-mismatch') {
            res.status(409).json({
              success: false,
              error: {
                message: 'Request body mismatch for idempotency key',
                code: 'IDEMPOTENCY_BODY_MISMATCH',
                hint: 'The original request with this Idempotency-Key had a different body',
              },
            });
          } else if (result) {
            replayCachedResponse(res, result, 'waiting');
          } else {
            // Winner did not complete successfully - return 504 Gateway Timeout
            res.status(504).json({
              success: false,
              error: {
                message: 'Idempotency operation timed out waiting for winner',
                code: 'IDEMPOTENCY_TIMEOUT',
                hint: 'The original operation did not complete within the timeout period. Retry with a new Idempotency-Key.',
              },
            });
          }
        }
        return;
      }

      // We won the reservation - proceed with the operation
      // Create in-memory tracking for this reservation
      const memoryReservation: InMemoryReservation = {
        state: 'pending',
        requestId,
        principal,
        httpMethod: req.method,
        routePattern,
        requestBodyHash,
        createdAt: Date.now(),
      };

      inFlightReservations.set(compositeKey, memoryReservation);

      let released = false;
      const releaseReservation = async (_reason: string): Promise<void> => {
        if (released || memoryReservation.state !== 'pending') {
          return;
        }
        released = true;
        memoryReservation.state = 'failed';
        memoryReservation.completedAt = Date.now();
        // Do not delete a newer local reservation created after this request
        // released or timed out.
        if (inFlightReservations.get(compositeKey)?.requestId === requestId) {
          inFlightReservations.delete(compositeKey);
        }

        if (redisClient && redisClient.isConnected()) {
          try {
            await redisClient.releaseReservation(compositeKey, requestId);
          } catch (error) {
            console.debug('[Idempotency] Failed to release Redis reservation:', error);
          }
        }
      };

      // Store original methods to capture response
      const originalJson = res.json.bind(res);
      const originalStatus = res.status;
      let capturedStatus = 200;

      // Intercept status calls
      (res as any).status = function (statusCode: number) {
        capturedStatus = statusCode;
        return originalStatus.call(this, statusCode);
      };

      /**
       * Mark the reservation as completed and persist the cached response.
       * Shared by JSON responses and successful non-JSON responses (204/send/end).
       */
      const storeSuccessfulResponse = async (responseBody: CachedHttpResponse): Promise<void> => {
        // Mark the local reservation completed synchronously so same-process
        // replays never observe a dangling pending reservation.
        memoryReservation.state = 'completed';
        memoryReservation.completedAt = Date.now();
        memoryReservation.response = responseBody;

        if (!redisClient || !redisClient.isConnected()) {
          return;
        }

        try {
          const entry: IdempotencyEntry = {
            data: {
              response: responseBody,
              keyOptions: { ttlMs, httpMethod: req.method, routePattern, principal, requestBodyHash },
              createdAt: Date.now(),
            },
            expiresAt: Date.now() + ttlMs,
          };
          await redisClient.storeResponse(compositeKey, entry, requestId);
        } catch (storeError) {
          console.debug('[Idempotency] Store error (response still resolved):', storeError);
        }
      };

      let jsonResponseCaptured = false;

      // Capture the response body when json is called
      const captureJson = async function (this: Response, body: unknown) {
        jsonResponseCaptured = true;
        try {
          const responseBody: CachedHttpResponse = {
            status: capturedStatus,
            headers: res.getHeaders() as Record<string, string>,
            body,
          };

          // Only cache successful responses (2xx and 3xx)
          if (capturedStatus >= 200 && capturedStatus < 400) {
            await storeSuccessfulResponse(responseBody);
          } else {
            await releaseReservation(`business response status ${capturedStatus}`);
          }
        } catch (error) {
          await releaseReservation('response capture error');
          console.error('Idempotency store error:', error);
        }

        return originalJson(body);
      };

      // Handle failures that bypass json(), including thrown errors handled by
      // Express, non-JSON error responses, and client disconnects.
      res.on('finish', () => {
        if (res.statusCode >= 400) {
          void releaseReservation(`business response status ${res.statusCode}`);
          return;
        }

        // Successful non-JSON responses (e.g. 204 No Content via res.send()/res.end())
        // must also complete the reservation, otherwise replays wait for a winner
        // that never finishes and eventually return 504. The body is stored as
        // undefined so the replay helper terminates the response with res.end().
        if (!jsonResponseCaptured && res.statusCode >= 200 && res.statusCode < 400) {
          const responseBody: CachedHttpResponse = {
            status: res.statusCode,
            headers: res.getHeaders() as Record<string, string>,
            body: undefined,
          };
          void storeSuccessfulResponse(responseBody);
        }
      });
      req.on('aborted', () => void releaseReservation('client request aborted'));
      res.on('close', () => {
        if (!res.writableEnded) {
          void releaseReservation('client response closed before completion');
        }
      });

      // Override json to capture response
      (res as any).json = captureJson;

      // ===== STEP 2: EXECUTE THE BUSINESS OPERATION =====
      try {
        next();
      } catch (error) {
        await releaseReservation('request processing threw');
        next(error);
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Store a validation/error response in the in-memory idempotency store.
 * This ensures that duplicate requests with invalid idempotency keys receive
 * consistent responses (Problem 10 fix).
 */
interface IdempotencyErrorResponse {
  status: number;
  body: unknown;
}

async function storeIdempotencyError(
  key: string,
  errorResponse: IdempotencyErrorResponse,
  ttlMs: number
): Promise<void> {
  const now = Date.now();

  // Store in in-memory reservation for fast local access
  inFlightReservations.set(key, {
    state: 'completed',
    requestId: 'error',
    principal: 'error',
    httpMethod: '',
    routePattern: '',
    requestBodyHash: undefined,
    createdAt: now,
    response: {
      status: errorResponse.status,
      headers: { 'X-Idempotency-Cache': 'error' },
      body: errorResponse.body,
    },
  });

  // Schedule in-memory cleanup
  setTimeout(() => {
    inFlightReservations.delete(key);
  }, ttlMs);

  // Persist error response to Redis so other instances also replay the cached error.
  // Error responses have no pre-existing reservation, so atomically reserve this
  // key first and only write the response when this process owns that reservation.
  if (redisClient && redisClient.isConnected()) {
    try {
      const requestId = crypto.randomUUID();
      const reservation = await redisClient.reserve(
        key,
        'error',
        '',
        '',
        requestId,
        Math.ceil(ttlMs / 1000),
      );

      if (!reservation.reserved) {
        return;
      }

      const entry: IdempotencyEntry = {
        data: {
          response: {
            status: errorResponse.status,
            headers: { 'X-Idempotency-Cache': 'error' },
            body: errorResponse.body,
          },
          keyOptions: { ttlMs, httpMethod: '', routePattern: '', principal: 'error' },
          createdAt: now,
        },
        expiresAt: now + ttlMs,
      };
      await redisClient.storeResponse(key, entry, requestId);
    } catch (redisError) {
      console.debug('[Idempotency] Redis storeResponse failed for error:', redisError);
      // In-memory entry is still valid; Redis failure is non-blocking
    }
  }
}

/**
 * Reserve in an in-memory Map (fallback when Redis is unavailable).
 */
async function reserveInMemory(
  key: string,
  principal: string,
  httpMethod: string,
  routePattern: string,
  requestId: string,
  ttlMs: number,
  requestBodyHash: string
): Promise<ReservationResult> {
  const existing = inFlightReservations.get(key);

  if (existing) {
    if (existing.state === 'completed' && existing.response) {
      return {
        reserved: false,
        exists: true,
        entry: {
          data: {
            response: existing.response,
            keyOptions: {
              ttlMs,
              httpMethod: existing.httpMethod,
              routePattern: existing.routePattern,
              principal: existing.principal,
              requestBodyHash: existing.requestBodyHash,
            },
            createdAt: existing.createdAt,
          },
          expiresAt: existing.createdAt + ttlMs,
        },
      };
    }
    
    if (existing.state === 'pending') {
      return {
        reserved: false,
        exists: false,
        existingReservation: {
          principal: existing.principal,
          requestId: existing.requestId,
          expiresAt: existing.createdAt + ttlMs,
          requestBodyHash: existing.requestBodyHash,
        },
      };
    }
  }

  inFlightReservations.set(key, {
    state: 'pending',
    requestId,
    principal,
    httpMethod,
    routePattern,
    requestBodyHash,
    createdAt: Date.now(),
  });

  return {
    reserved: true,
    key,
    principal,
    httpMethod,
    routePattern,
    requestId,
    expiresAt: Date.now() + ttlMs,
  };
}

/**
 * Wait for the winner to complete their operation.
 *
 * CRITICAL FIX: Polls Redis for the reservation state, not just the local Map.
 * This enables distributed multi-instance idempotency where Instance A wins the
 * reservation and Instance B must poll Redis to see the result.
 *
 * Returns null if timeout occurs or the reservation disappears from Redis.
 */
async function waitForWinner(
  key: string,
  existingReservation: { principal: string; requestId: string; expiresAt: number; requestBodyHash?: string },
  requestBodyHash: string | undefined
): Promise<WinnerWaitResult> {
  const startTime = Date.now();

  // Body mismatch check (Fix 4)
  if (hasBodyMismatch(existingReservation.requestBodyHash, requestBodyHash)) {
    return 'body-mismatch';
  }

  while (Date.now() - startTime < MAX_WAIT_MS) {
    // First, try local in-memory reservation (fast path for same-process dedup)
    const localReservation = inFlightReservations.get(key);
    
    if (localReservation) {
      if (localReservation.state === 'completed' && localReservation.response) {
        // The local entry may belong to a later reacquisition after the
        // reservation this waiter originally observed expired or was released.
        if (hasBodyMismatch(localReservation.requestBodyHash, requestBodyHash)) {
          return 'body-mismatch';
        }
        localReservation.response.headers['X-Idempotency-Cache'] = 'waiting';
        return localReservation.response;
      }

      if (localReservation.state === 'failed') {
        inFlightReservations.delete(key);
        return null; // Let the caller handle retry
      }
    }

    // Second, poll Redis for distributed cross-instance coordination (Fix 3)
    if (redisClient && redisClient.isConnected()) {
      try {
        const redisEntry = await redisClient.pollReservation(key);

        if (redisEntry === null) {
          // Key expired or never existed - reservation lost
          // Check if body mismatch was stored instead
          return null;
        }

        // A pending reservation can be replaced while waiting. Re-validate on
        // every poll before ever replaying that winner's response.
        if (hasBodyMismatch(redisEntry.requestBodyHash, requestBodyHash)) {
          return 'body-mismatch';
        }

        // If the winner has a response stored, return it
        if (redisEntry.response) {
          return redisEntry.response.data.response;
        }

        // If the reservation expired (expiresAt in the past), treat as gone
        if (Date.now() > redisEntry.expiresAt) {
          return null;
        }
      } catch (error) {
        console.debug('[Idempotency] Redis poll failed during waitForWinner:', error);
        // Continue with local polling only
      }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  // Timeout - let the caller return 504
  return null;
}

/**
 * Initialize the Redis client for distributed idempotency.
 * Called during server startup to establish Redis connection.
 */
export async function initializeRedisClient(): Promise<void> {
  if (!isRedisConfigured()) {
    console.log('[Idempotency] No REDIS_HOST configured - using in-memory store only');
    return;
  }

  try {
    redisClient = createRedisIdempotencyClient();
    const connected = await redisClient.initialize();
    
    if (connected) {
      console.log('[Idempotency] Redis client initialized for distributed idempotency');
    } else {
      console.log('[Idempotency] Redis initialization failed - falling back to in-memory store');
      redisClient = null;
    }
  } catch (error) {
    console.error('[Idempotency] Redis initialization error:', error);
    redisClient = null;
  }
}

/**
 * Start idempotency cleanup on server start.
 * Cleans up in-flight reservations periodically.
 * Also initializes Redis client if configured.
 */
export function initializeIdempotency(): void {
  startIdempotencyCleanup(60000); // Clean up store every minute
  
  // Also clean up in-flight reservations every minute
  const reservationCleanupInterval = setInterval(() => {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, reservation] of inFlightReservations.entries()) {
      const age = now - reservation.createdAt;
      if (age > DEFAULT_TTL_MS) {
        inFlightReservations.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.debug(`Idempotency: cleaned up ${removed} expired in-flight reservations`);
    }
  }, 60000);
  
  // Don't prevent process exit from this interval
  if (reservationCleanupInterval.unref) {
    reservationCleanupInterval.unref();
  }
}

/**
 * Get the current Redis client status (for testing/monitoring).
 */
export function getIdempotencyRedisStatus(): { connected: boolean; usingFallback: boolean } {
  if (!redisClient) {
    return { connected: false, usingFallback: true };
  }
  const status = redisClient.getStatus();
  return {
    connected: status.connected,
    usingFallback: status.usingFallback,
  };
}

/**
 * Close the Redis client (for graceful shutdown/testing).
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.close();
    redisClient = null;
  }
}

/**
 * Set the Redis client directly (for testing).
 */
export function setRedisClient(client: RedisIdempotencyClient | null): void {
  redisClient = client;
}

/**
 * Get the number of in-flight reservations (for testing/monitoring).
 */
export function getInFlightReservationCount(): number {
  return inFlightReservations.size;
}

/**
 * Clear in-flight reservations (for testing).
 */
export function clearInFlightReservations(): void {
  inFlightReservations.clear();
}

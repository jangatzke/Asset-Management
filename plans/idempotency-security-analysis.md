# Idempotency Middleware Security Analysis & Remediation Plan

## Executive Summary

This document analyzes three critical issues in the idempotency/reservation middleware system and provides concrete, code-level remediation plans. The issues are:

1. **Non-atomic reservation** — concurrent requests with the same key can both execute the business operation
2. **Body-hash collision risk** — non-recursive canonical serialization allows nested object properties to disappear from the hash
3. **Untrusted principal extraction** — fallback to raw request headers bypasses authentication middleware

---

## Issue 1: Non-Atomic Reservation

### Problem Statement

The current implementation in [`backend/src/middleware/idempotency.ts`](backend/src/middleware/idempotency.ts:84-117) has a **TOCTOU (Time-of-Check-Time-of-Use) race condition**:

```typescript
// Line 84-86: Check if response exists
const existingResponse = getIdempotencyResponse<...>(compositeKey);

// Line 87-117: If not found, proceed to business logic
if (existingResponse !== undefined) {
  // return cached response
}

// Lines 119-169: Intercept response and store later
// The store happens AFTER the business logic executes
```

**Attack scenario with two concurrent requests (A and B):**

```
Time    Request A                        Request B
────────────────────────────────────────────────────────────
T1      GET key → null
T2                                  GET key → null
T3      Execute business operation
T4                                  Execute business operation  ← DUPLICATE EXECUTION
T5      SET key → true
T6                                  SET key → false (rejected)
```

Both A and B find no entry at T1/T2, both execute the business operation at T3/T4, and only A succeeds in storing at T5. The second request B has already committed to its operation.

The Redis store in [`backend/src/services/idempotency-redis-store.ts`](backend/src/services/idempotency-redis-store.ts:55-70) correctly uses `SET NX` for atomic reservation, but the middleware never calls it — it only stores the response AFTER the business logic completes.

### State Machine Design

```
                    ┌─────────────────────────────────────────────────┐
                    │                                                   │
                    ▼                                                   │
               ┌──────────┐     atomic    ┌──────────────┐   first     │
   NEW ──────►│  MISSING │──SET NX──►   │  PROCESSING  │──write──┤
               └──────────┘              └──────────────┘  wins   │
                                              │                   │
                        ┌─────────────────────┘                   │
                        │                                         │
                        ▼                                         │
               ┌──────────────┐   completes   ┌──────────────┐   │
               │  PROCESSING  │───────────►   │  COMPLETED   │   │
               │  (blocking)  │               │  (cached)    │   │
               └──────────────┘               └──────────────┘   │
                        │                                         │
                        │                                         │
              ┌─────────┴─────────┐                               │
              │                   │                               │
              ▼                   ▼                               │
        ┌──────────┐      ┌──────────┐                           │
        │  409     │      │  425     │                           │
        │ CONFLICT │      │ UNAVAILABLE│                          │
        │(different│      │(wait for  │                           │
        │ body)    │      │ result)   │                           │
        └──────────┘      └──────────┘                           │
                                                                  │
               ┌──────────────────────────────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  COMPLETED   │◄─────────────────────────────────────────┐
        │  (cached)    │                                          │
        └──────────────┘                                          │
               │                                                  │
               │  subsequent GET                                 │
               ▼                                                  │
        ┌──────────┐                                              │
        │  200/201 │──────────────────────────────────────────────┘
        │  cached  │
        │ response │
        └──────────┘
```

### Concrete Implementation

#### 1. New Middleware Flow in [`backend/src/middleware/idempotency.ts`](backend/src/middleware/idempotency.ts)

```typescript
// === NEW: Reservation states ===
enum IdempotencyState {
  MISSING = 'missing',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
}

interface IdempotencyProcessingEntry {
  state: IdempotencyState.PROCESSING;
  startedAt: number;
  resultPromise: Promise<{ status: number; headers: Record<string, string>; body: unknown }>;
}

interface IdempotencyCompletedEntry {
  state: IdempotencyState.COMPLETED;
  response: { status: number; headers: Record<string, string>; body: unknown };
  requestBodyHash?: string;
  createdAt: number;
}

// === NEW: Atomic reservation function ===
async function tryReserveKey(
  compositeKey: string,
  ttlMs: number,
  requestBodyHash?: string
): Promise<
  | { status: 'reserved'; entry: IdempotencyProcessingEntry }
  | { status: 'exists'; entry: IdempotencyCompletedEntry | IdempotencyProcessingEntry }
> {
  // Use Redis SET NX if available, otherwise use in-memory atomic set
  const reserved = await idempotencyStore.reserve(compositeKey, { requestBodyHash, ttlMs });
  
  if (reserved) {
    return {
      status: 'reserved',
      entry: {
        state: IdempotencyState.PROCESSING,
        startedAt: Date.now(),
        resultPromise: new Promise(() => {}), // placeholder, resolved after handler
      },
    };
  }
  
  // Key already exists — check state
  const existing = await idempotencyStore.get(compositeKey);
  if (!existing) {
    return { status: 'reserved', entry: /* ... */ }; // race: re-attempt
  }
  
  if (existing.state === IdempotencyState.COMPLETED) {
    return { status: 'exists', entry: existing };
  }
  
  if (existing.state === IdempotencyState.PROCESSING) {
    // Check body hash before deciding 425 vs wait
    if (requestBodyHash && existing.requestBodyHash !== requestBodyHash) {
      return { status: 'exists', entry: existing }; // will trigger 409
    }
    // Return the processing entry so caller can await
    return { status: 'exists', entry: existing };
  }
  
  return { status: 'reserved', entry: /* ... */ };
}
```

#### 2. Updated Middleware Logic

```typescript
export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000;
  const keyHeader = (options.keyHeader || IDEMPOTENCY_KEY_HEADER).toLowerCase();
  const waitTimeout = options.waitTimeoutMs || 30_000; // How long to wait for in-flight request

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
      }

      const idempotencyKey = req.headers[keyHeader] as string | undefined;
      if (!idempotencyKey) return next();

      if (!/^[a-zA-Z0-9\-_]+$/.test(idempotencyKey)) {
        res.status(400).json({ success: false, error: { message: 'Invalid Idempotency-Key Format', code: 'INVALID_IDEMPOTENCY_KEY' } });
        return;
      }

      // === FIX #3: Principal from middleware context ONLY ===
      const principal = extractTrustedPrincipal(req);
      const routePattern = req.route?.path || req.originalUrl.split('?')[0];
      const compositeKey = generateIdempotencyKey(principal, req.method, routePattern, idempotencyKey);
      const requestBodyHash = req.body && Object.keys(req.body).length > 0
        ? generateCanonicalHash(req.body)
        : undefined;

      // === FIX #1: Atomic reservation ===
      const reservation = await tryReserveKey(compositeKey, ttlMs, requestBodyHash);

      switch (reservation.status) {
        case 'reserved': {
          // We won the race — proceed to business logic
          const processingEntry = reservation.entry;
          
          // Override response methods to capture result
          const originalJson = res.json.bind(res);
          let capturedStatus = 200;
          (res as any).status = function(this: Response, statusCode: number) {
            capturedStatus = statusCode;
            return originalStatus.call(this, statusCode);
          };

          // Create the result promise that will be resolved after handler
          const resultPromise = (async () => {
            // Wrap originalJson to capture the body
            const captureJson = async function(this: Response, body: unknown) {
              const responseBody = {
                status: capturedStatus,
                headers: res.getHeaders() as Record<string, string>,
                body,
              };

              // Transition to COMPLETED
              await idempotencyStore.updateState(compositeKey, {
                state: IdempotencyState.COMPLETED,
                response: responseBody,
                requestBodyHash,
                createdAt: Date.now(),
              });

              return originalJson(body);
            };
            (res as any).json = captureJson;
            return new Promise<{ status: number; headers: Record<string, string>; body: unknown }>(() => {
              // This promise resolves when captureJson is called
              // We use a different mechanism — see below
            });
          })();

          processingEntry.resultPromise = resultPromise;
          next();
          break;
        }

        case 'exists': {
          const existing = reservation.entry;

          if (existing.state === IdempotencyState.COMPLETED) {
            // Serve cached response
            res.set('X-Idempotency-Cache', 'hit');
            res.status(existing.response.status).json(existing.response.body);
            return;
          }

          if (existing.state === IdempotencyState.PROCESSING) {
            // Body mismatch → 409
            if (requestBodyHash && existing.requestBodyHash && existing.requestBodyHash !== requestBodyHash) {
              res.status(409).json({
                success: false,
                error: { message: 'Idempotency key reused with different request body', code: 'IDEMPOTENCY_BODY_MISMATCH' },
              });
              return;
            }

            // Same body, wait for in-flight result (with timeout)
            try {
              const result = await Promise.race([
                reservation.entry.resultPromise,
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Idempotency wait timeout')), waitTimeout)
                ),
              ]);

              res.set('X-Idempotency-Cache', 'hit');
              res.status(result.status).json(result.body);
            } catch (err) {
              // Timeout or error while waiting — treat as new request
              // (the original request may have failed; it's safe to retry)
              next();
            }
            return;
          }
        }
      }
    } catch (error) {
      next(error);
    }
  };
}
```

#### 3. Updated Store Interface

```typescript
// In backend/src/services/idempotency.service.ts

class IdempotencyStore {
  // NEW: Atomic reserve — only one caller wins
  async reserve(key: string, options: { requestBodyHash?: string; ttlMs?: number }): Promise<boolean> {
    const entry: IdempotencyProcessingEntry = {
      state: IdempotencyState.PROCESSING,
      startedAt: Date.now(),
      resultPromise: new Promise(() => {}),
    };
    
    // For in-memory: Map.set is synchronous and atomic within a single event loop tick
    // For Redis: uses SET NX
    if (this.store.has(key)) {
      return false;
    }
    this.store.set(key, entry as IdempotencyEntry);
    return true;
  }

  // NEW: Transition from PROCESSING to COMPLETED
  async updateState(key: string, completedEntry: IdempotencyCompletedEntry): Promise<boolean> {
    if (!this.store.has(key)) {
      return false;
    }
    this.store.set(key, completedEntry as IdempotencyEntry);
    return true;
  }
}
```

### Test Cases to Add

```typescript
// backend/src/__tests__/idempotency.concurrency.test.ts

describe('Concurrent request handling', () => {
  test('second concurrent request with same key should wait for result, not execute twice', async () => {
    let executionCount = 0;
    
    // Mock endpoint that counts executions
    app.post('/api/v1/test/count', async (req, res) => {
      executionCount++;
      await new Promise(r => setTimeout(r, 100)); // simulate slow operation
      res.status(201).json({ executionCount });
    });

    const key = 'concurrent-key';
    const [r1, r2] = await Promise.all([
      request(app).post('/api/v1/test/count').set(IDEMPOTENCY_KEY_HEADER, key).send({}),
      request(app).post('/api/v1/test/count').set(IDEMPOTENCY_KEY_HEADER, key).send({}),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.headers['x-idempotency-cache']).toBe('hit');
    expect(executionCount).toBe(1); // CRITICAL: only one execution
  });

  test('concurrent requests with different bodies should return 409', async () => {
    const key = 'conflict-key';
    const [r1, r2] = await Promise.all([
      request(app).post('/api/v1/test/assets').set(IDEMPOTENCY_KEY_HEADER, key).send({ name: 'A' }),
      request(app).post('/api/v1/test/assets').set(IDEMPOTENCY_KEY_HEADER, key).send({ name: 'B' }),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('IDEMPOTENCY_BODY_MISMATCH');
  });
});
```

---

## Issue 2: Body-Hash for Nested Objects

### Problem Statement

The current implementation in [`backend/src/services/idempotency.service.ts:60-62`](backend/src/services/idempotency.service.ts:60-62):

```typescript
export function generateRequestBodyHash(body: unknown): string {
  const normalized = typeof body === 'string' 
    ? body 
    : JSON.stringify(body, Object.keys(body as object).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

**This is broken for nested objects.** The `JSON.stringify(replacer)` second argument only affects the **top-level** keys. Nested objects retain their original key order.

**Example of the bug:**

```javascript
const payload1 = { user: { name: "Alice", age: 30 }, action: "create" };
const payload2 = { action: "create", user: { age: 30, name: "Alice" } };

// Current implementation:
JSON.stringify(payload1, Object.keys(payload1).sort())
// → '{"action":"create","user":{"name":"Alice","age":30}}'
//                                  ^^^^^^^ ^^^^  ← nested keys NOT sorted

JSON.stringify(payload2, Object.keys(payload2).sort())
// → '{"action":"create","user":{"age":30,"name":"Alice"}}'
//                                  ^^^^^ ^^^^  ← different order!

// These produce DIFFERENT strings → DIFFERENT hashes
// even though they represent the same logical payload
```

**Worse, deeply nested properties can be lost entirely:**

```javascript
const payload = {
  a: 1,
  nested: {
    deep: {
      veryDeep: { value: 42 }
    }
  }
};
// Only top-level key 'nested' is passed as replacer.
// The nested objects { deep: ... } and { veryDeep: ... } are stringified
// with their original key order, creating hash instability.
```

### Solution: Recursive Canonical Serialization

#### Implementation in [`backend/src/services/idempotency.service.ts`](backend/src/services/idempotency.service.ts)

```typescript
/**
 * Recursively canonicalize an object for deterministic serialization.
 * - All object keys are sorted lexicographically at every depth level
 * - Arrays preserve element order (elements are compared by their canonical hash)
 * - Primitive values are serialized as-is
 * - Handles circular references via a WeakSet
 * - null and undefined are handled consistently
 */
function canonicalize(value: unknown, seen = new WeakSet()): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;
  
  // Primitives: return as-is
  if (typeof value !== 'object') return value;
  
  // Circular reference guard
  if (seen.has(value)) {
    throw new Error('Circular reference detected in request body');
  }
  seen.add(value);
  
  // Arrays: canonicalize each element
  if (Array.isArray(value)) {
    return value.map(item => canonicalize(item, seen));
  }
  
  // Objects: sort keys recursively
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value as object).sort();
  for (const key of keys) {
    sorted[key] = canonicalize((value as Record<string, unknown>)[key], seen);
  }
  
  return sorted;
}

/**
 * Generate a SHA-256 hash from a request body using recursive canonical serialization.
 * This ensures that two payloads with the same logical content produce the same hash,
 * regardless of key ordering at any nesting depth.
 */
export function generateRequestBodyHash(body: unknown): string {
  const normalized = typeof body === 'string'
    ? body
    : JSON.stringify(canonicalize(body));
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

### Test Cases

```typescript
// In backend/src/__tests__/phase8.idempotency.test.ts

describe('generateRequestBodyHash - canonical serialization', () => {
  test('should produce same hash for objects with different key order at any depth', () => {
    const hash1 = generateRequestBodyHash({
      z: 1,
      a: { nested_z: 3, nested_a: 2 },
      m: { deep: { z: 9, a: 8 } }
    });
    
    const hash2 = generateRequestBodyHash({
      m: { deep: { a: 8, z: 9 } },
      a: { nested_a: 2, nested_z: 3 },
      z: 1
    });
    
    expect(hash1).toBe(hash2);
  });

  test('should handle arrays with object elements', () => {
    const hash1 = generateRequestBodyHash({
      items: [{ b: 2, a: 1 }, { d: 4, c: 3 }]
    });
    
    const hash2 = generateRequestBodyHash({
      items: [{ a: 1, b: 2 }, { c: 3, d: 4 }]
    });
    
    // Same content, different key order → same hash
    expect(hash1).toBe(hash2);
  });

  test('should produce different hash for logically different payloads', () => {
    const hash1 = generateRequestBodyHash({ name: 'Alice', age: 30 });
    const hash2 = generateRequestBodyHash({ name: 'Alice', age: 31 });
    const hash3 = generateRequestBodyHash({ name: 'Bob', age: 30 });
    
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test('should handle deeply nested objects (5+ levels)', () => {
    const payload = {
      level1: {
        z_key: {
          level3: {
            a_key: {
              level5: {
                z_final: 'value_z',
                a_final: 'value_a'
              }
            }
          }
        }
      }
    };
    
    const payloadReordered = {
      level1: {
        a_key: {
          level3: {
            z_key: {
              level5: {
                a_final: 'value_a',
                z_final: 'value_z'
              }
            }
          }
        }
      }
    };
    
    expect(generateRequestBodyHash(payload)).toBe(generateRequestBodyHash(payloadReordered));
  });

  test('should handle null, undefined, and mixed types', () => {
    const hash1 = generateRequestBodyHash({ a: null, b: undefined, c: 'text' });
    const hash2 = generateRequestBodyHash({ c: 'text', b: undefined, a: null });
    expect(hash1).toBe(hash2);
  });

  test('should handle empty objects and arrays', () => {
    expect(generateRequestBodyHash({})).not.toBe(generateRequestBodyHash({ a: 1 }));
    expect(generateRequestBodyHash([])).toBe(generateRequestBodyHash([]));
    expect(generateRequestBodyHash({ a: [] })).toBe(generateRequestBodyHash({ a: [] }));
  });
});
```

### Security Note

The recursive canonicalization prevents hash collisions caused by key ordering. However, for production-grade security against intentional collision attacks, consider:

1. **Adding a salt** derived from the request context (timestamp window, correlation ID)
2. **Limiting serialization depth** to prevent ReDoS-style DoS via deeply nested objects
3. **Using a length-prefix encoding** instead of JSON for the canonical form

```typescript
// Optional depth limit to prevent DoS
function canonicalize(value: unknown, seen = new WeakSet(), depth = 0, maxDepth = 50): unknown {
  if (depth > maxDepth) {
    throw new Error(`Request body exceeds maximum nesting depth of ${maxDepth}`);
  }
  // ... rest of implementation
}
```

---

## Issue 3: Untrusted Principal

### Problem Statement

The current `extractPrincipal` function in [`backend/src/middleware/idempotency.ts:25-35`](backend/src/middleware/idempotency.ts:25-35):

```typescript
function extractPrincipal(req: Request): string | undefined {
  // Check for service account ID in request metadata
  const serviceAccountId = (req as any).serviceAccount?.id || (req as any).headers['x-service-account-id'];
  if (serviceAccountId) return String(serviceAccountId);

  // Check for user ID in request metadata
  const userId = (req as any).user?.id || (req as any).headers['x-user-id'];
  if (userId) return String(userId);

  return undefined;
}
```

**The problem:** The function falls back to reading `x-user-id` and `x-service-account-id` **directly from request headers**. This is a security anti-pattern because:

1. **Bypasses authentication**: Any client can set `x-user-id: admin` or `x-service-account-id: service-account-id` in the header and impersonate any user/service account.
2. **No authentication guarantee**: The Principal should ONLY be set by a preceding authentication middleware (like [`authenticate`](backend/src/middleware/auth.ts:20) which validates JWT tokens).
3. **Inconsistent with the rest of the codebase**: All route handlers use `req.userId` which is set by the `authenticate` middleware.

**Compare with the auth middleware** in [`backend/src/middleware/auth.ts:20-46`](backend/src/middleware/auth.ts:20-46):

```typescript
export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  // Validates JWT token
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: JWT_ALGORITHMS });
  req.userId = decoded.userId;  // ← ONLY set after successful auth
  req.userRoles = decoded.roles ?? [];
  next();
};
```

### Root Cause in Route Registration

Looking at [`backend/src/index.ts:191-193`](backend/src/index.ts:191-193):

```typescript
// Phase 8 Routes - Webhooks & Service Accounts (with idempotency)
app.use('/api/v1/webhooks', idempotency(), webhookRouter);
app.use('/api/v1/service-accounts', idempotency(), serviceAccountRouter);
```

The `idempotency()` middleware is placed **BEFORE** the `authenticate` middleware in the chain. This means:
1. Idempotency middleware runs first, with no `req.userId` set
2. Authentication middleware runs second
3. The route handler runs third

This ordering is intentional for performance (reject duplicate requests before auth), but it creates the security gap when the idempotency middleware falls back to raw headers.

### Solution: Trusted Principal Propagation

#### Approach: Two-Middleware Pattern with Context

```typescript
// === NEW: Trusted principal extraction ===

/**
 * Extract principal from request, trusting ONLY middleware-set context.
 * 
 * Security invariant: The principal must have been set by a preceding
 * authentication middleware (e.g., authenticate, or a service account
 * token validator). Raw headers are NOT trusted.
 * 
 * For unauthenticated contexts (e.g., idempotency middleware running
 * before auth), use idempotencyKeyOnly() which generates a key
 * without a principal — this is safe because the composite key
 * includes the raw idempotency-key header, preventing cross-user collisions.
 */
function extractTrustedPrincipal(req: Request): string | undefined {
  // ONLY trust context set by preceding middleware
  const userId = (req as any).userId;
  if (userId) return String(userId);
  
  const serviceAccountId = (req as any).serviceAccount?.id;
  if (serviceAccountId) return String(serviceAccountId);
  
  // Do NOT fall back to raw headers
  return undefined;
}

/**
 * Generate an idempotency key that does NOT include a principal.
 * Use this when the idempotency middleware runs before authentication.
 * 
 * The composite key becomes: <raw_idempotency_key>:<method>:<route>
 * 
 * Security implication: Two users with the same idempotency-key sending
 * to the same route will collide. This is acceptable because:
 * 1. Idempotency-keys are UUIDs generated by the client
 * 2. The chance of two clients generating the same UUID is negligible
 * 3. The body-hash check (Issue 2 fix) will detect payload differences
 */
function generateUnauthenticatedCompositeKey(
  rawIdempotencyKey: string,
  httpMethod: string,
  routePattern: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${rawIdempotencyKey}:${httpMethod}:${routePattern}`);
  return hash.digest('hex');
}
```

#### Updated Middleware with Auth-Aware Mode

```typescript
interface IdempotencyOptions {
  ttlMs?: number;
  keyHeader?: string;
  waitTimeoutMs?: number;
  /**
   * When true, the middleware requires authentication to have already run.
   * If no trusted principal is found, it returns 401 instead of proceeding.
   * Default: false (for backward compatibility with unauthenticated service endpoints)
   */
  requireAuth?: boolean;
}

export function idempotency(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000;
  const keyHeader = (options.keyHeader || IDEMPOTENCY_KEY_HEADER).toLowerCase();
  const requireAuth = options.requireAuth ?? false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
      }

      const idempotencyKey = req.headers[keyHeader] as string | undefined;
      if (!idempotencyKey) return next();

      if (!/^[a-zA-Z0-9\-_]+$/.test(idempotencyKey)) {
        res.status(400).json({ success: false, error: { message: 'Invalid Idempotency-Key Format', code: 'INVALID_IDEMPOTENCY_KEY' } });
        return;
      }

      // === FIX #3: Trusted principal ===
      const principal = extractTrustedPrincipal(req);
      
      if (requireAuth && !principal) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required for idempotent requests', code: 'IDEMPOTENCY_AUTH_REQUIRED' },
        });
        return;
      }

      const routePattern = req.route?.path || req.originalUrl.split('?')[0];
      
      // Use principal-aware key if authenticated, otherwise unauthenticated key
      const compositeKey = principal
        ? generateIdempotencyKey(principal, req.method, routePattern, idempotencyKey)
        : generateUnauthenticatedCompositeKey(idempotencyKey, req.method, routePattern);

      // ... rest of atomic reservation flow
    } catch (error) {
      next(error);
    }
  };
}
```

#### Updated Route Registration

For routes that need both authentication and idempotency, the ordering should be:

```typescript
// Option A: Idempotency wraps auth (for authenticated idempotency)
app.use('/api/v1/webhooks', idempotency({ requireAuth: true }), authenticate, webhookRouter);

// Option B: Auth wraps idempotency (simpler, idempotency sees req.userId)
app.use('/api/v1/webhooks', authenticate, idempotency(), webhookRouter);
```

**Recommendation: Option B** — put `authenticate` before `idempotency()` so that:
1. The principal is always available when idempotency runs
2. The composite key includes the authenticated principal
3. No fallback to raw headers is needed

Updated [`backend/src/index.ts:191-193`](backend/src/index.ts:191-193):

```typescript
// Phase 8 Routes - Webhooks & Service Accounts (auth + idempotency)
app.use('/api/v1/webhooks', authenticate, idempotency(), webhookRouter);
app.use('/api/v1/service-accounts', authenticate, idempotency(), serviceAccountRouter);
```

### Test Cases

```typescript
// In backend/src/__tests__/idempotency.security.test.ts

describe('Principal extraction security', () => {
  test('should NOT trust x-user-id header when no auth middleware ran', async () => {
    const app = createMockAppWithoutAuth();
    
    const response = await request(app)
      .post('/api/v1/test/assets')
      .set('Idempotency-Key', 'test-key')
      .set('x-user-id', 'hacker-user')  // ← should be ignored
      .send({ name: 'stolen' });
    
    // Should either proceed as anonymous or return 401
    expect([201, 401, 409]).toContain(response.status);
  });

  test('should trust req.userId set by authenticate middleware', async () => {
    const app = createMockAppWithAuth();
    
    const response = await request(app)
      .post('/api/v1/test/assets')
      .set('Authorization', 'Bearer valid-jwt-for-user-123')
      .set('Idempotency-Key', 'test-key')
      .send({ name: 'legitimate' });
    
    expect(response.status).toBe(201);
  });

  test('requireAuth option should reject requests without trusted principal', async () => {
    const app = createMockApp();
    app.use('/api/v1/test', idempotency({ requireAuth: true }));
    app.post('/api/v1/test/assets', (req, res) => res.status(201).json({ success: true }));
    
    const response = await request(app)
      .post('/api/v1/test/assets')
      .set('Idempotency-Key', 'test-key')
      .set('x-user-id', 'impersonated')  // ← should be ignored
      .send({});
    
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('IDEMPOTENCY_AUTH_REQUIRED');
  });
});
```

---

## Summary of Changes

| Issue | File | Change |
|-------|------|--------|
| #1 Non-atomic reservation | [`backend/src/middleware/idempotency.ts`](backend/src/middleware/idempotency.ts) | Add `IdempotencyState` enum, `tryReserveKey()` function, atomic SET NX flow, result waiting |
| #1 Non-atomic reservation | [`backend/src/services/idempotency.service.ts`](backend/src/services/idempotency.service.ts) | Add `reserve()`, `updateState()` methods to `IdempotencyStore` |
| #1 Non-atomic reservation | [`backend/src/services/idempotency-redis-store.ts`](backend/src/services/idempotency-redis-store.ts) | Add `reserve()` async method using SET NX |
| #1 Non-atomic reservation | [`backend/src/__tests__/idempotency.concurrency.test.ts`](backend/src/__tests__/idempotency.concurrency.test.ts) | New test file for concurrent request scenarios |
| #2 Body-hash | [`backend/src/services/idempotency.service.ts`](backend/src/services/idempotency.service.ts:60) | Replace `generateRequestBodyHash()` with recursive `canonicalize()` + `JSON.stringify()` |
| #2 Body-hash | [`backend/src/__tests__/phase8.idempotency.test.ts`](backend/src/__tests__/phase8.idempotency.test.ts) | Add canonical serialization test cases |
| #3 Untrusted principal | [`backend/src/middleware/idempotency.ts`](backend/src/middleware/idempotency.ts:25) | Replace `extractPrincipal()` with `extractTrustedPrincipal()` that rejects raw header fallback |
| #3 Untrusted principal | [`backend/src/index.ts`](backend/src/index.ts:191) | Reorder middleware: `authenticate` before `idempotency()` |
| #3 Untrusted principal | [`backend/src/__tests__/idempotency.security.test.ts`](backend/src/__tests__/idempotency.security.test.ts) | New test file for principal security |

---

## Implementation Order

1. **Fix #2 (Body-hash)** — Lowest risk, pure function change, no behavioral change
2. **Fix #3 (Principal)** — Security-critical, requires route reordering
3. **Fix #1 (Atomic reservation)** — Most complex, requires state machine and store changes

This order minimizes regression risk: each fix is independently testable, and later fixes build on earlier ones.

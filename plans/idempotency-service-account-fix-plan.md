# Production-Ready Idempotency & Service Account Fix Plan

## Executive Summary

Two critical production-release blockers must be fixed:

1. **Idempotency shares namespace across clients** — `requireTrustedPrincipal: false` causes all authenticated clients to share the same `anonymous`-prefixed idempotency key. Additionally, Redis SET NX runs AFTER `next()`, allowing concurrent instances to execute the same operation.

2. **Service accounts are in-memory only** — The `Map` storage means restarts wipe all accounts, multiple instances see different accounts, and there is no Bearer token auth middleware.

---

## Issue 1: Idempotency — Root Cause Analysis

### Current Broken Flow

In [`backend/src/index.ts:195-196`](backend/src/index.ts:195):
```typescript
app.use('/api/v1/webhooks', idempotency({ requireTrustedPrincipal: false }), webhookRouter);
app.use('/api/v1/service-accounts', idempotency({ requireTrustedPrincipal: false }), serviceAccountRouter);
```

When `requireTrustedPrincipal: false`:
- No auth middleware runs before idempotency
- [`extractTrustedPrincipal()`](backend/src/middleware/idempotency.ts:60) returns `undefined`
- [`generateIdempotencyKey()`](backend/src/services/idempotency.service.ts:51) falls back to `'anonymous'`:
  ```typescript
  const safePrincipal = principal || 'anonymous';
  ```
- Result: `sha256("anonymous:POST:/api/v1/...:key")` — ALL clients share the same namespace

### Race Condition

In [`backend/src/middleware/idempotency.ts:270-375`](backend/src/middleware/idempotency.ts:270):

```
1. Map.set(compositeKey, pending)          ← Line 271 (local only)
2. next()                                  ← Line 375 (handler executes NOW)
3. captureJson → storeIdempotencyResponseDual()  ← Line 307 (Redis SET happens LATER)
```

**Two backend instances both pass step 1** (different process Maps), both execute `next()`, and both run the business operation before either writes to Redis.

### Required Fix Flow

```
1. Check Redis for existing completed entry → if found: return cached response
2. Redis SET key "pending" NX EX ttl         ← Distributed atomic reservation BEFORE operation
3. If SET returns null (loser): wait for winner's result promise
4. If SET returns OK (winner):
   a. Map.set(pending)
   b. next() → handler executes
   c. captureJson → Redis SET key "completed" (overwrite pending)
```

---

## Issue 2: Service Account — Root Cause Analysis

### Current Broken State

In [`backend/src/routes/serviceAccount.routes.ts:25`](backend/src/routes/serviceAccount.routes.ts:25):
```typescript
const serviceAccounts = new Map<string, ServiceAccountRecord>();
```

Problems:
1. **Restart = data loss** — Map is re-initialized on every server start
2. **Multi-instance = split brain** — Each instance has its own Map
3. **No Bearer auth middleware** — [`auth.ts`](backend/src/middleware/auth.ts:20) only handles JWT user tokens
4. **`/auth` endpoint is "for testing"** — Line 117: `POST /api/v1/service-accounts/auth`

### Required Fix

1. Create Prisma model for `ServiceAccount` (persistent storage)
2. Create `authenticateServiceAccount` middleware in `middleware/serviceAccountAuth.ts`
3. Update all service account routes to use Prisma + new auth middleware
4. Remove `requireTrustedPrincipal: false` from index.ts

---

## Implementation Plan

### Phase A: Idempotency Middleware Fix

#### File: `backend/src/middleware/idempotency.ts`

**Change 1: Redis SET NX BEFORE `next()`**

Restructure the middleware flow:

```typescript
// 1. Check for existing completed response in Redis
const existingEntry = await redisClient?.get(compositeKey);
if (existingEntry) {
  res.set('X-Idempotency-Cache', 'hit');
  res.status(existingEntry.data.response.status).json(existingEntry.data.response.body);
  return;
}

// 2. Try atomic Redis SET NX (distributed reservation)
const reservationSuccessful = await redisClient?.set(compositeKey, pendingEntry, { NX: true, EX: ttlSeconds });
if (reservationSuccessful === false) {
  // Loser: another instance won the race
  // Wait for their result promise or return 425
  res.status(425).json({
    error: { message: 'Idempotency key reservation contested', code: 'IDEMPOTENCY_RESERVATION_CONTESTED' }
  });
  return;
}

// 3. Winner: proceed with operation
inFlightReservations.set(compositeKey, reservation);
// ... capture response setup ...
next();  // Operation executes HERE, after Redis reservation
```

**Change 2: Remove `requireTrustedPrincipal: false` support**

- Change default to `requireTrustedPrincipal: true` (already the default)
- Remove the `requireTrustedPrincipal: false` option entirely
- Webhooks and service accounts MUST have a principal set by auth middleware

**Change 3: Proper principal handling**

- When `principal` is `undefined` and `requireTrustedPrincipal` is true → return 401
- Never fall back to `'anonymous'` — this is the security fix

#### File: `backend/src/services/idempotency-redis-client.ts`

**Add: `reserve()` method**

```typescript
async reserve(key: string, ttlSeconds: number): Promise<'won' | 'lost'> {
  // SET key "pending" NX EX ttlSeconds
  // Returns 'won' if SET succeeded, 'lost' if key already existed
  const result = await this.client.set(redisKey, 'pending', { NX: true, EX: ttlSeconds });
  return result === 'OK' ? 'won' : 'lost';
}
```

**Add: `storeResponse()` method** (overwrite pending with completed)

```typescript
async storeResponse(key: string, entry: IdempotencyEntry): Promise<void> {
  // SET key <serialized_entry> XX EX ttlSeconds
  // Overwrites pending with completed response
  await this.client.set(redisKey, serialized, { XX: true, EX: ttlSeconds });
}
```

### Phase B: Service Account Persistent Store + Auth

#### File: `backend/prisma/schema.prisma`

**Add ServiceAccount model:**

```prisma
model ServiceAccount {
  id                String   @id @default(cuid())
  displayId         String   @unique @map("display_id")
  name              String
  description       String?
  userId            String?  @map("user_id")
  accessTokenHash   String   @map("access_token_hash")
  accessTokenSalt   String   @map("access_token_salt")
  scopes            String[] @db.Text
  expiresAt         DateTime? @map("expires_at")
  isActive          Boolean  @default(true) @map("is_active")
  isArchived        Boolean  @default(false) @map("is_archived")
  lastUsedAt        DateTime? @map("last_used_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@map("service_accounts")
}
```

#### File: `backend/src/middleware/serviceAccountAuth.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import crypto from 'crypto';

export interface ServiceAccountRequest extends Request {
  serviceAccount?: {
    id: string;
    displayId: string;
    name: string;
    scopes: string[];
  };
}

export async function authenticateServiceAccount(
  req: ServiceAccountRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Authentication required', code: 'MISSING_BEARER_TOKEN' } });
    return;
  }

  const token = authHeader.slice(7);
  const salt = process.env.SERVICE_ACCOUNT_TOKEN_SALT || '';

  // Hash the incoming token with salt for lookup
  const tokenHash = crypto.createHash('sha256').update(`${token}${salt}`).digest('hex');

  // Find service account by accessTokenHash
  const account = await prisma.serviceAccount.findFirst({
    where: {
      accessTokenHash: tokenHash,
      isActive: true,
      isArchived: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      displayId: true,
      name: true,
      scopes: true,
    },
  });

  if (!account) {
    res.status(401).json({ error: { message: 'Invalid service account token', code: 'INVALID_TOKEN' } });
    return;
  }

  // Update last used time
  await prisma.serviceAccount.update({
    where: { id: account.id },
    data: { lastUsedAt: new Date() },
  });

  req.serviceAccount = account;
  next();
}
```

#### File: `backend/src/routes/serviceAccount.routes.ts`

**Changes:**
1. Replace `Map` with Prisma queries
2. Add `authenticateServiceAccount` middleware to protected routes
3. Remove `/auth` endpoint (or mark as deprecated with migration note)
4. Use `ServiceAccountRequest` type

#### File: `backend/src/index.ts`

**Changes:**
1. Remove `requireTrustedPrincipal: false` from both routes
2. Add `authenticateServiceAccount` middleware to service account routes
3. For webhooks: add webhook-specific auth (webhook signing key or webhook service account)

```typescript
// BEFORE (broken):
app.use('/api/v1/webhooks', idempotency({ requireTrustedPrincipal: false }), webhookRouter);
app.use('/api/v1/service-accounts', idempotency({ requireTrustedPrincipal: false }), serviceAccountRouter);

// AFTER (fixed):
app.use('/api/v1/service-accounts', authenticateServiceAccount, idempotency(), serviceAccountRouter);
app.use('/api/v1/webhooks', authenticateWebhook, idempotency(), webhookRouter);
```

### Phase C: Webhook Authentication

Webhooks need their own authentication. Options:
1. **Webhook signing secret** — HMAC signature verification
2. **Webhook service account** — Use a dedicated service account with `webhooks:write` scope

Recommend option 2 for consistency with the service account architecture.

Create `backend/src/middleware/webhookAuth.ts`:
```typescript
export async function authenticateWebhook(req: Request, res: Response, next: NextFunction) {
  // Option: Use a webhook service account
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Webhook authentication required' } });
    return;
  }
  // Validate against a webhook-specific service account
  // Set req.serviceAccount.id for idempotency principal
  next();
}
```

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | MODIFY | Add ServiceAccount model |
| `backend/src/middleware/idempotency.ts` | MODIFY | Redis SET NX before next(), remove anonymous fallback |
| `backend/src/services/idempotency-redis-client.ts` | MODIFY | Add reserve() and storeResponse() methods |
| `backend/src/middleware/serviceAccountAuth.ts` | NEW | Bearer token auth middleware for service accounts |
| `backend/src/middleware/webhookAuth.ts` | NEW | Webhook authentication middleware |
| `backend/src/routes/serviceAccount.routes.ts` | MODIFY | Prisma queries + auth middleware |
| `backend/src/routes/webhook.routes.ts` | MODIFY | Add webhook auth middleware |
| `backend/src/index.ts` | MODIFY | Remove requireTrustedPrincipal:false, add auth middlewares |
| `backend/src/services/auth.service.ts` | MODIFY | Add service account CRUD methods |

---

## Production Readiness Checklist

- [ ] Redis SET NX happens BEFORE `next()` (no race condition)
- [ ] Each principal has isolated idempotency namespace (no 'anonymous' fallback)
- [ ] Service accounts persisted to database ( survives restarts)
- [ ] Service accounts shared across instances (database, not Map)
- [ ] Bearer token auth middleware for service accounts
- [ ] Bearer token auth middleware for webhooks
- [ ] `/auth` endpoint removed or deprecated
- [ ] Multiple backend instances share same service accounts
- [ ] Idempotency works across multiple backend instances (Redis distributed)
- [ ] All existing tests pass with new behavior

/**
 * Service Account Routes
 * 
 * Production-ready service account management with:
 * - Prisma/PostgreSQL persistence (no more in-memory Map)
 * - Bearer token authentication middleware
 * - Proper token hashing with server-side salt
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { secureCompare } from '../utils/secureCompare';
import rateLimit from 'express-rate-limit';
import { validateBody, validateParams } from '../middleware/validation';
import { z } from 'zod';
import { rotateServiceAccountToken } from '../services/serviceAccountTokenRotation';

// ==================== Management Router ====================
// Protected by authenticate + authorize('admin') middleware applied in index.ts
// Middleware order: authenticate → authorize → idempotency → managementRouter
const managementRouter = Router();

// ==================== Auth Router (unprotected) ====================
// POST /auth is the service account token verification endpoint — it must NOT
// require admin authentication; it performs its own token lookup & verification.
const authRouter = Router();

const serviceAccountNameSchema = z.string().trim().min(1).max(100);
const scopeSchema = z.string().trim().min(1).max(100).regex(/^[a-z][a-z0-9-]*:(?:[a-z][a-z0-9-]*|\*)$/i);
const accountIdSchema = z.object({ id: z.string().uuid() }).strict();
const createServiceAccountSchema = z.object({
  name: serviceAccountNameSchema,
  description: z.string().trim().max(1_000).optional(),
  userId: z.string().uuid().optional(),
  scopes: z.array(scopeSchema).max(50).default([]),
  expiresAt: z.coerce.date().refine((date) => date > new Date(), 'expiresAt must be in the future').optional(),
}).strict();
const updateServiceAccountSchema = z.object({
  name: serviceAccountNameSchema.optional(),
  description: z.string().trim().max(1_000).nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  scopes: z.array(scopeSchema).max(50).optional(),
  expiresAt: z.coerce.date().refine((date) => date > new Date(), 'expiresAt must be in the future').nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required');
// Keep credential failures indistinguishable: a syntactically invalid token must
// reach the authentication handler and receive the same 401 response class as a
// revoked or incorrect credential. Only bound its size before hash processing.
const authenticateServiceAccountSchema = z.object({ accessToken: z.string().max(512) }).strict();

const serviceAccountAuthRateLimiter = rateLimit({
  windowMs: Number(process.env.SERVICE_ACCOUNT_AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: () => Number(process.env.SERVICE_ACCOUNT_AUTH_RATE_LIMIT_MAX || 60),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many service account authentication attempts. Please try again later.', code: 'RATE_LIMITED' } },
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_SERVICE_ACCOUNT_RATE_LIMIT_IN_TESTS !== 'true',
});

// ==================== Shared helpers ====================

/**
 * Parse scopes from JSON field
 */
function parseScopes(scopes: unknown): string[] {
  if (Array.isArray(scopes)) {
    return scopes.filter(s => typeof s === 'string');
  }
  return [];
}

/**
 * Generate a new access token for a service account.
 *
 * Token format: svc_${id}_${randomBytes(32).toString('base64url')}
 * The UUID in the token is the database id (not displayId), enabling ID-based lookup.
 * Returns token, hash, and salt.
 */
function generateAccessToken(
  id: string = crypto.randomUUID(),
  rotationId: string = crypto.randomBytes(4).toString('hex')
): { token: string; hash: string; salt: string; id: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const token = `svc_${id}_${rotationId}_${crypto.randomBytes(32).toString('base64url')}`;
  const combined = `${token}${salt}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return { token, hash, salt, id };
}

/**
 * Extract the account UUID from a service account token.
 * Token format: svc_<uuid>_<rotationId>_<random>
 *        legacy: svc_<uuid>_<random>
 * Returns the UUID part or null if token format is invalid.
 */
function extractAccountUuidFromToken(token: string): string | null {
  const parts = token.split('_');
  // UUIDs contain hyphens (not underscores), so splitting by '_' gives clean parts
  if (parts.length >= 3) {
    // Validate it looks like a proper UUID (8-4-4-4-12 pattern)
    const uuid = parts[1];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      return uuid;
    }
  }
  return null;
}

// ==================== Management Routes ====================

/**
 * GET /api/v1/service-accounts - List service accounts
 * Requires: admin authentication + serviceaccounts:read scope
 */
managementRouter.get(
  '/',
  async (_req: Request, res: Response, next: any) => {
    try {
      const accounts = await prisma.serviceAccount.findMany({
        where: {
          isArchived: false,
        },
        select: {
          id: true,
          displayId: true,
          name: true,
          description: true,
          userId: true,
          scopes: true,
          expiresAt: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        data: accounts.map((account: {
          id: string;
          displayId: string;
          name: string;
          description: string | null;
          userId: string | null;
          scopes: unknown;
          expiresAt: Date | null;
          isActive: boolean;
          lastUsedAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }) => ({
          ...account,
          scopes: parseScopes(account.scopes),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/service-accounts - Create service account
 * Requires: admin authentication + serviceaccounts:write scope
 */
managementRouter.post(
  '/',
  validateBody(createServiceAccountSchema),
  async (_req: Request, res: Response, next: any) => {
    try {
      const { name, description, userId, scopes = [], expiresAt } = _req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          error: 'Validation Error',
          message: 'name is required and must be a string',
        });
        return;
      }

      // Generate token with random salt — produce the DB UUID first
      const { token, hash, salt, id: accountUuid } = generateAccessToken();

      // Generate displayId in SVC-xxxx format
      // Query the next sequential number to avoid unique constraint violations
      const lastAccount = await prisma.serviceAccount.findFirst({
        where: { isArchived: false },
        orderBy: { displayId: 'desc' },
        select: { displayId: true },
      });

      let displayId = 'SVC-0001';
      if (lastAccount?.displayId && /^SVC-\d{4}$/.test(lastAccount.displayId)) {
        const num = parseInt(lastAccount.displayId.split('-')[1], 10) + 1;
        displayId = `SVC-${String(num).padStart(4, '0')}`;
      }

      const account = await prisma.serviceAccount.create({
        data: {
          id: accountUuid,            // store the same UUID that is embedded in the token
          displayId,
          name,
          description: description || undefined,
          userId: userId || undefined,
          scopes: scopes as string[],
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          accessTokenHash: hash,
          accessTokenSalt: salt,
          isActive: true,
          isArchived: false,
        },
        select: {
          id: true,
          displayId: true,
          name: true,
          description: true,
          userId: true,
          scopes: true,
          expiresAt: true,
          isActive: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json({
        data: {
          ...account,
          scopes: parseScopes(account.scopes),
        },
        accessToken: token, // WARNING: Only returned once!
      });
    } catch (error: any) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/service-accounts/:id - Get service account
 * Requires: admin authentication + serviceaccounts:read scope
 */
managementRouter.get(
  '/:id',
  validateParams(accountIdSchema),
  async (req: Request, res: Response, next: any) => {
    try {
      const account = await prisma.serviceAccount.findFirst({
        where: {
          id: req.params.id,
          isArchived: false,
        },
        select: {
          id: true,
          displayId: true,
          name: true,
          description: true,
          userId: true,
          scopes: true,
          expiresAt: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!account) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Service account not found',
        });
        return;
      }

      res.json({
        data: {
          ...account,
          scopes: parseScopes(account.scopes),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/service-accounts/:id - Update service account
 * Requires: admin authentication + serviceaccounts:write scope
 */
managementRouter.patch(
  '/:id',
  validateParams(accountIdSchema),
  validateBody(updateServiceAccountSchema),
  async (req: Request, res: Response, next: any) => {
    try {
      const existing = await prisma.serviceAccount.findFirst({
        where: {
          id: req.params.id,
          isArchived: false,
        },
      });

      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Service account not found',
        });
        return;
      }

      const { name, description, userId, scopes, expiresAt, isActive } = req.body;

      const updated = await prisma.serviceAccount.update({
        where: { id: req.params.id },
        data: {
          name: name !== undefined ? name : undefined,
          description: description !== undefined ? description : undefined,
          userId: userId !== undefined ? userId : undefined,
          scopes: scopes !== undefined ? (scopes as string[]) : undefined, // Fix 6: Prisma JSON field expects array directly
          expiresAt: expiresAt !== undefined ? expiresAt : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          displayId: true,
          name: true,
          description: true,
          userId: true,
          scopes: true,
          expiresAt: true,
          isActive: true,
          isArchived: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        data: {
          ...updated,
          scopes: parseScopes(updated.scopes),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/service-accounts/:id - Soft delete service account
 * Requires: admin authentication + serviceaccounts:write scope
 */
managementRouter.delete(
  '/:id',
  validateParams(accountIdSchema),
  async (req: Request, res: Response, next: any) => {
    try {
      const existing = await prisma.serviceAccount.findFirst({
        where: {
          id: req.params.id,
          isArchived: false,
        },
      });

      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Service account not found',
        });
        return;
      }

      await prisma.serviceAccount.update({
        where: { id: req.params.id },
        data: {
          isArchived: true,
          updatedAt: new Date(),
        },
      });

      res.json({
        data: { id: req.params.id, deleted: true },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/service-accounts/:id/regenerate-token - Regenerate access token
 * Requires: admin authentication + serviceaccounts:write scope
 *
 * IMPORTANT: This invalidates the old token and issues a new one.
 * The new token is only returned ONCE!
 */
managementRouter.post(
  '/:id/regenerate-token',
  validateParams(accountIdSchema),
  async (req: Request, res: Response, next: any) => {
    try {
      const existing = await prisma.serviceAccount.findFirst({
        where: {
          id: req.params.id,
          isArchived: false,
        },
      });

      if (!existing) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Service account not found',
        });
        return;
      }

      // Generate new token with NEW salt + NEW rotation epoch (better security)
      const rotation = rotateServiceAccountToken();
      const { token, hash, salt, id } = generateAccessToken(existing.id, rotation.rotationId);

      await prisma.serviceAccount.update({
        where: { id: req.params.id },
        data: {
          accessTokenHash: hash,
          accessTokenSalt: salt,
          tokenRotationId: rotation.rotationId,
          previousTokenRotationId: rotation.previousRotationId,
          tokenRotationValidUntil: rotation.validUntil,
          updatedAt: new Date(),
        },
      });

      res.json({
        data: { id },
        accessToken: token, // WARNING: Only returned once!
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/service-accounts/:id/tokens - Get service account token info (masked)
 * Requires: admin authentication + serviceaccounts:read scope
 */
managementRouter.get(
  '/:id/tokens',
  validateParams(accountIdSchema),
  async (req: Request, res: Response, next: any) => {
    try {
      const account = await prisma.serviceAccount.findFirst({
        where: {
          id: req.params.id,
          isArchived: false,
        },
        select: {
          id: true,
          displayId: true,
          isActive: true,
          expiresAt: true,
          lastUsedAt: true,
          scopes: true,
        },
      });

      if (!account) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Service account not found',
        });
        return;
      }

      res.json({
        data: {
          ...account,
          scopes: parseScopes(account.scopes),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== Auth Route (unprotected - performs its own token verification) ====================

/**
 * POST /api/v1/service-accounts/auth - Authenticate service account
 *
 * This endpoint is the primary authentication method for service account Bearer token validation.
 * It is intentionally UNPROTECTED — it performs its own token lookup & verification.
 *
 * Request: { "accessToken": "svc_..." }
 * Response: { "success": true, "data": { id, displayId, name, scopes } }
 */
authRouter.post(
  '/',
  serviceAccountAuthRateLimiter,
  validateBody(authenticateServiceAccountSchema),
  async (req: Request, res: Response, next: any) => {
    try {
      const { accessToken } = req.body;

      if (!accessToken || typeof accessToken !== 'string') {
        res.status(400).json({
          error: 'Validation Error',
          message: 'accessToken is required',
        });
        return;
      }

      // Extract the UUID from the token — it is now the DB id
      const accountUuid = extractAccountUuidFromToken(accessToken);
      if (!accountUuid) {
        res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid token format',
        });
        return;
      }

      // Look up the account by id (the UUID embedded in the token)
      const account = await prisma.serviceAccount.findFirst({
        where: {
          id: accountUuid,
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
          accessTokenSalt: true,
          accessTokenHash: true,
        },
      });

      if (!account) {
        res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid access token',
        });
        return;
      }

      // Verify using stored salt (constant-time comparison to avoid timing side channels)
      const computedHash = crypto
        .createHash('sha256')
        .update(`${accessToken}${account.accessTokenSalt}`)
        .digest('hex');

      if (!secureCompare(computedHash, account.accessTokenHash)) {
        res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid access token',
        });
        return;
      }

      // Update lastUsedAt
      await prisma.serviceAccount.update({
        where: { id: account.id },
        data: { lastUsedAt: new Date() },
      });

      res.json({
        success: true,
        data: {
          id: account.id,
          displayId: account.displayId,
          name: account.name,
          scopes: parseScopes(account.scopes),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export const serviceAccountRouter = managementRouter;
export const serviceAccountAuthRouter = authRouter;

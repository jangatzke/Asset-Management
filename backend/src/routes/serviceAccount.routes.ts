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
import { requireScopes } from '../middleware/apiScopes';
import { authenticateServiceAccount } from '../middleware/serviceAccountAuth';

const router = Router();

// All routes require service account authentication
router.use(authenticateServiceAccount);

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
 * Returns token, hash, and salt.
 */
function generateAccessToken(): { token: string; hash: string; salt: string } {
  const uuid = crypto.randomUUID();
  const salt = crypto.randomBytes(32).toString('hex');
  const token = `${process.env.SERVICE_ACCOUNT_PREFIX || 'svc'}_${uuid}_${Date.now()}`;
  const combined = `${token}${salt}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return { token, hash, salt };
}

/**
 * Extract the account UUID from a service account token.
 * Token format: svc_<uuid>_<timestamp>
 * Returns the UUID part or null if token format is invalid.
 */
function extractAccountUuidFromToken(token: string): string | null {
  const parts = token.split('_');
  // Expected format: ['svc', '<uuid>', '<timestamp>']
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

// ==================== Service Account Routes ====================

/**
 * GET /api/v1/service-accounts - List service accounts
 * Requires: serviceaccounts:read scope
 */
router.get(
  '/',
  requireScopes('serviceaccounts:read'),
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
 * Requires: serviceaccounts:write scope
 */
router.post(
  '/',
  requireScopes('serviceaccounts:write'),
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

      // Generate token with random salt
      const { token, hash, salt } = generateAccessToken();

      // Generate displayId in SVC-xxxx format (Fix 7)
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
          displayId,
          name,
          description: description || undefined,
          userId: userId || undefined,
          scopes: scopes as string[], // Fix 6: Prisma JSON field expects array directly, not JSON.stringify()
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
 * Requires: serviceaccounts:read scope
 */
router.get(
  '/:id',
  requireScopes('serviceaccounts:read'),
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
 * Requires: serviceaccounts:write scope
 */
router.patch(
  '/:id',
  requireScopes('serviceaccounts:write'),
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
          name: name || undefined,
          description: description !== undefined ? description : undefined,
          userId: userId !== undefined ? userId : undefined,
          scopes: scopes !== undefined ? (scopes as string[]) : undefined, // Fix 6: Prisma JSON field expects array directly
          expiresAt: expiresAt !== undefined ? new Date(expiresAt) : undefined,
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
 * Requires: serviceaccounts:write scope
 */
router.delete(
  '/:id',
  requireScopes('serviceaccounts:write'),
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
 * Requires: serviceaccounts:write scope
 * 
 * IMPORTANT: This invalidates the old token and issues a new one.
 * The new token is only returned ONCE!
 */
router.post(
  '/:id/regenerate-token',
  requireScopes('serviceaccounts:write'),
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

      // Generate new token with NEW salt (better security)
      const { token, hash, salt } = generateAccessToken();

      await prisma.serviceAccount.update({
        where: { id: req.params.id },
        data: {
          accessTokenHash: hash,
          accessTokenSalt: salt,
          updatedAt: new Date(),
        },
      });

      res.json({
        data: { id: req.params.id },
        accessToken: token, // WARNING: Only returned once!
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/service-accounts/:id/tokens - Get service account token info (masked)
 * Requires: serviceaccounts:read scope
 */
router.get(
  '/:id/tokens',
  requireScopes('serviceaccounts:read'),
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

/**
 * POST /api/v1/service-accounts/auth - Authenticate service account
 * 
 * This endpoint is NO LONGER "for testing" - it's the primary authentication
 * method for service account Bearer token validation.
 * 
 * Request: { "accessToken": "svc_..." }
 * Response: { "success": true, "data": { id, displayId, name, scopes } }
 */
router.post(
  '/auth',
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

      // Extract the UUID from the token for lookup
      const accountUuid = extractAccountUuidFromToken(accessToken);
      if (!accountUuid) {
        res.status(401).json({
          error: 'Authentication Failed',
          message: 'Invalid token format',
        });
        return;
      }

      // Look up the account by displayId (UUID)
      const account = await prisma.serviceAccount.findFirst({
        where: {
          displayId: accountUuid,
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

      // Verify using stored salt
      const computedHash = crypto
        .createHash('sha256')
        .update(`${accessToken}${account.accessTokenSalt}`)
        .digest('hex');

      if (computedHash !== account.accessTokenHash) {
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

export const serviceAccountRouter = router;

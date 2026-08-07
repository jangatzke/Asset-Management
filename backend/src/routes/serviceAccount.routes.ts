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
 * Serialize scopes for JSON storage
 */
function serializeScopes(scopes: string[]): string {
  return JSON.stringify(scopes);
}
/**
 * Generate a new access token for a service account.
 */
function generateAccessToken(): { token: string; hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString('hex');
  const token = `${process.env.SERVICE_ACCOUNT_PREFIX || 'svc'}_${crypto.randomUUID()}_${Date.now()}`;
  const combined = `${token}${salt}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return { token, hash, salt };
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

      const account = await prisma.serviceAccount.create({
        data: {
          name,
          description: description || undefined,
          userId: userId || undefined,
          scopes: serializeScopes(scopes as string[]),
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
          scopes: scopes !== undefined ? serializeScopes(scopes as string[]) : undefined,
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

      // Extract salt from environment
      const envSalt = process.env.SERVICE_ACCOUNT_TOKEN_SALT || '';

      // Hash the incoming token with env salt
      const tokenHash = crypto
        .createHash('sha256')
        .update(`${accessToken}${envSalt}`)
        .digest('hex');

      // Find matching service account in Prisma
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

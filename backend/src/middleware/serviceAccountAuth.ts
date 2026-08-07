/**
 * Service Account Bearer Token Authentication Middleware
 *
 * Validates Bearer tokens against the persisted ServiceAccount model in Prisma.
 * This replaces the in-memory Map-based approach and provides:
 * - Persistence across restarts
 * - Shared state across multiple backend instances
 * - Proper Bearer token authentication (not /auth endpoint)
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';

export interface ServiceAccountRequest extends Request {
  serviceAccount?: {
    id: string;
    displayId: string;
    name: string;
    scopes: string[];
  };
}

/**
 * Authenticate a service account from a Bearer token.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Hash the token with server-side salt
 * 3. Look up the service account by hashed token in Prisma
 * 4. Validate account is active and not expired
 * 5. Set req.serviceAccount for downstream middleware/routes
 */
export async function authenticateServiceAccount(
  req: ServiceAccountRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Authentication required',
        code: 'MISSING_BEARER_TOKEN',
        hint: 'Send a valid Bearer token in the Authorization header',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  if (!token || token.length < 10) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid service account token',
        code: 'INVALID_TOKEN',
      },
    });
    return;
  }

  // Extract the UUID from the token for lookup
  // Token format: svc_<uuid>_<timestamp>
  const parts = token.split('_');
  // UUIDs contain hyphens (not underscores), so splitting by '_' gives ['svc', '<uuid>', '<timestamp>']
  const accountUuid = parts.length >= 3 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1])
    ? parts[1]
    : null;

  if (!accountUuid) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token format',
        code: 'INVALID_TOKEN',
      },
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
      success: false,
      error: {
        message: 'Invalid or expired service account token',
        code: 'INVALID_TOKEN',
      },
    });
    return;
  }

  // Verify using stored salt
  const computedHash = crypto.createHash('sha256').update(`${token}${account.accessTokenSalt}`).digest('hex');
  if (computedHash !== account.accessTokenHash) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired service account token',
        code: 'INVALID_TOKEN',
      },
    });
    return;
  }

  // Update last used timestamp
  await prisma.serviceAccount.update({
    where: { id: account.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {
    // Best-effort: don't fail the request if update fails
  });

  // Parse scopes from JSON (Prisma stores as Json)
  const rawAccount = await prisma.serviceAccount.findUnique({
    where: { id: account.id },
    select: { scopes: true },
  });

  let scopes: string[] = account.scopes as unknown as string[];
  if (rawAccount && typeof rawAccount.scopes === 'string') {
    try {
      scopes = JSON.parse(rawAccount.scopes);
    } catch {
      scopes = [];
    }
  } else if (Array.isArray(rawAccount?.scopes)) {
    scopes = rawAccount.scopes as string[];
  }

  req.serviceAccount = {
    ...account,
    scopes,
  };

  // Set serviceAccountScopes so that requireScopes() can read them
  // (requireScopes() looks at req.serviceAccountScopes, not req.serviceAccount.scopes)
  (req as ServiceAccountRequest & { serviceAccountScopes?: string[] }).serviceAccountScopes = scopes;

  next();
}

/**
 * Require specific scopes for service account authentication.
 * Returns a middleware that checks if the authenticated service account
 * has at least one of the required scopes.
 */
export function requireServiceAccountScopes(...requiredScopes: string[]) {
  return (req: ServiceAccountRequest, res: Response, next: NextFunction): void => {
    if (!req.serviceAccount) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Service account authentication required',
          code: 'MISSING_AUTH',
        },
      });
      return;
    }

    const accountScopes = req.serviceAccount.scopes as string[];
    const hasScope = requiredScopes.some(scope =>
      accountScopes.includes(scope)
    );

    if (!hasScope) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient scopes',
          code: 'INSUFFICIENT_SCOPES',
          required: requiredScopes,
          granted: accountScopes,
        },
      });
      return;
    }

    next();
  };
}

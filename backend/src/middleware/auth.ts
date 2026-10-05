import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt, { Algorithm } from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

const JWT_ALGORITHMS: Algorithm[] = ['HS256'];

/**
 * Generate a random hex string of the specified byte length.
 */
function generateRandomHex(byteLength: number): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * JWT secret configuration status.
 */
export interface JwtSecretStatus {
  /** Whether a strong secret is configured */
  strong: boolean;
  /** The configured secret (or fallback) */
  secret: string;
  /** Warning message if applicable */
  warning?: string;
}

/**
 * Get the JWT secret used for token verification.
 *
 * Behavior:
 * - In production: validates secret strength and FAILS FAST at startup if weak/missing.
 * - In development: generates a secure random fallback and logs a warning.
 * - This prevents the server from running with a weak secret in production,
 *   while allowing development workflows to proceed.
 */

/** Stable development/test fallback so tokens stay verifiable across restarts of one process. */
let _devFallbackSecret: string | null = null;

export function getJwtSecretStatus(): JwtSecretStatus {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret || secret === 'secret' || secret.length < 32) {
    if (isProduction) {
      // Fail fast in production — this is a deployment configuration error.
      const message = '[auth] JWT_SECRET is weak or missing in production mode. ' +
        'Set JWT_SECRET to a string of at least 32 characters. ' +
        'Generate with: node -e "console.log(JSON.stringify(require(\'crypto\').randomBytes(32).toString(\'hex\')))"';
      console.error(message);
      throw new Error(message);
    }

    // In development, generate a secure random fallback (stable per process).
    if (!_devFallbackSecret) {
      console.warn(
        '[auth] JWT_SECRET is weak or missing. Generating secure development fallback. ' +
        'Set JWT_SECRET for production use.',
      );
      _devFallbackSecret = generateRandomHex(32);
    }
    return {
      strong: true,
      secret: _devFallbackSecret,
      warning: 'Using generated development JWT secret. Set JWT_SECRET for production.',
    };
  }

  return { strong: true, secret };
}

/**
 * SINGLE source of truth for the JWT signing/verification secret (S5).
 *
 * Every consumer (token issuance in auth.service, verification here) must go
 * through this function — duplicated weak-secret handling elsewhere has already
 * caused drift between sign and verify paths. The current environment is read
 * on every call so a rotated JWT_SECRET takes effect immediately; the
 * development fallback is generated once per process.
 */
export function getJwtSecret(): string {
  const status = getJwtSecretStatus();
  if (!status.strong || !status.secret) {
    throw new AppError('JWT secret is not securely configured. Contact your administrator.', 500);
  }
  return status.secret;
}

export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const header = req.headers['authorization'];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: JWT_ALGORITHMS }) as {
      userId: string;
      roles?: string[];
      typ?: string;
    };
    // A `typ: 'pre_auth'` token is intentionally not yet authorized (e.g. pending
    // approval or an incomplete login step). Returning the same message as a
    // missing token would let an attacker probe which tokens are provisioned but
    // not yet active. Use a distinct message so provisioned-but-unauthorized
    // tokens are distinguishable from a missing/unknown token.
    if (decoded.typ === 'pre_auth') {
      return next(new AppError('Authentication pending approval', 401));
    }
    req.userId = decoded.userId;
    // Keep the token roles on the request for informational purposes only —
    // role *authorization* below re-reads current roles from the database.
    req.userRoles = decoded.roles ?? [];
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Invalid or expired token', 401));
  }
};

// ==================== Current-role authorization (S4) ====================

interface CurrentUserRolesEntry {
  fetchedAt: number;
  roles: string[];
  isActive: boolean;
}

/**
 * SECURITY FIX (S4): `authorize()` must not trust the roles embedded in the
 * JWT — those are frozen at issuance time, so a role removal only takes effect
 * after token expiry. Current roles are read from the database instead, with a
 * small in-memory cache to keep per-request overhead bounded. The cache TTL is
 * deliberately short; call `invalidateUserAuthorizationCache()` right after
 * changing a user's roles or active state for immediate effect.
 */
const USER_ROLES_CACHE_TTL_MS = 30_000;
const currentUserRolesCache = new Map<string, CurrentUserRolesEntry>();

/** Drop cached current-role state for one user, or all users when omitted. */
export function invalidateUserAuthorizationCache(userId?: string): void {
  if (userId === undefined) {
    currentUserRolesCache.clear();
  } else {
    currentUserRolesCache.delete(userId);
  }
}

async function getCurrentUserRoles(userId: string): Promise<CurrentUserRolesEntry> {
  const now = Date.now();
  const cached = currentUserRolesCache.get(userId);
  if (cached && now - cached.fetchedAt < USER_ROLES_CACHE_TTL_MS) {
    return cached;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, userRoles: { select: { roleName: true } } },
  });
  if (!user) {
    // Unknown user: do not cache — a just-created user must be usable at once.
    return { fetchedAt: now, roles: [], isActive: false };
  }

  const entry: CurrentUserRolesEntry = {
    fetchedAt: now,
    roles: (user.userRoles ?? []).map((ur) => ur.roleName),
    isActive: user.isActive,
  };
  currentUserRolesCache.set(userId, entry);
  return entry;
}

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    // SECURITY FIX (Problem 7 / Issue #7): Use `next(error)` instead of `throw`
    // to be consistent with `authenticate()` and other Express middleware.  This
    // ensures proper error propagation through the middleware chain and makes
    // behaviour predictable for wrappers and test harnesses.
    if (!req.userId) {
      return next(new AppError('Authentication required', 401));
    }

    const userId = req.userId;
    void (async () => {
      let current: CurrentUserRolesEntry;
      try {
        current = await getCurrentUserRoles(userId);
      } catch (error) {
        // Fail closed: if current roles cannot be determined, do not fall back
        // to the (possibly stale) token roles.
        console.error('[auth] Failed to load current roles for authorization:', error);
        return next(new AppError('Authorization unavailable', 503));
      }

      if (!current.isActive) {
        return next(new AppError('Account is disabled', 403));
      }

      // Keep the request view consistent with what was actually enforced.
      req.userRoles = current.roles;

      if (roles.length && !roles.some((role) => current.roles.includes(role))) {
        return next(new AppError('Insufficient permissions', 403));
      }

      next();
    })();
  };
};

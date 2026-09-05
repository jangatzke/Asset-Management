import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt, { Algorithm } from 'jsonwebtoken';
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
let _jwtSecretCache: string | null = null;
let _jwtSecretStatus: JwtSecretStatus | null = null;

export function getJwtSecretStatus(): JwtSecretStatus {
  if (_jwtSecretStatus) return _jwtSecretStatus;

  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret || secret === 'secret' || secret.length < 32) {
    if (isProduction) {
      // Fail fast in production — this is a deployment configuration error.
      const message = '[auth] JWT_SECRET is weak or missing in production mode. ' +
        'Set JWT_SECRET to a string of at least 32 characters. ' +
        'Generate with: node -e "console.log(JSON.stringify(require(\'crypto\').randomBytes(32).toString(\'hex\')))"';
      console.error(message);
      // Do NOT set _jwtSecretStatus before throwing — the cache must not persist a failed state.
      throw new Error(message);
    }

    // In development, generate a secure random fallback
    console.warn(
      '[auth] JWT_SECRET is weak or missing. Generating secure development fallback. ' +
      'Set JWT_SECRET for production use.',
    );
    _jwtSecretStatus = {
      strong: true,
      secret: generateRandomHex(32),
      warning: 'Using generated development JWT secret. Set JWT_SECRET for production.',
    };
    _jwtSecretCache = _jwtSecretStatus.secret;
    return _jwtSecretStatus;
  }

  _jwtSecretStatus = { strong: true, secret };
  _jwtSecretCache = secret;
  return _jwtSecretStatus;
}

function getJwtSecret(): string {
  if (!_jwtSecretCache) {
    const status = getJwtSecretStatus();
    if (!status.strong || !status.secret) {
      throw new AppError('JWT secret is not securely configured. Contact your administrator.', 500);
    }
    _jwtSecretCache = status.secret;
  }
  return _jwtSecretCache;
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
    req.userRoles = decoded.roles ?? [];
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Invalid or expired token', 401));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    // SECURITY FIX (Problem 7 / Issue #7): Use `next(error)` instead of `throw`
    // to be consistent with `authenticate()` and other Express middleware.  This
    // ensures proper error propagation through the middleware chain and makes
    // behaviour predictable for wrappers and test harnesses.
    if (!req.userId) {
      return next(new AppError('Authentication required', 401));
    }

    if (roles.length && !roles.some(role => req.userRoles?.includes(role))) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

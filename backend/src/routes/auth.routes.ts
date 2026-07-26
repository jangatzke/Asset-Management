import { CookieOptions, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/entityAuth';
import { authService } from '../services/auth.service';
import { oidcService } from '../services/oidc.service';

export const authRouter = Router();

const REFRESH_COOKIE_NAME = process.env.REFRESH_TOKEN_COOKIE_NAME || 'refreshToken';

function requestContext(req: AuthRequest) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

function readCookie(req: AuthRequest, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rawValue.join('='));
  }
  return undefined;
}

function refreshCookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'test',
    sameSite: process.env.REFRESH_TOKEN_SAME_SITE === 'strict' ? 'strict' : 'lax',
    path: '/api/v1/auth',
    ...(expires ? { expires } : {}),
  };
}

function attachRefreshCookie(res: Response, result: { refreshToken?: string; refreshTokenExpiresAt?: Date }) {
  if (result.refreshToken && result.refreshTokenExpiresAt) {
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
  }
}

function isAuthenticatedResult(result: { state?: string; refreshToken?: string; refreshTokenExpiresAt?: Date }): result is typeof result & { state: 'authenticated' } {
  return result.state === 'authenticated' || Boolean(result.refreshToken && result.refreshTokenExpiresAt);
}

function stripRefreshToken<T extends { refreshToken?: string; refreshTokenExpiresAt?: Date }>(result: T): Omit<T, 'refreshToken'> {
  const { refreshToken: _refreshToken, ...safeResult } = result;
  return safeResult;
}

const authRateLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: () => Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many authentication attempts. Please try again later.' } },
  skip: () => process.env.NODE_ENV === 'test' && process.env.ENABLE_AUTH_RATE_LIMIT_IN_TESTS !== 'true',
});

authRouter.get('/has-admin', async (_req, res, next) => {
  try {
    const hasAdmin = await authService.hasAdminUsers();
    res.json({ hasAdmin });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/create-first-admin', authRateLimiter, async (req, res, next) => {
  try {
    const result = await authService.createFirstAdmin(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    // Check if local login is enabled
    const localLoginEnabled = await oidcService.isLocalLoginEnabled();
    if (!localLoginEnabled) {
      return res.status(403).json({ error: { message: 'Local login is disabled. Please use Entra ID login.' } });
    }
    const result = await authService.login(req.body, requestContext(req));
    if (isAuthenticatedResult(result)) {
      attachRefreshCookie(res, result);
      return res.json(stripRefreshToken(result));
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login/mfa', authRateLimiter, async (req, res, next) => {
  try {
    const result = await authService.verifyMfaLogin(req.body.preAuthToken ?? req.body.challenge, req.body.token, requestContext(req));
    attachRefreshCookie(res, result);
    return res.json(stripRefreshToken(result));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/preauth/mfa/setup', authRateLimiter, async (req, res, next) => {
  try {
    res.json(await authService.beginPreAuthMfaEnrollment(req.body.preAuthToken));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/preauth/mfa/confirm', authRateLimiter, async (req, res, next) => {
  try {
    const result = await authService.confirmPreAuthMfaEnrollment(req.body.preAuthToken, req.body.token, requestContext(req));
    attachRefreshCookie(res, result);
    res.json(stripRefreshToken(result));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/preauth/password/change', authRateLimiter, async (req, res, next) => {
  try {
    const result = await authService.changeExpiredPassword(req.body.preAuthToken, req.body.newPassword, requestContext(req));
    if (isAuthenticatedResult(result)) {
      attachRefreshCookie(res, result);
      return res.json(stripRefreshToken(result));
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// OIDC endpoints
authRouter.get('/oidc/authorize', authRateLimiter, async (_req, res, next) => {
  try {
    res.json(await oidcService.getAuthorizationUrl());
  } catch (error) {
    next(error);
  }
});

authRouter.post('/oidc/callback', authRateLimiter, async (req, res, next) => {
  try {
    const { code, state } = req.body;
    const result = await oidcService.handleCallback(code, state, undefined, requestContext(req));
    attachRefreshCookie(res, result);
    res.json(stripRefreshToken(result));
  } catch (error) {
    next(error);
  }
});

authRouter.get('/oidc/config', authenticate, async (_req, res, next) => {
  try {
    const config = await oidcService.getConfig();
    // Don't expose clientSecret
    const { clientSecret, ...safeConfig } = config;
    res.json(safeConfig);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req: AuthRequest, res, next) => {
  try {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
    const result = await authService.refreshToken(refreshToken ?? '', requestContext(req));
    attachRefreshCookie(res, result);
    res.json(stripRefreshToken(result));
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.userId!);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

authRouter.patch('/me/preferences', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { language, darkMode } = req.body;
    const user = await authService.updatePreferences(req.userId!, { language, darkMode });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/me/change-password', authenticate, authRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changeOwnPassword(req.userId!, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/me/mfa/setup', authenticate, authRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    res.json(await authService.beginMfaEnrollment(req.userId!));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/me/mfa/confirm', authenticate, authRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    res.json(await authService.confirmMfaEnrollment(req.userId!, req.body.token));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/me/mfa/disable', authenticate, authRateLimiter, async (req: AuthRequest, res, next) => {
  try {
    res.json(await authService.disableMfa(req.userId!, req.body.token));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req: AuthRequest, res, next) => {
  try {
    await authService.logout(readCookie(req, REFRESH_COOKIE_NAME) ?? null, requestContext(req));
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

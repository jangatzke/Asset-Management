import { CookieOptions, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authService } from '../services/auth.service';
import { oidcService } from '../services/oidc.service';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

export const authRouter = Router();

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(1).max(1_024);
const preAuthTokenSchema = z.string().min(1).max(4_096);
const mfaTokenSchema = z.string().trim().regex(/^\d{6,8}$/, 'Invalid MFA verification code');
const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().max(50).optional(),
  organizationUnitId: z.string().uuid().optional(),
}).strict();
const loginSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
const mfaLoginSchema = z.object({
  preAuthToken: preAuthTokenSchema.optional(),
  challenge: preAuthTokenSchema.optional(),
  token: mfaTokenSchema,
}).strict().refine((data) => Boolean(data.preAuthToken ?? data.challenge), { message: 'preAuthToken is required', path: ['preAuthToken'] });
const preAuthTokenOnlySchema = z.object({ preAuthToken: preAuthTokenSchema }).strict();
const preAuthMfaConfirmSchema = z.object({ preAuthToken: preAuthTokenSchema, token: mfaTokenSchema }).strict();
const preAuthPasswordChangeSchema = z.object({ preAuthToken: preAuthTokenSchema, newPassword: passwordSchema }).strict();
const oidcCallbackSchema = z.object({ code: z.string().min(1).max(8_192), state: z.string().min(1).max(4_096) }).strict();
const preferencesSchema = z.object({ language: z.enum(['de', 'en']).optional(), darkMode: z.boolean().optional() }).strict().refine((data) => data.language !== undefined || data.darkMode !== undefined, { message: 'At least one preference is required' });
const changePasswordSchema = z.object({ currentPassword: passwordSchema, newPassword: passwordSchema }).strict();
const mfaTokenOnlySchema = z.object({ token: mfaTokenSchema }).strict();

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

function useSecureRefreshCookie(): boolean {
  if (process.env.REFRESH_TOKEN_COOKIE_SECURE === 'true') return true;
  if (process.env.REFRESH_TOKEN_COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function refreshCookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: useSecureRefreshCookie(),
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

// The /refresh endpoint is called far more often than login (token renewal on
// every expired access token), so it gets its own, less restrictive limiter to
// prevent brute-force / replay of refresh tokens without breaking normal usage.
const refreshRateLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: () => Number(process.env.REFRESH_RATE_LIMIT_MAX || 120),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many token refresh attempts. Please try again later.' } },
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

authRouter.post('/create-first-admin', authRateLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.createFirstAdmin(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/register', authRateLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authRateLimiter, validateBody(loginSchema), async (req, res, next) => {
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

authRouter.post('/login/mfa', authRateLimiter, validateBody(mfaLoginSchema), async (req, res, next) => {
  try {
    const result = await authService.verifyMfaLogin(req.body.preAuthToken ?? req.body.challenge, req.body.token, requestContext(req));
    attachRefreshCookie(res, result);
    return res.json(stripRefreshToken(result));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/preauth/mfa/setup', authRateLimiter, validateBody(preAuthTokenOnlySchema), async (req, res, next) => {
  try {
    res.json(await authService.beginPreAuthMfaEnrollment(req.body.preAuthToken));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/preauth/mfa/confirm', authRateLimiter, validateBody(preAuthMfaConfirmSchema), async (req, res, next) => {
  try {
    const result = await authService.confirmPreAuthMfaEnrollment(req.body.preAuthToken, req.body.token, requestContext(req));
    attachRefreshCookie(res, result);
    res.json(stripRefreshToken(result));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/preauth/password/change', authRateLimiter, validateBody(preAuthPasswordChangeSchema), async (req, res, next) => {
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

authRouter.post('/oidc/callback', authRateLimiter, validateBody(oidcCallbackSchema), async (req, res, next) => {
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

authRouter.post('/refresh', refreshRateLimiter, async (req: AuthRequest, res, next) => {
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

authRouter.patch('/me/preferences', authenticate, validateBody(preferencesSchema), async (req: AuthRequest, res, next) => {
  try {
    const { language, darkMode } = req.body;
    const user = await authService.updatePreferences(req.userId!, { language, darkMode });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/me/change-password', authenticate, authRateLimiter, validateBody(changePasswordSchema), async (req: AuthRequest, res, next) => {
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

authRouter.post('/me/mfa/confirm', authenticate, authRateLimiter, validateBody(mfaTokenOnlySchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await authService.confirmMfaEnrollment(req.userId!, req.body.token));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/me/mfa/disable', authenticate, authRateLimiter, validateBody(mfaTokenOnlySchema), async (req: AuthRequest, res, next) => {
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

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authService } from '../services/auth.service';
import { oidcService } from '../services/oidc.service';
import crypto from 'crypto';

export const authRouter = Router();

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
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// OIDC endpoints
authRouter.get('/oidc/authorize', authRateLimiter, async (_req, res, next) => {
  try {
    const state = crypto.randomUUID();
    // Store state in session or cache - for now use query param approach
    const authorizeUrl = await oidcService.getAuthorizationUrl(state);
    // Redirect with state stored
    res.json({ authorizeUrl, state });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/oidc/callback', authRateLimiter, async (req, res, next) => {
  try {
    const { code, state, code_verifier } = req.body;
    const result = await oidcService.handleCallback(code, state, code_verifier);
    res.json(result);
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

authRouter.post('/refresh', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await authService.refreshToken(req.userId!);
    res.json(result);
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

authRouter.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await authService.logout(req.userId!);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});
